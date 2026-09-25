# Lead ingestion

Point IndiaMART, JustDial, Google Ads, Meta (Facebook) lead ads, or any
generic webhook at Almanac and every enquiry flows through the same
pipeline automatically:

**normalize → dedupe → contact upsert → lead record → deal in the
configured stage → instant WhatsApp template reply.**

Each lead source gets a secret ingest URL. Configure it once, then the
provider posts JSON to it whenever someone sends you an enquiry.

## Setting up a source

1. Open **Lead sources** in the sidebar and click **Add source**.
2. Name it (e.g. "IndiaMART store") and pick the provider.
3. Choose the **pipeline** and **stage** where new deals should land, the
   **template** to reply with instantly, and who new deals get assigned to.
4. Copy the webhook URL shown once, then paste it into your provider's
   lead-delivery / webhook settings:
   - **IndiaMART**: Buyer Lead API / webhook notifications
   - **JustDial**: Lead Manager API webhook
   - **Google Ads**: lead-form delivery via a webhook extension
   - **Meta**: lead-ads webhook → a small forwarder, or a generic
     integration that posts the enriched lead JSON
   - **Generic**: anything that can POST JSON or form fields

### IndiaMART

IndiaMART sends enquiries as JSON with fields like `SenderName`,
`SenderMobile`, `SenderEmail`, `SenderCity`, `ProductName`,
`RequirementType`, `Subject`, `RequirementDetail`. Create a source with
provider **IndiaMART** and paste its URL into IndiaMART's lead-delivery
settings.

### JustDial

JustDial lead webhooks carry `name`, `mobile`, `email`, `city`,
`category`, `datetime`, `label`, `brancharea`. Create a source with
provider **JustDial**.

### Google Ads

Google lead forms can be wired to a webhook (Zapier, a Cloud Function,
or your own forwarder). Expected fields: `full_name`, `phone_number`,
`email`, `city`, `campaign`, `adgroup`. Provider **Google Ads**.

### Meta lead ads

Meta posts `{ entry: [{ changes: [{ field: "leadgen", value: { leadgen_id, page_id, form_id, created_time } }] }] }`.
A bare `leadgen_id` is not enough on its own — someone (a small forwarder
service or your integration) must exchange it for the lead's field data
with a page access token, then POST the enriched lead to the ingest URL
with the source provider set to **Meta**:

```json
{
  "full_name": "Asha Sharma",
  "phone_number": "+919876543210",
  "email": "asha@example.com",
  "city": "Mumbai",
  "field_data": [{ "name": "full_name", "values": ["Asha Sharma"] }],
  "form_name": "Monsoon sale",
  "page_name": "Acme",
  "leadgen_id": "123456",
  "created_time": 1727174400
}
```

### Generic webhook

Anything else can POST JSON or URL-encoded form fields. Unknown field
names are handled with the source's **field mapping**: a JSON object of
`lead field → provider key`, for example

```json
{ "phone": "customer_mobile", "city": "cust_city", "notes": "remarks" }
```

If the source has a **verify secret**, every request must carry
`X-Signature: sha256=<hex>` where the hex is the HMAC-SHA256 of the raw
request body keyed with that secret. Set the secret in the source dialog;
Almanac never shows it again, and requests without a valid signature get
a 401.

## What happens per lead

1. **Normalize** — provider fields are mapped to `name`, `phone`, `email`,
   `city`, `notes` and any provider extras are kept on the record.
   10-digit national numbers are assumed Indian (`+91`).
2. **Dedupe** — if a contact with the same phone (or email) already
   exists, it is reused and updated with any new details instead of
   creating a duplicate. The lead is marked as a repeat.
3. **Lead record** — a row in `leads` stores the normalized fields plus
   the raw provider payload, so nothing is lost.
4. **Deal** — if the source has a pipeline configured, a deal is created
   in its stage (assigned to the chosen team member). Repeat leads link
   to the same contact rather than opening a second deal.
5. **Instant reply** — if the source has an approved WhatsApp template,
   the lead's conversation is resolved by phone and the template is sent
   with their first name. This is best-effort: a reply failure never
   blocks the lead itself.

Status is `invalid` when there is no usable phone or email, `duplicate`
for repeat enquiries, otherwise `new`.

## API reference

### `POST /api/leads/ingest/[key]`

Public endpoint; the `[key]` is the source's webhook key. Rate-limited
(60 requests/minute per key).

- Content type: `application/json` or `application/x-www-form-urlencoded`.
- If the source has a verify secret: requires header `X-Signature` with
  `sha256=<hex>` HMAC-SHA256 of the raw body.
- Inactive sources answer 404.

Response:

```json
{
  "ok": true,
  "lead_id": "uuid",
  "contact_id": "uuid",
  "deal_id": "uuid | null",
  "status": "new",
  "deduped": false,
  "reply_sent": true
}
```

### `GET|POST /api/lead-sources`, `PATCH|DELETE /api/lead-sources/[id]`

Account-scoped CRUD for sources. Admin/owner only for writes; viewers
can read. The webhook key is returned **only** on create and on
`PATCH` with `{"rotate_key": true}`. Setting a new `verify_secret`
replaces the stored hash; omitting it leaves it untouched.

### `GET /api/leads`

Account-scoped list of recent leads (100 max), with source and contact
names. Viewer role and up.

## Database

Migration `043_lead_ingestion.sql` adds:

- `lead_sources` — one row per source: provider, secret `webhook_key`
  (unique), optional hashed `verify_secret_hash`, default pipeline /
  stage / reply template / assignee, `field_mapping`, active flag.
- `leads` — one row per ingestion: normalized fields, `raw_payload`,
  `status`, `deduped`, `reply_sent`, links to source, contact and deal.

Both tables are account-scoped with the same RLS pattern as the rest of
Almanac: members of the owning account can read/write through the API,
the ingest endpoint itself uses a privileged client keyed only by the
webhook key, and the key is never returned by list/read APIs.

## Troubleshooting

- **404 from the ingest URL** — the key is wrong, or the source was
  deactivated. Create a new key with the rotate action and update the
  provider's settings.
- **401 signature errors** — make sure the provider signs the _raw_
  request body with the exact secret, hex-encoded, in `X-Signature`.
- **Leads marked invalid** — the payload had no usable phone or email.
  Check the raw payload on the lead row and add a field mapping.
- **No WhatsApp reply** — the source needs an _Approved_ template, and
  the phone must be a valid WhatsApp number. Reply failures are logged
  on the lead (`reply_sent = false`) without blocking ingestion.
