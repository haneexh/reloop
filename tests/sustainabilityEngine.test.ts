import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSustainabilityMetrics,
  type RawRequestRecord,
  type RawCollectionRecord,
  type RawRecoveryTransfer,
  type RawRouteRecord,
} from "../lib/sustainability-engine.ts";

describe("PS-013 Sustainability Intelligence & Eco-Metrics Tests", () => {
  const sampleRequests: RawRequestRecord[] = [
    { id: "req-1", status: "collected", created_at: "2026-10-08T08:00:00Z", is_simulated: false },
    { id: "req-2", status: "recovered", created_at: "2026-10-08T09:00:00Z", is_simulated: false },
    { id: "req-3", status: "scheduled", created_at: "2026-10-08T10:00:00Z", is_simulated: true },
    { id: "req-4", status: "pending", created_at: "2026-10-08T11:00:00Z", is_simulated: true },
  ];

  const sampleCollectionRecords: RawCollectionRecord[] = [
    { id: "rec-1", request_id: "req-1", actual_weight_kg: 20.0, verified_at: "2026-10-08T12:00:00Z", is_simulated: false },
    { id: "rec-2", request_id: "req-2", actual_weight_kg: 30.0, verified_at: "2026-10-08T13:00:00Z", is_simulated: false },
  ];

  const sampleTransfers: RawRecoveryTransfer[] = [
    {
      id: "tr-1",
      facility_id: "fac-1",
      route_id: "route-1",
      total_weight_kg: 30.0,
      refurbished_pct: 40, // 12 kg
      recycled_pct: 50,    // 15 kg
      residual_pct: 10,    // 3 kg
      transferred_at: "2026-10-08T14:00:00Z",
    },
  ];

  const sampleRoutes: RawRouteRecord[] = [
    { id: "route-1", total_distance_km: 25.0, total_load_kg: 50.0, status: "completed", vehicle_capacity_kg: 100.0 },
  ];

  // 12. Sustainability metric calculations
  it("Scenario 12: computes all circular mass balance metrics accurately", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
      baselineDistanceSavedKm: 5.5,
    });

    assert.equal(res.total_requests, 4);
    assert.equal(res.collected_requests, 2);
    assert.equal(res.scheduled_requests, 3); // req-1, req-2, req-3
    assert.equal(res.collected_weight_kg, 50.0);
    assert.equal(res.recovered_weight_kg, 12.0);
    assert.equal(res.recycled_weight_kg, 15.0);
    assert.equal(res.residual_weight_kg, 3.0);
    assert.equal(res.diverted_weight_kg, 47.0); // 50 - 3
    assert.equal(res.recovery_rate_percent, 54.0); // (12 + 15) / 50 * 100
    assert.equal(res.diversion_rate_percent, 94.0); // 47 / 50 * 100
  });

  // 13. Zero-denominator safety
  it("Scenario 13: handles empty database inputs with zero division safely without NaN or Infinity", () => {
    const res = computeSustainabilityMetrics({
      requests: [],
      collectionRecords: [],
      transfers: [],
      routes: [],
      baselineDistanceSavedKm: 0,
    });

    assert.equal(res.total_requests, 0);
    assert.equal(res.collected_weight_kg, 0);
    assert.equal(res.recovery_rate_percent, 0);
    assert.equal(res.collection_completion_rate_percent, 0);
    assert.equal(res.collection_efficiency_kg_per_km, 0);
    assert.equal(res.vehicle_utilization_percent, 0);
    assert.equal(res.average_pickup_lead_time_hours, 0);
    assert.equal(Number.isNaN(res.recovery_rate_percent), false);
    assert.equal(Number.isFinite(res.collection_efficiency_kg_per_km), true);
  });

  // 14. Collection efficiency calculation (kg/km)
  it("Scenario 14: computes collection efficiency and route distance metrics", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
      baselineDistanceSavedKm: 6.2,
    });

    // 50.0 kg / 25.0 km = 2.0 kg/km
    assert.equal(res.collection_efficiency_kg_per_km, 2.0);
    assert.equal(res.route_distance_km, 25.0);
    assert.equal(res.route_distance_saved_km, 6.2);
  });

  // 15. Vehicle utilization calculation
  it("Scenario 15: computes fleet capacity utilization percentage", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
    });

    // 50.0 kg assigned / 100.0 kg capacity = 50.0%
    assert.equal(res.vehicle_utilization_percent, 50.0);
  });

  // 16. Modeled environmental estimates
  it("Scenario 16: provides transparent environmental estimates clearly labelled", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
    });

    assert.ok(res.estimated_co2e_avoided_kg > 0);
    assert.ok(res.estimated_landfill_diverted_m3 > 0);
    assert.match(res.environmental_methodology, /ESTIMATE/);
  });

  // 17. Real vs Simulated distinction
  it("Scenario 17: preserves clean separation between real records and simulated demo data", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
    });

    assert.equal(res.real_requests_count, 2);
    assert.equal(res.simulated_requests_count, 2);
    assert.equal(res.real_collected_kg, 50.0);
    assert.equal(res.simulated_collected_kg, 0);
  });

  // 18. Public dashboard privacy: ensures metrics object contains zero citizen PII
  it("Scenario 18: guarantees sustainability output payload contains zero citizen PII", () => {
    const res = computeSustainabilityMetrics({
      requests: sampleRequests,
      collectionRecords: sampleCollectionRecords,
      transfers: sampleTransfers,
      routes: sampleRoutes,
    });

    assert.equal((res as any).citizen_name, undefined);
    assert.equal((res as any).citizen_phone, undefined);
    assert.equal((res as any).address, undefined);
  });
});
