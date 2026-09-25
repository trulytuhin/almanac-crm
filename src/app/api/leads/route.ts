// ============================================================
// GET /api/leads — recent ingested leads for this account.
//
// Query: `?limit=` (default 25, max 100), `?source_id=` to filter.
// Joins the source name for display; the raw payload is NOT
// returned here (it's on the lead row for audit, not for lists).
// ============================================================

import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

const LEAD_LIST_COLUMNS =
  'id, lead_source_id, name, phone, email, city, message, status, deduped, reply_sent, created_at, lead_sources(name, provider)';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('viewer');

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') ?? '25', 10) || 25, 1),
      100
    );
    const sourceId = url.searchParams.get('source_id');

    let query = ctx.supabase
      .from('leads')
      .select(LEAD_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sourceId) query = query.eq('lead_source_id', sourceId);

    const { data, error } = await query;
    if (error) {
      console.error('[api/leads] list error:', error);
      return NextResponse.json(
        { error: 'Failed to list leads' },
        { status: 500 }
      );
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
