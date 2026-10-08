import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateDemandScore,
  categorizeDemandLevel,
  aggregateSpatialDemand,
  aggregateTemporalDemand,
  generateDemandForecast,
  computeDemandIntelligence,
  type DemandRequestItem,
  type ZoneMetadata,
  DEMAND_SCORING_WEIGHTS,
} from "../lib/demand-engine.ts";

describe("PS-013 Demand Intelligence: Scoring & Categorization", () => {
  it("calculates deterministic demand score matching formula", () => {
    // 3 requests, 30 kg, 1 urgent, 1 high, recent
    const score = calculateDemandScore(
      3, // 3 * 10 = 30
      30, // 30 * 1.5 = 45
      1, // 1 * 15 = 15
      1, // 1 * 25 = 25
      new Date().toISOString(), // recent bonus = 10
      DEMAND_SCORING_WEIGHTS,
      new Date()
    );
    // Expected: 30 + 45 + 15 + 25 + 10 = 125.0
    assert.equal(score, 125.0);
  });

  it("returns zero score for zero requests", () => {
    const score = calculateDemandScore(0, 0, 0, 0, null);
    assert.equal(score, 0);
  });

  it("categorizes demand levels accurately based on thresholds", () => {
    assert.equal(categorizeDemandLevel(10, 0, 1, 5), "LOW");
    assert.equal(categorizeDemandLevel(35, 0, 2, 10), "MEDIUM");
    assert.equal(categorizeDemandLevel(85, 0, 4, 30), "HIGH");
    assert.equal(categorizeDemandLevel(50, 1, 2, 20), "CRITICAL"); // 1 urgent triggers CRITICAL
    assert.equal(categorizeDemandLevel(160, 0, 6, 40), "CRITICAL"); // score >= 150 triggers CRITICAL
    assert.equal(categorizeDemandLevel(60, 0, 4, 110), "CRITICAL"); // weight >= 100 triggers CRITICAL
  });
});

describe("PS-013 Demand Intelligence: Spatial Aggregation", () => {
  const sampleZones: ZoneMetadata[] = [
    {
      id: "zone-1",
      name: "HITEC City",
      code: "ZONE-HYD-01",
      center_lat: 17.4486,
      center_lng: 78.3908,
      radius_km: 4.5,
    },
    {
      id: "zone-2",
      name: "Gachibowli",
      code: "ZONE-HYD-02",
      center_lat: 17.4401,
      center_lng: 78.3489,
      radius_km: 5.0,
    },
  ];

  it("correctly aggregates requests by zone and separates real vs simulated counts", () => {
    const now = new Date();
    const requests: DemandRequestItem[] = [
      {
        id: "req-1",
        zone_id: "zone-1",
        status: "pending",
        priority: "normal",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        is_simulated: true,
        created_at: now.toISOString(),
        lat: 17.449,
        lng: 78.391,
        estimated_weight_kg: 10.0,
      },
      {
        id: "req-2",
        zone_id: "zone-1",
        status: "pending",
        priority: "urgent",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        is_simulated: false, // REAL request
        created_at: now.toISOString(),
        lat: 17.451,
        lng: 78.388,
        estimated_weight_kg: 5.5,
      },
      {
        id: "req-3",
        zone_id: "zone-2",
        status: "scheduled",
        priority: "normal",
        pickup_date: "2026-10-11",
        pickup_slot: "14:00 - 17:00",
        is_simulated: true,
        created_at: now.toISOString(),
        lat: 17.442,
        lng: 78.349,
        estimated_weight_kg: 8.0,
      },
      {
        id: "req-4",
        zone_id: "zone-1",
        status: "cancelled", // should be excluded from planning demand
        priority: "high",
        pickup_date: "2026-10-09",
        pickup_slot: "09:00 - 12:00",
        is_simulated: false,
        created_at: now.toISOString(),
        lat: 17.45,
        lng: 78.39,
        estimated_weight_kg: 50.0,
      },
    ];

    const spatial = aggregateSpatialDemand(requests, sampleZones, now);
    assert.equal(spatial.length, 2);

    const z1 = spatial.find((z) => z.zone_id === "zone-1")!;
    assert.equal(z1.request_count, 2); // req-1 and req-2 only (req-4 cancelled excluded)
    assert.equal(z1.total_estimated_weight_kg, 15.5);
    assert.equal(z1.urgent_count, 1);
    assert.equal(z1.pending_count, 2);
    assert.equal(z1.real_request_count, 1);
    assert.equal(z1.simulated_request_count, 1);

    const z2 = spatial.find((z) => z.zone_id === "zone-2")!;
    assert.equal(z2.request_count, 1);
    assert.equal(z2.scheduled_count, 1);
    assert.equal(z2.total_estimated_weight_kg, 8.0);
  });

  it("handles empty zones with zero requests gracefully", () => {
    const spatial = aggregateSpatialDemand([], sampleZones);
    assert.equal(spatial.length, 2);
    for (const z of spatial) {
      assert.equal(z.request_count, 0);
      assert.equal(z.total_estimated_weight_kg, 0);
      assert.equal(z.demand_score, 0);
    }
  });
});

