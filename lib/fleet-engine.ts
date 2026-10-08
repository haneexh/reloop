/**
 * PS-013 Fleet Engine & Vehicle Management
 * Deterministic fleet capacity and allocation helpers.
 */

export type VehicleType = "EV_VAN" | "CNG_TRUCK" | "MINI_TRUCK";
export type VehicleStatus = "available" | "assigned" | "in_route" | "maintenance" | "inactive";

export interface FleetVehicle {
  id: string;
  vehicle_code: string;
  capacity_kg: number;
  vehicle_type: VehicleType;
  status: VehicleStatus;
  depot_name: string;
  depot_lat: number;
  depot_lng: number;
  max_route_hours: number;
}

export interface VehicleUtilization {
  vehicle_id: string;
  vehicle_code: string;
  capacity_kg: number;
  assigned_load_kg: number;
  remaining_capacity_kg: number;
  utilization_percentage: number;
  is_overloaded: boolean;
}

export interface FleetCapacityAssessment {
  total_vehicles: number;
  available_vehicles: number;
  maintenance_vehicles: number;
  total_fleet_capacity_kg: number;
  available_capacity_kg: number;
  total_assigned_load_kg: number;
  fleet_utilization_percentage: number;
  by_type: Record<
    VehicleType,
    { count: number; available_count: number; total_capacity_kg: number }
  >;
}

/**
 * Filters fleet for dispatch-eligible vehicles (status === 'available').
 * Never automatically assigns maintenance or inactive units.
 */
export function getAvailableVehicles(vehicles: FleetVehicle[]): FleetVehicle[] {
  return vehicles.filter((v) => v.status === "available");
}

/**
 * Calculates deterministic capacity utilization for a single vehicle.
 */
export function calculateVehicleUtilization(
  vehicle: FleetVehicle,
  assignedLoadKg: number
): VehicleUtilization {
  const roundedLoad = Math.round(assignedLoadKg * 10) / 10;
  const remaining = Math.max(0, Math.round((vehicle.capacity_kg - roundedLoad) * 10) / 10);
  const rawPct = vehicle.capacity_kg > 0 ? (roundedLoad / vehicle.capacity_kg) * 100 : 0;
  const pct = Math.round(rawPct * 10) / 10;

  return {
    vehicle_id: vehicle.id,
    vehicle_code: vehicle.vehicle_code,
    capacity_kg: vehicle.capacity_kg,
    assigned_load_kg: roundedLoad,
    remaining_capacity_kg: remaining,
    utilization_percentage: pct,
    is_overloaded: roundedLoad > vehicle.capacity_kg,
  };
}

/**
 * Computes comprehensive fleet capacity and availability summary.
 */
export function assessFleetCapacity(
  vehicles: FleetVehicle[],
  assignedLoads: Record<string, number> = {}
): FleetCapacityAssessment {
  let totalCap = 0;
  let availCap = 0;
  let totalAssigned = 0;
  let availCount = 0;
  let maintCount = 0;

  const byType: Record<
    VehicleType,
    { count: number; available_count: number; total_capacity_kg: number }
  > = {
    EV_VAN: { count: 0, available_count: 0, total_capacity_kg: 0 },
    CNG_TRUCK: { count: 0, available_count: 0, total_capacity_kg: 0 },
    MINI_TRUCK: { count: 0, available_count: 0, total_capacity_kg: 0 },
  };

  for (const v of vehicles) {
    totalCap += v.capacity_kg;
    const typeKey = v.vehicle_type as VehicleType;
    if (byType[typeKey]) {
      byType[typeKey].count++;
      byType[typeKey].total_capacity_kg += v.capacity_kg;
    }

    const assigned = assignedLoads[v.id] || 0;
    totalAssigned += assigned;

    if (v.status === "available") {
      availCount++;
      availCap += v.capacity_kg;
      if (byType[typeKey]) byType[typeKey].available_count++;
    } else if (v.status === "maintenance" || v.status === "inactive") {
      maintCount++;
    }
  }

  const fleetUtilPct =
    availCap > 0 ? Math.round((totalAssigned / availCap) * 1000) / 10 : 0;

  return {
    total_vehicles: vehicles.length,
    available_vehicles: availCount,
    maintenance_vehicles: maintCount,
    total_fleet_capacity_kg: Math.round(totalCap * 10) / 10,
    available_capacity_kg: Math.round(availCap * 10) / 10,
    total_assigned_load_kg: Math.round(totalAssigned * 10) / 10,
    fleet_utilization_percentage: fleetUtilPct,
    by_type: byType,
  };
}
