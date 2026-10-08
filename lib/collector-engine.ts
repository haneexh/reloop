/**
 * PS-013 Collector Operations Engine
 * Pure TypeScript business logic for mobile field collection, QR verification,
 * scale weight validation, capacity safety, and route lifecycle progression.
 */

export type CollectorAuthRole = "COLLECTOR" | "DISPATCHER" | "ADMIN";

export type VerificationMethod = "qr_scan" | "manual" | "digital_scale";

export interface RouteStopDetail {
  sequence: number;
  request_id: string | null;
  stop_type: "DEPOT_DEPARTURE" | "COLLECTION_STOP" | "DEPOT_RETURN";
  lat: number;
  lng: number;
  estimated_weight_kg: number;
  priority?: string;
  pickup_slot?: string | null;
  status?: string;
  qr_token?: string | null;
  locality?: string;
  items_summary?: string;
  is_collected?: boolean;
  actual_weight_kg?: number | null;
  collected_at?: string | null;
}

export interface RouteProgress {
  total_stops: number;
  completed_stops: number;
  remaining_stops: number;
  completion_percentage: number;
  total_estimated_kg: number;
  total_actual_kg: number;
  vehicle_capacity_kg: number;
  remaining_capacity_kg: number;
  utilization_percentage: number;
}

export interface WeightValidationResult {
  valid: boolean;
  error?: string;
  weight?: number;
  variance_kg?: number;
  variance_percent?: number;
}

export interface StopValidationResult {
  valid: boolean;
  error?: string;
  code?:
    | "ROUTE_NOT_ACTIVE"
    | "NOT_ON_ROUTE"
    | "REQUEST_CANCELLED"
    | "ALREADY_COLLECTED"
    | "RECORD_EXISTS";
}

/**
 * Validates whether the given role is authorized to perform field collection operations.
 * CITIZEN is strictly denied.
 */
export function isAuthorizedCollector(role: unknown): boolean {
  if (typeof role !== "string") return false;
  const upper = role.toUpperCase();
  return upper === "COLLECTOR" || upper === "DISPATCHER" || upper === "ADMIN";
}

/**
 * Validates actual weight against vehicle limits and reasonable bounds.
 */
export function validateActualWeight(
  weightInput: unknown,
  vehicleCapacityKg: number,
  currentLoadedKg: number = 0
): WeightValidationResult {
  const parsed = Number(weightInput);

  if (typeof weightInput === "undefined" || weightInput === null || isNaN(parsed)) {
    return { valid: false, error: "Actual weight must be a valid number." };
  }

  if (parsed <= 0) {
    return { valid: false, error: "Actual weight must be greater than 0 kg." };
  }

  if (parsed > 1000) {
    return { valid: false, error: "Actual weight exceeds maximum allowable single pickup limit (1000 kg)." };
  }

  const remainingCapacity = Math.max(0, vehicleCapacityKg - currentLoadedKg);
  const roundedRemaining = Math.round(remainingCapacity * 10) / 10;

  if (parsed > roundedRemaining + 0.001) {
    return {
      valid: false,
      error: `Capacity overflow: ${parsed.toFixed(1)} kg exceeds vehicle remaining capacity (${roundedRemaining.toFixed(1)} kg of ${vehicleCapacityKg} kg total).`,
    };
  }

  return {
    valid: true,
    weight: Math.round(parsed * 10) / 10,
  };
}

/**
 * Computes weight variance between estimated and actual weighed pickup.
 */
export function calculateWeightVariance(
  estimatedKg: number,
  actualKg: number
): { variance_kg: number; variance_percent: number } {
  const est = Math.max(0.1, Number(estimatedKg) || 0.1);
  const act = Number(actualKg) || 0;
  const variance_kg = Math.round((act - est) * 10) / 10;
  const variance_percent = Math.round(((act - est) / est) * 1000) / 10;

  return { variance_kg, variance_percent };
}

/**
 * Validates that a target request is eligible for collection on the given route.
 */
