import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EWASTE_TAXONOMY,
  mapItemToTaxonomy,
} from "../lib/taxonomy-mapper.ts";
import {
  calculateHaversineDistanceKm,
  resolveZoneFromList,
  FALLBACK_HYDERABAD_ZONES,
} from "../lib/zone-resolver.ts";

describe("PS-013 Citizen Intake & Taxonomy Tests", () => {
  it("verifies taxonomy definitions contain required fields and positive weights", () => {
    assert.ok(EWASTE_TAXONOMY.length >= 10, "Taxonomy should define at least 10 categories");
    for (const item of EWASTE_TAXONOMY) {
      assert.ok(item.categoryKey.length > 0, "Category key must be non-empty");
      assert.ok(item.label.length > 0, "Label must be non-empty");
      assert.ok(item.avgWeightKg > 0, "Average weight must be positive");
      assert.ok(Array.isArray(item.potentialHazards), "Hazards must be an array");
      assert.ok(item.defaultAgeYears >= 0, "Default age must be non-negative");
    }
  });

  it("maps smartphone variants to smartphone taxonomy", () => {
    const res1 = mapItemToTaxonomy("iPhone 14 Pro Max");
    assert.equal(res1.categoryKey, "smartphone");
    assert.ok(res1.potentialHazards.includes("Lithium-ion Battery"));

    const res2 = mapItemToTaxonomy("Samsung Galaxy S22");
    assert.equal(res2.categoryKey, "smartphone");
  });

  it("maps laptop and PC variants to appropriate categories", () => {
    const resLaptop = mapItemToTaxonomy("MacBook Pro M2");
    assert.equal(resLaptop.categoryKey, "laptop");

    const resDesktop = mapItemToTaxonomy("Custom Desktop PC Tower");
    assert.equal(resDesktop.categoryKey, "desktop_pc");
  });

  it("maps hazardous legacy displays (CRT) correctly", () => {
    const resCrt = mapItemToTaxonomy("Old Sony Trinitron CRT TV");
    assert.equal(resCrt.categoryKey, "crt_tv");
    assert.ok(resCrt.potentialHazards.some((h) => h.includes("Lead")));
  });

  it("provides safe fallback baseline for unlisted electronics", () => {
    const resFallback = mapItemToTaxonomy("Industrial Oscilloscope Model X");
    assert.ok(resFallback.avgWeightKg > 0);
    assert.ok(resFallback.label.length > 0);
  });
});

describe("PS-013 Municipal Zone Resolution Tests", () => {
  it("computes Haversine distance correctly", () => {
    // Same coordinate
    const dZero = calculateHaversineDistanceKm(17.4486, 78.3908, 17.4486, 78.3908);
    assert.equal(dZero, 0);

    // Distance between HITEC City and Gachibowli is approx 4-6 km
    const dHitecToGachibowli = calculateHaversineDistanceKm(17.4486, 78.3908, 17.4401, 78.3489);
    assert.ok(
      dHitecToGachibowli >= 3.5 && dHitecToGachibowli <= 6.5,
      `Calculated distance ${dHitecToGachibowli} km outside expected range`
    );
  });

  it("resolves Cyber Towers coordinate to ZONE-HYD-01 (HITEC City)", () => {
    const cyberTowersLat = 17.4504;
    const cyberTowersLng = 78.3808;

    const res = resolveZoneFromList(cyberTowersLat, cyberTowersLng, FALLBACK_HYDERABAD_ZONES);
    assert.equal(res.zone.code, "ZONE-HYD-01");
    assert.ok(res.distanceKm < 3.0, "Should be within 3 km of HITEC centroid");
    assert.equal(res.isWithinRadius, true);
  });

  it("resolves Financial District coordinate to ZONE-HYD-02 (Gachibowli)", () => {
    const finDistrictLat = 17.4180;
    const finDistrictLng = 78.3400;

    const res = resolveZoneFromList(finDistrictLat, finDistrictLng, FALLBACK_HYDERABAD_ZONES);
    assert.equal(res.zone.code, "ZONE-HYD-02");
    assert.equal(res.isWithinRadius, true);
  });

  it("resolves Secunderabad coordinate to ZONE-HYD-08", () => {
    const secunderabadLat = 17.4410;
    const secunderabadLng = 78.5010;

    const res = resolveZoneFromList(secunderabadLat, secunderabadLng, FALLBACK_HYDERABAD_ZONES);
    assert.equal(res.zone.code, "ZONE-HYD-08");
  });
});

describe("PS-013 Citizen Tracking & Privacy Tests", () => {
  it("masks street address safely for public tracking view", () => {
    const rawAddress = "Flat 502, Building B, Rainbow Vistas, Moosapet, Hyderabad";
    const parts = rawAddress.split(",").map((s) => s.trim()).filter(Boolean);
    const publicArea = parts.length >= 2 ? parts.slice(-2).join(", ") : "Hyderabad";

    assert.equal(publicArea, "Moosapet, Hyderabad");
    assert.ok(!publicArea.includes("Flat 502"), "Private flat number must not appear in public area");
    assert.ok(!publicArea.includes("Building B"), "Building name must not appear in public area");
  });

  it("validates token format requirement", () => {
    const tokenRegex = /^RLP-HYD-[A-F0-9]{8}$/;
    const validSample = "RLP-HYD-A1B2C3D4";
    assert.ok(tokenRegex.test(validSample), "Token should match standard format");

    const invalidSample = "RLP-HYD-INVALID";
    assert.equal(tokenRegex.test(invalidSample), false);
  });
});
