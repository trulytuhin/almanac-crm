// ============================================================
// POST /api/leads/ingest/[key] — public lead-ingest endpoint.
//
// Providers (IndiaMART, JustDial, Google Ads, Meta forwarders, or any
// generic webhook) POST their lead payload to the per-source URL:
//
//   POST https://<host>/api/leads/ingest/<webhook_key>
//
// The `webhook_key` is a 256-bit secret minted at source creation —
// the URL *is* the credential, so treat it like one.
//
// Bodies: JSON (preferred) or `application/x-www-form-urlencoded`
// (what IndiaMART posts). Generic-webhook sources may also set a
// `verify_secret` on the source; then `X-Signature: sha256=<hex>`
// over the raw body is required (401 otherwise).
//
// Always 200 on content problems (providers retry non-2xx, so a 422
// would just duplicate the noise): unusable payloads are recorded as
// `invalid` leads. Unknown/disabled keys 404; bad signatures 401.
//
// Rate limit: 60/min per key (generous for lead bursts, bounded
// against a stuck retry loop).
// ============================================================

import { NextResponse } from 'next/server';

import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit';

import { supabaseAdmin } from '@/lib/leads/admin';
import {
  ingestLead,
  parseIngestBody,
  IngestAuthError,
  type LeadSourceRow,
} from '@/lib/leads/ingest';
import type { LeadProvider } from '@/lib/leads/providers';

const LEAD_SOURCE_COLUMNS =
  'id, account_id, name, provider, verify_secret, is_active, default_pipeline_id, default_stage_id, auto_reply_template_name, assign_to_profile_id, field_mapping';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  const limited = checkRateLimit(`lead-ingest:${key}`, RATE_LIMITS.leadIngest);
  if (!limited.success) return rateLimitResponse(limited);

  const db = supabaseAdmin();

  const { data: source, error } = await db
    .from('lead_sources')
    .select(LEAD_SOURCE_COLUMNS)
    .eq('webhook_key', key)
    .maybeSingle();

  if (error || !source) {
    return NextResponse.json(
      { ok: false, error: 'Unknown lead source' },
      { status: 404 }
    );
  }
  if (!source.is_active) {
    return NextResponse.json(
      { ok: false, error: 'Lead source is disabled' },
      { status: 404 }
    );
  }

  const rawBody = await request.text();
  const payload = parseIngestBody(rawBody, request.headers.get('content-type'));
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: 'Request body must be a JSON object or form fields' },
      { status: 400 }
    );
  }

  try {
    const result = await ingestLead({
      db,
      source: {
        ...(source as Record<string, unknown>),
        provider: source.provider as LeadProvider,
        field_mapping: (source.field_mapping ?? {}) as Record<string, string>,
      } as LeadSourceRow,
      rawBody,
      payload,
      signatureHeader: request.headers.get('x-signature'),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IngestAuthError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 401 }
      );
    }
    console.error('[api/leads/ingest] ingest error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
