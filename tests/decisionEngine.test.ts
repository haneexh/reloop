import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateItem,
  formatItemDisplayName,
  PPRI_WEIGHT_COST_RATIO,
  PPRI_WEIGHT_CONDITION,
  PPRI_WEIGHT_AGE,
  type RecommendedAction,
} from "../lib/decisionEngine.ts";

describe("RE:LOOP Decision Engine & PP-RI Unit Tests", () => {
  it("verifies mathematical weight configuration sums to 1.0", () => {
    const sum = PPRI_WEIGHT_COST_RATIO + PPRI_WEIGHT_CONDITION + PPRI_WEIGHT_AGE;
    assert.equal(Number(sum.toFixed(2)), 1.0);
  });

  // Test 1: Nearly-new functional phone routes to RESELL
  it("Test 1: Nearly-new functional smartphone gets high PP-RI score and RESELL recommendation", () => {
    const result = evaluateItem({
      item_type: "smartphone",
      brand: "Apple",
      estimated_age_years: 0.5,
      condition: "functional",
      material_recoverable: true,
    });

    assert.ok(result.ppri_score >= 8.0, `Expected PP-RI >= 8.0, got ${result.ppri_score}`);
    assert.equal(result.recommended_action, "resell");
    assert.equal(result.alt_action_1, "reuse");
    assert.ok(result.resale_value_est > result.repair_cost_est);
    assert.ok(result.co2e_saved_kg > 0);
    assert.ok(result.rationale.includes("reselling") || result.rationale.includes("resale"));
    assert.equal(result.ppri_level, "High Repairability");
  });

  // Test 2: Laptop with cosmetic damage routes to REFURBISH
  it("Test 2: Laptop with cosmetic damage evaluates REFURBISH circular routing", () => {
    const result = evaluateItem({
      item_type: "laptop",
      brand: "Lenovo",
      estimated_age_years: 3.0,
      condition: "cosmetic_damage",
      material_recoverable: true,
    });

    assert.ok(result.ppri_score >= 5.0 && result.ppri_score <= 9.0);
    assert.equal(result.recommended_action, "refurbish");
    assert.equal(result.alt_action_1, "resell");
    assert.ok(result.repair_cost_est > 0);
    assert.ok(result.resale_value_est > 0);
    assert.ok(result.rationale.includes("₹"));
  });

  // Test 3: Partially working item with economical repair routes to REPAIR
  it("Test 3: Partially working tablet with economical cost ratio routes to REPAIR", () => {
    const result = evaluateItem({
      item_type: "tablet",
      brand: "Samsung",
      estimated_age_years: 2.0,
      condition: "partially_working",
      material_recoverable: true,
    });

    assert.equal(result.recommended_action, "repair");
    assert.equal(result.alt_action_1, "refurbish");
    assert.ok(result.repair_cost_est > 0);
    assert.ok(result.resale_value_est > 0);
    assert.ok(result.breakdown.repair_cost_ratio <= 0.75);
    assert.ok(result.rationale.includes("PP-RI") || result.rationale.includes("₹"));
  });

  // Test 4: Severely damaged appliance routes to RECYCLE for material recovery
  it("Test 4: Severely damaged appliance routes to RECYCLE for material recovery", () => {
    const result = evaluateItem({
      item_type: "small_appliance",
      brand: "Philips",
      estimated_age_years: 4.0,
      condition: "severely_damaged",
      material_recoverable: true,
    });

    assert.equal(result.recommended_action, "recycle");
    assert.ok(
      result.ppri_score <= 4.0,
      `Expected low PP-RI for severely damaged, got ${result.ppri_score}`
    );
    assert.equal(result.ppri_level, "Low Repairability");
    assert.ok(result.waste_avoided_kg > 0);
    assert.ok(
      result.rationale.toLowerCase().includes("recycling") ||
        result.rationale.toLowerCase().includes("recycle")
    );
  });

  // Test 5: Older functional item routes to DONATE or REUSE
  it("Test 5: 7-year-old functional item evaluates DONATE/REUSE pathway", () => {
    const result = evaluateItem({
      item_type: "laptop",
      brand: "Dell",
      estimated_age_years: 7.0,
      condition: "functional",
      material_recoverable: true,
    });

    assert.ok(
      result.recommended_action === "donate" || result.recommended_action === "reuse",
      `Expected donate or reuse, got ${result.recommended_action}`
    );
    assert.ok(result.waste_avoided_kg > 0);
    assert.ok(result.rationale.length > 20);
  });

  // Test 6: Fallback handling with nulls in brand and age
  it("Test 6: Item with null brand and age safely falls back without throwing", () => {
    const result = evaluateItem({
      item_type: "clothing",
      brand: null,
      estimated_age_years: null,
      condition: "functional",
      material_recoverable: true,
    });

    assert.ok(typeof result.ppri_score === "number" && !isNaN(result.ppri_score));
    assert.ok(result.ppri_score >= 0 && result.ppri_score <= 10);
    assert.ok(typeof result.resale_value_est === "number");
    assert.ok(typeof result.repair_cost_est === "number");
    assert.ok(typeof result.co2e_saved_kg === "number");
    assert.ok(result.rationale.length > 0);
    assert.ok(result.confidence > 0 && result.confidence <= 1);
  });

  // Test 7: Evaluates all six distinct circular pathways
  it("Test 7: Returns comparison for all six distinct circular pathways", () => {
    const result = evaluateItem({
      item_type: "laptop",
      brand: "HP",
      estimated_age_years: 2.0,
      condition: "functional",
      material_recoverable: true,
    });

    const expectedActions: RecommendedAction[] = [
      "repair",
      "reuse",
      "donate",
      "resell",
      "refurbish",
      "recycle",
    ];

    assert.equal(result.pathways.length, 6);
    const actionSet = new Set(result.pathways.map((p) => p.action));
    for (const act of expectedActions) {
      assert.ok(actionSet.has(act), `Missing pathway: ${act}`);
    }

    // Verify each pathway has economic and environmental headlines
    for (const p of result.pathways) {
      assert.ok(p.economicHeadline.length > 0);
      assert.ok(p.environmentalHeadline.length > 0);
      assert.ok(p.keyAdvantage.length > 0);
      assert.ok(p.tradeoff.length > 0);
      assert.ok(p.suitabilityScore >= 0 && p.suitabilityScore <= 100);
    }
  });

  // Test 8: PP-RI breakdown contains mathematical components
  it("Test 8: PP-RI breakdown contains valid mathematical sub-scores", () => {
    const result = evaluateItem({
      item_type: "smartphone",
      brand: "Google",
      estimated_age_years: 1.5,
      condition: "functional",
      material_recoverable: true,
    });

    const bd = result.breakdown;
    assert.equal(bd.cost_ratio_weight, 0.45);
    assert.equal(bd.condition_weight, 0.35);
    assert.equal(bd.age_weight, 0.2);
    assert.ok(bd.cost_ratio_score >= 0 && bd.cost_ratio_score <= 10);
    assert.ok(bd.condition_score >= 0 && bd.condition_score <= 10);
    assert.ok(bd.age_score >= 0 && bd.age_score <= 10);
  });

  // Test 9: Verifies Reuse pathway scales economicValue correctly across all conditions
  it("Test 9: Verifies Reuse economicValue scales by condition and zeroes out on severely_damaged", () => {
    const baseInput = {
      item_type: "smartphone",
      brand: "Apple",
      estimated_age_years: 0.5,
      material_recoverable: true,
    };

    const functionalResult = evaluateItem({ ...baseInput, condition: "functional" });
    const cosmeticResult = evaluateItem({ ...baseInput, condition: "cosmetic_damage" });
    const partialResult = evaluateItem({ ...baseInput, condition: "partially_working" });
    const severeResult = evaluateItem({ ...baseInput, condition: "severely_damaged" });

    const getReuse = (res: typeof functionalResult) =>
      res.pathways.find((p) => p.action === "reuse")!;

    const functionalReuse = getReuse(functionalResult);
    const cosmeticReuse = getReuse(cosmeticResult);
    const partialReuse = getReuse(partialResult);
    const severeReuse = getReuse(severeResult);

    // Functional: Full utility avoided
    assert.ok(functionalReuse.economicValue > 20000, `Expected > 20000, got ${functionalReuse.economicValue}`);
    assert.equal(functionalReuse.economicLabel, "Replacement purchase avoided");

    // Cosmetic damage: ~90% of base utility
    assert.ok(cosmeticReuse.economicValue < functionalReuse.economicValue);
    assert.ok(cosmeticReuse.economicValue > partialReuse.economicValue);

    // Partially working: ~30% of base utility with clear degraded label
    assert.ok(partialReuse.economicValue < cosmeticReuse.economicValue);
    assert.equal(partialReuse.economicLabel, "Partial utility preserved");

    // Severely damaged: Exactly 0 value and plain non-functional label
    assert.equal(severeReuse.economicValue, 0);
    assert.equal(severeReuse.co2eAvoided, 0);
    assert.equal(severeReuse.economicLabel, "Non-functional (no purchase avoided)");
    assert.ok(severeReuse.rationale.includes("Non-functional condition prevents direct reuse"));
  });

  // Test 10: Verifies CRT TV baseline data, sensible PP-RI, and recycling / donation routing
  it("Test 10: 15-year-old CRT TV evaluates with specific heavy-hardware baselines and sensible score", () => {
    const crtResult = evaluateItem({
      item_type: "CRT Television / Tube TV",
      brand: "Sony",
      estimated_age_years: 15.0,
      condition: "functional",
      material_recoverable: true,
    });

    // 15-year old functional CRT TV:
    // Should resolve to crt_tv baseline (24kg weight, 320kg production CO2e)
    assert.equal(crtResult.waste_avoided_kg, 24.0);
    assert.ok(crtResult.ppri_score > 0, `Expected positive PP-RI score, got ${crtResult.ppri_score}`);
    assert.ok(crtResult.resale_value_est > 0);
    assert.ok(crtResult.repair_cost_est > 0);
    assert.ok(["donate", "reuse", "recycle"].includes(crtResult.recommended_action));

    // Verify all 6 pathways exist with non-zero metrics
    const pathways = crtResult.pathways;
    assert.equal(pathways.length, 6);
    const recyclePathway = pathways.find((p) => p.action === "recycle")!;
    assert.ok(recyclePathway.co2eAvoided > 50, `Expected > 50 kg CO2e for CRT recycling, got ${recyclePathway.co2eAvoided}`);
    assert.ok(recyclePathway.economicValue > 500, `Expected scrap value > 500 for 24kg CRT, got ${recyclePathway.economicValue}`);
  });

  // Test 11: Verifies resolution for all expanded legacy electronics
  it("Test 11: Correctly matches diverse synonyms for legacy hardware", () => {
    const vcr = evaluateItem({ item_type: "Vintage VHS VCR Deck", condition: "partially_working" });
    assert.equal(vcr.waste_avoided_kg, 3.5);

    const desktop = evaluateItem({ item_type: "Custom Gaming PC Tower", condition: "functional" });
    assert.equal(desktop.waste_avoided_kg, 8.5);

    const landline = evaluateItem({ item_type: "Panasonic Cordless Landline Phone", condition: "functional" });
    assert.equal(landline.waste_avoided_kg, 0.7);

    const featurePhone = evaluateItem({ item_type: "Nokia 3310 Keypad Phone", condition: "functional" });
    assert.equal(featurePhone.waste_avoided_kg, 0.15);

    const printer = evaluateItem({ item_type: "HP LaserJet All-in-One Printer", condition: "partially_working" });
    assert.equal(printer.waste_avoided_kg, 6.5);
  });

  // Test 12: formatItemDisplayName preserves acronyms and avoids duplicated brand strings
  it("Test 12: formatItemDisplayName preserves acronyms and avoids duplicated brand strings", () => {
    assert.equal(
      formatItemDisplayName("Sony", "CRT Television / Tube TV"),
      "Sony CRT Television / Tube TV"
    );
    assert.equal(
      formatItemDisplayName("Sony", "crt_tv"),
      "Sony CRT Television / Tube TV"
    );
    assert.equal(
      formatItemDisplayName("Lenovo", "Lenovo ThinkPad Laptop"),
      "Lenovo ThinkPad Laptop"
    );
    assert.equal(
      formatItemDisplayName("LG", "vcr / dvd / media player"),
      "LG VCR / DVD / Media Player"
    );
    assert.equal(
      formatItemDisplayName("Dell", "desktop_pc"),
      "Dell Desktop PC / Tower"
    );
  });

  // Test 13: Recommended pathway always has rank 1 and highest viability score
  it("Test 13: Recommended pathway always has rank 1 and highest viability score across diverse hardware", () => {
    const testCases = [
      { item_type: "CRT Television / Tube TV", brand: "Sony", estimated_age_years: 15, condition: "functional" as const },
      { item_type: "Laptop / Notebook", brand: "Apple", estimated_age_years: 1, condition: "functional" as const },
      { item_type: "Laptop / Notebook", brand: "Lenovo", estimated_age_years: 3, condition: "cosmetic_damage" as const },
      { item_type: "Tablet", brand: "Samsung", estimated_age_years: 2, condition: "partially_working" as const },
      { item_type: "Smartphone", brand: "Google", estimated_age_years: 5, condition: "severely_damaged" as const },
    ];

    for (const tc of testCases) {
      const res = evaluateItem({ ...tc, material_recoverable: true });
      const recPathway = res.pathways.find((p) => p.isRecommended);
      assert.ok(recPathway, `No recommended pathway flagged for ${tc.item_type}`);
      assert.equal(recPathway.rank, 1, `Recommended pathway rank should be 1, got ${recPathway.rank}`);
      assert.equal(recPathway.action, res.recommended_action);

      // Verify recPathway viability is >= all other pathways
      for (const p of res.pathways) {
        assert.ok(
          recPathway.viability >= p.viability,
          `Recommended ${recPathway.action} viability (${recPathway.viability}) must be >= ${p.action} (${p.viability}) for ${tc.item_type}`
        );
      }
    }
  });

  // Test 14: Pathways array must be strictly sorted in descending order of viability score
  it("Test 14: Pathways array is strictly sorted in descending order of viability score across diverse hardware", () => {
    const testCases = [
      { item_type: "CRT Television / Tube TV", brand: "Sony", estimated_age_years: 15, condition: "functional" as const },
      { item_type: "Laptop / Notebook", brand: "Apple", estimated_age_years: 1, condition: "functional" as const },
      { item_type: "Laptop / Notebook", brand: "Lenovo", estimated_age_years: 3, condition: "cosmetic_damage" as const },
      { item_type: "Tablet", brand: "Samsung", estimated_age_years: 2, condition: "partially_working" as const },
      { item_type: "Smartphone", brand: "Google", estimated_age_years: 5, condition: "severely_damaged" as const },
      { item_type: "Vintage VHS VCR Deck", brand: "Panasonic", estimated_age_years: 12, condition: "functional" as const },
      { item_type: "Printer / Scanner", brand: "HP", estimated_age_years: 4, condition: "partially_working" as const },
    ];

    for (const tc of testCases) {
      const res = evaluateItem({ ...tc, material_recoverable: true });
      const pathways = res.pathways;

      assert.equal(pathways.length, 6, `Expected 6 pathways for ${tc.item_type}`);

      // Generic assertion: pathways[i].viability >= pathways[i+1].viability for all consecutive pairs
      for (let i = 0; i < pathways.length - 1; i++) {
        const current = pathways[i];
        const next = pathways[i + 1];
        assert.ok(
          current.viability >= next.viability,
          `Viability sort violation for ${tc.item_type} at index ${i} -> ${i + 1}: ` +
            `${current.title} (${current.viability}) should be >= ${next.title} (${next.viability}). ` +
            `Full order: [${pathways.map((p) => `${p.title}:${p.viability}`).join(", ")}]`
        );
      }
    }
  });
});


