/**
 * ============================================================================
 * RE:LOOP Post-Purchase Repairability Index (PP-RI) & Decision Engine
 * ============================================================================
 *
 * Deterministic, explainable circular routing engine calculating economic
 * viability, environmental savings, and lifecycle recommendations.
 */

// ----------------------------------------------------------------------------
// Named Tuning Constants (Weights for PP-RI Score)
// ----------------------------------------------------------------------------
// These three weights sum to 1.0 (100%) and determine the 0-10 PP-RI score.
export const PPRI_WEIGHT_COST_RATIO = 0.45; // 45%: Economic feasibility (repair cost vs resale value)
export const PPRI_WEIGHT_CONDITION = 0.35; // 35%: Physical & operational condition of the hardware
export const PPRI_WEIGHT_AGE = 0.2; // 20%: Lifecycle age and component availability

// ----------------------------------------------------------------------------
// Type Definitions
// ----------------------------------------------------------------------------
export type ItemCondition =
  "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged";

export type RecommendedAction = "repair" | "reuse" | "donate" | "refurbish" | "recycle";

export interface DecisionEngineInput {
  item_type: string;
  brand?: string | null;
  estimated_age_years?: number | null;
  condition: ItemCondition;
  material_recoverable?: boolean;
}

export interface DecisionResult {
  ppri_score: number; // 0.0 to 10.0 scale
  recommended_action: RecommendedAction;
  rationale: string; // Plain-English sentence explaining WHY referencing exact metrics
  alt_action_1: RecommendedAction | null;
  alt_action_2: RecommendedAction | null;
  repair_cost_est: number; // Estimated repair cost in ₹
  resale_value_est: number; // Estimated fair secondary market value in ₹
  co2e_saved_kg: number; // Avoided carbon footprint in kg CO2e
  waste_avoided_kg: number; // Diverted landfill mass in kg
}

export interface BaselineCategoryData {
  new_price_est: number; // New retail baseline in ₹
  co2e_new_production_kg: number; // Cradle-to-gate embodied carbon (kg CO2e)
  avg_repair_cost_pct_of_new: number; // Typical repair cost ratio (0.0 - 1.0)
  annual_decay_rate: number; // Annual market depreciation rate (e.g. 0.14 = 14%/yr)
  weight_kg: number; // Average unit mass in kg
}

// ----------------------------------------------------------------------------
// Baseline Data per Category
// ----------------------------------------------------------------------------
export const BASELINE_DATA: Record<string, BaselineCategoryData> = {
  laptop: {
    new_price_est: 55000,
    co2e_new_production_kg: 280,
    avg_repair_cost_pct_of_new: 0.22,
    annual_decay_rate: 0.15,
    weight_kg: 2.2,
  },
  smartphone: {
    new_price_est: 28000,
    co2e_new_production_kg: 75,
    avg_repair_cost_pct_of_new: 0.18,
    annual_decay_rate: 0.2,
    weight_kg: 0.2,
  },
  tablet: {
    new_price_est: 32000,
    co2e_new_production_kg: 110,
    avg_repair_cost_pct_of_new: 0.2,
    annual_decay_rate: 0.18,
    weight_kg: 0.5,
  },
  small_appliance: {
    new_price_est: 8500,
    co2e_new_production_kg: 65,
    avg_repair_cost_pct_of_new: 0.28,
    annual_decay_rate: 0.12,
    weight_kg: 4.5,
  },
  furniture: {
    new_price_est: 15000,
    co2e_new_production_kg: 90,
    avg_repair_cost_pct_of_new: 0.15,
    annual_decay_rate: 0.08,
    weight_kg: 18.0,
  },
  clothing: {
    new_price_est: 2500,
    co2e_new_production_kg: 22,
    avg_repair_cost_pct_of_new: 0.15,
    annual_decay_rate: 0.25,
    weight_kg: 0.8,
  },
  other: {
    new_price_est: 6000,
    co2e_new_production_kg: 45,
    avg_repair_cost_pct_of_new: 0.25,
    annual_decay_rate: 0.15,
    weight_kg: 2.0,
  },
};

/**
 * Resolves standard category key from user input.
 */
