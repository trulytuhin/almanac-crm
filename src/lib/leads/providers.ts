/**
 * Provider payload normalizers for lead ingestion.
 *
 * Each normalizer maps one provider's payload shape onto the shared
 * `NormalizedLead`. Payloads are defensively read — providers rename
 * fields and nest things differently across API versions, so every
 * field checks a list of aliases and everything unknown lands in
 * `extra` (persisted on the lead row for audit/reprocessing).
 */

export type LeadProvider =
  'indiamart' | 'justdial' | 'google_ads' | 'meta' | 'webhook';

export const LEAD_PROVIDERS: { value: LeadProvider; label: string }[] = [
  { value: 'indiamart', label: 'IndiaMART' },
  { value: 'justdial', label: 'JustDial' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'webhook', label: 'Generic webhook' },
];

export interface NormalizedLead {
  name: string | null;
  /** Raw phone as the provider sent it — normalized later. */
  phone: string | null;
  email: string | null;
  city: string | null;
  /** The enquiry / requirement text. */
  message: string | null;
  /** Everything else, kept for audit. */
  extra: Record<string, unknown>;
}

type Payload = Record<string, unknown>;

function str(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** First non-empty string among the alias keys. */
function pick(payload: Payload, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = str(payload[key]);
    if (value) return value;
  }
  return null;
}

function base(extra: Payload): NormalizedLead {
  return {
    name: null,
    phone: null,
    email: null,
    city: null,
    message: null,
    extra,
  };
}

/**
 * IndiaMART CRM-integration POST (form-encoded). Field names follow
 * IndiaMART's lead-notification API: SENDERNAME / SENDEREMAIL / MOB /
 * ENQ_MESSAGE / ENQ_CITY / ENQ_STATE / ENQ_PRODUCT …
 */
function normalizeIndiaMart(payload: Payload): NormalizedLead {
  const lead = base(payload);
  lead.name = pick(payload, 'SENDERNAME', 'sender_name', 'name', 'SENDER_NAME');
  lead.phone = pick(payload, 'MOB', 'MOBILE', 'mob', 'mobile', 'GLUSR_MOBILE');
  lead.email = pick(
    payload,
    'SENDEREMAIL',
    'sender_email',
    'email',
    'SENDER_EMAIL'
  );
  lead.city = pick(payload, 'ENQ_CITY', 'enq_city', 'city', 'CITY');
  const product = pick(payload, 'ENQ_PRODUCT', 'PRODUCT_NAME', 'product_name');
  const message = pick(
    payload,
    'ENQ_MESSAGE',
    'enq_message',
    'message',
    'REQUIREMENT'
  );
  lead.message =
    product && message ? `${product}: ${message}` : (message ?? product);
  return lead;
}

/**
 * JustDial lead notification. Field names vary by JustDial's API
 * version; aliases cover the common shapes.
 */
function normalizeJustDial(payload: Payload): NormalizedLead {
  const lead = base(payload);
  lead.name = pick(payload, 'name', 'lead_name', 'customer_name', 'NAME');
  lead.phone = pick(
    payload,
    'mobile',
    'lead_mobile',
    'phone',
    'MOBILE',
    'PHONE'
  );
  lead.email = pick(payload, 'email', 'lead_email', 'EMAIL');
  lead.city = pick(payload, 'city', 'lead_city', 'CITY');
  lead.message = pick(
    payload,
    'requirement',
    'message',
    'enquiry',
    'REQUIREMENT'
  );
  return lead;
}

/**
 * Google Ads lead-form webhook. Handles both the flattened Zapier-style
 * shape (full_name / phone_number / email / city) and Google's native
 * `user_column_data: [{ column_name, string_value }]` shape.
 */
function normalizeGoogleAds(payload: Payload): NormalizedLead {
  const lead = base(payload);

  const columns = payload['user_column_data'];
  const flat: Payload = { ...payload };
  if (Array.isArray(columns)) {
    for (const col of columns) {
      if (col && typeof col === 'object') {
        const c = col as Payload;
        const key = str(c['column_name']);
        const value = str(c['string_value']);
        if (key && value) flat[key.toLowerCase()] = value;
      }
    }
  }

  lead.name = pick(flat, 'full_name', 'full name', 'name', 'user_name');
  lead.phone = pick(
    flat,
    'phone_number',
    'phone number',
    'phone',
    'mobile',
    'user_phone'
  );
  lead.email = pick(flat, 'email', 'user_email');
  lead.city = pick(flat, 'city', 'user_city', 'postal_code', 'zip');
  // Anything that isn't identity/address is the requirement: join the
  // remaining custom answers so nothing the prospect typed is lost.
  const known = new Set([
    'full_name',
    'full name',
    'name',
    'user_name',
    'phone_number',
    'phone number',
    'phone',
    'mobile',
    'user_phone',
    'email',
    'user_email',
    'city',
    'user_city',
    'postal_code',
    'zip',
    'lead_id',
    'form_id',
    'campaign_id',
    'campaign_name',
    'adgroup_id',
    'creative_id',
    'google_key',
    'user_column_data',
  ]);
  const answers = Object.entries(flat)
    .filter(([k, v]) => !known.has(k.toLowerCase()) && str(v))
    .map(([k, v]) => `${k}: ${str(v)}`);
  lead.message = answers.length > 0 ? answers.join('\n') : null;
  return lead;
}

