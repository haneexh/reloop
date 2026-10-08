import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getRequestStatusMeta,
  getRouteStatusMeta,
  formatRawKeyToCivic,
} from "../lib/status-helper.ts";

describe("PS-013 Civic Status Language & Design Token Mapping Tests", () => {
  it("maps pending request to civic 'Pickup Requested' warning status", () => {
    const meta = getRequestStatusMeta("pending");
    assert.equal(meta.label, "Pickup Requested");
    assert.equal(meta.variant, "warning");
    assert.match(meta.description, /awaiting dispatch planning/);
  });

  it("maps collected request to civic 'E-Waste Collected' success status", () => {
    const meta = getRequestStatusMeta("collected");
    assert.equal(meta.label, "E-Waste Collected");
    assert.equal(meta.variant, "success");
    assert.match(meta.description, /verified at physical scale/);
  });

  it("maps sent_to_facility request to civic 'Sent for Recovery'", () => {
    const meta = getRequestStatusMeta("sent_to_facility");
    assert.equal(meta.label, "Sent for Recovery");
    assert.equal(meta.variant, "accent");
  });

  it("maps recovered request to civic 'Recovery Recorded'", () => {
    const meta = getRequestStatusMeta("recovered");
    assert.equal(meta.label, "Recovery Recorded");
    assert.equal(meta.variant, "success");
  });

  it("safely handles null or undefined request statuses", () => {
    const nullMeta = getRequestStatusMeta(null);
    assert.equal(nullMeta.label, "Pickup Requested");

    const undefinedMeta = getRequestStatusMeta(undefined);
    assert.equal(undefinedMeta.label, "Pickup Requested");
  });

  it("maps route planned and in_progress statuses", () => {
    const plannedMeta = getRouteStatusMeta("planned");
    assert.equal(plannedMeta.label, "Route Planned");

    const inProgressMeta = getRouteStatusMeta("in_progress");
    assert.equal(inProgressMeta.label, "Route Active");
  });

  it("converts arbitrary snake_case keys into Title Case civic strings", () => {
    assert.equal(formatRawKeyToCivic("item_type"), "Item Type");
    assert.equal(formatRawKeyToCivic("capacity_exceeded"), "Capacity Exceeded");
    assert.equal(formatRawKeyToCivic(""), "");
  });
});
