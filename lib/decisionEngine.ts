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
  label?: string;
  description: string;
  suitability: SuitabilityRating;
  rank: number; // 1 (highest) to 6 (lowest)
  suitabilityScore: number; // 0 - 100
  economicType: "cost" | "value" | "preserved";
  economicLabel: string;
  economicValue: number;
  co2eAvoided: number;
  viability: number; // 0.0 to 10.0 scale
  feasibility: string;
  rationale: string;
  isRecommended: boolean;
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
  desktop_pc: {
    new_price_est: 42000,
    co2e_new_production_kg: 350,
    avg_repair_cost_pct_of_new: 0.2,
    annual_decay_rate: 0.16,
    weight_kg: 8.5,
  },
  crt_tv: {
    new_price_est: 14000,
    co2e_new_production_kg: 320,
    avg_repair_cost_pct_of_new: 0.3,
    annual_decay_rate: 0.22,
    weight_kg: 24.0,
  },
  crt_monitor: {
    new_price_est: 9500,
    co2e_new_production_kg: 220,
    avg_repair_cost_pct_of_new: 0.32,
    annual_decay_rate: 0.24,
    weight_kg: 14.0,
  },
  media_player: {
    new_price_est: 6500,
    co2e_new_production_kg: 45,
    avg_repair_cost_pct_of_new: 0.25,
    annual_decay_rate: 0.18,
    weight_kg: 3.5,
  },
  feature_phone: {
    new_price_est: 2500,
    co2e_new_production_kg: 30,
    avg_repair_cost_pct_of_new: 0.25,
    annual_decay_rate: 0.22,
    weight_kg: 0.15,
  },
  landline_phone: {
    new_price_est: 1800,
    co2e_new_production_kg: 18,
    avg_repair_cost_pct_of_new: 0.2,
    annual_decay_rate: 0.2,
    weight_kg: 0.7,
  },
  printer: {
    new_price_est: 12000,
    co2e_new_production_kg: 85,
    avg_repair_cost_pct_of_new: 0.35,
    annual_decay_rate: 0.2,
    weight_kg: 6.5,
  },
  audio_stereo: {
    new_price_est: 11000,
    co2e_new_production_kg: 75,
    avg_repair_cost_pct_of_new: 0.22,
    annual_decay_rate: 0.14,
    weight_kg: 5.0,
  },
  camera: {
    new_price_est: 16000,
    co2e_new_production_kg: 50,
    avg_repair_cost_pct_of_new: 0.28,
    annual_decay_rate: 0.16,
    weight_kg: 0.6,
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
  other_electronics: {
    new_price_est: 7500,
    co2e_new_production_kg: 55,
    avg_repair_cost_pct_of_new: 0.25,
    annual_decay_rate: 0.18,
    weight_kg: 2.5,
  },
  other: {
    new_price_est: 6000,
    co2e_new_production_kg: 45,
    avg_repair_cost_pct_of_new: 0.25,
    annual_decay_rate: 0.15,
    weight_kg: 2.0,
  },
};

export interface ItemTypePreset {
  label: string;
  categoryKey: string;
  defaultAgeYears: number;
}

