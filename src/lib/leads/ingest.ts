import type { SupabaseClient } from '@supabase/supabase-js';

import { findOrCreateContact, resolveAuditUserId } from '@/lib/api/v1/contacts';
import { resolveConversationByPhone } from '@/lib/whatsapp/resolve-conversation';
import { sendMessageToConversation } from '@/lib/whatsapp/send-message';
import { decrypt } from '@/lib/whatsapp/encryption';

import { normalizeLeadPhone } from './phone';
import {
  hasLeadIdentity,
  normalizeProviderPayload,
  type LeadProvider,
  type NormalizedLead,
} from './providers';
import { verifyHmacSignature } from './verify';

/**
 * Lead ingestion pipeline.
 *
 * A public, unauthenticated caller hits POST /api/leads/ingest/[key]
 * with a provider payload. This module turns it into Almanac state:
 *
 *   payload → normalize → phone → contact upsert (dedupe by phone) →
 *   lead row → deal in the source's default stage → instant WhatsApp
 *   template reply (speed-to-lead).
 *
 * The route runs it with the service-role client (the caller has no
 * session); every write is explicitly scoped by `account_id`.
 *
 * Nothing here throws for provider/content problems — those become a
 * lead row with status `invalid`/`duplicate` and a 200 to the caller
 * (providers retry non-2xx, so a 422 would just duplicate the noise).
 * Only programmer errors (DB down) propagate.
 */

export interface LeadSourceRow {
  id: string;
  account_id: string;
  name: string;
  provider: LeadProvider;
  verify_secret: string | null;
  is_active: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  auto_reply_template_name: string | null;
  assign_to_profile_id: string | null;
  field_mapping: Record<string, string>;
}

export interface IngestResult {
  ok: true;
  lead_id: string;
  contact_id: string | null;
  deduped: boolean;
  deal_id: string | null;
  reply_sent: boolean;
}

export interface IngestInput {
  db: SupabaseClient;
  source: LeadSourceRow;
  /** Raw request body text — kept raw so HMAC verification is exact. */
  rawBody: string;
  /** Parsed payload (JSON, or form fields for IndiaMART). */
  payload: Record<string, unknown>;
  /** Value of the `X-Signature` header, if the provider sent one. */
  signatureHeader: string | null;
}

/** Decrypt the source's verify_secret, tolerating plaintext legacy rows. */
function sourceSecret(source: LeadSourceRow): string | null {
  if (!source.verify_secret) return null;
  try {
    return decrypt(source.verify_secret);
  } catch {
    // Not encrypted (hand-inserted row) — use as-is.
    return source.verify_secret;
  }
}

export async function ingestLead(input: IngestInput): Promise<IngestResult> {
  const { db, source, rawBody, payload, signatureHeader } = input;
  const accountId = source.account_id;

  // ---- 1. HMAC gate (generic webhook provider only) -----------------
  const secret = sourceSecret(source);
  if (secret && !verifyHmacSignature(rawBody, signatureHeader, secret)) {
    // Auth failure, not a content problem: the one case where we do
    // NOT 200 — a wrong secret must be loud, not silently recorded.
    throw new IngestAuthError('Invalid signature');
  }

  // ---- 2. Normalize --------------------------------------------------
  const normalized: NormalizedLead = normalizeProviderPayload(
    source.provider,
    payload,
    source.field_mapping ?? {}
  );
  const phone = normalizeLeadPhone(normalized.phone);

  const auditUserId = await resolveAuditUserId(db, accountId);

  // ---- 3. No usable identity → record as invalid, still 200 ----------
  if (!phone && !hasLeadIdentity(normalized)) {
    const leadId = await insertLead(db, source, null, normalized, null, {
      status: 'invalid',
    });
    return {
      ok: true,
      lead_id: leadId,
      contact_id: null,
      deduped: false,
      deal_id: null,
      reply_sent: false,
    };
  }

  // ---- 4. Contact upsert (dedupe by phone) ---------------------------
  let contactId: string | null = null;
  let deduped = false;
  if (phone) {
    const { id, created } = await findOrCreateContact(
      db,
      accountId,
      auditUserId,
      {
        phone: `+${phone}`,
        name: normalized.name,
        email: normalized.email,
      }
    );
    contactId = id;
    deduped = !created;
  }

  // ---- 5. Lead row ----------------------------------------------------
  const leadId = await insertLead(db, source, contactId, normalized, phone, {
    status: deduped ? 'duplicate' : 'new',
    deduped,
  });

  // ---- 6. Deal in the default stage -----------------------------------
  let dealId: string | null = null;
  if (source.default_pipeline_id && source.default_stage_id && contactId) {
    dealId = await createDeal(db, source, auditUserId, contactId, normalized);
    if (dealId) {
      await db.from('leads').update({ deal_id: dealId }).eq('id', leadId);
    }
  }

  // ---- 7. Instant WhatsApp reply — best effort, never fails ingest --
  let replySent = false;
  if (source.auto_reply_template_name && phone) {
    try {
      replySent = await sendInstantReply(
        db,
        accountId,
        source.auto_reply_template_name,
        `+${phone}`,
        normalized.name
      );
    } catch (err) {
      console.error('[leads/ingest] instant reply failed:', err);
    }
    if (replySent) {
      await db.from('leads').update({ reply_sent: true }).eq('id', leadId);
    }
  }

  return {
    ok: true,
    lead_id: leadId,
    contact_id: contactId,
    deduped,
    deal_id: dealId,
    reply_sent: replySent,
  };
}

