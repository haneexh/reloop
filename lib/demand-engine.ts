/**
 * PS-013 Demand Intelligence & Forecasting Engine
 * Pure TypeScript deterministic spatial & temporal aggregation and demand forecasting.
 * No external LLM or black-box algorithms are used.
 */

export interface DemandScoringWeights {
  volumeWeight: number; // Points per request
  weightKgWeight: number; // Points per kg of e-waste
  urgentPriorityBonus: number; // Bonus for urgent requests
  highPriorityBonus: number; // Bonus for high priority requests
  recencyWindowHours: number; // Hours considered recent
  recencyBonus: number; // Bonus for recent requests
}

export const DEMAND_SCORING_WEIGHTS: DemandScoringWeights = {
  volumeWeight: 10.0,
  weightKgWeight: 1.5,
  urgentPriorityBonus: 25.0,
  highPriorityBonus: 15.0,
  recencyWindowHours: 24,
  recencyBonus: 10.0,
};

export type DemandLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DemandRequestItem {
  id: string;
  zone_id: string | null;
  status: string;
  priority: string;
  pickup_date: string | null;
  pickup_slot: string | null;
  is_simulated: boolean;
  created_at: string;
  lat: number | null;
  lng: number | null;
  estimated_weight_kg?: number;
  notes?: string | null;
}

export interface ZoneMetadata {
  id: string;
  name: string;
  code: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
}

export interface ZoneSpatialDemand {
  zone_id: string;
  zone_code: string;
  zone_name: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  request_count: number;
  total_estimated_weight_kg: number;
  average_request_weight_kg: number;
  high_priority_count: number;
  urgent_count: number;
  pending_count: number;
  scheduled_count: number;
  assigned_count: number;
  real_request_count: number;
  simulated_request_count: number;
  latest_request_at: string | null;
  demand_score: number;
}

export interface TemporalDateAggregation {
  date: string;
  total_requests: number;
  total_weight_kg: number;
  real_requests: number;
  simulated_requests: number;
  slots: Record<string, { requests: number; weight_kg: number }>;
}

export interface WeekdayDistribution {
  weekday_index: number; // 0=Sunday, 6=Saturday
  weekday_name: string;
  total_requests: number;
  total_weight_kg: number;
  average_daily_requests: number;
}

export interface TemporalDemandSummary {
  by_date: TemporalDateAggregation[];
  by_slot: Record<string, { requests: number; weight_kg: number }>;
  by_weekday: WeekdayDistribution[];
  total_requests: number;
  total_weight_kg: number;
  real_requests_count: number;
  simulated_requests_count: number;
}

export interface ZoneForecast {
  zone_id: string;
  zone_code: string;
  zone_name: string;
  forecast_request_count: number;
  forecast_weight_kg: number;
  recommended_collection_window: string;
  demand_level: DemandLevel;
  explanation: string;
  is_simulated_basis: boolean;
}

export interface DemandIntelligenceSummary {
  spatial: ZoneSpatialDemand[];
  temporal: TemporalDemandSummary;
  forecasts: ZoneForecast[];
  planning_summary: {
    total_planning_requests: number;
    total_planning_weight_kg: number;
    pending_unassigned_requests: number;
    critical_zones_count: number;
    high_demand_zones_count: number;
    real_requests_percentage: number;
    generated_at: string;
  };
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Calculates deterministic demand score for a zone based on volume, mass, priority, and recency.
 */
export function calculateDemandScore(
  requestCount: number,
  totalWeightKg: number,
  highPriorityCount: number,
  urgentCount: number,
  latestRequestAt: string | null,
  weights: DemandScoringWeights = DEMAND_SCORING_WEIGHTS,
  now: Date = new Date()
): number {
  if (requestCount <= 0) return 0;

  const volumePoints = requestCount * weights.volumeWeight;
  const weightPoints = totalWeightKg * weights.weightKgWeight;
  const priorityPoints =
    urgentCount * weights.urgentPriorityBonus +
    highPriorityCount * weights.highPriorityBonus;

  let recencyPoints = 0;
  if (latestRequestAt) {
    const diffHours = (now.getTime() - new Date(latestRequestAt).getTime()) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours <= weights.recencyWindowHours) {
      recencyPoints = weights.recencyBonus;
    }
  }

