import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy, shared service-role client for lead-ingestion work.
// Mirrors the per-domain pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts) and the automation engine
// (src/lib/automations/admin-client.ts).
//
// The ingest endpoint is public (providers can't hold a session), so
// RLS can't scope it — every query in the ingest path filters by the
// source's account_id explicitly instead.
let _adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}
