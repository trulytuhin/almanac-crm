// ============================================================
// GET    /api/lead-sources/[id] — one source (secrets stripped)
// PATCH  /api/lead-sources/[id] — update (admin+)
// DELETE /api/lead-sources/[id] — delete, cascades its leads (admin+)
//
// PATCH accepts the same body as POST. To rotate the webhook key,
// pass `{ "rotate_key": true }` — the new key is returned once.
// To rotate the HMAC secret, pass a new `verify_secret`; to clear
// it, pass `verify_secret: null` explicitly.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

import {
  generateWebhookKey,
  LEAD_SOURCE_PUBLIC_COLUMNS,
  serializeLeadSource,
  validateLeadSourceInput,
} from '@/lib/leads/sources';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('viewer');
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from('lead_sources')
      .select(LEAD_SOURCE_PUBLIC_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Lead source not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      serializeLeadSource(data as Record<string, unknown>)
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await ctx.supabase
      .from('lead_sources')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Lead source not found' },
        { status: 404 }
      );
    }

    const validated = validateLeadSourceInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const input = validated.input;

    if (input.default_pipeline_id || input.default_stage_id) {
      if (!input.default_pipeline_id || !input.default_stage_id) {
        return NextResponse.json(
          {
            error:
              "'default_pipeline_id' and 'default_stage_id' must be set together",
          },
          { status: 400 }
        );
      }
      const { data: stage } = await ctx.supabase
        .from('pipeline_stages')
        .select('id, pipeline_id, pipelines!inner(account_id)')
        .eq('id', input.default_stage_id)
        .eq('pipeline_id', input.default_pipeline_id)
        .maybeSingle();
      if (!stage) {
        return NextResponse.json(
          { error: 'default_stage_id is not a stage of default_pipeline_id' },
          { status: 400 }
        );
      }
    }

    if (input.assign_to_profile_id) {
      const { data: member } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('id', input.assign_to_profile_id)
        .eq('account_id', ctx.accountId)
        .maybeSingle();
      if (!member) {
        return NextResponse.json(
          { error: 'assign_to_profile_id is not a member of this account' },
          { status: 400 }
        );
      }
    }

    // verify_secret semantics: validated input encrypts a provided
    // string; an explicit null clears it; undefined (key absent)
    // leaves it untouched.
    const patch: Record<string, unknown> = {
      name: input.name,
      provider: input.provider,
      is_active: input.is_active,
      default_pipeline_id: input.default_pipeline_id,
      default_stage_id: input.default_stage_id,
      auto_reply_template_name: input.auto_reply_template_name,
      assign_to_profile_id: input.assign_to_profile_id,
      field_mapping: input.field_mapping,
    };
    if ('verify_secret' in body) {
      patch.verify_secret = input.verify_secret;
    }

    let rotatedKey: string | null = null;
    if (body.rotate_key === true) {
      rotatedKey = generateWebhookKey();
      patch.webhook_key = rotatedKey;
    }

    const { data: updated, error } = await ctx.supabase
      .from('lead_sources')
      .update(patch)
      .eq('id', id)
      .select(LEAD_SOURCE_PUBLIC_COLUMNS)
      .single();

    if (error || !updated) {
      console.error('[api/lead-sources] update error:', error);
      return NextResponse.json(
        { error: 'Failed to update lead source' },
        { status: 500 }
      );
    }

    const serialized = serializeLeadSource(updated as Record<string, unknown>);
    return NextResponse.json(
      rotatedKey ? { ...serialized, webhook_key: rotatedKey } : serialized
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const ctx = await requireRole('admin');
    const { id } = await params;

    const { error } = await ctx.supabase
      .from('lead_sources')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('[api/lead-sources] delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete lead source' },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
