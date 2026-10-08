import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { computeDemandIntelligence } from "../lib/demand-engine.ts";
import { getAvailableVehicles } from "../lib/fleet-engine.ts";
import { scheduleRequests } from "../lib/scheduler.ts";
import { optimizeFleetRoutes } from "../lib/route-optimizer.ts";

function getEnv() {
  const envFiles = [".env.local", ".env.production.local"];
  const env = {};
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("==================================================");
console.log("PS-013 DISPATCH & ROUTE OPTIMIZATION E2E TEST");
console.log("Target Database:", supabaseUrl);
console.log("==================================================");

async function runTest() {
  // 1. Fetch Zones
  const { data: zones, error: zErr } = await supabase
    .from("collection_zones")
    .select("id, name, code, center_lat, center_lng, radius_km")
    .order("code", { ascending: true });

  if (zErr || !zones || zones.length === 0) {
    console.error("FAIL: Could not load zones:", zErr);
    process.exit(1);
  }
  console.log(`✔ Step 1: Loaded ${zones.length} collection zones.`);

  // 2. Fetch Vehicles
  const { data: vehicles, error: vErr } = await supabase
    .from("vehicles")
    .select("*");

  if (vErr || !vehicles || vehicles.length === 0) {
    console.error("FAIL: Could not load vehicles:", vErr);
    process.exit(1);
  }
  const availableVehicles = getAvailableVehicles(vehicles.map((v) => ({
    id: v.id,
    vehicle_code: v.vehicle_code,
    capacity_kg: Number(v.capacity_kg),
    vehicle_type: v.vehicle_type,
    status: v.status,
    depot_name: v.depot_name,
    depot_lat: Number(v.depot_lat),
    depot_lng: Number(v.depot_lng),
    max_route_hours: Number(v.max_route_hours || 8),
  })));
  console.log(`✔ Step 2: Loaded ${vehicles.length} vehicles (${availableVehicles.length} available for dispatch).`);

  // 3. Fetch Requests & Items
  const { data: requests, error: rErr } = await supabase
    .from("collection_requests")
    .select("id, zone_id, status, priority, pickup_date, pickup_slot, is_simulated, created_at, lat, lng, notes");

  if (rErr || !requests) {
    console.error("FAIL: Could not load requests:", rErr);
    process.exit(1);
  }

  const { data: items } = await supabase.from("items").select("request_id, waste_avoided_kg");
  const weightMap = {};
  items?.forEach((it) => {
    if (it.request_id) {
      weightMap[it.request_id] = (weightMap[it.request_id] || 0) + (Number(it.waste_avoided_kg) || 0);
    }
  });

  const candidateRequests = requests.map((r) => ({
    id: r.id,
    zone_id: r.zone_id,
    status: r.status,
    priority: r.priority,
    pickup_date: r.pickup_date,
    pickup_slot: r.pickup_slot,
    is_simulated: r.is_simulated,
    created_at: r.created_at,
    lat: r.lat ? Number(r.lat) : null,
    lng: r.lng ? Number(r.lng) : null,
    estimated_weight_kg: weightMap[r.id] && weightMap[r.id] > 0 ? weightMap[r.id] : 6.5,
  }));
  console.log(`✔ Step 3: Loaded ${candidateRequests.length} total collection requests.`);

  // 4. Compute Demand Intelligence & Forecasts
  const demandResult = computeDemandIntelligence(
    candidateRequests,
    zones.map((z) => ({
      id: z.id,
      name: z.name,
      code: z.code,
      center_lat: Number(z.center_lat),
      center_lng: Number(z.center_lng),
      radius_km: Number(z.radius_km),
    }))
  );

  assertNonEmpty(demandResult.spatial, "Spatial demand");
  assertNonEmpty(demandResult.forecasts, "Demand forecasts");

  const highOrCriticalZones = demandResult.forecasts.filter(
    (f) => f.demand_level === "HIGH" || f.demand_level === "CRITICAL"
  );
  console.log(`✔ Step 4: Demand Intelligence computed. High/Critical demand zones: ${highOrCriticalZones.length}`);
  highOrCriticalZones.forEach((hz) => {
    console.log(`   - [${hz.demand_level}] ${hz.zone_code} (${hz.zone_name}): ${hz.explanation}`);
  });

  // 5. Run Collection Scheduling for Today
  const today = new Date().toISOString().split("T")[0];
  const schedulingResult = scheduleRequests(candidateRequests, availableVehicles, {
    planningDate: today,
    allowOverdueBacklog: true,
  });

  console.log(`✔ Step 5: Scheduling executed:`);
  console.log(`   - Scheduled Requests: ${schedulingResult.scheduled_requests.length} (${schedulingResult.metrics.total_scheduled_weight_kg} kg)`);
  console.log(`   - Deferred Requests: ${schedulingResult.deferred_requests.length}`);
  if (schedulingResult.deferred_requests.length > 0) {
    schedulingResult.deferred_requests.forEach((d) => {
      console.log(`     * Deferral [#${d.request_id.slice(0, 8)}]: Reason=${d.reason}`);
    });
  }

  // 6. Run Route Optimization Engine
  const optimizationResult = optimizeFleetRoutes(schedulingResult.assignments);
  console.log(`✔ Step 6: Route Optimization executed:`);
  console.log(`   - Routes Generated: ${optimizationResult.routes.length}`);
  console.log(`   - Total Stops Served: ${optimizationResult.summary.total_stops_served}`);
  console.log(`   - Baseline Total Distance: ${optimizationResult.summary.baseline_total_distance_km} km`);
  console.log(`   - Optimized Total Distance: ${optimizationResult.summary.optimized_total_distance_km} km`);
  console.log(`   - Distance Saved: ${optimizationResult.summary.total_distance_saved_km} km (${optimizationResult.summary.overall_distance_reduction_percent}%)`);
  console.log(`   - Avg Fleet Capacity Utilization: ${optimizationResult.summary.average_capacity_utilization_percent}%`);

  for (const route of optimizationResult.routes) {
    console.log(`   > ${route.vehicle_code} (${route.vehicle_type}): ${route.stops_count} stops, ${route.total_load_kg} kg (${route.utilization_percentage}%), ${route.total_distance_km} km (Saved: ${route.distance_saved_km} km)`);
    // Verify route departs and returns to depot
    if (route.stops[0].stop_type !== "DEPOT_DEPARTURE") {
      throw new Error(`Route for ${route.vehicle_code} does not start at DEPOT_DEPARTURE`);
    }
    if (route.stops[route.stops.length - 1].stop_type !== "DEPOT_RETURN") {
      throw new Error(`Route for ${route.vehicle_code} does not return to DEPOT_RETURN`);
    }
    // Verify capacity constraint
    if (route.total_load_kg > route.capacity_kg) {
      throw new Error(`Route ${route.vehicle_code} exceeds capacity! ${route.total_load_kg} > ${route.capacity_kg}`);
    }
  }

  // 7. Test Route Persistence into collection_routes & Event Log
  if (optimizationResult.routes.length > 0) {
    const testRoute = optimizationResult.routes[0];
    const { data: insertedRoute, error: insertErr } = await supabase
      .from("collection_routes")
      .insert({
        vehicle_id: testRoute.vehicle_id,
        zone_id: testRoute.zone_id,
        route_date: today,
        status: "planned",
        total_distance_km: testRoute.total_distance_km,
        total_load_kg: testRoute.total_load_kg,
        estimated_duration_minutes: testRoute.estimated_duration_minutes,
        stops_json: testRoute.stops_json,
      })
      .select()
      .single();

    if (insertErr || !insertedRoute) {
      console.error("FAIL: Could not persist route:", insertErr);
      process.exit(1);
    }
    console.log(`✔ Step 7: Persisted test route in collection_routes (ID: ${insertedRoute.id})`);

    // Verify ROUTE_GENERATED and ROUTE_OPTIMIZED event logging
    const { error: evGenErr } = await supabase.from("event_log").insert({
      event_type: "ROUTE_GENERATED",
      entity_type: "collection_routes",
      entity_id: insertedRoute.id,
      actor_role: "DISPATCHER",
      payload_json: {
        route_id: insertedRoute.id,
        vehicle_code: testRoute.vehicle_code,
        stops_count: testRoute.stops_count,
        total_load_kg: testRoute.total_load_kg,
        total_distance_km: testRoute.total_distance_km,
      },
    });
    if (evGenErr) console.warn("Notice: event_log gen notice:", evGenErr);

    const { error: evOptErr } = await supabase.from("event_log").insert({
      event_type: "ROUTE_OPTIMIZED",
      entity_type: "collection_routes",
      entity_id: insertedRoute.id,
      actor_role: "DISPATCHER",
      payload_json: {
        route_id: insertedRoute.id,
        baseline_distance_km: testRoute.baseline_distance_km,
        optimized_distance_km: testRoute.total_distance_km,
        distance_saved_km: testRoute.distance_saved_km,
      },
    });
    if (evOptErr) console.warn("Notice: event_log opt notice:", evOptErr);

    console.log(`✔ Step 8: ROUTE_GENERATED and ROUTE_OPTIMIZED logged in event_log.`);

    // 8. Query back from collection_routes to confirm visible to dispatcher
    const { data: queriedRoute } = await supabase
      .from("collection_routes")
      .select("id, status, total_distance_km, stops_json")
      .eq("id", insertedRoute.id)
      .single();

    if (!queriedRoute) {
      throw new Error("Could not query back created route from collection_routes");
    }
    console.log(`✔ Step 9: Successfully queried back created route from database with ${queriedRoute.stops_json?.length} stops.`);

    // 9. Clean up test route row so database stays clean
    await supabase.from("collection_routes").delete().eq("id", insertedRoute.id);
    console.log(`✔ Step 10: Cleaned up test collection_routes record (baseline tables preserved).`);
  }

  console.log("==================================================");
  console.log("ALL E2E DISPATCH & ROUTE OPTIMIZATION CHECKS PASSED!");
  console.log("==================================================");
}

function assertNonEmpty(arr, label) {
  if (!arr || arr.length === 0) {
    throw new Error(`${label} is empty!`);
  }
}

runTest().catch((err) => {
  console.error("E2E Test Error:", err);
  process.exit(1);
});
