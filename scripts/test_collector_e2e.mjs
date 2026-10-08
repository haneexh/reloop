import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  isAuthorizedCollector,
  validateActualWeight,
  calculateWeightVariance,
  validateStopForCollection,
  calculateRouteProgress,
  maskAddressForCollector,
} from "../lib/collector-engine.ts";

function getEnv() {
  const envFiles = [".env.local", ".env.production.local"];
  const env = {};
  for (const f of envFiles) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1];
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[key]) env[key] = val;
        }
      }
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("==================================================");
console.log("PS-013 COLLECTOR OPERATIONS LIVE E2E TEST");
console.log("Target Database:", supabaseUrl);
console.log("==================================================");

async function runE2ETest() {
  let testRequestId = null;
  let testRouteId = null;
  let testRecordId = null;

  try {
    // 1. Fetch an active vehicle
    const { data: vehicle, error: vErr } = await supabase
      .from("vehicles")
      .select("id, vehicle_code, capacity_kg")
      .eq("status", "available")
      .limit(1)
      .single();

    if (vErr || !vehicle) {
      console.error("FAIL: No available vehicle found in database.");
      process.exit(1);
    }
    console.log(`✔ Step 1: Selected fleet vehicle ${vehicle.vehicle_code} (Capacity: ${vehicle.capacity_kg} kg)`);

    // 2. Fetch a municipal zone
    const { data: zone, error: zErr } = await supabase
      .from("collection_zones")
      .select("id, code, name")
      .limit(1)
      .single();

    if (zErr || !zone) {
      console.error("FAIL: No collection zone found in database.");
      process.exit(1);
    }
    console.log(`✔ Step 2: Selected zone ${zone.code} (${zone.name})`);

    // 3. Create an isolated simulated test request
    const testToken = `RLP-TEST-${Date.now().toString().slice(-6)}`;
    const { data: createdReq, error: reqErr } = await supabase
      .from("collection_requests")
      .insert({
        citizen_name: "Field Test Citizen",
        citizen_phone: "+91-99999-00000",
        address: "Test Lab, Plot 42, HITEC City, Hyderabad",
        zone_id: zone.id,
        lat: 17.449,
        lng: 78.384,
        pickup_date: new Date().toISOString().split("T")[0],
        pickup_slot: "09:00 - 12:00",
        status: "assigned",
        priority: "normal",
        notes: "E2E Field Ops Test Parcel",
        qr_token: testToken,
        is_simulated: true,
      })
      .select("id, qr_token, status")
      .single();

    if (reqErr || !createdReq) {
      console.error("FAIL: Could not create test collection request:", reqErr);
      process.exit(1);
    }
    testRequestId = createdReq.id;
    console.log(`✔ Step 3: Created test request ${testRequestId} with token "${testToken}"`);

    // 4. Create an isolated planned collection route
    const stopsJson = [
      { sequence: 1, stop_type: "DEPOT_DEPARTURE", request_id: null, lat: 17.452, lng: 78.384, estimated_weight_kg: 0 },
      { sequence: 2, stop_type: "COLLECTION_STOP", request_id: testRequestId, lat: 17.449, lng: 78.384, estimated_weight_kg: 8.0 },
      { sequence: 3, stop_type: "DEPOT_RETURN", request_id: null, lat: 17.452, lng: 78.384, estimated_weight_kg: 0 },
    ];

    const { data: createdRoute, error: routeErr } = await supabase
      .from("collection_routes")
      .insert({
        vehicle_id: vehicle.id,
        zone_id: zone.id,
        route_date: new Date().toISOString().split("T")[0],
        status: "in_progress",
        total_distance_km: 4.5,
        total_load_kg: 8.0,
        estimated_duration_minutes: 35,
        stops_json: stopsJson,
      })
      .select("id, status")
      .single();

    if (routeErr || !createdRoute) {
      console.error("FAIL: Could not create test route:", routeErr);
      process.exit(1);
    }
    testRouteId = createdRoute.id;
    console.log(`✔ Step 4: Created test route ${testRouteId} with 1 collection stop.`);

    // 5. Test Stop Validation
    const validationResult = validateStopForCollection({
      routeStops: stopsJson,
      requestId: testRequestId,
      requestStatus: "assigned",
      existingRecordCount: 0,
      routeStatus: "in_progress",
    });
    if (!validationResult.valid) {
      console.error("FAIL: Stop validation unexpectedly failed:", validationResult.error);
      process.exit(1);
    }
    console.log("✔ Step 5: Stop validated against route itinerary successfully.");

    // 6. Test Capacity Overflow Protection
    const currentLoad = 0;
    const overflowWeight = Number(vehicle.capacity_kg) + 50; // exceeds vehicle limit!
    const overflowValidation = validateActualWeight(overflowWeight, Number(vehicle.capacity_kg), currentLoad);
    if (overflowValidation.valid) {
      console.error("FAIL: Capacity overflow was not rejected!");
      process.exit(1);
    }
    console.log(`✔ Step 6: Capacity overflow correctly rejected: "${overflowValidation.error}"`);

    // 7. Test Valid Weight & Variance
    const actualWeight = 8.8; // 8.8 kg actual vs 8.0 kg estimated
    const weightValidation = validateActualWeight(actualWeight, Number(vehicle.capacity_kg), currentLoad);
    if (!weightValidation.valid) {
      console.error("FAIL: Valid weight unexpectedly rejected:", weightValidation.error);
      process.exit(1);
    }
    const variance = calculateWeightVariance(8.0, actualWeight);
    console.log(`✔ Step 7: Scale weighment validated: ${actualWeight} kg (Variance: +${variance.variance_kg} kg / +${variance.variance_percent}%)`);

    // 8. Commit Collection Record
    const verifiedTimestamp = new Date().toISOString();
    const { data: createdRec, error: recErr } = await supabase
      .from("collection_records")
      .insert({
        request_id: testRequestId,
        route_id: testRouteId,
        collector_id: null,
        actual_weight_kg: actualWeight,
        verified_at: verifiedTimestamp,
        verification_method: "qr_scan",
        notes: "E2E automated test verified [GPS: 17.4490, 78.3840]",
      })
      .select("id, request_id, actual_weight_kg, verified_at")
      .single();

    if (recErr || !createdRec) {
      console.error("FAIL: Could not insert collection record:", recErr);
      process.exit(1);
    }
    testRecordId = createdRec.id;
    console.log(`✔ Step 8: Created collection_record ${testRecordId}`);

    // 9. Update request status to 'collected'
    const { error: updErr } = await supabase
      .from("collection_requests")
      .update({ status: "collected" })
      .eq("id", testRequestId);

    if (updErr) {
      console.error("FAIL: Could not update request status:", updErr);
      process.exit(1);
    }
    console.log("✔ Step 9: Updated collection_requests.status to 'collected'.");

    // 10. Append immutable audit entries to event_log
    const { error: evErr } = await supabase.from("event_log").insert([
      {
        event_type: "ITEM_COLLECTED",
        entity_type: "collection_requests",
        entity_id: testRequestId,
        actor_role: "COLLECTOR",
        payload_json: {
          request_id: testRequestId,
          collection_record_id: testRecordId,
          route_id: testRouteId,
          qr_token: testToken,
          actual_weight_kg: actualWeight,
          estimated_weight_kg: 8.0,
          variance_kg: variance.variance_kg,
          verification_method: "qr_scan",
          gps_captured: true,
          collected_at: verifiedTimestamp,
        },
      },
      {
        event_type: "WEIGHT_RECORDED",
        entity_type: "collection_records",
        entity_id: testRecordId,
        actor_role: "COLLECTOR",
        payload_json: {
          collection_record_id: testRecordId,
          actual_weight_kg: actualWeight,
          estimated_weight_kg: 8.0,
          variance_percent: variance.variance_percent,
        },
      },
    ]);

    if (evErr) {
      console.error("FAIL: Could not append event log entries:", evErr);
      process.exit(1);
    }
    console.log("✔ Step 10: Appended ITEM_COLLECTED and WEIGHT_RECORDED events to event_log.");

    // 11. Test Duplicate Protection
    const duplicateValidation = validateStopForCollection({
      routeStops: stopsJson,
      requestId: testRequestId,
      requestStatus: "collected",
      existingRecordCount: 1, // already has record!
      routeStatus: "in_progress",
    });

    if (duplicateValidation.valid) {
      console.error("FAIL: Duplicate collection attempt was not rejected!");
      process.exit(1);
    }
    console.log(`✔ Step 11: Duplicate collection attempt blocked: "${duplicateValidation.error}"`);

    // 12. Verify Traceability Chain in Live Database
    const { data: queriedReq } = await supabase
      .from("collection_requests")
      .select("id, status, qr_token")
      .eq("id", testRequestId)
      .single();

    const { data: queriedRec } = await supabase
      .from("collection_records")
      .select("id, request_id, actual_weight_kg")
      .eq("id", testRecordId)
      .single();

    const { data: queriedEvents } = await supabase
      .from("event_log")
      .select("id, event_type, entity_id")
      .eq("entity_id", testRequestId);

    if (queriedReq?.status !== "collected") {
      console.error("FAIL: Request status is not 'collected':", queriedReq);
      process.exit(1);
    }
    if (!queriedRec || queriedRec.actual_weight_kg !== actualWeight) {
      console.error("FAIL: Collection record mismatch:", queriedRec);
      process.exit(1);
    }
    if (!queriedEvents || queriedEvents.length === 0) {
      console.error("FAIL: Event log entries not found:", queriedEvents);
      process.exit(1);
    }
    console.log("✔ Step 12: End-to-end traceability chain verified across all tables.");

    console.log("\n==================================================");
    console.log("ALL PS-013 COLLECTOR OPERATIONS E2E CHECKS PASSED!");
    console.log("==================================================");
  } finally {
    // Clean up test data cleanly to preserve database integrity
    console.log("\nCleaning up test records...");
    if (testRecordId) {
      await supabase.from("collection_records").delete().eq("id", testRecordId);
    }
    if (testRequestId) {
      await supabase.from("collection_requests").delete().eq("id", testRequestId);
    }
    if (testRouteId) {
      await supabase.from("collection_routes").delete().eq("id", testRouteId);
    }
    console.log("✔ Test records cleaned up successfully.");
  }
}

runE2ETest().catch((err) => {
  console.error("Unhandled error in E2E test:", err);
  process.exit(1);
});
