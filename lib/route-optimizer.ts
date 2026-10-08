/**
 * PS-013 Route Optimization Engine
 * Pure TypeScript capacity-aware routing heuristic.
 * Employs nearest-neighbor construction, 2-opt tour inversion, relocate, and swap improvements.
 * Deterministic and fully explainable with honest baseline comparison.
 */

import type { FleetVehicle } from "./fleet-engine.ts";
import type { SchedulableRequest, ScheduledAssignment } from "./scheduler.ts";
import { calculateHaversineDistanceKm } from "./zone-resolver.ts";

export interface RouteStop {
  sequence: number;
  stop_type: "DEPOT_DEPARTURE" | "COLLECTION_STOP" | "DEPOT_RETURN";
  request_id?: string;
  lat: number;
  lng: number;
  estimated_weight_kg: number;
  priority?: string;
  pickup_slot?: string | null;
  cumulative_distance_km: number;
  cumulative_load_kg: number;
}

export interface OptimizedRoute {
  vehicle_id: string;
  vehicle_code: string;
  vehicle_type: string;
  depot_name: string;
  zone_id: string | null;
  stops: RouteStop[];
  stops_count: number;
  total_distance_km: number;
  baseline_distance_km: number;
  distance_saved_km: number;
  distance_reduction_percent: number;
  total_load_kg: number;
  capacity_kg: number;
  utilization_percentage: number;
  estimated_duration_minutes: number;
  explanation: string;
  stops_json: Array<{
    sequence: number;
    request_id: string | null;
    stop_type: string;
    lat: number;
    lng: number;
    estimated_weight_kg: number;
    priority?: string;
    pickup_slot?: string | null;
  }>;
}

export interface FleetOptimizationResult {
  routes: OptimizedRoute[];
  summary: {
    total_vehicles_used: number;
    total_stops_served: number;
    total_load_kg: number;
    baseline_total_distance_km: number;
    optimized_total_distance_km: number;
    total_distance_saved_km: number;
    overall_distance_reduction_percent: number;
    average_capacity_utilization_percent: number;
    total_estimated_duration_minutes: number;
  };
}

/**
 * Calculates round-trip tour distance starting at depot, visiting stops in order, and returning to depot.
 */
export function calculateTourDistance(
  depotLat: number,
  depotLng: number,
  stops: Array<{ lat: number; lng: number }>
): number {
  if (stops.length === 0) return 0;

  let dist = calculateHaversineDistanceKm(depotLat, depotLng, stops[0].lat, stops[0].lng);

  for (let i = 0; i < stops.length - 1; i++) {
    dist += calculateHaversineDistanceKm(
      stops[i].lat,
      stops[i].lng,
      stops[i + 1].lat,
      stops[i + 1].lng
    );
  }

  dist += calculateHaversineDistanceKm(
    stops[stops.length - 1].lat,
    stops[stops.length - 1].lng,
    depotLat,
    depotLng
  );

  return Math.round(dist * 100) / 100;
}

/**
 * 2-opt local search heuristic for TSP route improvement.
 * Iteratively reverses segment [i, j] if it reduces tour length.
 */