async function insertLead(
  db: SupabaseClient,
  source: LeadSourceRow,
  contactId: string | null,
  normalized: NormalizedLead,
  phone: string | null,
  opts: { status: string; deduped?: boolean }
): Promise<string> {
  const { data, error } = await db
    .from('leads')
    .insert({
      lead_source_id: source.id,
      account_id: source.account_id,
      contact_id: contactId,
      name: normalized.name,
      phone,
      email: normalized.email,
      city: normalized.city,
      message: normalized.message,
      raw_payload: normalized.extra,
      status: opts.status,
      deduped: opts.deduped ?? false,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[leads/ingest] lead insert error:', error);
    throw new Error('Failed to record lead');
  }
  return data.id as string;
}

async function createDeal(
  db: SupabaseClient,
  source: LeadSourceRow,
  auditUserId: string,
  contactId: string,
  normalized: NormalizedLead
): Promise<string | null> {
  // Guard: the stage must belong to the pipeline (a deleted pipeline
  // nulls default_pipeline_id, but a stage could be re-pointed).
  const { data: stage } = await db
    .from('pipeline_stages')
    .select('id, pipeline_id')
    .eq('id', source.default_stage_id)
    .maybeSingle();
  if (!stage || stage.pipeline_id !== source.default_pipeline_id) {
    console.error(
      '[leads/ingest] default stage not in default pipeline; skipping deal'
    );
    return null;
  }

  const title = normalized.name
    ? `${normalized.name} — ${source.name}`
    : `Lead — ${source.name}`;

  const { data, error } = await db
    .from('deals')
    .insert({
      account_id: source.account_id,
      user_id: auditUserId,
      pipeline_id: source.default_pipeline_id,
      stage_id: source.default_stage_id,
      contact_id: contactId,
      title,
      value: 0,
      currency: 'INR',
      notes: normalized.message,
      assigned_to: source.assign_to_profile_id,
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[leads/ingest] deal insert error:', error);
    return null;
  }
  return data.id as string;
}

/**
 * Fire the source's auto-reply template at the lead. Reuses the exact
 * send core the public API uses (resolve → send → persist), so the
 * message lands in the shared inbox like any other outbound message.
 *
 * Body params: `{{1}}` gets the lead's first name when the template
 * uses one; templates without placeholders are sent bare (Meta
 * rejects surplus params).
 */
async function sendInstantReply(
  db: SupabaseClient,
  accountId: string,
  templateName: string,
  phoneE164: string,
  name: string | null
): Promise<boolean> {
  const { data: template } = await db
    .from('message_templates')
    .select('body_text')
    .eq('account_id', accountId)
    .eq('name', templateName)
    .eq('status', 'Approved')
    .maybeSingle();

  const resolved = await resolveConversationByPhone(
    db,
    accountId,
    phoneE164,
    name
  );

  const firstName = (name ?? '').trim().split(/\s+/)[0] || 'there';
  const params =
    template &&
    typeof template.body_text === 'string' &&
    template.body_text.includes('{{1}}')
      ? [firstName]
      : [];

  await sendMessageToConversation(db, accountId, {
    conversationId: resolved.conversationId,
    messageType: 'template',
    templateName,
    templateParams: params,
  });
  return true;
}

/** Thrown only for the HMAC gate — the route maps it to 401. */
export class IngestAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestAuthError';
  }
}

/**
 * Parse the raw ingest body. JSON first (preferred), then
 * `application/x-www-form-urlencoded` form fields (what IndiaMART
 * posts). Returns null when the body is empty or unusable.
 */
export function parseIngestBody(
  rawBody: string,
  contentType: string | null
): Record<string, unknown> | null {
  const text = rawBody.trim();
  if (!text) return null;

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not JSON — try form fields below
  }

  if (
    !contentType ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const params = new URLSearchParams(text);
      const obj: Record<string, unknown> = {};
      params.forEach((value, key) => {
        obj[key] = value;
      });
      return Object.keys(obj).length > 0 ? obj : null;
    } catch {
      return null;
    }
  }

  return null;
}