export function resolveCategoryBaseline(itemType: string): BaselineCategoryData {
  const normalized = (itemType || "other").toLowerCase().replace(/[-_\s]+/g, "_");

  if (
    normalized.includes("laptop") ||
    normalized.includes("macbook") ||
    normalized.includes("pc")
  ) {
    return BASELINE_DATA.laptop;
  }
  if (
    normalized.includes("phone") ||
    normalized.includes("smartphone") ||
    normalized.includes("mobile")
  ) {
    return BASELINE_DATA.smartphone;
  }
  if (normalized.includes("tablet") || normalized.includes("ipad")) {
    return BASELINE_DATA.tablet;
  }
  if (
    normalized.includes("appliance") ||
    normalized.includes("microwave") ||
    normalized.includes("blender") ||
    normalized.includes("toaster") ||
    normalized.includes("iron")
  ) {
    return BASELINE_DATA.small_appliance;
  }
  if (
    normalized.includes("furniture") ||
    normalized.includes("chair") ||
    normalized.includes("table") ||
    normalized.includes("desk")
  ) {
    return BASELINE_DATA.furniture;
  }
  if (
    normalized.includes("cloth") ||
    normalized.includes("apparel") ||
    normalized.includes("shirt") ||
    normalized.includes("jacket")
  ) {
    return BASELINE_DATA.clothing;
  }

  return BASELINE_DATA[normalized] || BASELINE_DATA.other;
}

/**
 * Evaluates an item and computes the Post-Purchase Repairability Index (PP-RI)
 * along with the primary and alternative circular economy actions.
 */