  const rawScore = volumePoints + weightPoints + priorityPoints + recencyPoints;
  return Math.round(rawScore * 10) / 10;
}

/**
 * Categorizes a numeric demand score and priority profile into a discrete DemandLevel.
 */
export function categorizeDemandLevel(
  score: number,
  urgentCount: number,
  requestCount: number,
  totalWeightKg: number
): DemandLevel {
  if (urgentCount >= 1 || score >= 150 || totalWeightKg >= 100) {
    return "CRITICAL";
  }
  if (score >= 80 || requestCount >= 5 || totalWeightKg >= 50) {
    return "HIGH";
  }
  if (score >= 30 || requestCount >= 2) {
    return "MEDIUM";
  }
  return "LOW";
}

/**
 * Performs spatial aggregation of collection requests across zones.
 * Filters only planning-relevant statuses: pending, scheduled, assigned.
 */
export function aggregateSpatialDemand(
  requests: DemandRequestItem[],
  zones: ZoneMetadata[],
  now: Date = new Date()
): ZoneSpatialDemand[] {
  const relevantRequests = requests.filter((r) =>
    ["pending", "scheduled", "assigned"].includes(r.status)
  );

  return zones.map((zone) => {
    const zoneRequests = relevantRequests.filter((r) => r.zone_id === zone.id);

    let totalWeight = 0;
    let highPriorityCount = 0;
    let urgentCount = 0;
    let pendingCount = 0;
    let scheduledCount = 0;
    let assignedCount = 0;
    let realCount = 0;
    let simulatedCount = 0;
    let latestTimestamp: string | null = null;

    for (const r of zoneRequests) {
      const weight = r.estimated_weight_kg && r.estimated_weight_kg > 0 ? r.estimated_weight_kg : 5.0;
      totalWeight += weight;

      if (r.priority === "urgent") urgentCount++;
      else if (r.priority === "high") highPriorityCount++;

      if (r.status === "pending") pendingCount++;
      else if (r.status === "scheduled") scheduledCount++;
      else if (r.status === "assigned") assignedCount++;

      if (r.is_simulated) simulatedCount++;
      else realCount++;

      if (r.created_at) {
        if (!latestTimestamp || new Date(r.created_at) > new Date(latestTimestamp)) {
          latestTimestamp = r.created_at;
        }
      }
    }

    const roundedWeight = Math.round(totalWeight * 10) / 10;
    const avgWeight =
      zoneRequests.length > 0
        ? Math.round((roundedWeight / zoneRequests.length) * 10) / 10
        : 0;

    const demandScore = calculateDemandScore(
      zoneRequests.length,
      roundedWeight,
      highPriorityCount,
      urgentCount,
      latestTimestamp,
      DEMAND_SCORING_WEIGHTS,
      now
    );

    return {
      zone_id: zone.id,
      zone_code: zone.code,
      zone_name: zone.name,
      center_lat: zone.center_lat,
      center_lng: zone.center_lng,
      radius_km: zone.radius_km,
      request_count: zoneRequests.length,
      total_estimated_weight_kg: roundedWeight,
      average_request_weight_kg: avgWeight,
      high_priority_count: highPriorityCount,
      urgent_count: urgentCount,
      pending_count: pendingCount,
      scheduled_count: scheduledCount,
      assigned_count: assignedCount,
      real_request_count: realCount,
      simulated_request_count: simulatedCount,
      latest_request_at: latestTimestamp,
      demand_score: demandScore,
    };
  });
}

/**
 * Performs temporal aggregation of collection requests across dates, slots, and weekdays.
 * Strictly separates real from simulated requests.
 */
