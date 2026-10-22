export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { enforceOperatorRole } from "@/lib/operator-auth";
import { clearInMemoryCache } from "@/lib/ai-scan-cache";

const ClearCacheSchema = z.object({
  hash: z.string().min(1).max(64).optional(),
  clear_all: z.boolean().optional(),
});

/**
 * Operator-only endpoint to clear AI scan cache entries.
 * Requires valid operator session cookie (ADMIN, DISPATCHER, or COLLECTOR).
 * Unauthenticated calls return 401.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = enforceOperatorRole(req, ["ADMIN", "DISPATCHER", "COLLECTOR"]);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const hashParam = searchParams.get("hash");
    const clearAllParam = searchParams.get("clear_all") === "true" || hashParam === "all";

    if (!hashParam && !clearAllParam) {
      return NextResponse.json(
        { error: "Must provide ?hash=<image_sha256> or ?clear_all=true to clear cache." },
        { status: 400 }
      );
    }

    let deletedCount = 0;

    if (clearAllParam) {
      const { error: dbErr, count } = await supabase
        .from("ai_scan_cache")
        .delete({ count: "exact" })
        .neq("image_sha256", "0");

      if (dbErr) {
        console.warn("[Cache Clear] Database clear error:", dbErr);
      }
      clearInMemoryCache("all");
      deletedCount = count ?? 0;
    } else if (hashParam) {
      const { error: dbErr, count } = await supabase
        .from("ai_scan_cache")
        .delete({ count: "exact" })
        .eq("image_sha256", hashParam);

      if (dbErr) {
        console.warn("[Cache Clear] Database delete error:", dbErr);
      }
      clearInMemoryCache(hashParam);
      deletedCount = count ?? 1;
    }

    // Log administrative action in audit ledger
    await supabase.from("event_log").insert({
      event_type: "AI_CACHE_CLEARED",
      entity_type: "ai_scan_cache",
      entity_id: "00000000-0000-0000-0000-000000000000",
      actor_role: authResult.session.role,
      payload_json: {
        timestamp: new Date().toISOString(),
        actor_role: authResult.session.role,
        cleared_hash: clearAllParam ? "ALL" : hashParam,
        deleted_count: deletedCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: clearAllParam ? "All AI scan cache entries cleared." : `Cache entry ${hashParam} cleared.`,
      cleared_hash: clearAllParam ? "ALL" : hashParam,
      deleted_count: deletedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = enforceOperatorRole(req, ["ADMIN", "DISPATCHER", "COLLECTOR"]);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const rawJson = await req.json().catch(() => ({}));
    const parseResult = ClearCacheSchema.safeParse(rawJson);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid cache clear payload.", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { hash, clear_all } = parseResult.data;
    if (!hash && !clear_all) {
      return NextResponse.json(
        { error: "Must specify 'hash' or 'clear_all: true'." },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    if (clear_all) url.searchParams.set("clear_all", "true");
    if (hash) url.searchParams.set("hash", hash);

    const deleteReq = new NextRequest(url.toString(), {
      method: "DELETE",
      headers: req.headers,
    });

    return DELETE(deleteReq);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
