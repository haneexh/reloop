import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateItem,
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
});
