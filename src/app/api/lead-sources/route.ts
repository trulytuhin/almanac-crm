// ============================================================
// GET  /api/lead-sources — list this account's lead sources
// POST /api/lead-sources — create one (admin+)
//
// POST mints the `webhook_key` and returns it in plaintext exactly
// once — store it: Almanac keeps the key but never shows it again.
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

import {
  generateWebhookKey,
  LEAD_SOURCE_PUBLIC_COLUMNS,
  serializeLeadSource,
  validateLeadSourceInput,
} from '@/lib/leads/sources';

export async function GET() {
  try {
    const ctx = await requireRole('viewer');

    const { data, error } = await ctx.supabase
      .from('lead_sources')
      .select(LEAD_SOURCE_PUBLIC_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api/lead-sources] list error:', error);
      return NextResponse.json(
        { error: 'Failed to list lead sources' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lead_sources: (data ?? []).map((r) =>
        serializeLeadSource(r as Record<string, unknown>)
      ),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');

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

    const validated = validateLeadSourceInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const input = validated.input;

    // Guard the pipeline/stage wiring: the stage must belong to the
    // pipeline, and both must belong to this account — otherwise the
    // ingest path would silently skip deal creation.
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

    // Assignee must be a member of this account.
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

    const webhookKey = generateWebhookKey();

    const { data: created, error } = await ctx.supabase
      .from('lead_sources')
      .insert({
        account_id: ctx.accountId,
        name: input.name,
        provider: input.provider,
        webhook_key: webhookKey,
        verify_secret: input.verify_secret,
        is_active: input.is_active,
        default_pipeline_id: input.default_pipeline_id,
        default_stage_id: input.default_stage_id,
        auto_reply_template_name: input.auto_reply_template_name,
        assign_to_profile_id: input.assign_to_profile_id,
        field_mapping: input.field_mapping,
      })
      .select(LEAD_SOURCE_PUBLIC_COLUMNS)
      .single();

    if (error || !created) {
      console.error('[api/lead-sources] create error:', error);
      return NextResponse.json(
        { error: 'Failed to create lead source' },
        { status: 500 }
      );
    }

    // Key shown exactly once.
    return NextResponse.json(
      {
        ...serializeLeadSource(created as Record<string, unknown>),
        webhook_key: webhookKey,
      },
      { status: 201 }
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
