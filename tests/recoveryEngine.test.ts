import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAuthorizedRecoveryOperator,
  mapPartnerToFacility,
  validateTransferBatch,
  validateRecoveryBreakdown,
  calculateDiversionMetrics,
  type RecoveryFacility,
} from "../lib/recovery-engine.ts";

describe("PS-013 Recovery Workflow & Material Breakdown Tests", () => {
  const samplePartner = {
    id: "fac-001",
    name: "EcoCirc Smelting & Recovery Works",
    partner_type: "recycler",
    city: "Hyderabad",
    lat: 17.44,
    lng: 78.38,
    contact: "ops@ecocirc.in",
    verified: true,
  };

  const sampleFacility: RecoveryFacility = mapPartnerToFacility(samplePartner);

  const sampleRecords = [
    { id: "rec-1", actual_weight_kg: 10.0, request_id: "req-1", request_status: "collected" },
    { id: "rec-2", actual_weight_kg: 15.0, request_id: "req-2", request_status: "collected" },
  ];

  // 1. Valid facility selection
  it("Scenario 1: validates facility selection and maps partner properly", () => {
    assert.equal(sampleFacility.id, "fac-001");
    assert.equal(sampleFacility.facility_type, "RECYCLER");
    assert.equal(sampleFacility.verified, true);
    assert.ok(sampleFacility.accepted_categories.includes("e-waste"));
  });

  // 2. Invalid facility rejection
  it("Scenario 2: rejects null, undefined, or missing facility in batch transfer", () => {
    const res = validateTransferBatch({
      facility: null,
      collectionRecords: sampleRecords,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || "", /valid recovery facility must be selected/);
  });

  // 3. Transfer weight validation
  it("Scenario 3: calculates exact total weight from collection records batch", () => {
    const res = validateTransferBatch({
      facility: sampleFacility,
      collectionRecords: sampleRecords,
    });
    assert.equal(res.valid, true);
    assert.equal(res.total_weight_kg, 25.0); // 10.0 + 15.0
    assert.equal(res.record_ids?.length, 2);
  });

  // 4. Cannot transfer more weight than was collected
  it("Scenario 4: rejects transfer if specified weight exceeds collected batch weight", () => {
    const res = validateTransferBatch({
      facility: sampleFacility,
      collectionRecords: sampleRecords,
      specifiedWeightKg: 30.0, // Exceeds 25.0 kg collected!
    });
    assert.equal(res.valid, false);
    assert.match(res.error || "", /Cannot transfer more weight/);
  });

  // 5. Cannot transfer uncollected material
  it("Scenario 5: rejects transfer of cancelled or pending uncollected requests", () => {
    const uncollectedRecords = [
      { id: "rec-3", actual_weight_kg: 5.0, request_id: "req-3", request_status: "pending" },
    ];
    const res = validateTransferBatch({
      facility: sampleFacility,
      collectionRecords: uncollectedRecords,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || "", /Cannot transfer uncollected request/);
  });

  // 6. Negative recovery allocation rejected
  it("Scenario 6: rejects negative recovery allocation percentages", () => {
    const res = validateRecoveryBreakdown(25.0, -10, 50, 10);
    assert.equal(res.valid, false);
    assert.match(res.error || "", /cannot be negative/);
  });

  // 7. Recovery allocation exceeding transfer rejected
  it("Scenario 7: rejects recovery allocations exceeding 100% of payload", () => {
    const res = validateRecoveryBreakdown(25.0, 50, 40, 25); // Sum = 115%
    assert.equal(res.valid, false);
    assert.match(res.error || "", /exceed 100%/);
  });

  // 8. Incomplete allocation detected
  it("Scenario 8: detects incomplete breakdown without silently treating difference as residual", () => {
    const res = validateRecoveryBreakdown(100.0, 30, 40, 10); // Sum = 80% (20% unallocated)
    assert.equal(res.valid, true);
    assert.equal(res.breakdown?.is_complete, false);
    assert.equal(res.breakdown?.unallocated_pct, 20.0);
    assert.equal(res.breakdown?.unallocated_kg, 20.0);
    assert.equal(res.breakdown?.residual_kg, 10.0); // Residual is kept at explicit 10 kg
  });

  // 9. Exact recovery breakdown accepted
  it("Scenario 9: accepts exact 100% recovery breakdown with accurate mass balance", () => {
    const res = validateRecoveryBreakdown(200.0, 25, 65, 10); // Sum = 100%
    assert.equal(res.valid, true);
    assert.equal(res.breakdown?.is_complete, true);
    assert.equal(res.breakdown?.refurbished_kg, 50.0);
    assert.equal(res.breakdown?.recycled_kg, 130.0);
    assert.equal(res.breakdown?.residual_kg, 20.0);
    assert.equal(res.breakdown?.diverted_weight_kg, 180.0);
    assert.equal(res.breakdown?.recovery_rate_percent, 90.0);
  });

  // 10. Diversion calculation
  it("Scenario 10: calculates diversion mass balance correctly", () => {
    const div = calculateDiversionMetrics(150.0, 15.0);
    assert.equal(div.diverted_weight_kg, 135.0);
    assert.equal(div.diversion_rate_percent, 90.0);
  });

  // 11. Authorization boundary
  it("Scenario 11: enforces authorization boundary for recovery workflow", () => {
    assert.equal(isAuthorizedRecoveryOperator("FACILITY"), true);
    assert.equal(isAuthorizedRecoveryOperator("DISPATCHER"), true);
    assert.equal(isAuthorizedRecoveryOperator("ADMIN"), true);
    assert.equal(isAuthorizedRecoveryOperator("CITIZEN"), false);
    assert.equal(isAuthorizedRecoveryOperator("COLLECTOR"), false);
    assert.equal(isAuthorizedRecoveryOperator(""), false);
  });

  // 11b. Invariant 6: Rejects transferring already transferred requests
  it("Scenario 11b: rejects transferring request that has already been transferred (Invariant 6)", () => {
    const alreadyTransferredRecords = [
      { id: "rec-transferred", actual_weight_kg: 12.0, request_id: "req-transferred", request_status: "sent_to_facility" },
    ];
    const res = validateTransferBatch({
      facility: sampleFacility,
      collectionRecords: alreadyTransferredRecords,
    });
    assert.equal(res.valid, false);
    assert.match(res.error || "", /already been transferred/);
  });
});