export function aggregateTemporalDemand(
  requests: DemandRequestItem[]
): TemporalDemandSummary {
  const dateMap = new Map<string, TemporalDateAggregation>();
  const slotMap: Record<string, { requests: number; weight_kg: number }> = {};
  const weekdayTotals = Array.from({ length: 7 }, (_, i) => ({
    weekday_index: i,
    weekday_name: WEEKDAY_NAMES[i],
    total_requests: 0,
    total_weight_kg: 0,
    days_seen: new Set<string>(),
  }));

  let totalRequests = 0;
  let totalWeightKg = 0;
  let realCount = 0;
  let simulatedCount = 0;

  for (const r of requests) {
    if (["cancelled"].includes(r.status)) continue;

    const weight = r.estimated_weight_kg && r.estimated_weight_kg > 0 ? r.estimated_weight_kg : 5.0;
    const isSim = Boolean(r.is_simulated);
    const dateKey = r.pickup_date || (r.created_at ? r.created_at.split("T")[0] : "undated");
    const slotKey = r.pickup_slot || "09:00 - 12:00";

    totalRequests++;
    totalWeightKg += weight;
    if (isSim) simulatedCount++;
    else realCount++;

    // Date aggregation
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        date: dateKey,
        total_requests: 0,
        total_weight_kg: 0,
        real_requests: 0,
        simulated_requests: 0,
        slots: {},
      });
    }
    const dateAgg = dateMap.get(dateKey)!;
    dateAgg.total_requests++;
    dateAgg.total_weight_kg = Math.round((dateAgg.total_weight_kg + weight) * 10) / 10;
    if (isSim) dateAgg.simulated_requests++;
    else dateAgg.real_requests++;

    if (!dateAgg.slots[slotKey]) {
      dateAgg.slots[slotKey] = { requests: 0, weight_kg: 0 };
    }
    dateAgg.slots[slotKey].requests++;
    dateAgg.slots[slotKey].weight_kg =
      Math.round((dateAgg.slots[slotKey].weight_kg + weight) * 10) / 10;

    // Slot aggregation
    if (!slotMap[slotKey]) {
      slotMap[slotKey] = { requests: 0, weight_kg: 0 };
    }
    slotMap[slotKey].requests++;
    slotMap[slotKey].weight_kg =
      Math.round((slotMap[slotKey].weight_kg + weight) * 10) / 10;

    // Weekday aggregation
    if (dateKey !== "undated") {
      const dt = new Date(dateKey + "T00:00:00Z");
      if (!isNaN(dt.getTime())) {
        const dayIdx = dt.getUTCDay();
        weekdayTotals[dayIdx].total_requests++;
        weekdayTotals[dayIdx].total_weight_kg =
          Math.round((weekdayTotals[dayIdx].total_weight_kg + weight) * 10) / 10;
        weekdayTotals[dayIdx].days_seen.add(dateKey);
      }
    }
  }

  const byWeekday: WeekdayDistribution[] = weekdayTotals.map((w) => ({
    weekday_index: w.weekday_index,
    weekday_name: w.weekday_name,
    total_requests: w.total_requests,
    total_weight_kg: w.total_weight_kg,
    average_daily_requests:
      w.days_seen.size > 0
        ? Math.round((w.total_requests / w.days_seen.size) * 10) / 10
        : w.total_requests,
  }));

  const byDate = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    by_date: byDate,
    by_slot: slotMap,
    by_weekday: byWeekday,
    total_requests: totalRequests,
    total_weight_kg: Math.round(totalWeightKg * 10) / 10,
    real_requests_count: realCount,
    simulated_requests_count: simulatedCount,
  };
}

/**
 * Generates an interpretable deterministic demand forecast per zone.
 * Uses pending backlog + spatial pressure without fake AI or inflated numbers.
 */
