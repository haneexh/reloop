/**
 * ============================================================================
 * RE:LOOP Post-Purchase Repairability Index (PP-RI) & Decision Engine
 * ============================================================================
 *
 * Deterministic, explainable circular routing engine calculating economic
 * viability, environmental savings, and lifecycle recommendations across
 * six distinct circular pathways:
 * 1. Repair
 * 2. Reuse
 * 3. Donate
 * 4. Resell
 * 5. Refurbish
 * 6. Recycle
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
  | "functional"
  | "cosmetic_damage"
  | "partially_working"
  | "severely_damaged";

export type RecommendedAction =
  | "repair"
  | "reuse"
  | "donate"
  | "resell"
  | "refurbish"
  | "recycle";

export type SuitabilityRating = "optimal" | "viable" | "suboptimal" | "not_recommended";

export interface PathwayComparison {
  action: RecommendedAction;
  title: string;
  description: string;
  suitability: SuitabilityRating;
  rank: number; // 1 (highest) to 6 (lowest)
  suitabilityScore: number; // 0 - 100
  economicHeadline: string;
  economicDetail: string;
  environmentalHeadline: string;
  environmentalDetail: string;
  keyAdvantage: string;
  tradeoff: string;
}

export interface DecisionEngineInput {
  item_type: string;
  brand?: string | null;
  estimated_age_years?: number | null;
  condition: ItemCondition;
  material_recoverable?: boolean;
}

export interface DecisionResult {
  ppri_score: number; // 0.0 to 10.0 scale
  ppri_level: "High Repairability" | "Moderate Repairability" | "Low Repairability";
  recommended_action: RecommendedAction;
  confidence: number; // 0.0 to 1.0 confidence score
  rationale: string; // Plain-English explanation referencing exact metrics
  alt_action_1: RecommendedAction | null;
  alt_action_2: RecommendedAction | null;
  repair_cost_est: number; // Estimated repair cost in ₹
  resale_value_est: number; // Estimated fair secondary market value in ₹
  co2e_saved_kg: number; // Avoided carbon footprint in kg CO2e
  waste_avoided_kg: number; // Diverted landfill mass in kg
  breakdown: {
    cost_ratio_score: number;
    cost_ratio_weight: number;
    condition_score: number;
    condition_weight: number;
    age_score: number;
    age_weight: number;
    repair_cost_ratio: number;
  };
  pathways: PathwayComparison[];
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
    normalized.includes("pc") ||
    normalized.includes("desktop") ||
    normalized.includes("computer")
  ) {
    return BASELINE_DATA.laptop;
  }
  if (
    normalized.includes("phone") ||
    normalized.includes("smartphone") ||
    normalized.includes("mobile") ||
    normalized.includes("iphone") ||
    normalized.includes("android")
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
    normalized.includes("iron") ||
    normalized.includes("vacuum") ||
    normalized.includes("heater")
  ) {
    return BASELINE_DATA.small_appliance;
  }
  if (
    normalized.includes("furniture") ||
    normalized.includes("chair") ||
    normalized.includes("table") ||
    normalized.includes("desk") ||
    normalized.includes("shelf") ||
    normalized.includes("sofa")
  ) {
    return BASELINE_DATA.furniture;
  }
  if (
    normalized.includes("cloth") ||
    normalized.includes("apparel") ||
    normalized.includes("shirt") ||
    normalized.includes("jacket") ||
    normalized.includes("pants") ||
    normalized.includes("dress")
  ) {
    return BASELINE_DATA.clothing;
  }

  return BASELINE_DATA[normalized] || BASELINE_DATA.other;
}

/**
 * Evaluates an item and computes the Post-Purchase Repairability Index (PP-RI),
 * the primary circular action, two alternatives, and comprehensive six-pathway comparative metrics.
 */
