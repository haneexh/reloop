import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateItem,
  PPRI_WEIGHT_COST_RATIO,
  PPRI_WEIGHT_CONDITION,
  PPRI_WEIGHT_AGE,
} from "../lib/decisionEngine.ts";

describe("RE:LOOP Decision Engine & PP-RI Unit Tests", () => {
  it("verifies mathematical weight configuration sums to 1.0", () => {
    const sum = PPRI_WEIGHT_COST_RATIO + PPRI_WEIGHT_CONDITION + PPRI_WEIGHT_AGE;
    assert.equal(Number(sum.toFixed(2)), 1.0);
  });

  // Test 1: Nearly-new functional phone
  it("Test 1: Nearly-new functional phone gets high PP-RI score and REUSE/REPAIR recommendation", () => {
    const result = evaluateItem({
      item_type: "smartphone",
      brand: "Apple",
      estimated_age_years: 0.5,
      condition: "functional",
      material_recoverable: true,
    });

    assert.ok(result.ppri_score >= 8.0, `Expected PP-RI >= 8.0, got ${result.ppri_score}`);
    assert.equal(result.recommended_action, "repair"); // cost ratio < 0.4 and age <= 5 -> repair
    assert.equal(result.alt_action_1, "reuse");
    assert.ok(result.resale_value_est > result.repair_cost_est);
    assert.ok(result.co2e_saved_kg > 0);
    assert.ok(result.rationale.includes("PP-RI") || result.rationale.includes("₹"));
  });

  // Test 2: 6-year-old laptop with cosmetic damage
  it("Test 2: 6-year-old laptop with cosmetic damage evaluates refurbish/donate circular routing", () => {
    const result = evaluateItem({
      item_type: "laptop",
      brand: "Lenovo",
      estimated_age_years: 6.0,
      condition: "cosmetic_damage",
      material_recoverable: true,
    });

    assert.ok(result.ppri_score >= 3.0 && result.ppri_score <= 8.5);
    assert.ok(["refurbish", "donate", "repair", "reuse"].includes(result.recommended_action));
    assert.ok(result.repair_cost_est > 0);
    assert.ok(result.resale_value_est > 0);
    assert.ok(result.rationale.includes("₹"));
  });

  // Test 3: Severely damaged appliance
  it("Test 3: Severely damaged appliance routes to RECYCLE for material recovery", () => {
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
    assert.ok(result.waste_avoided_kg > 0);
    assert.ok(
      result.rationale.toLowerCase().includes("recycling") ||
        result.rationale.toLowerCase().includes("recycle")
    );
  });

  // Test 4: Mid-age item near the repair/resale threshold
  it("Test 4: Mid-age tablet with partial functionality correctly computes repair viability ratio", () => {
    const result = evaluateItem({
      item_type: "tablet",
      brand: "Samsung",
      estimated_age_years: 4.0,
      condition: "partially_working",
      material_recoverable: true,
    });

    assert.ok(result.ppri_score > 0 && result.ppri_score < 10);
    assert.ok(result.repair_cost_est > 0);
    assert.ok(result.resale_value_est > 0);
    assert.ok(["repair", "reuse", "donate", "recycle"].includes(result.recommended_action));
    assert.ok(result.rationale.length > 20);
  });

  // Test 5: Item with no brand or age data (nulls)
  it("Test 5: Item with null brand and age safely falls back to default lifecycle constants without throwing", () => {
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
  });
});
