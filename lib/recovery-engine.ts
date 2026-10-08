/**
 * PS-013 Recovery Workflow Engine
 * Pure TypeScript business logic for facility transfers, material recovery breakdowns,
 * diversion accounting, and batch multi-record allocation.
 */

export type RecoveryRole = "FACILITY" | "DISPATCHER" | "ADMIN";

export interface RecoveryFacility {
  id: string;
  name: string;
  facility_type: "RECYCLER" | "REFURBISHER" | "DISMANTLER" | "REPAIR" | "MRF" | "CHARITY_NGO";
  partner_type: string;
  city: string;
  lat: number;
  lng: number;
  contact: string | null;
  verified: boolean;
  accepted_categories: string[];
  operational_status: "ACTIVE" | "MAINTENANCE" | "FULL";
  monthly_capacity_kg: number;
}

export interface RecoveryBreakdown {
  total_weight_kg: number;
  refurbished_kg: number;
  recycled_kg: number;
  residual_kg: number;
  refurbished_pct: number;
  recycled_pct: number;
  residual_pct: number;
  unallocated_kg: number;
  unallocated_pct: number;
  is_complete: boolean;
  diverted_weight_kg: number;
  recovery_rate_percent: number;
}

export interface BatchValidationResult {
  valid: boolean;
  error?: string;
  total_weight_kg?: number;
  record_ids?: string[];
}

export interface BreakdownValidationResult {
  valid: boolean;
  error?: string;
  breakdown?: RecoveryBreakdown;
}

/**
 * Validates operational authorization for recovery actions.
 * Only FACILITY, DISPATCHER, and ADMIN roles are authorized.
 * CITIZEN is strictly rejected.
 */
export function isAuthorizedRecoveryOperator(role: unknown): boolean {
  if (typeof role !== "string") return false;
  const upper = role.toUpperCase();
  return upper === "FACILITY" || upper === "DISPATCHER" || upper === "ADMIN";
}

/**
 * Maps existing partners row into normalized recovery facility model.
 */
export function mapPartnerToFacility(partner: {
  id: string;
  name: string;
  partner_type: string;
  city: string;
  lat: number;
  lng: number;
  contact?: string | null;
  verified?: boolean;
}): RecoveryFacility {
  let facility_type: RecoveryFacility["facility_type"] = "RECYCLER";
  let accepted_categories: string[] = ["general_electronics"];
  let monthly_capacity_kg = 5000;

  switch (partner.partner_type) {
    case "recycler":
      facility_type = "RECYCLER";
      accepted_categories = ["e-waste", "metals", "circuit_boards", "batteries", "cables"];
      monthly_capacity_kg = 25000;
      break;
    case "refurbisher":
      facility_type = "REFURBISHER";
      accepted_categories = ["laptops", "desktops", "smartphones", "monitors", "tablets"];
      monthly_capacity_kg = 10000;
      break;
    case "repair":
      facility_type = "DISMANTLER";
      accepted_categories = ["appliances", "audio_video", "peripherals", "displays"];
      monthly_capacity_kg = 6000;
      break;
    case "ngo":
      facility_type = "CHARITY_NGO";
      accepted_categories = ["functional_it", "educational_devices", "telecom"];
      monthly_capacity_kg = 4000;
      break;
    case "informal":
      facility_type = "MRF";
      accepted_categories = ["mixed_e_waste", "cables", "scrapped_casings"];
      monthly_capacity_kg = 8000;
      break;
  }

  return {
    id: partner.id,
    name: partner.name,
    facility_type,
    partner_type: partner.partner_type,
    city: partner.city,
    lat: Number(partner.lat),
    lng: Number(partner.lng),
    contact: partner.contact || null,
    verified: Boolean(partner.verified),
    accepted_categories,
    operational_status: "ACTIVE",
    monthly_capacity_kg,
  };
}

/**
 * Validates a batch transfer of collection records to a facility.
 */
