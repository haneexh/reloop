import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { getOperatorSession } from "@/lib/operator-auth";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    // 1. Require a valid demo operator session cookie (any role)
    const session = getOperatorSession(req);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Operator session required to reset demo data." },
        { status: 401 }
      );
    }

    // 2. Rate limit: 3 calls per 10 minutes (600s) per IP
    const rateCheck = checkRateLimit(req, 3, 600);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 3 demo resets per 10 minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.resetInSecs),
          },
        }
      );
    }

    // 3. Reset simulated / seed routes back to planned
    await supabase
      .from("collection_routes")
      .update({
        status: "planned",
      })
      .neq("status", "planned");

    // 4. Reset simulated / seed requests back to their initial baseline states
    // Touches only rows with is_simulated = true (seed dataset)
    const pendingTokens = [
      "QR-REQ-HYD-001",
      "QR-REQ-HYD-002",
      "QR-REQ-HYD-003",
      "QR-REQ-HYD-005",
      "QR-REQ-HYD-006",
      "QR-REQ-HYD-008",
      "QR-REQ-HYD-011",
    ];
    await supabase
      .from("collection_requests")
      .update({ status: "pending" })
      .eq("is_simulated", true)
      .in("qr_token", pendingTokens);

    // Baseline assigned & scheduled requests (touches only is_simulated = true)
    await supabase
      .from("collection_requests")
      .update({ status: "assigned" })
      .eq("is_simulated", true)
      .in("qr_token", ["QR-REQ-HYD-007", "QR-REQ-HYD-009"]);

    await supabase
      .from("collection_requests")
      .update({ status: "scheduled" })
      .eq("is_simulated", true)
      .eq("qr_token", "QR-REQ-HYD-012");

    // Baseline collected requests (touches only is_simulated = true)
    await supabase
      .from("collection_requests")
      .update({ status: "collected" })
      .eq("is_simulated", true)
      .in("qr_token", ["QR-REQ-HYD-004", "QR-REQ-HYD-010"]);

    // 5. Reset vehicle fleet statuses to available
    await supabase
      .from("vehicles")
      .update({ status: "available" });

    // 6. Write event_log audit entry
    await supabase.from("event_log").insert({
      event_type: "DEMO_DATA_RESET",
      entity_type: "system",
      entity_id: "00000000-0000-0000-0000-000000000000",
      actor_role: session.role || "SYSTEM",
      payload_json: {
        timestamp: new Date().toISOString(),
        actor_role: session.role,
        is_demo: session.isDemo,
        message: "Simulated fleet routes and requests reset to baseline demonstration state.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demo dataset reset successfully to baseline state.",
      rate_limit: {
        remaining: rateCheck.remaining,
        reset_in_secs: rateCheck.resetInSecs,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset demo data";
    console.error("Demo reset error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
