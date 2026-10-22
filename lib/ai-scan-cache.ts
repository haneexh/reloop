export interface AssessmentResult {
  is_electronic: boolean;
  rejection_reason?: string;
  item_type: string;
  brand: string | null;
  estimated_age_years: number | null;
  condition: "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged";
  condition_notes: string;
  material_recoverable: boolean;
  confidence: "high" | "medium" | "low";
  is_low_confidence: boolean;
}

export interface CachedScanEntry {
  result: AssessmentResult;
  provider: string;
  model: string;
}

// In-memory process cache keyed by image SHA-256 for sub-millisecond edge lookups
const inMemoryCache = new Map<string, CachedScanEntry>();

export function getMemoryCache(hash: string): CachedScanEntry | undefined {
  return inMemoryCache.get(hash);
}

export function setMemoryCache(hash: string, entry: CachedScanEntry): void {
  inMemoryCache.set(hash, entry);
}

export function clearInMemoryCache(hash?: string): void {
  if (hash && hash !== "all") {
    inMemoryCache.delete(hash);
  } else {
    inMemoryCache.clear();
  }
}

/**
 * Quality Gate: Validates that an AI output is informative and specific.
 * If a provider returns a low-information result ("Other Electronics / Unlisted", missing item_type,
 * or low confidence with vague label), it is rejected as a failure so the pipeline falls through
 * to the next provider.
 */
export function isHighQualityAssessment(result: AssessmentResult | null): boolean {
  if (!result) return false;

  // Non-electronic rejection is a high-value decisive output
  if (result.is_electronic === false) {
    return Boolean(
      (result.rejection_reason && result.rejection_reason.trim().length > 0) ||
      (result.condition_notes && result.condition_notes.trim().length > 0) ||
      (result.item_type && result.item_type.toLowerCase().includes("non-electronic"))
    );
  }

  if (!result.item_type || typeof result.item_type !== "string") {
    return false;
  }

  const lower = result.item_type.trim().toLowerCase();

  const lowQualityLabels = [
    "other electronics / unlisted",
    "other electronics",
    "unlisted",
    "unknown",
    "other",
    "electronic item",
    "electronics",
    "electronic device",
    "device",
    "gadget",
    "unidentified",
    "hardware",
  ];

  if (lowQualityLabels.includes(lower)) {
    return false;
  }

  // Reject low confidence
  if (result.confidence === "low" || result.is_low_confidence === true) {
    return false;
  }

  return true;
}

export function extractJSON(text: string): AssessmentResult | null {
  if (!text) return null;

  const sanitizeParsed = (parsed: Record<string, unknown>): AssessmentResult => {
    const isElectronic = parsed.is_electronic !== false;
    const rejectionReason = typeof parsed.rejection_reason === "string" ? parsed.rejection_reason : undefined;

    if (!isElectronic) {
      return {
        is_electronic: false,
        rejection_reason: rejectionReason,
        item_type: "Non-Electronic Item",
        brand: null,
        estimated_age_years: null,
        condition: "functional",
        condition_notes: rejectionReason || "Non-electronic item detected.",
        material_recoverable: false,
        confidence: "high",
        is_low_confidence: false,
      };
    }

    const rawType = typeof parsed.item_type === "string" && parsed.item_type.trim()
      ? parsed.item_type.trim().slice(0, 80)
      : "Other Electronics / Unlisted";
    const rawBrand = typeof parsed.brand === "string" && parsed.brand.trim()
      ? parsed.brand.trim().slice(0, 80)
      : null;
    const rawAge = typeof parsed.estimated_age_years === "number" && Number.isFinite(parsed.estimated_age_years)
      ? Math.max(0, Math.min(50, parsed.estimated_age_years))
      : null;
    const rawCondition = [
      "functional",
      "cosmetic_damage",
      "partially_working",
      "severely_damaged",
    ].includes(String(parsed.condition))
      ? (parsed.condition as AssessmentResult["condition"])
      : "functional";
    const rawNotes = typeof parsed.condition_notes === "string" && parsed.condition_notes.trim()
      ? parsed.condition_notes.trim().slice(0, 500)
      : "Condition assessed via vision model.";
    const rawRecoverable =
      typeof parsed.material_recoverable === "boolean" ? parsed.material_recoverable : true;
    const rawConf = ["high", "medium", "low"].includes(String(parsed.confidence))
      ? (parsed.confidence as "high" | "medium" | "low")
      : "medium";

    const isLowConfidence = rawConf === "low" || rawType === "Other Electronics / Unlisted" || rawType.toLowerCase().includes("unknown");

    return {
      is_electronic: true,
      item_type: rawType,
      brand: rawBrand,
      estimated_age_years: rawAge,
      condition: rawCondition,
      condition_notes: rawNotes,
      material_recoverable: rawRecoverable,
      confidence: rawConf,
      is_low_confidence: isLowConfidence,
    };
  };

  try {
    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return sanitizeParsed(parsed);
    }
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed === "object") {
          return sanitizeParsed(parsed);
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}
