import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { FleetVehicle, getAvailableVehicles } from "@/lib/fleet-engine";
import { SchedulableRequest, scheduleRequests } from "@/lib/scheduler";
import { optimizeFleetRoutes, FleetOptimizationResult } from "@/lib/route-optimizer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planningDate =
      body.planning_date || new Date().toISOString().split("T")[0];
    const planningSlot = body.planning_slot || null;
    const shouldPersist = Boolean(body.persist);

    // 1. Fetch available vehicles
    const { data: dbVehicles, error: vehicleErr } = await supabase
      .from("vehicles")
      .select("*");

    if (vehicleErr || !dbVehicles) {
      console.error("Error fetching vehicles:", vehicleErr);
      return NextResponse.json(
        { error: "Failed to retrieve municipal fleet records." },
        { status: 500 }
      );
    }

    const fleet: FleetVehicle[] = dbVehicles.map((v) => ({
      id: v.id,
      vehicle_code: v.vehicle_code,
      capacity_kg: Number(v.capacity_kg),
      vehicle_type: v.vehicle_type,
      status: v.status,
      depot_name: v.depot_name || "Central Depot",
      depot_lat: Number(v.depot_lat),
      depot_lng: Number(v.depot_lng),
      max_route_hours: Number(v.max_route_hours || 8.0),
    }));

    const availableFleet = getAvailableVehicles(fleet);

    // 2. Fetch candidate requests
    const { data: dbRequests, error: reqErr } = await supabase
      .from("collection_requests")
      .select(`
        id,
        zone_id,
        lat,
        lng,
        priority,
        pickup_date,
        pickup_slot,
        status,
        is_simulated,
        notes
      `)
      .in("status", ["pending", "scheduled"]);

    if (reqErr || !dbRequests) {
      console.error("Error fetching candidate collection requests:", reqErr);
      return NextResponse.json(
        { error: "Failed to retrieve pending collection requests." },
        { status: 500 }
      );
    }

    // 3. Aggregate item weights per request
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

    const candidateRequests: SchedulableRequest[] = dbRequests.map((r) => {
      const computedWeight = weightsByRequest[r.id];
      const weight =
        typeof computedWeight === "number" && computedWeight > 0 ? computedWeight : 6.5;

      return {
        id: r.id,
        zone_id: r.zone_id,
        lat: r.lat ? Number(r.lat) : null,
        lng: r.lng ? Number(r.lng) : null,
        priority: r.priority || "normal",
        pickup_date: r.pickup_date,
        pickup_slot: r.pickup_slot,
        status: r.status,
        estimated_weight_kg: Math.round(weight * 10) / 10,
        is_simulated: Boolean(r.is_simulated),
        notes: r.notes,
      };
    });

    // 4. Run deterministic capacity scheduler
    const schedulingResult = scheduleRequests(candidateRequests, availableFleet, {
      planningDate,
      planningSlot,
    });

    // 5. Run route optimizer (2-opt + relocate) on scheduled assignments
    const optimizationResult: FleetOptimizationResult = optimizeFleetRoutes(
      schedulingResult.assignments
    );

    // 6. If persist requested, commit collection_routes, update request statuses, and append event_log
    const persistedRouteIds: string[] = [];

    if (shouldPersist && optimizationResult.routes.length > 0) {
      for (const route of optimizationResult.routes) {
        // Insert collection_routes
        const { data: createdRoute, error: insertRouteErr } = await supabase
          .from("collection_routes")
          .insert({
            vehicle_id: route.vehicle_id,
            zone_id: route.zone_id,
            route_date: planningDate,
            status: "planned",
            total_distance_km: route.total_distance_km,
            total_load_kg: route.total_load_kg,
            estimated_duration_minutes: route.estimated_duration_minutes,
            stops_json: route.stops_json,
          })
          .select("id")
          .single();

        if (insertRouteErr || !createdRoute) {
          console.error("Failed to insert collection route:", insertRouteErr);
          continue;
        }

        persistedRouteIds.push(createdRoute.id);

        // Update assigned requests status to 'assigned'
        const stopRequestIds = route.stops
          .filter((s) => s.stop_type === "COLLECTION_STOP" && s.request_id)
          .map((s) => s.request_id!);

        if (stopRequestIds.length > 0) {
          await supabase
            .from("collection_requests")
            .update({ status: "assigned" })
            .in("id", stopRequestIds);
        }

        // Update vehicle status to 'assigned'
        await supabase
          .from("vehicles")
          .update({ status: "assigned" })
          .eq("id", route.vehicle_id);

        // Append ROUTE_GENERATED in event_log
        await supabase.from("event_log").insert({
          event_type: "ROUTE_GENERATED",
          entity_type: "collection_routes",
          entity_id: createdRoute.id,
          actor_role: "DISPATCHER",
          payload_json: {
            route_id: createdRoute.id,
            vehicle_id: route.vehicle_id,
            vehicle_code: route.vehicle_code,
            route_date: planningDate,
            stops_count: route.stops_count,
            total_load_kg: route.total_load_kg,
            total_distance_km: route.total_distance_km,
            estimated_duration_minutes: route.estimated_duration_minutes,
          },
        });

        // Append ROUTE_OPTIMIZED in event_log
        await supabase.from("event_log").insert({
          event_type: "ROUTE_OPTIMIZED",
          entity_type: "collection_routes",
          entity_id: createdRoute.id,
          actor_role: "DISPATCHER",
          payload_json: {
            route_id: createdRoute.id,
            vehicle_code: route.vehicle_code,
            baseline_distance_km: route.baseline_distance_km,
            optimized_distance_km: route.total_distance_km,
            distance_saved_km: route.distance_saved_km,
            distance_reduction_percent: route.distance_reduction_percent,
            capacity_utilization_percent: route.utilization_percentage,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        planning_date: planningDate,
        persisted: shouldPersist,
        persisted_route_ids: persistedRouteIds,
        routes: optimizationResult.routes,
        summary: optimizationResult.summary,
        scheduled_requests_count: schedulingResult.scheduled_requests.length,
        deferred_requests: schedulingResult.deferred_requests,
        deferred_count: schedulingResult.deferred_requests.length,
        vehicles_available: availableFleet.length,
        vehicles_utilized: optimizationResult.routes.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/routes error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    let query = supabase
      .from("collection_routes")
      .select(`
        id,
        vehicle_id,
        zone_id,
        route_date,
        status,
        total_distance_km,
        total_load_kg,
        estimated_duration_minutes,
        stops_json,
        created_at
      `)
      .order("created_at", { ascending: false });

    if (date) {
      query = query.eq("route_date", date);
    }

    const { data: routes, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Join vehicle and zone codes
    const { data: vehicles } = await supabase.from("vehicles").select("id, vehicle_code, vehicle_type, depot_name");
    const { data: zones } = await supabase.from("collection_zones").select("id, name, code");

    const vehicleMap = new Map((vehicles || []).map((v) => [v.id, v]));
    const zoneMap = new Map((zones || []).map((z) => [z.id, z]));

    const enrichedRoutes = (routes || []).map((r) => {
      const v = r.vehicle_id ? vehicleMap.get(r.vehicle_id) : null;
      const z = r.zone_id ? zoneMap.get(r.zone_id) : null;
      return {
        ...r,
        vehicle_code: v?.vehicle_code || "UNKNOWN",
        vehicle_type: v?.vehicle_type || "VAN",
        depot_name: v?.depot_name || "Depot",
        zone_name: z?.name || null,
        zone_code: z?.code || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedRoutes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
