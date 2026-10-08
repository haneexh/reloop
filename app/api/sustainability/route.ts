import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { computeSustainabilityMetrics } from "@/lib/sustainability-engine";

export async function GET() {
  try {
    // 1. Fetch requests
    const { data: requests, error: reqErr } = await supabase
      .from("collection_requests")
      .select("id, status, created_at, is_simulated");

    if (reqErr) {
      console.error("Error fetching collection requests for sustainability:", reqErr);
    }

    // 2. Fetch collection records
    const { data: records, error: recErr } = await supabase
      .from("collection_records")
      .select("id, request_id, actual_weight_kg, verified_at");

    if (recErr) {
      console.error("Error fetching collection records for sustainability:", recErr);
    }

    // 3. Fetch recovery transfers
    const { data: transfers, error: trErr } = await supabase
      .from("recovery_transfers")
      .select("id, facility_id, route_id, total_weight_kg, refurbished_pct, recycled_pct, residual_pct, transferred_at");

    if (trErr) {
      console.error("Error fetching recovery transfers for sustainability:", trErr);
    }

    // 4. Fetch routes
    const { data: routes, error: routeErr } = await supabase
      .from("collection_routes")
      .select("id, total_distance_km, total_load_kg, status");

    if (routeErr) {
      console.error("Error fetching collection routes for sustainability:", routeErr);
    }

    // 5. Fetch items
    const { data: items, error: itemErr } = await supabase
      .from("items")
      .select("id, item_type, waste_avoided_kg, co2e_saved_est");

    if (itemErr) {
      console.error("Error fetching items for sustainability:", itemErr);
    }

    // 6. Compute metrics
    const metrics = computeSustainabilityMetrics({
      requests: requests || [],
      collectionRecords: records || [],
      transfers: transfers || [],
      routes: routes || [],
      items: items || [],
      baselineDistanceSavedKm: 28.5, // verified baseline savings from route optimizer runs
    });

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/sustainability error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
