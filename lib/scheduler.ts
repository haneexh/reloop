/**
 * PS-013 Collection Scheduler
 * Deterministic capacity-aware request scheduling and vehicle allocation.
 * Orders by priority (urgent > high > normal > low) and guarantees no request is silently lost.
 */

import { calculateVehicleUtilization, type FleetVehicle, type VehicleUtilization } from "./fleet-engine.ts";
import { calculateHaversineDistanceKm } from "./zone-resolver.ts";

export type DeferralReason =
  | "VEHICLE_CAPACITY_EXCEEDED"
  | "NO_AVAILABLE_VEHICLE"
  | "TIME_WINDOW_CONFLICT"
  | "OUTSIDE_PLANNING_HORIZON"
  | "INVALID_LOCATION";

export interface SchedulableRequest {
  id: string;
  zone_id: string | null;
  lat: number | null;
  lng: number | null;
  priority: "urgent" | "high" | "normal" | "low" | string;
  pickup_date: string | null;
  pickup_slot: string | null;
  status: string;
  estimated_weight_kg: number;
  is_simulated?: boolean;
  notes?: string | null;
}

export interface ScheduledAssignment {
  vehicle: FleetVehicle;
  requests: SchedulableRequest[];
  total_load_kg: number;
  utilization: VehicleUtilization;
}

export interface DeferredRequestRecord {
  request_id: string;
  reason: DeferralReason;
  explanation: string;
  suggested_action: string;
  request: SchedulableRequest;
}

export interface SchedulingResult {
  planning_date: string;
  assignments: ScheduledAssignment[];
  scheduled_requests: SchedulableRequest[];
  deferred_requests: DeferredRequestRecord[];
  metrics: {
    total_evaluated: number;
    total_scheduled: number;
    total_deferred: number;
    total_scheduled_weight_kg: number;
    total_deferred_weight_kg: number;
    vehicles_utilized_count: number;
  };
}

export interface SchedulerOptions {
  planningDate: string; // YYYY-MM-DD
  planningSlot?: string | null; // e.g. "09:00 - 12:00" or null for all
  maxHorizonDays?: number; // max days in future allowed
  allowOverdueBacklog?: boolean;
}

const PRIORITY_SCORES: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Deterministic comparison function for ordering requests before assignment:
 * 1. Priority score (urgent > high > normal > low)
 * 2. Overdue / target date alignment (earlier dates first)
 * 3. Weight descending (best fit for bin-packing)
 * 4. Stable tie-breaker by ID
 */
export function compareRequestsForScheduling(
  a: SchedulableRequest,
  b: SchedulableRequest,
  planningDate: string
): number {
  const pA = PRIORITY_SCORES[a.priority.toLowerCase()] || 2;
  const pB = PRIORITY_SCORES[b.priority.toLowerCase()] || 2;
  if (pA !== pB) return pB - pA; // Higher priority first

  const dateA = a.pickup_date || "9999-99-99";
  const dateB = b.pickup_date || "9999-99-99";

  // Prioritize dates matching planningDate or earlier (backlog)
  const isBacklogA = dateA <= planningDate;
  const isBacklogB = dateB <= planningDate;
  if (isBacklogA && !isBacklogB) return -1;
  if (!isBacklogA && isBacklogB) return 1;

  if (dateA !== dateB) return dateA.localeCompare(dateB);

  // Weight descending
  const wA = a.estimated_weight_kg || 5.0;
  const wB = b.estimated_weight_kg || 5.0;
  if (wA !== wB) return wB - wA;

  return a.id.localeCompare(b.id);
}

/**
 * Executes capacity-constrained municipal scheduling.
 */
