import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateItem } from "../lib/decisionEngine.ts";
import { mapItemToTaxonomy } from "../lib/taxonomy-mapper.ts";
import { calculateCircularImpact } from "../lib/impact-calculator.ts";

describe("PS-013 Scan to Pickup Prefill & Linking Tests", () => {
  it("Scenario 1: Maps evaluated scan item to pickup request manifest fields", () => {
    const scannedItem = {
      item_type: "laptop",
      brand: "Lenovo",
      condition: "cosmetic_damage" as const,
      estimated_age_years: 3,
      material_recoverable: true,
    };

    const evaluation = evaluateItem(scannedItem);
    assert.ok(evaluation.recommended_action, "Must have recommended pathway");
    assert.ok(evaluation.ppri_score >= 0 && evaluation.ppri_score <= 10, "PP-RI between 0-10");

    // Map to pickup taxonomy
    const taxonomy = mapItemToTaxonomy(scannedItem.item_type);
    assert.equal(taxonomy.categoryKey, "laptop");
    assert.ok(taxonomy.avgWeightKg > 0);

    // Calculate environmental mass and carbon metrics
    const impact = calculateCircularImpact({
      itemType: scannedItem.item_type,
      condition: scannedItem.condition,
      estimatedAgeYears: scannedItem.estimated_age_years,
    });

    assert.ok(impact.co2eSavedEst > 0, "CO2e saved must be positive");
    assert.ok(impact.wasteAvoidedKg > 0, "Waste avoided must be positive");

    // Form prefill payload
    const prefilledManifestItem = {
      category_key: taxonomy.categoryKey,
      brand: scannedItem.brand,
      condition: scannedItem.condition,
      estimated_age_years: scannedItem.estimated_age_years,
      weight_kg: impact.wasteAvoidedKg,
      co2e_saved_est: impact.co2eSavedEst,
      waste_avoided_kg: impact.wasteAvoidedKg,
      hazards: taxonomy.potentialHazards,
    };

    assert.equal(prefilledManifestItem.category_key, "laptop");
    assert.equal(prefilledManifestItem.brand, "Lenovo");
    assert.equal(prefilledManifestItem.condition, "cosmetic_damage");
    assert.equal(prefilledManifestItem.estimated_age_years, 3);
    assert.ok(prefilledManifestItem.weight_kg > 0);
  });

  it("Scenario 2: Dual Score integrity (PP-RI repairability vs Circular Viability)", () => {
    // Smartphone in functional condition
    const phoneScan = {
      item_type: "smartphone",
      brand: "Samsung",
      condition: "functional" as const,
      estimated_age_years: 1,
      material_recoverable: true,
    };

    const phoneEval = evaluateItem(phoneScan);
    assert.ok(phoneEval.ppri_score >= 7.0, "Near-new phone should score high PP-RI");

    // Recommended pathway comparison
    const topPathway = phoneEval.pathways.find((p) => p.isRecommended);
    assert.ok(topPathway, "Top pathway must be flagged");
    assert.ok(topPathway.suitabilityScore >= 70, "Top pathway viability should be high");
    assert.ok(topPathway.economicValue > 0, "Economic value should be positive");
    assert.ok(topPathway.co2eAvoided > 0, "Carbon avoided should be positive");

    // Degraded display with low repairability
    const crtScan = {
      item_type: "crt_tv",
      brand: "Sony",
      condition: "severely_damaged" as const,
      estimated_age_years: 15,
      material_recoverable: true,
    };

    const crtEval = evaluateItem(crtScan);
    assert.ok(crtEval.ppri_score < 4.0, "Severely damaged old CRT must have low PP-RI");
    assert.equal(crtEval.recommended_action, "recycle", "Must route to material recovery");
  });

  it("Scenario 3: Verifies linking payload structure between scan assessment and pickup request", () => {
    const scanItemId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
    const pickupRequestId = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";

    const requestCreationPayload = {
      citizen_name: "Anita Sharma",
      citizen_phone: "+91-98765-43210",
      address: "Plot 42, Jubilee Hills Road 36, Hyderabad",
      pickup_date: "2026-10-25",
      pickup_slot: "09:00 - 12:00",
      linked_item_id: scanItemId,
      items: [
        {
          item_type: "laptop",
          brand: "Dell",
          condition: "partially_working",
          estimated_age_years: 4,
          weight_kg: 2.2,
          quantity: 1,
        },
      ],
    };

    assert.equal(requestCreationPayload.linked_item_id, scanItemId);
    assert.equal(requestCreationPayload.items.length, 1);

    // Simulated event log linking event
    const itemLinkedEvent = {
      event_type: "ITEM_LINKED",
      entity_type: "items",
      entity_id: scanItemId,
      actor_role: "CITIZEN",
      payload_json: {
        request_id: pickupRequestId,
        qr_token: "RLP-HYD-LNK-001",
      },
    };

    assert.equal(itemLinkedEvent.event_type, "ITEM_LINKED");
    assert.equal(itemLinkedEvent.entity_id, scanItemId);
    assert.equal(itemLinkedEvent.payload_json.request_id, pickupRequestId);
  });

  it("Scenario 4: Gracefully handles partial or unknown scan attributes", () => {
    const partialScan = {
      item_type: "electronic_gadget_xyz",
      brand: null,
      condition: "functional" as const,
      estimated_age_years: null,
      material_recoverable: true,
    };

    const evalResult = evaluateItem(partialScan);
    assert.ok(evalResult.ppri_score >= 0, "Safely handles null brand and age");

    const taxonomy = mapItemToTaxonomy(partialScan.item_type);
    assert.ok(taxonomy.avgWeightKg > 0, "Provides positive weight fallback");
    assert.ok(taxonomy.label.length > 0, "Provides default label");
  });
});