export const ITEM_TYPE_PRESETS: ItemTypePreset[] = [
  { label: "Laptop / Notebook", categoryKey: "laptop", defaultAgeYears: 3 },
  { label: "Smartphone", categoryKey: "smartphone", defaultAgeYears: 2 },
  { label: "Tablet", categoryKey: "tablet", defaultAgeYears: 3 },
  { label: "Desktop PC / Tower", categoryKey: "desktop_pc", defaultAgeYears: 4 },
  { label: "CRT Television / Tube TV", categoryKey: "crt_tv", defaultAgeYears: 15 },
  { label: "CRT / Legacy Monitor", categoryKey: "crt_monitor", defaultAgeYears: 14 },
  { label: "VCR / DVD / Media Player", categoryKey: "media_player", defaultAgeYears: 12 },
  { label: "Keypad / Feature Phone", categoryKey: "feature_phone", defaultAgeYears: 8 },
  { label: "Landline / Corded Phone", categoryKey: "landline_phone", defaultAgeYears: 7 },
  { label: "Printer / Scanner", categoryKey: "printer", defaultAgeYears: 4 },
  { label: "Radio / Stereo / Audio System", categoryKey: "audio_stereo", defaultAgeYears: 6 },
  { label: "Camera (Film / Digital)", categoryKey: "camera", defaultAgeYears: 5 },
  { label: "Small Home Appliance", categoryKey: "small_appliance", defaultAgeYears: 4 },
  { label: "Furniture", categoryKey: "furniture", defaultAgeYears: 5 },
  { label: "Clothing / Apparel", categoryKey: "clothing", defaultAgeYears: 2 },
  { label: "Other Electronics / Unlisted", categoryKey: "other_electronics", defaultAgeYears: 4 },
];

/**
 * Resolves standard category key from user input.
 */
