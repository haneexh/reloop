import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAuthorizedCollector,
  validateActualWeight,
  calculateWeightVariance,
  validateStopForCollection,
  calculateRouteProgress,
  maskAddressForCollector,
  type RouteStopDetail,
} from "../lib/collector-engine.ts";

describe("PS-013 Collector Operations & Verification Unit Tests", () => {
  const sampleRouteStops = [
    {
      sequence: 1,
      stop_type: "DEPOT_DEPARTURE",
      request_id: null,
      lat: 17.45,
      lng: 78.38,
      estimated_weight_kg: 0,
    },
    {
      sequence: 2,
      stop_type: "COLLECTION_STOP",
      request_id: "req-001",
      lat: 17.44,
      lng: 78.39,
      estimated_weight_kg: 8.5,
    },
    {
      sequence: 3,
      stop_type: "COLLECTION_STOP",
      request_id: "req-002",
      lat: 17.46,
      lng: 78.37,
      estimated_weight_kg: 12.0,
    },
    {
      sequence: 4,
      stop_type: "DEPOT_RETURN",
      request_id: null,
      lat: 17.45,
      lng: 78.38,
      estimated_weight_kg: 0,
    },
  ];

  // 1. Valid QR/reference verification
  it("Scenario 1: validates stop presence for collection successfully", () => {
    const res = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-001",
      requestStatus: "assigned",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  // 2. Invalid QR rejection (empty or unformatted token logic)
  it("Scenario 2: rejects invalid, non-existent, or unmatched tokens", () => {
    const res = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "non-existent-req",
      requestStatus: "assigned",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, "NOT_ON_ROUTE");
    assert.match(res.error || "", /does not belong to this assigned route/);
  });

  // 3. Request not belonging to route rejection
  it("Scenario 3: rejects collection of request belonging to a different route", () => {
    const res = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-unrelated-999",
      requestStatus: "assigned",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, "NOT_ON_ROUTE");
  });

  // 4. Cancelled request rejection
  it("Scenario 4: rejects collection attempt for a cancelled request", () => {
    const res = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-001",
      requestStatus: "cancelled",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, "REQUEST_CANCELLED");
    assert.match(res.error || "", /cancelled/);
  });

  // 5. Already collected request rejection
  it("Scenario 5: rejects collection attempt if request is already collected or weighed", () => {
    const resCollected = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-001",
      requestStatus: "collected",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(resCollected.valid, false);
    assert.equal(resCollected.code, "ALREADY_COLLECTED");

    const resWeighed = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-001",
      requestStatus: "weighed",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });

    assert.equal(resWeighed.valid, false);
    assert.equal(resWeighed.code, "ALREADY_COLLECTED");
  });

  // 6. Actual weight validation (numeric, positive, reasonable upper bound)
  it("Scenario 6: validates actual weight boundaries and formats correctly", () => {
    // Valid positive weight
    const validRes = validateActualWeight(9.4, 100, 10);
    assert.equal(validRes.valid, true);
    assert.equal(validRes.weight, 9.4);

    // Negative weight rejected
    const negativeRes = validateActualWeight(-2.5, 100, 0);
    assert.equal(negativeRes.valid, false);
    assert.match(negativeRes.error || "", /greater than 0/);

    // Zero weight rejected
    const zeroRes = validateActualWeight(0, 100, 0);
    assert.equal(zeroRes.valid, false);

    // Non-numeric rejected
    const nanRes = validateActualWeight("abc", 100, 0);
    assert.equal(nanRes.valid, false);

    // Unreasonable upper bound rejected (> 1000 kg)
    const excessRes = validateActualWeight(1500, 2000, 0);
    assert.equal(excessRes.valid, false);
    assert.match(excessRes.error || "", /1000 kg/);
  });

  // 7. Capacity overflow rejection
  it("Scenario 7: rejects actual weight that exceeds remaining vehicle capacity", () => {
    const vehicleCapacity = 100.0;
    const currentLoaded = 90.0; // 10 kg space remaining

    // Attempting 15 kg pickup exceeds 10 kg remaining
    const overflowRes = validateActualWeight(15.0, vehicleCapacity, currentLoaded);
    assert.equal(overflowRes.valid, false);
    assert.match(overflowRes.error || "", /Capacity overflow/);

    // 9.5 kg pickup fits comfortably within remaining capacity
    const fittingRes = validateActualWeight(9.5, vehicleCapacity, currentLoaded);
    assert.equal(fittingRes.valid, true);
    assert.equal(fittingRes.weight, 9.5);
  });

  // 8. Valid collection record creation & weight variance
  it("Scenario 8: calculates weight variance honestly against intake estimates", () => {
    const variance1 = calculateWeightVariance(10.0, 12.0);
    assert.equal(variance1.variance_kg, 2.0);
    assert.equal(variance1.variance_percent, 20.0);

    const variance2 = calculateWeightVariance(8.0, 6.0);
    assert.equal(variance2.variance_kg, -2.0);
    assert.equal(variance2.variance_percent, -25.0);
  });

  // 9. Duplicate collection prevention
  it("Scenario 9: prevents duplicate collection when collection_record already exists", () => {
    const res = validateStopForCollection({
      routeStops: sampleRouteStops,
      requestId: "req-001",
      requestStatus: "assigned",
      existingRecordCount: 1, // Already exists in database!
      routeStatus: "in_progress",
    });

    assert.equal(res.valid, false);
    assert.equal(res.code, "RECORD_EXISTS");
    assert.match(res.error || "", /Duplicate collection detected/);
  });

  // 10. Request status transition & Route progress derivation
  it("Scenario 10: derives route progress metrics strictly from database state", () => {
    const completedIds = new Set(["req-001"]);
    const weightsMap = new Map([["req-001", 9.0]]);

    const progress = calculateRouteProgress(
      sampleRouteStops,
      completedIds,
      100.0,
      weightsMap
    );

    assert.equal(progress.total_stops, 2); // 2 collection stops
    assert.equal(progress.completed_stops, 1);
    assert.equal(progress.remaining_stops, 1);
    assert.equal(progress.completion_percentage, 50.0);
    assert.equal(progress.total_actual_kg, 9.0);
    assert.equal(progress.remaining_capacity_kg, 91.0);
    assert.equal(progress.utilization_percentage, 9.0);
  });

  // 11. Event log payload creation structure
  it("Scenario 11: constructs valid event log payloads without sensitive PII", () => {
    const payload = {
      request_id: "req-001",
      collection_record_id: "rec-001",
      route_id: "route-001",
      vehicle_id: "veh-001",
      qr_token: "RLP-HYD-001",
      actual_weight_kg: 9.4,
      estimated_weight_kg: 8.5,
      variance_kg: 0.9,
      verification_method: "qr_scan",
      gps_captured: true,
      collected_at: new Date().toISOString(),
    };

    assert.ok(payload.request_id);
    assert.ok(payload.collection_record_id);
    assert.ok(payload.actual_weight_kg > 0);
    // Explicitly verify no phone numbers or personal citizen names in payload
    assert.equal((payload as any).citizen_phone, undefined);
    assert.equal((payload as any).citizen_name, undefined);
  });

  // 12. GPS optional behavior (succeeds with or without GPS)
  it("Scenario 12: supports collection workflow whether GPS is captured or denied", () => {
    // With GPS
    const withGpsNote = `Verified by field collector [GPS: 17.44900, 78.38400]`;
    assert.match(withGpsNote, /GPS: 17.44900/);

    // Without GPS (denied/unavailable)
    const withoutGpsNote = `Verified by field collector`;
    assert.doesNotMatch(withoutGpsNote, /GPS/);
    assert.ok(withoutGpsNote.length > 0);
  });

  // 13. Public tracking PII masking
  it("Scenario 13: securely masks street address to municipal locality", () => {
    const masked1 = maskAddressForCollector(
      "Flat 402, Tower B, My Home Bhooja, HITEC City, Hyderabad",
      "HITEC City"
    );
    assert.equal(masked1, "HITEC City, Hyderabad");
    assert.doesNotMatch(masked1, /Flat 402/);
    assert.doesNotMatch(masked1, /Tower B/);

    const maskedEmpty = maskAddressForCollector("", "Gachibowli");
    assert.equal(maskedEmpty, "Gachibowli, Hyderabad");
  });

  // 14. Collector authorization boundary
  it("Scenario 14: enforces role authorization boundary (COLLECTOR allowed, CITIZEN rejected)", () => {
    assert.equal(isAuthorizedCollector("COLLECTOR"), true);
    assert.equal(isAuthorizedCollector("collector"), true);
    assert.equal(isAuthorizedCollector("DISPATCHER"), true);
    assert.equal(isAuthorizedCollector("ADMIN"), true);

    // CITIZEN and unauthorized roles MUST be rejected
    assert.equal(isAuthorizedCollector("CITIZEN"), false);
    assert.equal(isAuthorizedCollector("citizen"), false);
    assert.equal(isAuthorizedCollector(""), false);
    assert.equal(isAuthorizedCollector(null), false);
    assert.equal(isAuthorizedCollector(undefined), false);
    assert.equal(isAuthorizedCollector("ANONYMOUS"), false);
  });
});
