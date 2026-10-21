import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // 1. Reset simulated routes back to planned
    await supabase
      .from("collection_routes")
      .update({
        status: "planned",
      })
      .neq("status", "planned");

    // 2. Reset simulated requests back to their initial baseline states
    // Baseline pending requests
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
      .in("qr_token", pendingTokens);

    // Baseline assigned & scheduled requests
    await supabase
      .from("collection_requests")
      .update({ status: "assigned" })
      .in("qr_token", ["QR-REQ-HYD-007", "QR-REQ-HYD-009"]);

    await supabase
      .from("collection_requests")
      .update({ status: "scheduled" })
      .eq("qr_token", "QR-REQ-HYD-012");

    // Baseline collected requests
    await supabase
      .from("collection_requests")
      .update({ status: "collected" })
      .in("qr_token", ["QR-REQ-HYD-004", "QR-REQ-HYD-010"]);

    // 3. Reset vehicle fleet statuses to available
    await supabase
      .from("vehicles")
      .update({ status: "available" });

    // 4. Log demo reset event
    await supabase.from("event_log").insert({
      event_type: "DEMO_DATA_RESET",
      entity_type: "system",
      entity_id: "00000000-0000-0000-0000-000000000000",
      actor_role: "SYSTEM",
      payload_json: {
        timestamp: new Date().toISOString(),
        message: "Simulated fleet routes and requests reset to baseline demonstration state.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demo dataset reset successfully to baseline state.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset demo data";
    console.error("Demo reset error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
