/**
 * Impact and circular economy metrics calculator based on item classification.
 */

interface ImpactCalculationParams {
  itemType: string;
  condition: string;
  estimatedAgeYears?: number | null;
}

interface ImpactCalculationResult {
  repairCostEst: number;
  resaleValueEst: number;
  co2eSavedEst: number;
  wasteAvoidedKg: number;
}

// Baseline metrics per category: [baseWeightKg, baseCO2ePerKg, baseNewPriceUSD, repairFactor]
const CATEGORY_PROFILES: Record<
  string,
  { weightKg: number; co2eKg: number; baseValue: number; repairCostRatio: number }
> = {
  laptop: { weightKg: 2.2, co2eKg: 250, baseValue: 750, repairCostRatio: 0.25 },
  smartphone: { weightKg: 0.2, co2eKg: 70, baseValue: 450, repairCostRatio: 0.2 },
  tablet: { weightKg: 0.5, co2eKg: 100, baseValue: 350, repairCostRatio: 0.22 },
  desktop: { weightKg: 8.5, co2eKg: 350, baseValue: 800, repairCostRatio: 0.2 },
  monitor: { weightKg: 4.5, co2eKg: 120, baseValue: 200, repairCostRatio: 0.3 },
  chair: { weightKg: 12.0, co2eKg: 45, baseValue: 150, repairCostRatio: 0.25 },
  table: { weightKg: 25.0, co2eKg: 80, baseValue: 220, repairCostRatio: 0.2 },
  appliance: { weightKg: 18.0, co2eKg: 180, baseValue: 300, repairCostRatio: 0.35 },
  audio: { weightKg: 1.5, co2eKg: 35, baseValue: 120, repairCostRatio: 0.3 },
  television: { weightKg: 11.0, co2eKg: 220, baseValue: 400, repairCostRatio: 0.4 },
  default: { weightKg: 3.0, co2eKg: 50, baseValue: 100, repairCostRatio: 0.25 },
};

export function calculateCircularImpact({
  itemType,
  condition,
  estimatedAgeYears = 2,
}: ImpactCalculationParams): ImpactCalculationResult {
  const normalizedType = (itemType || "default").toLowerCase().trim();

  // Find matching profile or default
  const key = Object.keys(CATEGORY_PROFILES).find((k) => normalizedType.includes(k)) || "default";
  const profile = CATEGORY_PROFILES[key];

  const age = Math.max(0.5, estimatedAgeYears || 2);
  const depreciation = Math.max(0.15, Math.pow(0.75, age));

  // Condition multipliers
  let conditionMultiplier = 0.8;
  let repairFactor = 1.0;

  switch (condition) {
    case "functional":
      conditionMultiplier = 0.85;
      repairFactor = 0.2; // minimal maintenance
      break;
    case "cosmetic_damage":
      conditionMultiplier = 0.65;
      repairFactor = 0.5;
      break;
    case "partially_working":
      conditionMultiplier = 0.4;
      repairFactor = 1.0;
      break;
    case "severely_damaged":
      conditionMultiplier = 0.15;
      repairFactor = 1.8;
      break;
  }

  const resaleValueEst = Math.round(profile.baseValue * depreciation * conditionMultiplier);
  const repairCostEst = Math.round(profile.baseValue * profile.repairCostRatio * repairFactor);
  const wasteAvoidedKg = Number(profile.weightKg.toFixed(1));
  const co2eSavedEst = Math.round(profile.co2eKg * (condition === "severely_damaged" ? 0.4 : 0.85));

  return {
    repairCostEst: Math.max(10, repairCostEst),
    resaleValueEst: Math.max(5, resaleValueEst),
    co2eSavedEst: Math.max(5, co2eSavedEst),
    wasteAvoidedKg: Math.max(0.1, wasteAvoidedKg),
  };
}
