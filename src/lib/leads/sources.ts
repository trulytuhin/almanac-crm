import { randomBytes } from 'node:crypto';

import { encrypt } from '@/lib/whatsapp/encryption';

import { LEAD_PROVIDERS, type LeadProvider } from './providers';

/**
 * Shared shapes + validation for the lead-sources dashboard API.
 * The `webhook_key` is a bearer secret: it is returned in plaintext
 * exactly once (on create) and never again — list/detail responses
 * strip it, mirroring the `/api/v1/webhooks` secret-once contract.
 */

export const LEAD_SOURCE_PUBLIC_COLUMNS =
  'id, account_id, name, provider, is_active, default_pipeline_id, default_stage_id, auto_reply_template_name, assign_to_profile_id, field_mapping, created_at, updated_at';

export interface LeadSourceInput {
  name: string;
  provider: LeadProvider;
  is_active: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  auto_reply_template_name: string | null;
  assign_to_profile_id: string | null;
  verify_secret: string | null;
  field_mapping: Record<string, string>;
}

export function isLeadProvider(value: unknown): value is LeadProvider {
  return LEAD_PROVIDERS.some((p) => p.value === value);
}

/** Mint a fresh webhook key: 256 bits, URL-safe. */
export function generateWebhookKey(): string {
  return randomBytes(32).toString('base64url');
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Validate a create/update body. Returns the normalized input or a
 * human-readable error for a 400. `verify_secret` is encrypted here so
 * no route ever persists it in plaintext.
 */
export function validateLeadSourceInput(
  body: Record<string, unknown>
): { ok: true; input: LeadSourceInput } | { ok: false; error: string } {
  const name = asString(body.name);
  if (!name) return { ok: false, error: "'name' is required" };
  if (name.length > 120)
    return { ok: false, error: "'name' is too long (max 120)" };

  if (!isLeadProvider(body.provider)) {
    return {
      ok: false,
      error: `'provider' must be one of: ${LEAD_PROVIDERS.map((p) => p.value).join(', ')}`,
    };
  }

  const templateName = asString(body.auto_reply_template_name);
  if (templateName && templateName.length > 120) {
    return { ok: false, error: "'auto_reply_template_name' is too long" };
  }

  const fieldMapping: Record<string, string> = {};
  if (body.field_mapping !== undefined && body.field_mapping !== null) {
    if (
      typeof body.field_mapping !== 'object' ||
      Array.isArray(body.field_mapping)
    ) {
      return { ok: false, error: "'field_mapping' must be a JSON object" };
    }
    for (const [k, v] of Object.entries(
      body.field_mapping as Record<string, unknown>
    )) {
      if (typeof v !== 'string' || !v.trim()) {
        return {
          ok: false,
          error: `'field_mapping.${k}' must be a non-empty string`,
        };
      }
      fieldMapping[k] = v.trim();
    }
  }

  const verifySecret = asString(body.verify_secret);

  return {
    ok: true,
    input: {
      name,
      provider: body.provider,
      is_active: body.is_active !== false,
      default_pipeline_id: asString(body.default_pipeline_id),
      default_stage_id: asString(body.default_stage_id),
      auto_reply_template_name: templateName,
      assign_to_profile_id: asString(body.assign_to_profile_id),
      verify_secret: verifySecret ? encrypt(verifySecret) : null,
      field_mapping: fieldMapping,
    },
  };
}

/** Strip secrets before a row leaves the API. */
export function serializeLeadSource(row: Record<string, unknown>) {
  const rest = { ...row };
  delete rest.webhook_key;
  delete rest.verify_secret;
  return rest;
}