describe("PS-013 Demand Intelligence: Temporal Aggregation & Forecasting", () => {
  it("aggregates requests by date, time slot, and weekday while tracking real vs simulated totals", () => {
    const requests: DemandRequestItem[] = [
      {
        id: "r1",
        zone_id: "z1",
        status: "pending",
        priority: "normal",
        pickup_date: "2026-10-10", // Saturday (UTC day 6)
        pickup_slot: "09:00 - 12:00",
        is_simulated: true,
        created_at: "2026-10-08T10:00:00Z",
        lat: 17.45,
        lng: 78.39,
        estimated_weight_kg: 12.0,
      },
      {
        id: "r2",
        zone_id: "z1",
        status: "scheduled",
        priority: "high",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        is_simulated: false,
        created_at: "2026-10-08T11:00:00Z",
        lat: 17.45,
        lng: 78.39,
        estimated_weight_kg: 4.0,
      },
    ];

    const temporal = aggregateTemporalDemand(requests);
    assert.equal(temporal.total_requests, 2);
    assert.equal(temporal.total_weight_kg, 16.0);
    assert.equal(temporal.real_requests_count, 1);
    assert.equal(temporal.simulated_requests_count, 1);
    assert.equal(temporal.by_date.length, 1);
    assert.equal(temporal.by_date[0].date, "2026-10-10");
    assert.equal(temporal.by_date[0].slots["09:00 - 12:00"].requests, 2);
  });

  it("generates honest, human-readable zone forecasts without fake AI", () => {
    const zones: ZoneMetadata[] = [
      {
        id: "zone-1",
        name: "HITEC City & Madhapur",
        code: "ZONE-HYD-01",
        center_lat: 17.4486,
        center_lng: 78.3908,
        radius_km: 4.5,
      },
    ];

    const requests: DemandRequestItem[] = [
      {
        id: "r1",
        zone_id: "zone-1",
        status: "pending",
        priority: "urgent",
        pickup_date: "2026-10-10",
        pickup_slot: "09:00 - 12:00",
        is_simulated: true,
        created_at: new Date().toISOString(),
        lat: 17.4486,
        lng: 78.3908,
        estimated_weight_kg: 25.0,
      },
    ];

    const intelligence = computeDemandIntelligence(requests, zones);
    assert.equal(intelligence.forecasts.length, 1);

    const f1 = intelligence.forecasts[0];
    assert.equal(f1.zone_code, "ZONE-HYD-01");
    assert.equal(f1.demand_level, "CRITICAL");
    assert.ok(f1.explanation.includes("HITEC City & Madhapur"));
    assert.ok(f1.explanation.includes("urgent safety priority"));
    assert.equal(f1.is_simulated_basis, true);
  });
});