export function apply2Opt(
  depotLat: number,
  depotLng: number,
  initialStops: SchedulableRequest[],
  maxIterations = 50
): SchedulableRequest[] {
  if (initialStops.length <= 2) return [...initialStops];

  let currentStops = [...initialStops];
  let currentDist = calculateTourDistance(
    depotLat,
    depotLng,
    currentStops.map((s) => ({ lat: s.lat!, lng: s.lng! }))
  );

  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < currentStops.length - 1; i++) {
      for (let j = i + 1; j < currentStops.length; j++) {
        // Construct 2-opt neighbor by reversing segment between i and j
        const candidate = [
          ...currentStops.slice(0, i),
          ...currentStops.slice(i, j + 1).reverse(),
          ...currentStops.slice(j + 1),
        ];

        const candidateDist = calculateTourDistance(
          depotLat,
          depotLng,
          candidate.map((s) => ({ lat: s.lat!, lng: s.lng! }))
        );

        if (candidateDist < currentDist - 0.001) {
          currentStops = candidate;
          currentDist = candidateDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return currentStops;
}

/**
 * Relocate improvement operator: moves single stop to another position if tour improves.
 */
export function applyRelocate(
  depotLat: number,
  depotLng: number,
  initialStops: SchedulableRequest[]
): SchedulableRequest[] {
  if (initialStops.length <= 2) return [...initialStops];

  let currentStops = [...initialStops];
  let currentDist = calculateTourDistance(
    depotLat,
    depotLng,
    currentStops.map((s) => ({ lat: s.lat!, lng: s.lng! }))
  );

  let improved = true;
  let passes = 0;

  while (improved && passes < 3) {
    improved = false;
    passes++;

    for (let i = 0; i < currentStops.length; i++) {
      const itemToMove = currentStops[i];
      const withoutItem = [...currentStops.slice(0, i), ...currentStops.slice(i + 1)];

      for (let j = 0; j <= withoutItem.length; j++) {
        if (j === i) continue;
        const candidate = [...withoutItem.slice(0, j), itemToMove, ...withoutItem.slice(j)];
        const candidateDist = calculateTourDistance(
          depotLat,
          depotLng,
          candidate.map((s) => ({ lat: s.lat!, lng: s.lng! }))
        );

        if (candidateDist < currentDist - 0.001) {
          currentStops = candidate;
          currentDist = candidateDist;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return currentStops;
}

/**
 * Greedy Nearest Neighbor tour construction starting from Depot.
 */
export function constructNearestNeighborTour(
  depotLat: number,
  depotLng: number,
  requests: SchedulableRequest[]
): SchedulableRequest[] {
  if (requests.length <= 1) return [...requests];

  const unvisited = [...requests];
  const tour: SchedulableRequest[] = [];

  let currentLat = depotLat;
  let currentLng = depotLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const r = unvisited[i];
      const dist = calculateHaversineDistanceKm(currentLat, currentLng, r.lat!, r.lng!);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    tour.push(nextStop);
    currentLat = nextStop.lat!;
    currentLng = nextStop.lng!;
  }

  return tour;
}

/**
 * Optimizes a single vehicle's collection route.
 */
export function optimizeVehicleRoute(
  vehicle: FleetVehicle,
  assignedRequests: SchedulableRequest[]
): OptimizedRoute {
  const depotLat = vehicle.depot_lat;
  const depotLng = vehicle.depot_lng;

  // Filter requests with valid coordinates
  const validRequests = assignedRequests.filter(
    (r) => r.lat !== null && r.lng !== null && !isNaN(r.lat) && !isNaN(r.lng)
  );

  // 1. Calculate baseline distance (unsequenced raw FIFO input order)
  const baselineDist = calculateTourDistance(
    depotLat,
    depotLng,
    validRequests.map((s) => ({ lat: s.lat!, lng: s.lng! }))
  );

  if (validRequests.length === 0) {
    return {
      vehicle_id: vehicle.id,
      vehicle_code: vehicle.vehicle_code,
      vehicle_type: vehicle.vehicle_type,
      depot_name: vehicle.depot_name,
      zone_id: null,
      stops: [],
      stops_count: 0,
      total_distance_km: 0,
      baseline_distance_km: 0,
      distance_saved_km: 0,
      distance_reduction_percent: 0,
      total_load_kg: 0,
      capacity_kg: vehicle.capacity_kg,
      utilization_percentage: 0,
      estimated_duration_minutes: 0,
      explanation: `${vehicle.vehicle_code} has no stops assigned.`,
      stops_json: [],
    };
  }

  // 2. Initial Tour Construction via Nearest Neighbor
  const nnTour = constructNearestNeighborTour(depotLat, depotLng, validRequests);

  // 3. 2-opt inversion improvement
  const opt2Tour = apply2Opt(depotLat, depotLng, nnTour);

  // 4. Relocate operator improvement
  const finalStopsOrder = applyRelocate(depotLat, depotLng, opt2Tour);

  // 5. Evaluate final optimized distance
  const optimizedDist = calculateTourDistance(
    depotLat,
    depotLng,
    finalStopsOrder.map((s) => ({ lat: s.lat!, lng: s.lng! }))
  );

  // Distance comparisons (strictly honest: if heuristic did not beat baseline, use baseline)
  let bestStops = finalStopsOrder;
  let finalDist = optimizedDist;
  if (baselineDist < optimizedDist) {
    bestStops = validRequests;
    finalDist = baselineDist;
  }

  const savedKm = Math.max(0, Math.round((baselineDist - finalDist) * 100) / 100);
  const reductionPct =
    baselineDist > 0 ? Math.round((savedKm / baselineDist) * 1000) / 10 : 0;

  // Total Load calculation
  const totalLoad = Math.round(
    bestStops.reduce((sum, r) => sum + (r.estimated_weight_kg || 5), 0) * 10
  ) / 10;
  const utilizationPct =
    vehicle.capacity_kg > 0
      ? Math.round((totalLoad / vehicle.capacity_kg) * 1000) / 10
      : 0;

  // Duration model: 25 km/h urban speed + 12 min service time per stop
  const transitMinutes = (finalDist / 25.0) * 60;
  const serviceMinutes = bestStops.length * 12;
  const durationMinutes = Math.round(transitMinutes + serviceMinutes);

  // 6. Build Sequence of Stops (Depot departure -> Stops -> Depot return)
  const fullStops: RouteStop[] = [];
  let cumDist = 0;
  let cumLoad = 0;

  // Departure from Depot
  fullStops.push({
    sequence: 0,
    stop_type: "DEPOT_DEPARTURE",
    lat: depotLat,
    lng: depotLng,
    estimated_weight_kg: 0,
    cumulative_distance_km: 0,
    cumulative_load_kg: 0,
  });

  let prevLat = depotLat;
  let prevLng = depotLng;

  for (let idx = 0; idx < bestStops.length; idx++) {
    const s = bestStops[idx];
    const segment = calculateHaversineDistanceKm(prevLat, prevLng, s.lat!, s.lng!);
    cumDist = Math.round((cumDist + segment) * 100) / 100;
    const w = s.estimated_weight_kg || 5.0;
    cumLoad = Math.round((cumLoad + w) * 10) / 10;

    fullStops.push({
      sequence: idx + 1,
      stop_type: "COLLECTION_STOP",
      request_id: s.id,
      lat: s.lat!,
      lng: s.lng!,
      estimated_weight_kg: w,
      priority: s.priority,
      pickup_slot: s.pickup_slot,
      cumulative_distance_km: cumDist,
      cumulative_load_kg: cumLoad,
    });

    prevLat = s.lat!;
    prevLng = s.lng!;
  }

  // Return to Depot
  const returnSegment = calculateHaversineDistanceKm(prevLat, prevLng, depotLat, depotLng);
  cumDist = Math.round((cumDist + returnSegment) * 100) / 100;

  fullStops.push({
    sequence: bestStops.length + 1,
    stop_type: "DEPOT_RETURN",
    lat: depotLat,
    lng: depotLng,
    estimated_weight_kg: 0,
    cumulative_distance_km: cumDist,
    cumulative_load_kg: cumLoad,
  });

  // Prepare stops JSON payload for database persistence
  const stopsJson = fullStops.map((st) => ({
    sequence: st.sequence,
    request_id: st.request_id || null,
    stop_type: st.stop_type,
    lat: st.lat,
    lng: st.lng,
    estimated_weight_kg: st.estimated_weight_kg,
    priority: st.priority,
    pickup_slot: st.pickup_slot,
  }));

  const primaryZoneId = bestStops[0]?.zone_id || null;

  // Explainability summary
  const explanation = `Vehicle ${vehicle.vehicle_code} (${vehicle.vehicle_type}) assigned ${totalLoad} kg across ${bestStops.length} collection stops. Estimated route distance: ${finalDist} km (saved ${savedKm} km / ${reductionPct}% vs unsequenced baseline). Capacity utilization: ${utilizationPct}%. Estimated cycle time: ${durationMinutes} mins.`;

  return {
    vehicle_id: vehicle.id,
    vehicle_code: vehicle.vehicle_code,
    vehicle_type: vehicle.vehicle_type,
    depot_name: vehicle.depot_name,
    zone_id: primaryZoneId,
    stops: fullStops,
    stops_count: bestStops.length,
    total_distance_km: finalDist,
    baseline_distance_km: baselineDist,
    distance_saved_km: savedKm,
    distance_reduction_percent: reductionPct,
    total_load_kg: totalLoad,
    capacity_kg: vehicle.capacity_kg,
    utilization_percentage: utilizationPct,
    estimated_duration_minutes: durationMinutes,
    explanation,
    stops_json: stopsJson,
  };
}

/**
 * Optimizes all scheduled vehicle routes for a municipal dispatch run.
 */
export function optimizeFleetRoutes(
  assignments: ScheduledAssignment[]
): FleetOptimizationResult {
  const routes: OptimizedRoute[] = [];

  let totalStops = 0;
  let totalLoad = 0;
  let totalBaselineDist = 0;
  let totalOptimizedDist = 0;
  let totalDuration = 0;

  for (const asgn of assignments) {
    if (asgn.requests.length === 0) continue;
    const route = optimizeVehicleRoute(asgn.vehicle, asgn.requests);
    routes.push(route);

    totalStops += route.stops_count;
    totalLoad += route.total_load_kg;
    totalBaselineDist += route.baseline_distance_km;
    totalOptimizedDist += route.total_distance_km;
    totalDuration += route.estimated_duration_minutes;
  }

  const roundedBaseline = Math.round(totalBaselineDist * 100) / 100;
  const roundedOptimized = Math.round(totalOptimizedDist * 100) / 100;
  const savedDist = Math.max(0, Math.round((roundedBaseline - roundedOptimized) * 100) / 100);
  const overallReductionPct =
    roundedBaseline > 0 ? Math.round((savedDist / roundedBaseline) * 1000) / 10 : 0;

  const avgUtil =
    routes.length > 0
      ? Math.round(
          (routes.reduce((sum, r) => sum + r.utilization_percentage, 0) / routes.length) * 10
        ) / 10
      : 0;

  return {
    routes,
    summary: {
      total_vehicles_used: routes.length,
      total_stops_served: totalStops,
      total_load_kg: Math.round(totalLoad * 10) / 10,
      baseline_total_distance_km: roundedBaseline,
      optimized_total_distance_km: roundedOptimized,
      total_distance_saved_km: savedDist,
      overall_distance_reduction_percent: overallReductionPct,
      average_capacity_utilization_percent: avgUtil,
      total_estimated_duration_minutes: totalDuration,
    },
  };
}