export function validateStopForCollection(params: {
  routeStops: Array<{ request_id?: string | null; stop_type: string }>;
  requestId: string;
  requestStatus: string;
  existingRecordCount: number;
  routeStatus: string;
}): StopValidationResult {
  const { routeStops, requestId, requestStatus, existingRecordCount, routeStatus } = params;

  if (routeStatus === "cancelled") {
    return {
      valid: false,
      error: "Cannot collect stop: Collection route has been cancelled.",
      code: "ROUTE_NOT_ACTIVE",
    };
  }

  // Check stop presence
  const stopMatches = routeStops.some(
    (s) => s.stop_type === "COLLECTION_STOP" && s.request_id === requestId
  );

  if (!stopMatches) {
    return {
      valid: false,
      error: "Security validation failed: Request ID does not belong to this assigned route.",
      code: "NOT_ON_ROUTE",
    };
  }

  if (requestStatus === "cancelled") {
    return {
      valid: false,
      error: "Cannot collect: Request has been cancelled by citizen or municipal operator.",
      code: "REQUEST_CANCELLED",
    };
  }

  if (requestStatus === "collected" || requestStatus === "weighed") {
    return {
      valid: false,
      error: `Request has already been processed (Current status: ${requestStatus}).`,
      code: "ALREADY_COLLECTED",
    };
  }

  if (existingRecordCount > 0) {
    return {
      valid: false,
      error: "Duplicate collection detected: A verified collection record already exists for this request.",
      code: "RECORD_EXISTS",
    };
  }

  return { valid: true };
}

/**
 * Derives route progress metrics 100% from database state.
 */
export function calculateRouteProgress(
  stops: Array<{ request_id?: string | null; stop_type: string; estimated_weight_kg?: number }>,
  completedRequestIds: Set<string>,
  vehicleCapacityKg: number,
  actualWeightsByRequestId: Map<string, number>
): RouteProgress {
  const collectionStops = stops.filter(
    (s) => s.stop_type === "COLLECTION_STOP" && s.request_id
  );

  const totalStops = collectionStops.length;
  let completedStops = 0;
  let totalEstimatedKg = 0;
  let totalActualKg = 0;

  for (const s of collectionStops) {
    const reqId = s.request_id!;
    totalEstimatedKg += Number(s.estimated_weight_kg) || 0;

    if (completedRequestIds.has(reqId)) {
      completedStops++;
      const actualWeight = actualWeightsByRequestId.get(reqId);
      if (typeof actualWeight === "number") {
        totalActualKg += actualWeight;
      } else {
        totalActualKg += Number(s.estimated_weight_kg) || 0;
      }
    }
  }

  const remainingStops = Math.max(0, totalStops - completedStops);
  const completionPercentage =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 1000) / 10 : 0;
  const remainingCapacityKg = Math.max(0, vehicleCapacityKg - totalActualKg);
  const utilizationPercentage =
    vehicleCapacityKg > 0
      ? Math.round((totalActualKg / vehicleCapacityKg) * 1000) / 10
      : 0;

  return {
    total_stops: totalStops,
    completed_stops: completedStops,
    remaining_stops: remainingStops,
    completion_percentage: completionPercentage,
    total_estimated_kg: Math.round(totalEstimatedKg * 10) / 10,
    total_actual_kg: Math.round(totalActualKg * 10) / 10,
    vehicle_capacity_kg: Math.round(vehicleCapacityKg * 10) / 10,
    remaining_capacity_kg: Math.round(remainingCapacityKg * 10) / 10,
    utilization_percentage: utilizationPercentage,
  };
}

/**
 * Mask raw address to safe municipal locality to prevent exposing private household PII.
 */
export function maskAddressForCollector(
  address: string | null | undefined,
  zoneName?: string
): string {
  if (!address || address.trim().length === 0) {
    return zoneName ? `${zoneName}, Hyderabad` : "Hyderabad Metropolitan Area";
  }

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join(", ");
  }

  return parts[0] || (zoneName ? `${zoneName}, Hyderabad` : "Hyderabad Metropolitan Area");
}