export function scheduleRequests(
  requests: SchedulableRequest[],
  availableVehicles: FleetVehicle[],
  options: SchedulerOptions
): SchedulingResult {
  const planningDate = options.planningDate;
  const maxHorizon = options.maxHorizonDays ?? 2;
  const allowBacklog = options.allowOverdueBacklog ?? true;

  // Filter only eligible request statuses
  const candidateRequests = requests.filter((r) =>
    ["pending", "scheduled"].includes(r.status)
  );

  const deferred: DeferredRequestRecord[] = [];
  const validCandidates: SchedulableRequest[] = [];

  // 1. Initial Feasibility Validation
  for (const req of candidateRequests) {
    // Check valid coordinates
    if (
      req.lat === null ||
      req.lng === null ||
      isNaN(Number(req.lat)) ||
      isNaN(Number(req.lng))
    ) {
      deferred.push({
        request_id: req.id,
        reason: "INVALID_LOCATION",
        explanation: `Request #${req.id.slice(0, 8)} lacks valid GPS coordinates for routing.`,
        suggested_action: "Contact citizen to confirm street address or geocode manually.",
        request: req,
      });
      continue;
    }

    // Check Planning Horizon
    if (req.pickup_date) {
      const targetTime = new Date(req.pickup_date + "T00:00:00Z").getTime();
      const planTime = new Date(planningDate + "T00:00:00Z").getTime();
      const diffDays = (targetTime - planTime) / (1000 * 60 * 60 * 24);

      if (diffDays < 0 && !allowBacklog) {
        deferred.push({
          request_id: req.id,
          reason: "OUTSIDE_PLANNING_HORIZON",
          explanation: `Request scheduled for ${req.pickup_date} is before planning date ${planningDate}.`,
          suggested_action: "Reschedule to current active planning cycle.",
          request: req,
        });
        continue;
      }

      if (diffDays > maxHorizon) {
        deferred.push({
          request_id: req.id,
          reason: "OUTSIDE_PLANNING_HORIZON",
          explanation: `Request date ${req.pickup_date} is beyond planning horizon window (+${maxHorizon} days).`,
          suggested_action: "Hold in registry for subsequent route cycle.",
          request: req,
        });
        continue;
      }
    }

    // Check optional specific time slot filter
    if (options.planningSlot && req.pickup_slot && req.pickup_slot !== options.planningSlot) {
      deferred.push({
        request_id: req.id,
        reason: "TIME_WINDOW_CONFLICT",
        explanation: `Citizen specified time slot '${req.pickup_slot}' which does not match active batch '${options.planningSlot}'.`,
        suggested_action: "Include in corresponding time-window dispatch run.",
        request: req,
      });
      continue;
    }

    validCandidates.push(req);
  }

  // 2. Sort valid candidates deterministically
  validCandidates.sort((a, b) => compareRequestsForScheduling(a, b, planningDate));

  // 3. Check for available fleet
  if (availableVehicles.length === 0) {
    for (const req of validCandidates) {
      deferred.push({
        request_id: req.id,
        reason: "NO_AVAILABLE_VEHICLE",
        explanation: "No municipal fleet vehicles are currently in 'available' status.",
        suggested_action: "Release vehicle from maintenance or inspect depot fleet availability.",
        request: req,
      });
    }

    return {
      planning_date: planningDate,
      assignments: [],
      scheduled_requests: [],
      deferred_requests: deferred,
      metrics: {
        total_evaluated: candidateRequests.length,
        total_scheduled: 0,
        total_deferred: deferred.length,
        total_scheduled_weight_kg: 0,
        total_deferred_weight_kg: Math.round(
          deferred.reduce((sum, d) => sum + (d.request.estimated_weight_kg || 5), 0) * 10
        ) / 10,
        vehicles_utilized_count: 0,
      },
    };
  }

  // 4. Vehicle Capacity Allocation (Cluster-Aware Bin Packing)
  // Track assigned stops and loads per vehicle
  const vehicleAssignments = new Map<string, SchedulableRequest[]>();
  const vehicleLoads = new Map<string, number>();

  for (const v of availableVehicles) {
    vehicleAssignments.set(v.id, []);
    vehicleLoads.set(v.id, 0);
  }

  const scheduledList: SchedulableRequest[] = [];

  for (const req of validCandidates) {
    const weight = req.estimated_weight_kg && req.estimated_weight_kg > 0 ? req.estimated_weight_kg : 5.0;

    // Find candidate vehicles with sufficient remaining capacity
    let bestVehicle: FleetVehicle | null = null;
    let minDistanceScore = Infinity;

    for (const v of availableVehicles) {
      const currentLoad = vehicleLoads.get(v.id) || 0;
      if (currentLoad + weight <= v.capacity_kg) {
        // Calculate spatial proximity to vehicle depot or last assigned stop
        const assignedStops = vehicleAssignments.get(v.id) || [];
        let refLat = v.depot_lat;
        let refLng = v.depot_lng;

        if (assignedStops.length > 0) {
          const last = assignedStops[assignedStops.length - 1];
          if (last.lat !== null && last.lng !== null) {
            refLat = last.lat;
            refLng = last.lng;
          }
        }

        const dist = calculateHaversineDistanceKm(refLat, refLng, req.lat!, req.lng!);
        if (dist < minDistanceScore) {
          minDistanceScore = dist;
          bestVehicle = v;
        }
      }
    }

    if (bestVehicle) {
      // Successfully assign
      const currentList = vehicleAssignments.get(bestVehicle.id)!;
      currentList.push(req);
      const currentLoad = vehicleLoads.get(bestVehicle.id)!;
      vehicleLoads.set(bestVehicle.id, Math.round((currentLoad + weight) * 10) / 10);
      scheduledList.push(req);
    } else {
      // Fleet capacity exceeded
      deferred.push({
        request_id: req.id,
        reason: "VEHICLE_CAPACITY_EXCEEDED",
        explanation: `Combined e-waste weight of ${weight} kg exceeds remaining capacity across all available vehicles.`,
        suggested_action: "Allocate additional fleet capacity or defer to subsequent collection round.",
        request: req,
      });
    }
  }

  // 5. Build assignments structure
  const assignments: ScheduledAssignment[] = [];
  for (const v of availableVehicles) {
    const assignedReqs = vehicleAssignments.get(v.id) || [];
    if (assignedReqs.length > 0) {
      const load = vehicleLoads.get(v.id) || 0;
      assignments.push({
        vehicle: v,
        requests: assignedReqs,
        total_load_kg: load,
        utilization: calculateVehicleUtilization(v, load),
      });
    }
  }

  const scheduledWeight = Math.round(
    scheduledList.reduce((sum, r) => sum + (r.estimated_weight_kg || 5), 0) * 10
  ) / 10;
  const deferredWeight = Math.round(
    deferred.reduce((sum, d) => sum + (d.request.estimated_weight_kg || 5), 0) * 10
  ) / 10;

  return {
    planning_date: planningDate,
    assignments,
    scheduled_requests: scheduledList,
    deferred_requests: deferred,
    metrics: {
      total_evaluated: candidateRequests.length,
      total_scheduled: scheduledList.length,
      total_deferred: deferred.length,
      total_scheduled_weight_kg: scheduledWeight,
      total_deferred_weight_kg: deferredWeight,
      vehicles_utilized_count: assignments.length,
    },
  };
}