/**
 * Meta leadgen. A raw Meta webhook `value` only carries IDs
 * (leadgen_id / form_id / page_id) — the field data needs a Graph API
 * fetch with the page token, which is app-level subscription config,
 * not something this endpoint can do with the lead source's key alone.
 *
 * So this normalizer accepts the *enriched* shape — either the Graph
 * API `/<leadgen_id>` response (`field_data: [{name, values}]`) or a
 * forwarder that already resolved it. Point the Meta app webhook at a
 * tiny forwarder, or use the generic `webhook` provider. See
 * docs/lead-ingestion.md.
 */
function normalizeMeta(payload: Payload): NormalizedLead {
  const lead = base(payload);

  const fieldData = payload['field_data'];
  if (Array.isArray(fieldData)) {
    const fields: Payload = {};
    for (const f of fieldData) {
      if (f && typeof f === 'object') {
        const entry = f as Payload;
        const name = str(entry['name']);
        const values = entry['values'];
        const value = Array.isArray(values) ? str(values[0]) : str(values);
        if (name && value) fields[name.toLowerCase()] = value;
      }
    }
    lead.name = pick(fields, 'full_name', 'name', 'first_name');
    const first = pick(fields, 'first_name');
    const last = pick(fields, 'last_name');
    if (!lead.name && (first || last)) {
      lead.name = [first, last].filter(Boolean).join(' ');
    }
    lead.phone = pick(fields, 'phone_number', 'phone', 'mobile_number');
    lead.email = pick(fields, 'email');
    lead.city = pick(fields, 'city');
    const rest = Object.entries(fields)
      .filter(
        ([k]) =>
          ![
            'full_name',
            'name',
            'first_name',
            'last_name',
            'phone_number',
            'phone',
            'mobile_number',
            'email',
            'city',
          ].includes(k)
      )
      .map(([, v]) => v as string);
    lead.message = rest.length > 0 ? rest.join('\n') : null;
    return lead;
  }

  // Bare webhook ping — IDs only, nothing to normalize.
  return lead;
}

/**
 * Generic webhook: the documented contract is
 * `{ name, phone, email?, city?, message? }`, plus anything extra.
 * `fieldMapping` ({ normalizedField: sourceKey }) renames provider
 * keys before normalization, e.g. `{ "phone": "customer_mobile" }`.
 */
function normalizeGeneric(
  payload: Payload,
  fieldMapping: Record<string, string>
): NormalizedLead {
  const mapped: Payload = { ...payload };
  for (const [target, sourceKey] of Object.entries(fieldMapping)) {
    if (sourceKey && sourceKey in payload && !(target in payload)) {
      mapped[target] = payload[sourceKey];
    }
  }
  const lead = base(mapped);
  lead.name = pick(mapped, 'name', 'full_name', 'customer_name');
  lead.phone = pick(mapped, 'phone', 'mobile', 'phone_number');
  lead.email = pick(mapped, 'email');
  lead.city = pick(mapped, 'city');
  lead.message = pick(mapped, 'message', 'requirement', 'enquiry', 'notes');
  return lead;
}

export function normalizeProviderPayload(
  provider: LeadProvider,
  payload: Payload,
  fieldMapping: Record<string, string> = {}
): NormalizedLead {
  switch (provider) {
    case 'indiamart':
      return normalizeIndiaMart(payload);
    case 'justdial':
      return normalizeJustDial(payload);
    case 'google_ads':
      return normalizeGoogleAds(payload);
    case 'meta':
      return normalizeMeta(payload);
    case 'webhook':
      return normalizeGeneric(payload, fieldMapping);
  }
}

/** True when the normalized lead has the minimum to be actionable. */
export function hasLeadIdentity(lead: NormalizedLead): boolean {
  return lead.phone !== null || lead.email !== null;
}
