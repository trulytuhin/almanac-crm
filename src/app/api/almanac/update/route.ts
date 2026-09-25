// ============================================================
// /api/almanac/update
//
// GET  (admins)  what version is running and what's newer.
// POST (the person who set up this installation) run the update.
//
// One Almanac installation can host several accounts, so "owner of an
// account" isn't enough to restart the whole server. Only the owner of
// the first account created on this installation (whoever ran the
// installer and signed up first) may start an update from the app.
// ============================================================

import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { getUpdateStatus, isUpdating, startUpdate } from "@/lib/almanac/updates";

export const dynamic = "force-dynamic";

async function isInstanceOwner(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("accounts")
    .select("owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.owner_user_id === userId;
}

export async function GET() {
  try {
    const ctx = await requireRole("admin");
    const status = await getUpdateStatus();
    return NextResponse.json({ ...status, canUpdate: status.hosting === "managed" && (await isInstanceOwner(ctx.userId)) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST() {
  try {
    const ctx = await requireRole("owner");
    const status = await getUpdateStatus();
    if (status.hosting !== "managed") {
      return NextResponse.json({ error: "This installation isn't managed by the almanac command." }, { status: 400 });
    }
    if (!(await isInstanceOwner(ctx.userId))) {
      return NextResponse.json({ error: "Only the person who set up this installation can update it." }, { status: 403 });
    }
    if (isUpdating()) return NextResponse.json({ started: false, updating: true }, { status: 202 });
    startUpdate();
    return NextResponse.json({ started: true, updating: true }, { status: 202 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
