import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAvailableVehicles, calculateVehicleUtilization, type FleetVehicle } from "../lib/fleet-engine.ts";
import { scheduleRequests, type SchedulableRequest } from "../lib/scheduler.ts";
import {
  calculateTourDistance,
  optimizeVehicleRoute,
  optimizeFleetRoutes,
  apply2Opt,
} from "../lib/route-optimizer.ts";
import { calculateHaversineDistanceKm } from "../lib/zone-resolver.ts";

describe("PS-013 Fleet Engine & Scheduler Tests", () => {
  const sampleVehicle: FleetVehicle = {
    id: "veh-1",
    vehicle_code: "EV-VAN-01",
    capacity_kg: 100.0,
    vehicle_type: "EV_VAN",
    status: "available",
    depot_name: "HITEC Central Eco-Depot",
    depot_lat: 17.452,
    depot_lng: 78.384,
    max_route_hours: 8.0,
  };

  const maintVehicle: FleetVehicle = {
    ...sampleVehicle,
    id: "veh-2",
    vehicle_code: "EV-VAN-02",
    status: "maintenance",
  };

  it("filters out maintenance and inactive vehicles from available dispatch fleet", () => {
    const avail = getAvailableVehicles([sampleVehicle, maintVehicle]);
    assert.equal(avail.length, 1);
    assert.equal(avail[0].id, "veh-1");
  });

  it("calculates vehicle utilization accurately", () => {
    const util = calculateVehicleUtilization(sampleVehicle, 75.0);
    assert.equal(util.assigned_load_kg, 75.0);
    assert.equal(util.remaining_capacity_kg, 25.0);
    assert.equal(util.utilization_percentage, 75.0);
    assert.equal(util.is_overloaded, false);

    const overloaded = calculateVehicleUtilization(sampleVehicle, 120.0);
    assert.equal(overloaded.is_overloaded, true);
    assert.equal(overloaded.remaining_capacity_kg, 0);
  });

  it("respects vehicle capacity constraints and defers excess requests with reason", () => {
    const reqs: SchedulableRequest[] = [
      {
        id: "r1",
        zone_id: "z1",
        lat: 17.449,
        lng: 78.391,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 60.0,
      },
      {
        id: "r2",
        zone_id: "z1",
        lat: 17.451,
        lng: 78.385,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 30.0,
      },
      {
        id: "r3",
        zone_id: "z1",
        lat: 17.455,
        lng: 78.388,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 25.0, // Exceeds remaining 10 kg
      },
    ];

    const result = scheduleRequests(reqs, [sampleVehicle], { planningDate: "2026-10-10" });
    assert.equal(result.scheduled_requests.length, 2); // r1 + r2 = 90 kg <= 100 kg
    assert.equal(result.deferred_requests.length, 1); // r3 deferred
    assert.equal(result.deferred_requests[0].reason, "VEHICLE_CAPACITY_EXCEEDED");
    assert.ok(result.deferred_requests[0].explanation.includes("capacity"));
  });

  it("schedules urgent requests before normal requests (priority ordering)", () => {
    const reqs: SchedulableRequest[] = [
      {
        id: "r-normal",
        zone_id: "z1",
        lat: 17.449,
        lng: 78.391,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 70.0,
      },
      {
        id: "r-urgent",
        zone_id: "z1",
        lat: 17.451,
        lng: 78.385,
        priority: "urgent", // must be scheduled first
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 60.0,
      },
    ];

    // Vehicle can only take 100 kg. Urgent (60kg) fits, normal (70kg) cannot also fit!
    const result = scheduleRequests(reqs, [sampleVehicle], { planningDate: "2026-10-10" });
    assert.equal(result.scheduled_requests.length, 1);
    assert.equal(result.scheduled_requests[0].id, "r-urgent");
    assert.equal(result.deferred_requests[0].request_id, "r-normal");
  });

  it("defers requests with INVALID_LOCATION if lat/lng are null", () => {
    const reqs: SchedulableRequest[] = [
      {
        id: "r-invalid",
        zone_id: "z1",
        lat: null,
        lng: null,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 10.0,
      },
    ];

    const result = scheduleRequests(reqs, [sampleVehicle], { planningDate: "2026-10-10" });
    assert.equal(result.scheduled_requests.length, 0);
    assert.equal(result.deferred_requests[0].reason, "INVALID_LOCATION");
  });

  it("defers requests with NO_AVAILABLE_VEHICLE if fleet list is empty", () => {
    const reqs: SchedulableRequest[] = [
      {
        id: "r1",
        zone_id: "z1",
        lat: 17.45,
        lng: 78.39,
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        status: "pending",
        estimated_weight_kg: 10.0,
      },
    ];

    const result = scheduleRequests(reqs, [], { planningDate: "2026-10-10" });
    assert.equal(result.deferred_requests[0].reason, "NO_AVAILABLE_VEHICLE");
  });
});

