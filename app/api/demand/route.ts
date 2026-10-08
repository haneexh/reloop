import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  computeDemandIntelligence,
  DemandRequestItem,
  ZoneMetadata,
} from "@/lib/demand-engine";
import { FALLBACK_HYDERABAD_ZONES } from "@/lib/zone-resolver";

export async function GET() {
  try {
    // 1. Fetch collection_zones
    let zones: ZoneMetadata[] = [];
    const { data: dbZones, error: zoneError } = await supabase
      .from("collection_zones")
      .select("id, name, code, center_lat, center_lng, radius_km")
      .order("code", { ascending: true });

    if (!zoneError && dbZones && dbZones.length > 0) {
      zones = dbZones.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        center_lat: Number(z.center_lat),
        center_lng: Number(z.center_lng),
        radius_km: Number(z.radius_km),
      }));
    } else {
      zones = FALLBACK_HYDERABAD_ZONES.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        center_lat: z.center_lat,
        center_lng: z.center_lng,
        radius_km: z.radius_km,
      }));
    }

    // 2. Fetch collection_requests without sensitive citizen PII
    // Exclude: citizen_phone, citizen_name, address, notes, qr_token
    const { data: dbRequests, error: reqError } = await supabase
      .from("collection_requests")
      .select(`
        id,
        zone_id,
        status,
        priority,
        pickup_date,
        pickup_slot,
        is_simulated,
        created_at,
        lat,
        lng
      `);

    if (reqError) {
      console.error("Error fetching collection requests for demand intelligence:", reqError);
      return NextResponse.json(
        { error: "Failed to query collection demand records." },
        { status: 500 }
      );
    }

    // 3. Query items to aggregate weights per request
    const { data: dbItems } = await supabase
      .from("items")
      .select("request_id, waste_avoided_kg");

    const weightsByRequest: Record<string, number> = {};
    if (dbItems) {
      for (const item of dbItems) {
        if (item.request_id) {
          weightsByRequest[item.request_id] =
            (weightsByRequest[item.request_id] || 0) + (Number(item.waste_avoided_kg) || 0);
        }
      }
    }

    // Map into DemandRequestItem with aggregated or fallback weight
    const mappedRequests: DemandRequestItem[] = (dbRequests || []).map((r) => {
      const computedWeight = weightsByRequest[r.id];
      // Default to 6.5 kg for seed/unitemized requests
      const weight =
        typeof computedWeight === "number" && computedWeight > 0 ? computedWeight : 6.5;

      return {
        id: r.id,
        zone_id: r.zone_id,
        status: r.status,
        priority: r.priority,
        pickup_date: r.pickup_date,
        pickup_slot: r.pickup_slot,
        is_simulated: Boolean(r.is_simulated),
        created_at: r.created_at,
        lat: r.lat ? Number(r.lat) : null,
        lng: r.lng ? Number(r.lng) : null,
        estimated_weight_kg: Math.round(weight * 10) / 10,
      };
    });

    // 4. Compute deterministic demand intelligence
    const intelligence = computeDemandIntelligence(mappedRequests, zones, new Date());

    return NextResponse.json({
      success: true,
      data: intelligence,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/demand error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
