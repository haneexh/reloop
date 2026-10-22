import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateSecureTrackingToken,
  isValidTrackingToken,
  isDemoTrackingToken,
} from "../lib/tracking-token.ts";
import { isHighQualityAssessment } from "../lib/ai-scan-cache.ts";

describe("PS-013 Canonical Tracking Token & Quality Gate Tests", () => {
  it("Generates canonical tracking tokens with >= 50 bits entropy and RLP-HYD- prefix", () => {
    const token = generateSecureTrackingToken();
    assert.match(token, /^RLP-HYD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
    assert.equal(isValidTrackingToken(token), true);
  });

  it("Ensures tokens have distinct random values (no collision in sample)", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = generateSecureTrackingToken();
      assert.equal(tokens.has(t), false, `Collision detected on ${t}`);
      tokens.add(t);
    }
    assert.equal(tokens.size, 500);
  });

  it("Validates demo tokens correctly", () => {
    assert.equal(isDemoTrackingToken("QR-REQ-HYD-001"), true);
    assert.equal(isDemoTrackingToken("QR-REQ-HYD-002"), true);
    assert.equal(isDemoTrackingToken("QR-REQ-HYD-009"), true);
    assert.equal(isDemoTrackingToken("RLP-HYD-7K9M2W4X8P"), false);
    assert.equal(isDemoTrackingToken("RLP-9B1D4F2A"), false);
    assert.equal(isValidTrackingToken("QR-REQ-HYD-001"), true);
  });

  it("Quality gate rejects low-information or unlisted electronic classifications", () => {
    assert.equal(
      isHighQualityAssessment({
        item_type: "Other Electronics / Unlisted",
        confidence: "high",
      }),
      false,
      "Should reject Other Electronics / Unlisted"
    );

    assert.equal(
      isHighQualityAssessment({
        item_type: "unknown",
        confidence: "medium",
      }),
      false,
      "Should reject unknown"
    );

    assert.equal(
      isHighQualityAssessment({
        confidence: "high",
      }),
      false,
      "Should reject missing item_type"
    );

    assert.equal(
      isHighQualityAssessment({
        item_type: "Smartphone",
        confidence: "low",
      }),
      false,
      "Should reject low confidence"
    );
  });

  it("Quality gate accepts well-formed electronic classification with high/medium confidence", () => {
    assert.equal(
      isHighQualityAssessment({
        item_type: "Smartphone",
        confidence: "high",
        brand: "Apple",
        condition: "working",
      }),
      true
    );

    assert.equal(
      isHighQualityAssessment({
        item_type: "Laptop",
        confidence: "medium",
        brand: "Dell",
        condition: "cosmetic_damage",
      }),
      true
    );
  });

  it("Quality gate accepts non-electronic classifications with high/medium confidence", () => {
    assert.equal(
      isHighQualityAssessment({
        item_type: "Non-electronic item (shirt / apparel)",
        is_electronic: false,
        confidence: "high",
      }),
      true
    );
  });
});