export function resolveCategoryBaseline(itemType: string): BaselineCategoryData {
  const normalized = (itemType || "other").toLowerCase().replace(/[-_\s]+/g, "_");

  // CRT & Legacy Displays
  if (
    normalized.includes("crt_monitor") ||
    (normalized.includes("crt") && (normalized.includes("monitor") || normalized.includes("screen") || normalized.includes("display")))
  ) {
    return BASELINE_DATA.crt_monitor;
  }
  if (
    normalized.includes("crt") ||
    normalized.includes("tube") ||
    normalized.includes("analog_tv") ||
    normalized.includes("box_tv") ||
    normalized.includes("cathode") ||
    normalized.includes("picture_tube")
  ) {
    return BASELINE_DATA.crt_tv;
  }

  // Media Players & Recorders
  if (
    normalized.includes("vcr") ||
    normalized.includes("dvd") ||
    normalized.includes("cd_player") ||
    normalized.includes("cassette") ||
    normalized.includes("vhs") ||
    normalized.includes("tape_deck") ||
    normalized.includes("blu_ray") ||
    normalized.includes("bluray")
  ) {
    return BASELINE_DATA.media_player;
  }

  // Landline & Feature Phones (must precede general smartphone)
  if (
    normalized.includes("landline") ||
    normalized.includes("corded_phone") ||
    normalized.includes("cordless_phone") ||
    normalized.includes("intercom") ||
    normalized.includes("rotary")
  ) {
    return BASELINE_DATA.landline_phone;
  }
  if (
    normalized.includes("feature_phone") ||
    normalized.includes("keypad_phone") ||
    normalized.includes("button_phone") ||
    normalized.includes("basic_phone") ||
    normalized.includes("dumb_phone") ||
    normalized.includes("3310") ||
    normalized.includes("1100")
  ) {
    return BASELINE_DATA.feature_phone;
  }

  // Desktops & Workstations (must precede general laptop)
  if (
    normalized.includes("desktop") ||
    normalized.includes("tower") ||
    normalized.includes("cpu_cabinet") ||
    normalized.includes("workstation") ||
    normalized.includes("pc_cabinet") ||
    normalized.includes("system_unit")
  ) {
    return BASELINE_DATA.desktop_pc;
  }

  // Printers & Scanners
  if (
    normalized.includes("printer") ||
    normalized.includes("scanner") ||
    normalized.includes("photocopier") ||
    normalized.includes("laserjet") ||
    normalized.includes("deskjet") ||
    normalized.includes("all_in_one_printer")
  ) {
    return BASELINE_DATA.printer;
  }

  // Audio & Stereo
  if (
    normalized.includes("stereo") ||
    normalized.includes("radio") ||
    normalized.includes("boombox") ||
    normalized.includes("amplifier") ||
    normalized.includes("turntable") ||
    normalized.includes("walkman") ||
    normalized.includes("soundbar") ||
    normalized.includes("speaker")
  ) {
    return BASELINE_DATA.audio_stereo;
  }

  // Cameras
  if (
    normalized.includes("camera") ||
    normalized.includes("dslr") ||
    normalized.includes("camcorder") ||
    normalized.includes("digicam") ||
    normalized.includes("handycam") ||
    normalized.includes("film_camera") ||
    normalized.includes("slr")
  ) {
    return BASELINE_DATA.camera;
  }

  // Laptops & Notebooks
  if (
    normalized.includes("laptop") ||
    normalized.includes("macbook") ||
    normalized.includes("notebook") ||
    normalized.includes("thinkpad") ||
    normalized.includes("chromebook")
  ) {
    return BASELINE_DATA.laptop;
  }

  // Tablets
  if (normalized.includes("tablet") || normalized.includes("ipad") || normalized.includes("kindle")) {
    return BASELINE_DATA.tablet;
  }

  // Smartphones
  if (
    normalized.includes("phone") ||
    normalized.includes("smartphone") ||
    normalized.includes("mobile") ||
    normalized.includes("iphone") ||
    normalized.includes("android") ||
    normalized.includes("galaxy") ||
    normalized.includes("pixel")
  ) {
    return BASELINE_DATA.smartphone;
  }

  // Small Home Appliances
  if (
    normalized.includes("appliance") ||
    normalized.includes("microwave") ||
    normalized.includes("blender") ||
    normalized.includes("mixer") ||
    normalized.includes("toaster") ||
    normalized.includes("iron") ||
    normalized.includes("vacuum") ||
    normalized.includes("heater") ||
    normalized.includes("kettle") ||
    normalized.includes("purifier") ||
    normalized.includes("fan")
  ) {
    return BASELINE_DATA.small_appliance;
  }

  // Furniture
  if (
    normalized.includes("furniture") ||
    normalized.includes("chair") ||
    normalized.includes("table") ||
    normalized.includes("desk") ||
    normalized.includes("shelf") ||
    normalized.includes("sofa") ||
    normalized.includes("cabinet") ||
    normalized.includes("cupboard")
  ) {
    return BASELINE_DATA.furniture;
  }

  // Clothing
  if (
    normalized.includes("cloth") ||
    normalized.includes("apparel") ||
    normalized.includes("shirt") ||
    normalized.includes("jacket") ||
    normalized.includes("pants") ||
    normalized.includes("dress") ||
    normalized.includes("jeans") ||
    normalized.includes("garment")
  ) {
    return BASELINE_DATA.clothing;
  }

  // General Electronics
  if (
    normalized.includes("electronic") ||
    normalized.includes("gadget") ||
    normalized.includes("charger") ||
    normalized.includes("adapter") ||
    normalized.includes("router") ||
    normalized.includes("modem") ||
    normalized.includes("headphone") ||
    normalized.includes("keyboard") ||
    normalized.includes("mouse") ||
    normalized.includes("power_bank")
  ) {
    return BASELINE_DATA.other_electronics;
  }

  return BASELINE_DATA[normalized] || BASELINE_DATA.other_electronics;
}

const ACRONYM_MAP: Record<string, string> = {
  crt: "CRT",
  tv: "TV",
  pc: "PC",
  dvd: "DVD",
  vcr: "VCR",
  vhs: "VHS",
  cd: "CD",
  cpu: "CPU",
  usb: "USB",
  led: "LED",
  lcd: "LCD",
  ngo: "NGO",
  ac: "AC",
  co2e: "CO2e",
  dslr: "DSLR",
  slr: "SLR",
};

/**
 * Cleanly formats the item display name without duplicating the brand
 * if the item_type already starts with or includes the brand name, and
 * preserves standard industry uppercase acronyms (CRT, TV, PC, DVD, etc.).
 */
