import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  isAuthorizedCollector,
  validateActualWeight,
  calculateWeightVariance,
  validateStopForCollection,
  VerificationMethod,
} from "@/lib/collector-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = req.headers.get("x-user-role") || body.actor_role || "COLLECTOR";

    // 1. Authorization boundary: CITIZEN cannot collect requests
    if (!isAuthorizedCollector(role)) {
      return NextResponse.json(
        { error: "Forbidden: Citizen role is not authorized to execute pickup collections." },
        { status: 403 }
      );
    }

    const {
      route_id,
      request_id,
      qr_token,
      actual_weight_kg,
      verification_method = "qr_scan",
      collector_id = null,
      notes,
      lat,
      lng,
    } = body;

    if (!route_id) {
      return NextResponse.json({ error: "route_id is required." }, { status: 400 });
    }

    if (!request_id && !qr_token) {
      return NextResponse.json(
        { error: "Either request_id or qr_token is required for pickup verification." },
        { status: 400 }
      );
    }

    // 2. Fetch route and vehicle
    const { data: route, error: routeErr } = await supabase
      .from("collection_routes")
      .select("id, vehicle_id, zone_id, status, stops_json")
      .eq("id", route_id)
      .single();

    if (routeErr || !route) {
      return NextResponse.json(
        { error: "Collection route not found." },
        { status: 404 }
      );
    }

    let vehicleCapacityKg = 500;
    if (route.vehicle_id) {
      const { data: vehicle } = await supabase
        .from("vehicles")
        .select("capacity_kg")
        .eq("id", route.vehicle_id)
        .single();

      if (vehicle?.capacity_kg) {
        vehicleCapacityKg = Number(vehicle.capacity_kg);
      }
    }

    // 3. Compute currently loaded payload on this route from existing collection records
    const { data: routeRecords } = await supabase
      .from("collection_records")
      .select("actual_weight_kg")
      .eq("route_id", route_id);

    const currentLoadedKg = (routeRecords || []).reduce(
      (sum, r) => sum + (Number(r.actual_weight_kg) || 0),
      0
    );

    // 4. Validate actual weight against capacity
    const weightValidation = validateActualWeight(
      actual_weight_kg,
      vehicleCapacityKg,
      currentLoadedKg
    );

    if (!weightValidation.valid || typeof weightValidation.weight !== "number") {
      return NextResponse.json(
        {
          error: weightValidation.error || "Invalid weight measurement.",
          remaining_capacity_kg: Math.max(0, vehicleCapacityKg - currentLoadedKg),
          vehicle_capacity_kg: vehicleCapacityKg,
          current_loaded_kg: currentLoadedKg,
        },
        { status: 400 }
      );
    }

    const verifiedWeight = weightValidation.weight;

    // 5. Lookup collection request by token or id
    let reqQuery = supabase.from("collection_requests").select(`
      id,
      qr_token,
      status,
      priority,
      address,
      zone_id,
      pickup_slot,
      is_simulated
    `);

    if (qr_token) {
      reqQuery = reqQuery.eq("qr_token", qr_token.trim());
    } else {
      reqQuery = reqQuery.eq("id", request_id);
    }

    const { data: request, error: reqLookupErr } = await reqQuery.single();

    if (reqLookupErr || !request) {
      return NextResponse.json(
        { error: "No matching collection request found for the provided token or ID." },
        { status: 404 }
      );
    }

    // 6. Check existing collection records for duplicate protection
    const { count: existingRecordCount, error: countErr } = await supabase
      .from("collection_records")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request.id);

    if (countErr) {
      return NextResponse.json(
        { error: "Database error verifying duplicate records." },
        { status: 500 }
      );
    }

    // 7. Route stop and status validation
    const routeStops = Array.isArray(route.stops_json)
      ? (route.stops_json as Array<{
          request_id?: string | null;
          stop_type: string;
          estimated_weight_kg?: number;
        }>)
      : [];
    const stopValidation = validateStopForCollection({
      routeStops,
      requestId: request.id,
      requestStatus: request.status,
      existingRecordCount: existingRecordCount || 0,
      routeStatus: route.status,
    });

    if (!stopValidation.valid) {
      const statusCode =
        stopValidation.code === "RECORD_EXISTS" || stopValidation.code === "ALREADY_COLLECTED"
          ? 409
          : stopValidation.code === "NOT_ON_ROUTE"
          ? 403
          : 400;

      return NextResponse.json(
        { error: stopValidation.error, code: stopValidation.code },
        { status: statusCode }
      );
    }

    // 8. Find estimated weight from manifest stop or items
    const stopMeta = routeStops.find(
      (s) => s.stop_type === "COLLECTION_STOP" && s.request_id === request.id
    );
    const estimatedWeightKg = Number(stopMeta?.estimated_weight_kg) || 5.0;
    const variance = calculateWeightVariance(estimatedWeightKg, verifiedWeight);

    // 9. Format verification method according to DB constraints ('qr_scan', 'manual', 'digital_scale')
    let validMethod: VerificationMethod = "qr_scan";
    if (verification_method === "manual" || verification_method === "digital_scale") {
      validMethod = verification_method;
    }

    // Optional GPS formatting
    let noteText = notes ? notes.trim() : "";
    if (typeof lat === "number" && typeof lng === "number") {
      const gpsTag = `[GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
      noteText = noteText ? `${noteText} ${gpsTag}` : gpsTag;
    }

    const nowIso = new Date().toISOString();

    // 10. Persist collection record
    const { data: createdRecord, error: insertRecordErr } = await supabase
      .from("collection_records")
      .insert({
        request_id: request.id,
        route_id: route.id,
        collector_id: collector_id,
        actual_weight_kg: verifiedWeight,
        verified_at: nowIso,
        verification_method: validMethod,
        notes: noteText || null,
      })
      .select("id, request_id, actual_weight_kg, verified_at, verification_method")
      .single();

    if (insertRecordErr || !createdRecord) {
      console.error("Failed to insert collection record:", insertRecordErr);
      return NextResponse.json(
        { error: "Database error persisting verified collection record." },
        { status: 500 }
      );
    }

    // 11. Update collection_requests status to 'collected'
    const { error: updateReqErr } = await supabase
      .from("collection_requests")
      .update({
        status: "collected",
        updated_at: nowIso,
      })
      .eq("id", request.id);

    if (updateReqErr) {
      console.error("Warning: failed to update collection request status:", updateReqErr);
    }

    // 12. Check if route should advance to 'in_progress' or 'completed'
    const totalCollectionStops = routeStops.filter(
      (s) => s.stop_type === "COLLECTION_STOP" && s.request_id
    );

    const { count: totalRouteCompletedRecords } = await supabase
      .from("collection_records")
      .select("id", { count: "exact", head: true })
      .eq("route_id", route.id);

    const allStopsFinished =
      (totalRouteCompletedRecords || 0) >= totalCollectionStops.length;

    let newRouteStatus = route.status;
    if (allStopsFinished) {
      newRouteStatus = "completed";
      await supabase
        .from("collection_routes")
        .update({ status: "completed" })
        .eq("id", route.id);
    } else if (route.status === "planned" || route.status === "assigned") {
      newRouteStatus = "in_progress";
      await supabase
        .from("collection_routes")
        .update({ status: "in_progress" })
        .eq("id", route.id);
    }

    // 13. Append immutable audit entries to event_log (Zero sensitive citizen PII)
    await supabase.from("event_log").insert([
      {
        event_type: "ITEM_COLLECTED",
        entity_type: "collection_requests",
        entity_id: request.id,
        actor_role: role,
        payload_json: {
          request_id: request.id,
          collection_record_id: createdRecord.id,
          route_id: route.id,
          vehicle_id: route.vehicle_id,
          qr_token: request.qr_token,
          actual_weight_kg: verifiedWeight,
          estimated_weight_kg: estimatedWeightKg,
          variance_kg: variance.variance_kg,
          verification_method: validMethod,
          gps_captured: typeof lat === "number" && typeof lng === "number",
          collected_at: nowIso,
        },
      },
      {
        event_type: "WEIGHT_RECORDED",
        entity_type: "collection_records",
        entity_id: createdRecord.id,
        actor_role: role,
        payload_json: {
          collection_record_id: createdRecord.id,
          request_id: request.id,
          actual_weight_kg: verifiedWeight,
          estimated_weight_kg: estimatedWeightKg,
          variance_percent: variance.variance_percent,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        record_id: createdRecord.id,
        request_id: request.id,
        qr_token: request.qr_token,
        status: "collected",
        actual_weight_kg: verifiedWeight,
        estimated_weight_kg: estimatedWeightKg,
        variance_kg: variance.variance_kg,
        variance_percent: variance.variance_percent,
        route_status: newRouteStatus,
        all_stops_completed: allStopsFinished,
        verified_at: nowIso,
        verification_method: validMethod,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/collector/collect error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