export function evaluateItem(input: DecisionEngineInput): DecisionResult {
  const { item_type, brand, estimated_age_years, condition, material_recoverable = true } = input;

  // Step 1: Baseline data lookup
  const baseline = resolveCategoryBaseline(item_type);

  // Default age fallback to 3.0 years if null/unspecified
  const age =
    estimated_age_years !== null && estimated_age_years !== undefined
      ? Math.max(0, estimated_age_years)
      : 3.0;

  // Condition multipliers for repair & resale calculations
  let conditionRepairFactor = 1.0;
  let conditionResaleFactor = 1.0;
  let conditionScore = 5.0;

  switch (condition) {
    case "functional":
      conditionRepairFactor = 0.3; // Preventative maintenance or checkup only
      conditionResaleFactor = 0.95;
      conditionScore = 10.0;
      break;
    case "cosmetic_damage":
      conditionRepairFactor = 0.6; // Casing or superficial refurbishment
      conditionResaleFactor = 0.75;
      conditionScore = 8.0;
      break;
    case "partially_working":
      conditionRepairFactor = 1.0; // Component replacement required
      conditionResaleFactor = 0.45;
      conditionScore = 5.0;
      break;
    case "severely_damaged":
      conditionRepairFactor = 2.2; // Critical damage exceeding standard repair
      conditionResaleFactor = 0.08; // Scrap/salvage value
      conditionScore = 1.0;
      break;
  }

  // Step 2: Compute financial & carbon metrics
  // Resale decay with floor of 5% of new price
  const ageDepreciation = Math.max(0.05, 1 - age * baseline.annual_decay_rate);
  const resale_value_est = Math.round(
    baseline.new_price_est * ageDepreciation * conditionResaleFactor
  );

  const repair_cost_est = Math.round(
    baseline.new_price_est * baseline.avg_repair_cost_pct_of_new * conditionRepairFactor
  );

  const repair_cost_ratio = resale_value_est > 0 ? repair_cost_est / resale_value_est : 2.0;

  // Environmental savings
  const co2e_saved_if_repaired = Math.round(baseline.co2e_new_production_kg * 0.85);
  const co2e_saved_if_recycled = Math.round(baseline.co2e_new_production_kg * 0.15);

  // Step 3: Compute PP-RI Score (0.0 to 10.0)
  // Cost ratio factor (lower ratio is better; ratio <= 0.20 gets 10, ratio >= 1.0 gets 0)
  let costRatioScore = 0;
  if (repair_cost_ratio <= 0.2) {
    costRatioScore = 10.0;
  } else if (repair_cost_ratio >= 1.0) {
    costRatioScore = 0.0;
  } else {
    costRatioScore = Number(((1.0 - (repair_cost_ratio - 0.2) / 0.8) * 10).toFixed(2));
  }

  // Age factor (newer is higher; <= 0.5 yr = 10, >= 8 yr = 1.0)
  const ageScore = Math.max(1.0, Math.min(10.0, 10.0 - age * 1.1));

  // Weighted composite PP-RI score
  const rawPpri =
    costRatioScore * PPRI_WEIGHT_COST_RATIO +
    conditionScore * PPRI_WEIGHT_CONDITION +
    ageScore * PPRI_WEIGHT_AGE;
  const ppri_score = Number(Math.max(0, Math.min(10, rawPpri)).toFixed(1));

  // Step 4: Decision Rules
  let recommended_action: RecommendedAction;
  let alt_action_1: RecommendedAction | null = null;
  let alt_action_2: RecommendedAction | null = null;
  let rationale = "";

  const brandDisplay = brand ? `${brand} ` : "";
  const formattedRepair = `₹${repair_cost_est.toLocaleString("en-IN")}`;
  const formattedResale = `₹${resale_value_est.toLocaleString("en-IN")}`;
  const costRatioPct = `${Math.round(repair_cost_ratio * 100)}%`;

  if (condition === "severely_damaged" && material_recoverable) {
    recommended_action = "recycle";
    alt_action_1 = "refurbish";
    alt_action_2 = null;
    rationale = `Due to severe damage and high repair costs (${formattedRepair} vs ${formattedResale} residual value), immediate certified materials recycling captures ${co2e_saved_if_recycled} kg CO2e and diverts ${baseline.weight_kg} kg of e-waste.`;
  } else if (repair_cost_ratio < 0.4 && age <= 5) {
    recommended_action = "repair";
    alt_action_1 = "reuse";
    alt_action_2 = "refurbish";
    rationale = `High economic viability with repair cost at only ${costRatioPct} of secondary market value (${formattedRepair} repair vs ${formattedResale} resale, PP-RI: ${ppri_score}/10). Repairing preserves ${co2e_saved_if_repaired} kg CO2e.`;
  } else if (["functional", "cosmetic_damage"].includes(condition) && age <= 5) {
    recommended_action = "reuse";
    alt_action_1 = "repair";
    alt_action_2 = "donate";
    rationale = `The ${brandDisplay}${item_type} is in ${condition.replace("_", " ")} condition at ${age.toFixed(1)} years old with substantial market value (${formattedResale}), making direct reuse/reselling the highest-impact circular path.`;
  } else if (resale_value_est > 0 && condition === "cosmetic_damage") {
    recommended_action = "refurbish";
    alt_action_1 = "recycle";
    alt_action_2 = "donate";
    rationale = `Cosmetic flaws can be restored economically (${formattedRepair}) to recover a secondary market value of ${formattedResale} (PP-RI: ${ppri_score}/10).`;
  } else if (age > 7 || repair_cost_ratio > 0.7) {
    if (resale_value_est > 0 && condition !== "severely_damaged") {
      recommended_action = "donate";
      alt_action_1 = "recycle";
      alt_action_2 = "reuse";
      rationale = `At ${age.toFixed(1)} years old with elevated repair ratio (${costRatioPct}), social donation maximizes community utility while diverting ${baseline.weight_kg} kg from landfills.`;
    } else {
      recommended_action = "recycle";
      alt_action_1 = "donate";
      alt_action_2 = null;
      rationale = `Exceeded standard operational lifespan (${age.toFixed(1)} years) and economic repair threshold; recycling recovers valuable core materials and saves ${co2e_saved_if_recycled} kg CO2e.`;
    }
  } else {
    recommended_action = "recycle";
    alt_action_1 = "donate";
    alt_action_2 = null;
    rationale = `Standard circular routing recommends material recovery to capture ${co2e_saved_if_recycled} kg CO2e and avoid ${baseline.weight_kg} kg landfill waste.`;
  }

  const co2e_saved_kg =
    recommended_action === "recycle" ? co2e_saved_if_recycled : co2e_saved_if_repaired;
  const waste_avoided_kg = baseline.weight_kg;

  return {
    ppri_score,
    recommended_action,
    rationale,
    alt_action_1,
    alt_action_2,
    repair_cost_est,
    resale_value_est,
    co2e_saved_kg,
    waste_avoided_kg,
  };
}