export function validateTransferBatch(params: {
  facility: { id: string; name: string; verified?: boolean } | null | undefined;
  collectionRecords: Array<{ id: string; actual_weight_kg: number; request_id: string; request_status?: string }>;
  specifiedWeightKg?: number;
}): BatchValidationResult {
  const { facility, collectionRecords, specifiedWeightKg } = params;

  if (!facility || !facility.id) {
    return { valid: false, error: "A valid recovery facility must be selected." };
  }

  if (!collectionRecords || collectionRecords.length === 0) {
    return { valid: false, error: "At least one collected record must be selected for transfer." };
  }

  // Calculate total weight strictly from actual collection records
  let sumWeight = 0;
  for (const rec of collectionRecords) {
    const w = Number(rec.actual_weight_kg);
    if (isNaN(w) || w <= 0) {
      return { valid: false, error: `Invalid collected weight in record ${rec.id}: must be greater than 0 kg.` };
    }
    // Verify request is not uncollected or cancelled
    if (rec.request_status === "cancelled" || rec.request_status === "pending") {
      return {
        valid: false,
        error: `Cannot transfer uncollected request ${rec.request_id} (Status: ${rec.request_status}).`,
      };
    }
    // Invariant 6: The same collected mass cannot be transferred twice
    if (rec.request_status === "sent_to_facility" || rec.request_status === "recovered") {
      return {
        valid: false,
        error: `Cannot transfer request ${rec.request_id} which has already been transferred (Status: ${rec.request_status}).`,
      };
    }
    sumWeight += w;
  }

  const calculatedTotal = Math.round(sumWeight * 10) / 10;

  // If a manual specified weight was provided, check it cannot exceed collected total
  if (typeof specifiedWeightKg === "number") {
    if (specifiedWeightKg <= 0) {
      return { valid: false, error: "Transferred weight must be greater than 0 kg." };
    }
    if (specifiedWeightKg > calculatedTotal + 0.05) {
      return {
        valid: false,
        error: `Cannot transfer more weight (${specifiedWeightKg.toFixed(1)} kg) than was actually collected in selected batch (${calculatedTotal.toFixed(1)} kg).`,
      };
    }
  }

  return {
    valid: true,
    total_weight_kg: typeof specifiedWeightKg === "number" ? specifiedWeightKg : calculatedTotal,
    record_ids: collectionRecords.map((r) => r.id),
  };
}

/**
 * Validates material recovery breakdown allocation.
 * Enforces non-negative values, sum <= 100%, and detects incomplete breakdowns.
 */
export function validateRecoveryBreakdown(
  totalWeightKg: number,
  refurbishedPct: number,
  recycledPct: number,
  residualPct: number
): BreakdownValidationResult {
  const total = Number(totalWeightKg);
  if (isNaN(total) || total <= 0) {
    return { valid: false, error: "Total batch weight must be greater than 0 kg to record recovery breakdown." };
  }

  const ref = Number(refurbishedPct) || 0;
  const rec = Number(recycledPct) || 0;
  const res = Number(residualPct) || 0;

  if (ref < 0 || rec < 0 || res < 0) {
    return { valid: false, error: "Recovery allocations cannot be negative." };
  }

  const sumPct = Math.round((ref + rec + res) * 10) / 10;

  if (sumPct > 100.05) {
    return {
      valid: false,
      error: `Allocation error: Combined recovery percentages (${sumPct}%) exceed 100% of transferred payload.`,
    };
  }

  const unallocatedPct = Math.max(0, Math.round((100 - sumPct) * 10) / 10);
  const isComplete = unallocatedPct <= 0.05;

  const refKg = Math.round(total * (ref / 100) * 10) / 10;
  const recKg = Math.round(total * (rec / 100) * 10) / 10;
  const resKg = Math.round(total * (res / 100) * 10) / 10;
  const unallocKg = Math.max(0, Math.round(total * (unallocatedPct / 100) * 10) / 10);

  // Diversion = Refurbished + Recycled (or Total - Residual)
  const divertedKg = Math.max(0, Math.round((refKg + recKg) * 10) / 10);
  const recoveryRate = total > 0 ? Math.round(((refKg + recKg) / total) * 1000) / 10 : 0;

  const breakdown: RecoveryBreakdown = {
    total_weight_kg: total,
    refurbished_kg: refKg,
    recycled_kg: recKg,
    residual_kg: resKg,
    refurbished_pct: ref,
    recycled_pct: rec,
    residual_pct: res,
    unallocated_kg: unallocKg,
    unallocated_pct: unallocatedPct,
    is_complete: isComplete,
    diverted_weight_kg: divertedKg,
    recovery_rate_percent: recoveryRate,
  };

  return {
    valid: true,
    breakdown,
  };
}

/**
 * Calculates high-level circular diversion metrics safely.
 */
export function calculateDiversionMetrics(
  collectedKg: number,
  residualKg: number
): { diverted_weight_kg: number; diversion_rate_percent: number } {
  const collected = Math.max(0, Number(collectedKg) || 0);
  const residual = Math.max(0, Number(residualKg) || 0);
  const diverted = Math.max(0, collected - residual);
  const diversionRate = collected > 0 ? Math.min(100, Math.round((diverted / collected) * 1000) / 10) : 0;

  return {
    diverted_weight_kg: Math.round(diverted * 10) / 10,
    diversion_rate_percent: diversionRate,
  };
}