export function generateDemandForecast(
  spatialDemands: ZoneSpatialDemand[],
  temporalSummary: TemporalDemandSummary
): ZoneForecast[] {
  // Determine global slot popularity
  let primarySlot = "09:00 - 12:00";
  let maxSlotRequests = -1;
  for (const [slot, data] of Object.entries(temporalSummary.by_slot)) {
    if (data.requests > maxSlotRequests) {
      maxSlotRequests = data.requests;
      primarySlot = slot;
    }
  }

  return spatialDemands.map((sd) => {
    // Deterministic forecast:
    // Forecast volume = active pending requests + expected baseline demand based on current score
    const pendingVol = sd.pending_count;

    // Projected inflow for the next planning horizon based on historical intensity:
    const baselineInflow = Math.round((sd.demand_score / 40.0) * 10) / 10;
    const forecastReqs = Math.max(pendingVol, Math.round(pendingVol + baselineInflow));

    const avgWeight = sd.average_request_weight_kg > 0 ? sd.average_request_weight_kg : 6.0;
    const forecastWeight = Math.round(forecastReqs * avgWeight * 10) / 10;

    const demandLevel = categorizeDemandLevel(
      sd.demand_score,
      sd.urgent_count,
      sd.request_count,
      sd.total_estimated_weight_kg
    );

    // Formulate honest, human-understandable explanation
    let explanation = "";
    if (sd.request_count === 0) {
      explanation = `Low demand in ${sd.zone_name}: 0 pending collection requests. Regular route monitoring active.`;
    } else {
      const parts: string[] = [];
      parts.push(`${demandLevel} demand in ${sd.zone_name}`);
      parts.push(
        `with ${sd.request_count} active requests (${sd.total_estimated_weight_kg} kg estimated load)`
      );
      if (sd.urgent_count > 0) {
        parts.push(`including ${sd.urgent_count} urgent safety priority item(s)`);
      } else if (sd.high_priority_count > 0) {
        parts.push(`including ${sd.high_priority_count} high-priority item(s)`);
      }
      if (sd.pending_count > 0) {
        parts.push(`requiring dispatch scheduling across ${sd.pending_count} pending locations`);
      }
      explanation = parts.join(" ") + ".";
    }

    const isSimulatedBasis = sd.simulated_request_count > 0;

    return {
      zone_id: sd.zone_id,
      zone_code: sd.zone_code,
      zone_name: sd.zone_name,
      forecast_request_count: forecastReqs,
      forecast_weight_kg: forecastWeight,
      recommended_collection_window: primarySlot,
      demand_level: demandLevel,
      explanation,
      is_simulated_basis: isSimulatedBasis,
    };
  });
}

/**
 * Master demand intelligence computation combining spatial, temporal, and forecasting.
 */
export function computeDemandIntelligence(
  requests: DemandRequestItem[],
  zones: ZoneMetadata[],
  now: Date = new Date()
): DemandIntelligenceSummary {
  const spatial = aggregateSpatialDemand(requests, zones, now);
  const temporal = aggregateTemporalDemand(requests);
  const forecasts = generateDemandForecast(spatial, temporal);

  const totalPlanningRequests = spatial.reduce((acc, s) => acc + s.request_count, 0);
  const totalPlanningWeightKg =
    Math.round(spatial.reduce((acc, s) => acc + s.total_estimated_weight_kg, 0) * 10) / 10;
  const pendingUnassignedRequests = spatial.reduce((acc, s) => acc + s.pending_count, 0);
  const criticalZones = forecasts.filter((f) => f.demand_level === "CRITICAL").length;
  const highZones = forecasts.filter((f) => f.demand_level === "HIGH").length;

  const realTotal = temporal.real_requests_count;
  const allTotal = temporal.total_requests;
  const realPct = allTotal > 0 ? Math.round((realTotal / allTotal) * 1000) / 10 : 0;

  return {
    spatial,
    temporal,
    forecasts,
    planning_summary: {
      total_planning_requests: totalPlanningRequests,
      total_planning_weight_kg: totalPlanningWeightKg,
      pending_unassigned_requests: pendingUnassignedRequests,
      critical_zones_count: criticalZones,
      high_demand_zones_count: highZones,
      real_requests_percentage: realPct,
      generated_at: now.toISOString(),
    },
  };
}