describe("PS-013 Route Optimizer Engine Tests", () => {
  const vehicle: FleetVehicle = {
    id: "veh-hitec",
    vehicle_code: "EV-VAN-01",
    capacity_kg: 400.0,
    vehicle_type: "EV_VAN",
    status: "available",
    depot_name: "HITEC Central Eco-Depot",
    depot_lat: 17.452,
    depot_lng: 78.384,
    max_route_hours: 8.0,
  };

  it("handles empty stop list by returning zero distance and empty stops", () => {
    const route = optimizeVehicleRoute(vehicle, []);
    assert.equal(route.total_distance_km, 0);
    assert.equal(route.stops_count, 0);
    assert.equal(route.stops.length, 0);
  });

  it("handles single stop route with departure from depot and return to depot", () => {
    const singleStop: SchedulableRequest = {
      id: "req-single",
      zone_id: "z1",
      lat: 17.445,
      lng: 78.389,
      priority: "normal",
      pickup_date: "2026-10-10",
      pickup_slot: "09:00 - 12:00",
      status: "pending",
      estimated_weight_kg: 15.0,
    };

    const route = optimizeVehicleRoute(vehicle, [singleStop]);
    assert.equal(route.stops_count, 1);
    assert.equal(route.stops.length, 3); // Depot -> Stop -> Depot
    assert.equal(route.stops[0].stop_type, "DEPOT_DEPARTURE");
    assert.equal(route.stops[1].stop_type, "COLLECTION_STOP");
    assert.equal(route.stops[1].request_id, "req-single");
    assert.equal(route.stops[2].stop_type, "DEPOT_RETURN");
    assert.ok(route.total_distance_km > 0);
  });

  it("guarantees every served request appears exactly once in the route", () => {
    const reqs: SchedulableRequest[] = [
      { id: "s1", zone_id: "z1", lat: 17.441, lng: 78.382, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
      { id: "s2", zone_id: "z1", lat: 17.449, lng: 78.391, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 20 },
      { id: "s3", zone_id: "z1", lat: 17.458, lng: 78.372, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 15 },
    ];

    const route = optimizeVehicleRoute(vehicle, reqs);
    assert.equal(route.stops_count, 3);

    const stopIds = route.stops
      .filter((s) => s.stop_type === "COLLECTION_STOP")
      .map((s) => s.request_id);

    assert.equal(new Set(stopIds).size, 3);
    assert.ok(stopIds.includes("s1"));
    assert.ok(stopIds.includes("s2"));
    assert.ok(stopIds.includes("s3"));
  });

  it("calculates baseline vs optimized distance honestly and computes distance saved", () => {
    // Deliberately criss-crossed stops to ensure 2-opt can untangle and save distance
    const crissCrossStops: SchedulableRequest[] = [
      { id: "p1", zone_id: "z1", lat: 17.43, lng: 78.37, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
      { id: "p2", zone_id: "z1", lat: 17.47, lng: 78.41, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
      { id: "p3", zone_id: "z1", lat: 17.43, lng: 78.41, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
      { id: "p4", zone_id: "z1", lat: 17.47, lng: 78.37, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
    ];

    const route = optimizeVehicleRoute(vehicle, crissCrossStops);
    assert.ok(route.baseline_distance_km > 0);
    assert.ok(route.total_distance_km <= route.baseline_distance_km);
    assert.equal(route.distance_saved_km, Math.round((route.baseline_distance_km - route.total_distance_km) * 100) / 100);
  });

  it("is completely deterministic: identical inputs yield identical routes and distances", () => {
    const stops: SchedulableRequest[] = [
      { id: "a1", zone_id: "z1", lat: 17.441, lng: 78.382, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 10 },
      { id: "a2", zone_id: "z1", lat: 17.449, lng: 78.391, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 20 },
      { id: "a3", zone_id: "z1", lat: 17.458, lng: 78.372, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 15 },
    ];

    const run1 = optimizeVehicleRoute(vehicle, stops);
    const run2 = optimizeVehicleRoute(vehicle, stops);

    assert.equal(run1.total_distance_km, run2.total_distance_km);
    assert.equal(run1.baseline_distance_km, run2.baseline_distance_km);
    assert.deepEqual(
      run1.stops.map((s) => s.request_id),
      run2.stops.map((s) => s.request_id)
    );
  });

  it("BRUTE-FORCE VALIDATION: verifies heuristic produces near-optimal solution on small instance", () => {
    // 4 stops = 4! = 24 total tour permutations
    const points: SchedulableRequest[] = [
      { id: "b1", zone_id: "z1", lat: 17.445, lng: 78.385, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 5 },
      { id: "b2", zone_id: "z1", lat: 17.460, lng: 78.370, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 5 },
      { id: "b3", zone_id: "z1", lat: 17.450, lng: 78.400, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 5 },
      { id: "b4", zone_id: "z1", lat: 17.435, lng: 78.390, priority: "normal", pickup_date: "2026-10-10", pickup_slot: "09:00 - 12:00", status: "pending", estimated_weight_kg: 5 },
    ];

    // Generate all 24 permutations
    function getPermutations<T>(arr: T[]): T[][] {
      if (arr.length <= 1) return [arr];
      const result: T[][] = [];
      for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        for (const perm of getPermutations(remaining)) {
          result.push([current, ...perm]);
        }
      }
      return result;
    }

    const allPerms = getPermutations(points);
    assert.equal(allPerms.length, 24);

    let bruteForceMin = Infinity;
    for (const perm of allPerms) {
      const dist = calculateTourDistance(
        vehicle.depot_lat,
        vehicle.depot_lng,
        perm.map((p) => ({ lat: p.lat!, lng: p.lng! }))
      );
      if (dist < bruteForceMin) {
        bruteForceMin = dist;
      }
    }

    // Run our heuristic
    const heuristicRoute = optimizeVehicleRoute(vehicle, points);

    // Assert the heuristic reaches within 5% of the true global minimum (or matches it)
    assert.ok(
      heuristicRoute.total_distance_km <= bruteForceMin * 1.05 + 0.01,
      `Heuristic distance (${heuristicRoute.total_distance_km} km) exceeded brute-force minimum (${bruteForceMin} km) by more than 5%`
    );
  });
});