export function formatItemDisplayName(
  brand: string | null | undefined,
  itemType: string | null | undefined
): string {
  const rawType = (itemType || "item").trim();
  const cleanBrand = (brand || "").trim();

  // Check if rawType matches a preset label or key
  const matchedPreset = ITEM_TYPE_PRESETS.find(
    (p) =>
      p.label.toLowerCase() === rawType.toLowerCase() ||
      p.categoryKey.toLowerCase() === rawType.toLowerCase()
  );

  let formattedType = matchedPreset ? matchedPreset.label : rawType;

  // Process tokens to preserve known acronyms if not matched from preset
  if (!matchedPreset) {
    formattedType = formattedType
      .split(/(\s+|\/|-)/)
      .map((token) => {
        const lower = token.toLowerCase();
        if (ACRONYM_MAP[lower]) {
          return ACRONYM_MAP[lower];
        }
        if (token.length > 0 && !/[\s\/-]/.test(token)) {
          if (token !== token.toLowerCase()) return token;
          return token.charAt(0).toUpperCase() + token.slice(1);
        }
        return token;
      })
      .join("");
  }

  if (!cleanBrand) return formattedType;
  if (formattedType.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
    return formattedType;
  }
  return `${cleanBrand} ${formattedType}`;
}

/**
 * Evaluates an item and computes the Post-Purchase Repairability Index (PP-RI),
 * the primary circular action, two alternatives, and comprehensive six-pathway comparative metrics.
 */