export function evaluateItem(input: DecisionEngineInput): DecisionResult {
  const {
    item_type,
    brand,
    estimated_age_years,
    condition,
    material_recoverable = true,
  } = input;

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
      conditionRepairFactor = 0.25; // Preventative maintenance / tuning only
      conditionResaleFactor = 0.95;
      conditionScore = 10.0;
      break;
    case "cosmetic_damage":
      conditionRepairFactor = 0.55; // Shell/casing refurbishment or minor touchups
      conditionResaleFactor = 0.75;
      conditionScore = 8.0;
      break;
    case "partially_working":
      conditionRepairFactor = 1.0; // Component replacement required (screen, battery, port)
      conditionResaleFactor = 0.45;
      conditionScore = 5.0;
      break;
    case "severely_damaged":
      conditionRepairFactor = 2.2; // Critical structural/motherboard failure
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

  const repair_cost_ratio =
    resale_value_est > 0 ? Number((repair_cost_est / resale_value_est).toFixed(2)) : 2.0;

  // Environmental savings
  const co2e_saved_if_repaired = Math.round(baseline.co2e_new_production_kg * 0.85);
  const co2e_saved_if_recycled = Math.round(baseline.co2e_new_production_kg * 0.2);

  // Step 3: Compute PP-RI Score (0.0 to 10.0)
  let costRatioScore = 0;
  if (repair_cost_ratio <= 0.2) {
    costRatioScore = 10.0;
  } else if (repair_cost_ratio >= 1.0) {
    costRatioScore = 0.0;
  } else {
    costRatioScore = Number(((1.0 - (repair_cost_ratio - 0.2) / 0.8) * 10).toFixed(2));
  }

  // Age factor (newer is higher; <= 0.5 yr = 10, >= 8 yr = 1.0)
  const ageScore = Number(Math.max(1.0, Math.min(10.0, 10.0 - age * 1.1)).toFixed(2));

  // Weighted composite PP-RI score
  const rawPpri =
    costRatioScore * PPRI_WEIGHT_COST_RATIO +
    conditionScore * PPRI_WEIGHT_CONDITION +
    ageScore * PPRI_WEIGHT_AGE;
  const ppri_score = Number(Math.max(0, Math.min(10, rawPpri)).toFixed(1));

  let ppri_level: "High Repairability" | "Moderate Repairability" | "Low Repairability";
  if (ppri_score >= 7.0) {
    ppri_level = "High Repairability";
  } else if (ppri_score >= 4.0) {
    ppri_level = "Moderate Repairability";
  } else {
    ppri_level = "Low Repairability";
  }

  // Confidence calculation based on data specificity
  let confidence = 0.88;
  if (brand && estimated_age_years !== null && estimated_age_years !== undefined) {
    confidence = 0.94;
  } else if (!brand && (estimated_age_years === null || estimated_age_years === undefined)) {
    confidence = 0.8;
  }

  // Step 4: Decision Rules across all 6 Pathways
  let recommended_action: RecommendedAction;
  let alt_action_1: RecommendedAction | null = null;
  let alt_action_2: RecommendedAction | null = null;
  let rationale = "";

  const brandDisplay = brand ? `${brand} ` : "";
  const formattedRepair = `₹${repair_cost_est.toLocaleString("en-IN")}`;
  const formattedResale = `₹${resale_value_est.toLocaleString("en-IN")}`;
  const costRatioPct = `${Math.round(repair_cost_ratio * 100)}%`;

  if (condition === "severely_damaged") {
    recommended_action = "recycle";
    alt_action_1 = "refurbish";
    alt_action_2 = material_recoverable ? "donate" : null;
    rationale = `Due to severe damage and high repair costs (${formattedRepair} repair vs ${formattedResale} residual salvage), immediate certified recycling captures ${co2e_saved_if_recycled} kg CO2e and recovers ${baseline.weight_kg} kg of raw materials.`;
  } else if (condition === "partially_working" && repair_cost_ratio <= 0.75 && age <= 6) {
    recommended_action = "repair";
    alt_action_1 = "refurbish";
    alt_action_2 = "resell";
    rationale = `High economic viability with repair cost at only ${costRatioPct} of secondary market value (${formattedRepair} repair vs ${formattedResale} resale, PP-RI: ${ppri_score}/10). Repairing restores full utility and preserves ${co2e_saved_if_repaired} kg CO2e.`;
  } else if (condition === "cosmetic_damage" && resale_value_est >= 2000 && age <= 5) {
    recommended_action = "refurbish";
    alt_action_1 = "resell";
    alt_action_2 = "reuse";
    rationale = `Cosmetic flaws can be restored economically (${formattedRepair}) to recover a secondary market value of ${formattedResale} (PP-RI: ${ppri_score}/10), lifting the item to grade-A resale standard.`;
  } else if (condition === "functional" && resale_value_est >= 3000 && age <= 4.5) {
    recommended_action = "resell";
    alt_action_1 = "reuse";
    alt_action_2 = "donate";
    rationale = `The ${brandDisplay}${item_type} is in functional condition with strong secondary market demand (estimated resale ${formattedResale}). Reselling maximizes cash recovery and extends device lifecycle.`;
  } else if (condition === "functional" && (resale_value_est < 3000 || age > 4.5)) {
    recommended_action = "reuse";
    alt_action_1 = "donate";
    alt_action_2 = "resell";
    rationale = `The ${brandDisplay}${item_type} is in working condition but past peak commercial resale value (${formattedResale}). Direct reuse or household repurposing delivers 100% utility with zero carbon footprint.`;
  } else if (age > 6 || repair_cost_ratio > 0.7) {
    if (resale_value_est > 0) {
      recommended_action = "donate";
      alt_action_1 = "recycle";
      alt_action_2 = "reuse";
      rationale = `At ${age.toFixed(1)} years old with elevated repair ratio (${costRatioPct}), community donation to verified NGOs maximizes social utility while diverting ${baseline.weight_kg} kg from landfills.`;
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

  // Helper to compute display rank without TypeScript control-flow narrowing conflicts
  const computePathwayRank = (
    target: RecommendedAction,
    fallbackRank: number
  ): number => {
    if (recommended_action === target) return 1;
    if (alt_action_1 === target) return 2;
    if (alt_action_2 === target) return 3;
    return fallbackRank;
  };

  const isSeverelyDamaged = (condition as string) === "severely_damaged";
  const isFunctional = (condition as string) === "functional";
  const isCosmeticDamage = (condition as string) === "cosmetic_damage";
  const isPartiallyWorking = (condition as string) === "partially_working";

  // Step 5: Generate Side-by-Side Comparison for All 6 Pathways
  const pathways: PathwayComparison[] = [
    {
      action: "repair",
      title: "Repair",
      description: "Fix broken subcomponents to restore 100% operational functionality.",
      suitability:
        recommended_action === "repair"
          ? "optimal"
          : repair_cost_ratio < 0.6 && !isSeverelyDamaged
            ? "viable"
            : isFunctional
              ? "suboptimal"
              : "not_recommended",
      rank: computePathwayRank("repair", 4),
      suitabilityScore:
        isSeverelyDamaged
          ? 15
          : isFunctional
            ? 50
            : Math.max(20, Math.min(98, Math.round(100 - repair_cost_ratio * 70))),
      economicHeadline: `Est. Cost: ${formattedRepair}`,
      economicDetail:
        isFunctional
          ? "No repair needed; item is operational."
          : `Repair is ${costRatioPct} of estimated secondary resale value (${formattedResale}).`,
      environmentalHeadline: `Saves ${co2e_saved_if_repaired} kg CO2e`,
      environmentalDetail: "Avoids manufacture of replacement unit; extends active operational life.",
      keyAdvantage: "Retains full primary device value with minimal component replacement.",
      tradeoff: `Requires capital expenditure (${formattedRepair}) and technician turnaround time.`,
    },
    {
      action: "reuse",
      title: "Reuse",
      description: "Continue direct usage, secondary household purpose, or pass down to peers.",
      suitability:
        recommended_action === "reuse"
          ? "optimal"
          : isFunctional || isCosmeticDamage
            ? "viable"
            : "not_recommended",
      rank: computePathwayRank("reuse", 5),
      suitabilityScore:
        isSeverelyDamaged
          ? 10
          : isPartiallyWorking
            ? 35
            : age > 4
              ? 90
              : 80,
      economicHeadline: "₹0 Outlay / Retained Utility",
      economicDetail: `Avoids new purchase expenditure while maintaining immediate utility.`,
      environmentalHeadline: `Preserves 100% Embedded Carbon`,
      environmentalDetail: `Zero logistics or processing footprint; maximum circular efficiency.`,
      keyAdvantage: "Instant utility retention with zero monetary expenditure or platform fees.",
      tradeoff: "Does not convert asset to cash.",
    },
    {
      action: "resell",
      title: "Resell",
      description: "List on secondary peer-to-peer or verified refurbished marketplaces for cash recovery.",
      suitability:
        recommended_action === "resell"
          ? "optimal"
          : resale_value_est >= 2000 && !isSeverelyDamaged
            ? "viable"
            : resale_value_est > 500
              ? "suboptimal"
              : "not_recommended",
      rank: computePathwayRank("resell", 4),
      suitabilityScore:
        isSeverelyDamaged
          ? 5
          : isFunctional && age <= 3
            ? 95
            : isCosmeticDamage
              ? 75
              : Math.max(10, Math.min(85, Math.round(resale_value_est / (baseline.new_price_est * 0.01)))),
      economicHeadline: `Est. Value: ${formattedResale}`,
      economicDetail: `Secondary market demand yields direct monetary return for functional hardware.`,
      environmentalHeadline: `Saves ${co2e_saved_if_repaired} kg CO2e`,
      environmentalDetail: `Displaces a brand-new production unit in the secondary market.`,
      keyAdvantage: "Direct monetary return and maximum economic recovery for the owner.",
      tradeoff: "Listing effort, buyer negotiations, and transaction fees.",
    },
    {
      action: "refurbish",
      title: "Refurbish",
      description: "Professional cosmetic restoration, cleaning, and testing to upgrade grade quality.",
      suitability:
        recommended_action === "refurbish"
          ? "optimal"
          : isCosmeticDamage || isPartiallyWorking
            ? "viable"
            : "suboptimal",
      rank: computePathwayRank("refurbish", 5),
      suitabilityScore:
        isSeverelyDamaged
          ? 20
          : isCosmeticDamage
            ? 90
            : isPartiallyWorking
              ? 70
              : 50,
      economicHeadline: `Net Lift: ~₹${Math.round(resale_value_est * 0.35).toLocaleString("en-IN")}`,
      economicDetail: `Professional reconditioning restores cosmetic grade, boosting resale margin.`,
      environmentalHeadline: `Preserves ${co2e_saved_if_repaired} kg CO2e`,
      environmentalDetail: `Brings mid-condition hardware back into active commercial circulation.`,
      keyAdvantage: "Significantly lifts perceived secondary market value with superficial touchup.",
      tradeoff: "Requires specialized refurbishment tools and replacement casing/parts.",
    },
    {
      action: "donate",
      title: "Donate",
      description: "Contribute functional or lightly worn items to verified NGOs, schools, or charities.",
      suitability:
        recommended_action === "donate"
          ? "optimal"
          : !isSeverelyDamaged
            ? "viable"
            : "not_recommended",
      rank: computePathwayRank("donate", 5),
      suitabilityScore:
        isSeverelyDamaged
          ? 5
          : age >= 4 && isFunctional
            ? 92
            : !isSeverelyDamaged
              ? 75
              : 20,
      economicHeadline: "Social Impact / Tax Deductible",
      economicDetail: `Provides digital and physical access to community beneficiaries at zero cost to them.`,
      environmentalHeadline: `Diverts ${baseline.weight_kg} kg Landfill Waste`,
      environmentalDetail: `Guarantees extended active lifecycle in community institutions.`,
      keyAdvantage: "Direct philanthropic and community utility with simple handover.",
      tradeoff: "No monetary cash return for the owner.",
    },
    {
      action: "recycle",
      title: "Recycle",
      description: "Certified e-waste processing and informal scrap disassembly for material recovery.",
      suitability:
        recommended_action === "recycle"
          ? "optimal"
          : isSeverelyDamaged || age > 7
            ? "viable"
            : "suboptimal",
      rank: computePathwayRank("recycle", 6),
      suitabilityScore:
        isSeverelyDamaged
          ? 96
          : age > 7
            ? 75
            : 30,
      economicHeadline: `Scrap Value: ~₹${Math.round(baseline.weight_kg * 45).toLocaleString("en-IN")}`,
      economicDetail: `Material scrap value from copper, aluminium, circuit boards, and plastics.`,
      environmentalHeadline: `Saves ${co2e_saved_if_recycled} kg CO2e`,
      environmentalDetail: `Recovers scarce minerals, precious metals, and prevents toxic landfill contamination.`,
      keyAdvantage: "Responsible end-of-life guarantee with zero landfill toxicity.",
      tradeoff: "Lowest economic recovery compared to functional reuse.",
    },
  ];

  // Sort pathways by rank (optimal first)
  pathways.sort((a, b) => a.rank - b.rank);

  return {
    ppri_score,
    ppri_level,
    recommended_action,
    confidence,
    rationale,
    alt_action_1,
    alt_action_2,
    repair_cost_est,
    resale_value_est,
    co2e_saved_kg,
    waste_avoided_kg,
    breakdown: {
      cost_ratio_score: costRatioScore,
      cost_ratio_weight: PPRI_WEIGHT_COST_RATIO,
      condition_score: conditionScore,
      condition_weight: PPRI_WEIGHT_CONDITION,
      age_score: ageScore,
      age_weight: PPRI_WEIGHT_AGE,
      repair_cost_ratio,
    },
    pathways,
  };
}