export function evaluateItem(input: DecisionEngineInput): DecisionResult {
  const {
    item_type,
    brand: rawBrand,
    estimated_age_years,
    condition,
    material_recoverable = true,
  } = input;

  // Defensive sanitization and clamping
  const sanitizedItemType =
    typeof item_type === "string" && item_type.trim()
      ? item_type.trim().slice(0, 80)
      : "Everyday electronic item";
  const brand =
    typeof rawBrand === "string" && rawBrand.trim()
      ? rawBrand.trim().slice(0, 80)
      : null;

  // Step 1: Baseline data lookup
  const baseline = resolveCategoryBaseline(sanitizedItemType);

  // Default age fallback to 3.0 years if null/unspecified, clamped between 0 and 50
  const age =
    estimated_age_years !== null && estimated_age_years !== undefined
      ? Math.max(0, Math.min(50, Number(estimated_age_years) || 0))
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

  const itemDisplayName = formatItemDisplayName(brand, item_type);
  const formattedRepair = `₹${repair_cost_est.toLocaleString("en-IN")}`;
  const formattedResale = `₹${resale_value_est.toLocaleString("en-IN")}`;
  const costRatioPct = `${Math.round(repair_cost_ratio * 100)}%`;
  const postRefurbValue = Math.round(resale_value_est * 1.25);
  const formattedPostRefurb = `₹${postRefurbValue.toLocaleString("en-IN")}`;
  const basePreservedUtility = Math.round(
    baseline.new_price_est * Math.max(0.4, 1 - age * 0.08)
  );

  const isSeverelyDamaged = (condition as string) === "severely_damaged";
  const isFunctional = (condition as string) === "functional";
  const isCosmeticDamage = (condition as string) === "cosmetic_damage";
  const isPartiallyWorking = (condition as string) === "partially_working";

  // Condition-scaled Reuse economics
  let reuseConditionFactor = 1.0;
  let reuseEconomicLabel = "Replacement purchase avoided";
  let reuseEconomicDetail = "Avoids new purchase expenditure while maintaining immediate zero-cost utility.";
  let reuseRationale = "Zero logistics or monetary outlay; maximum retained utility.";
  let reuseFeasibility = isFunctional ? "Ready for secondary use" : "Light servicing recommended";
  let reuseCo2eAvoided = Number((baseline.co2e_new_production_kg * 0.9).toFixed(1));

  if (condition === "severely_damaged") {
    reuseConditionFactor = 0;
    reuseEconomicLabel = "Non-functional (no purchase avoided)";
    reuseEconomicDetail = "Item cannot be reused in current non-functional state; replacement purchase cannot be avoided.";
    reuseRationale = "Non-functional condition prevents direct reuse without major reconstruction.";
    reuseFeasibility = "Not viable (non-functional)";
    reuseCo2eAvoided = 0;
  } else if (condition === "partially_working") {
    reuseConditionFactor = 0.3;
    reuseEconomicLabel = "Partial utility preserved";
    reuseEconomicDetail = "Only limited secondary utility retained due to component defects.";
    reuseRationale = "Limited to degraded secondary usage; core workflow requires repair or replacement.";
    reuseFeasibility = "Limited secondary utility";
    reuseCo2eAvoided = Number((baseline.co2e_new_production_kg * 0.35).toFixed(1));
  } else if (condition === "cosmetic_damage") {
    reuseConditionFactor = 0.9;
    reuseEconomicLabel = "Replacement purchase avoided";
    reuseEconomicDetail = "Cosmetic flaws do not impair daily operational utility.";
    reuseRationale = "Full operational utility retained despite cosmetic imperfections.";
    reuseFeasibility = "Ready for secondary use";
    reuseCo2eAvoided = Number((baseline.co2e_new_production_kg * 0.85).toFixed(1));
  }

  const reuseEconomicValue = Math.round(basePreservedUtility * reuseConditionFactor);
  const reuseEconomicHeadline =
    condition === "severely_damaged"
      ? "₹0 (Non-Functional)"
      : condition === "partially_working"
      ? `Avoids ~₹${reuseEconomicValue.toLocaleString("en-IN")} (Degraded)`
      : `Avoids ~₹${reuseEconomicValue.toLocaleString("en-IN")} New Buy`;

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
    rationale = `Cosmetic flaws can be restored economically (${formattedRepair}) to lift the item from raw as-is value (${formattedResale}) to grade-A secondary resale (${formattedPostRefurb}, PP-RI: ${ppri_score}/10).`;
  } else if (condition === "functional" && resale_value_est >= 3000 && age <= 4.5) {
    recommended_action = "resell";
    alt_action_1 = "reuse";
    alt_action_2 = "donate";
    rationale = `The ${itemDisplayName} is in functional condition with strong secondary market demand (estimated as-is resale ${formattedResale}). Reselling maximizes cash recovery and extends device lifecycle.`;
  } else if (condition === "functional" && age > 6) {
    recommended_action = "donate";
    alt_action_1 = "reuse";
    alt_action_2 = "recycle";
    rationale = `At ${age.toFixed(1)} years old, this functional ${itemDisplayName} has significant social and community utility for schools, shelters, and NGOs, keeping ${baseline.weight_kg} kg out of landfills.`;
  } else if (condition === "functional") {
    recommended_action = "reuse";
    alt_action_1 = "donate";
    alt_action_2 = "resell";
    rationale = `The ${itemDisplayName} is in working condition with high retained utility (avoiding a ~₹${reuseEconomicValue.toLocaleString("en-IN")} replacement). Direct reuse delivers 100% utility with zero carbon footprint.`;
  } else if (age > 6 || repair_cost_ratio > 0.7) {
    if (resale_value_est > 0 && !isSeverelyDamaged) {
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

  // Step 5: Generate Side-by-Side Comparison for All 6 Pathways
  const pathways: PathwayComparison[] = [
    {
      action: "repair",
      title: "Repair",
      label: "Repair",
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
      economicType: "cost",
      economicLabel: "Estimated repair cost",
      economicValue: repair_cost_est,
      co2eAvoided: co2e_saved_if_repaired,
      viability:
        recommended_action === "repair"
          ? 9.4
          : isSeverelyDamaged
          ? 1.5
          : isFunctional
          ? 5.0
          : Number(Math.max(2.0, Math.min(8.5, 9.0 - repair_cost_ratio * 6)).toFixed(1)),
      feasibility: isSeverelyDamaged
        ? "Specialist assessment needed"
        : isPartiallyWorking
        ? "Local repair likely"
        : "Operational / Maintenance",
      rationale: `${isFunctional ? "The item is functional" : "Component repair needed"}; viable at an estimated ₹${repair_cost_est.toLocaleString("en-IN")}.`,
      isRecommended: recommended_action === "repair",
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
      label: "Reuse",
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
      economicType: "preserved",
      economicLabel: reuseEconomicLabel,
      economicValue: reuseEconomicValue,
      co2eAvoided: reuseCo2eAvoided,
      viability:
        recommended_action === "reuse"
          ? 9.3
          : isSeverelyDamaged
          ? 1.0
          : isPartiallyWorking
          ? 3.5
          : Number(Math.max(4.0, Math.min(8.5, (isFunctional ? 8.2 : 7.0) - age * 0.2)).toFixed(1)),
      feasibility: reuseFeasibility,
      rationale: reuseRationale,
      isRecommended: recommended_action === "reuse",
      economicHeadline: reuseEconomicHeadline,
      economicDetail: reuseEconomicDetail,
      environmentalHeadline: isSeverelyDamaged
        ? "0 kg CO2e"
        : `Preserves ${reuseCo2eAvoided} kg Embedded Carbon`,
      environmentalDetail: isSeverelyDamaged
        ? "Non-functional hardware cannot displace new manufacturing demand."
        : `Zero logistics or processing footprint; maximum circular efficiency.`,
      keyAdvantage: isSeverelyDamaged
        ? "None in current non-functional condition."
        : "Instant utility retention with zero monetary expenditure or platform fees.",
      tradeoff: isSeverelyDamaged
        ? "Hardware is non-functional."
        : "Does not convert asset to cash.",
    },
    {
      action: "resell",
      title: "Resell",
      label: "Resell",
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
      economicType: "value",
      economicLabel: "As-is raw secondary value",
      economicValue: resale_value_est,
      co2eAvoided: co2e_saved_if_repaired,
      viability:
        recommended_action === "resell"
          ? 9.5
          : isSeverelyDamaged
          ? 0.5
          : Number(Math.max(1.0, Math.min(8.5, (resale_value_est / baseline.new_price_est) * 10)).toFixed(1)),
      feasibility: resale_value_est >= 2500 ? "Strong secondary market" : "Moderate demand",
      rationale: `Direct monetary recovery estimated at ₹${resale_value_est.toLocaleString("en-IN")}.`,
      isRecommended: recommended_action === "resell",
      economicHeadline: `As-Is Value: ${formattedResale}`,
      economicDetail: `Immediate secondary market cash recovery without any refurbishment outlay.`,
      environmentalHeadline: `Saves ${co2e_saved_if_repaired} kg CO2e`,
      environmentalDetail: `Displaces a brand-new production unit in the secondary market.`,
      keyAdvantage: "Direct monetary return and maximum economic recovery for the owner.",
      tradeoff: "Listing effort, buyer negotiations, and transaction fees.",
    },
    {
      action: "refurbish",
      title: "Refurbish",
      label: "Refurbish",
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
      economicType: "value",
      economicLabel: "Post-refurb graded resale",
      economicValue: postRefurbValue,
      co2eAvoided: co2e_saved_if_repaired,
      viability:
        recommended_action === "refurbish"
          ? 9.1
          : isSeverelyDamaged
          ? 2.0
          : isCosmeticDamage
          ? 8.0
          : isPartiallyWorking
          ? 6.5
          : 4.5,
      feasibility: isCosmeticDamage || isPartiallyWorking ? "High grade-lift potential" : "Standard servicing",
      rationale: "Restores cosmetic grade to achieve premium secondary market valuation.",
      isRecommended: recommended_action === "refurbish",
      economicHeadline: `Graded Value: ${formattedPostRefurb}`,
      economicDetail: `Professional reconditioning lifts cosmetic grade, yielding ~25% higher resale valuation.`,
      environmentalHeadline: `Preserves ${co2e_saved_if_repaired} kg CO2e`,
      environmentalDetail: `Brings mid-condition hardware back into active commercial circulation.`,
      keyAdvantage: "Significantly lifts perceived secondary market value with superficial touchup.",
      tradeoff: "Requires specialized refurbishment tools and replacement casing/parts.",
    },
    {
      action: "donate",
      title: "Donate",
      label: "Donate",
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
      economicType: "preserved",
      economicLabel: isSeverelyDamaged ? "Unsuitable for donation" : "Philanthropic social benefit",
      economicValue: isSeverelyDamaged ? 0 : Math.round(resale_value_est * 0.5),
      co2eAvoided: isSeverelyDamaged ? 0 : Number((baseline.co2e_new_production_kg * 0.75).toFixed(1)),
      viability:
        recommended_action === "donate"
          ? 9.2
          : isSeverelyDamaged
          ? 0.5
          : age >= 4 && isFunctional
          ? 8.0
          : !isSeverelyDamaged
          ? 7.0
          : 2.0,
      feasibility: isSeverelyDamaged ? "Unsuitable (non-functional)" : "Accepted by device banks",
      rationale: isSeverelyDamaged
        ? "NGOs require working hardware; non-functional units cannot be deployed."
        : "Delivers educational and digital access to community institutions.",
      isRecommended: recommended_action === "donate",
      economicHeadline: isSeverelyDamaged ? "₹0 (Unsuitable for Donation)" : "Social Impact / Tax Deductible",
      economicDetail: isSeverelyDamaged
        ? "Charities and schools cannot accept non-operational hardware."
        : `Provides digital and physical access to community beneficiaries at zero cost to them.`,
      environmentalHeadline: isSeverelyDamaged ? "0 kg CO2e" : `Diverts ${baseline.weight_kg} kg Landfill Waste`,
      environmentalDetail: isSeverelyDamaged
        ? "Non-functional donations risk rejection and improper disposal."
        : `Guarantees extended active lifecycle in community institutions.`,
      keyAdvantage: isSeverelyDamaged ? "None in current non-functional state." : "Direct philanthropic and community utility with simple handover.",
      tradeoff: "No monetary cash return for the owner.",
    },
    {
      action: "recycle",
      title: "Recycle",
      label: "Recycle",
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
      economicType: "preserved",
      economicLabel: "Material scrap value",
      economicValue: Math.round(baseline.weight_kg * 45),
      co2eAvoided: co2e_saved_if_recycled,
      viability:
        recommended_action === "recycle"
          ? 9.6
          : isSeverelyDamaged
          ? 9.0
          : age > 7
          ? 7.2
          : 3.0,
      feasibility: "Doorstep scrap or R2 dropoff",
      rationale: "Certified mineral recovery prevents hazardous soil and water contamination.",
      isRecommended: recommended_action === "recycle",
      economicHeadline: `Scrap Value: ~₹${Math.round(baseline.weight_kg * 45).toLocaleString("en-IN")}`,
      economicDetail: `Material scrap value from copper, aluminium, circuit boards, and plastics.`,
      environmentalHeadline: `Saves ${co2e_saved_if_recycled} kg CO2e`,
      environmentalDetail: `Recovers scarce minerals, precious metals, and prevents toxic landfill contamination.`,
      keyAdvantage: "Responsible end-of-life guarantee with zero landfill toxicity.",
      tradeoff: "Lowest economic recovery compared to functional reuse.",
    },
  ];

  // Explicitly sort pathways by viability score descending (highest score first)
  pathways.sort((a, b) => {
    if (b.viability !== a.viability) {
      return b.viability - a.viability;
    }
    return b.suitabilityScore - a.suitabilityScore;
  });

  // Re-assign display rank based on strictly sorted order
  pathways.forEach((p, idx) => {
    p.rank = idx + 1;
  });

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
