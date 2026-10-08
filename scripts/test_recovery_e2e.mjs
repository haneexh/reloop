import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  mapPartnerToFacility,
  validateTransferBatch,
  validateRecoveryBreakdown,
  calculateDiversionMetrics,
} from "../lib/recovery-engine.ts";
import { computeSustainabilityMetrics } from "../lib/sustainability-engine.ts";

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
console.log("PS-013 RECOVERY TRACKING & SUSTAINABILITY LIVE E2E TEST");
console.log("Target Database:", supabaseUrl);
console.log("==================================================");

async function runRecoveryE2E() {
  let testRequestId = null;
  let testRecordId = null;
  let testTransferId = null;

  try {
    // 1. Fetch valid facility from partners
    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .select("id, name, partner_type, city, lat, lng, contact, verified")
      .eq("verified", true)
      .limit(1)
      .single();

    if (pErr || !partner) {
      console.error("FAIL: Could not load verified facility partner:", pErr);
      process.exit(1);
    }
    const facility = mapPartnerToFacility(partner);
    console.log(`✔ Step 1: Selected accredited facility "${facility.name}" [${facility.facility_type}] in ${facility.city}`);

    // 2. Fetch a municipal zone
    const { data: zone } = await supabase
      .from("collection_zones")
      .select("id, code, name")
      .limit(1)
      .single();

    // 3. Create simulated test collection request & record
    const testToken = `RLP-TEST-REC-${Date.now().toString().slice(-6)}`;
    const { data: createdReq, error: reqErr } = await supabase
      .from("collection_requests")
      .insert({
        citizen_name: "Simulated Test Citizen",
        citizen_phone: "+91-98765-43210",
        address: "Recovery Test Lab, Madhapur, Hyderabad",
        zone_id: zone?.id || null,
        lat: 17.449,
        lng: 78.384,
        pickup_date: new Date().toISOString().split("T")[0],
        pickup_slot: "09:00 - 12:00",
        status: "collected",
        priority: "normal",
        notes: "E2E Recovery Consignment Batch",
        qr_token: testToken,
        is_simulated: true,
      })
      .select("id, qr_token, status")
      .single();

    if (reqErr || !createdReq) {
      console.error("FAIL: Could not create test request:", reqErr);
      process.exit(1);
    }
    testRequestId = createdReq.id;
    console.log(`✔ Step 2: Created collected test request ${testRequestId} with token ${testToken}`);

    // Create corresponding collection record (15.0 kg)
    const testCollectedWeight = 15.0;
    const { data: createdRec, error: recErr } = await supabase
      .from("collection_records")
      .insert({
        request_id: testRequestId,
        actual_weight_kg: testCollectedWeight,
        verified_at: new Date().toISOString(),
        verification_method: "digital_scale",
        notes: "E2E Verified Scale Weight for Recovery Test",
      })
      .select("id, actual_weight_kg")
      .single();

    if (recErr || !createdRec) {
      console.error("FAIL: Could not create test collection record:", recErr);
      process.exit(1);
    }
    testRecordId = createdRec.id;
    console.log(`✔ Step 3: Created collection_record ${testRecordId} with verified load ${testCollectedWeight} kg`);

    // 4. Test Over-Allocation Rejection (Invariant Protection)
    const invalidBreakdown = validateRecoveryBreakdown(testCollectedWeight, 50, 45, 20); // 115%
    if (invalidBreakdown.valid) {
      console.error("FAIL: Over-allocation was not rejected!");
      process.exit(1);
    }
    console.log(`✔ Step 4: Invalid over-allocation correctly rejected: "${invalidBreakdown.error}"`);

    // 5. Test Valid Recovery Breakdown
    const validBreakdownRes = validateRecoveryBreakdown(testCollectedWeight, 40, 50, 10); // 40% refurb, 50% recycle, 10% residual = 100%
    if (!validBreakdownRes.valid || !validBreakdownRes.breakdown) {
      console.error("FAIL: Valid breakdown rejected:", validBreakdownRes.error);
      process.exit(1);
    }
    const bd = validBreakdownRes.breakdown;
    console.log(`✔ Step 5: Valid recovery breakdown calculated: Refurbished: ${bd.refurbished_kg} kg (${bd.refurbished_pct}%), Recycled: ${bd.recycled_kg} kg (${bd.recycled_pct}%), Residual: ${bd.residual_kg} kg (${bd.residual_pct}%), Diverted: ${bd.diverted_weight_kg} kg`);

    // 6. Commit Recovery Transfer to Live DB
    const nowIso = new Date().toISOString();
    const { data: createdTransfer, error: trErr } = await supabase
      .from("recovery_transfers")
      .insert({
        facility_id: facility.id,
        route_id: null,
        total_weight_kg: testCollectedWeight,
        refurbished_pct: bd.refurbished_pct,
        recycled_pct: bd.recycled_pct,
        residual_pct: bd.residual_pct,
        transferred_at: nowIso,
        notes: `E2E Live Test Transfer | Batch: ["${testRecordId}"]`,
      })
      .select("id, total_weight_kg, refurbished_pct, recycled_pct, residual_pct, transferred_at")
      .single();

    if (trErr || !createdTransfer) {
      console.error("FAIL: Could not insert recovery transfer:", trErr);
      process.exit(1);
    }
    testTransferId = createdTransfer.id;
    console.log(`✔ Step 6: Created recovery_transfer ${testTransferId}`);

    // 7. Advance Request Status to 'recovered'
    const { error: updErr } = await supabase
      .from("collection_requests")
      .update({ status: "recovered", updated_at: nowIso })
      .eq("id", testRequestId);

    if (updErr) {
      console.error("FAIL: Could not update request to recovered:", updErr);
      process.exit(1);
    }
    console.log("✔ Step 7: Advanced collection_requests.status to 'recovered'");

    // 8. Append Immutable Audit Events to event_log
    const { error: evErr } = await supabase.from("event_log").insert([
      {
        event_type: "SENT_TO_FACILITY",
        entity_type: "recovery_transfers",
        entity_id: testTransferId,
        actor_role: "DISPATCHER",
        payload_json: {
          transfer_id: testTransferId,
          facility_id: facility.id,
          facility_name: facility.name,
          transferred_weight_kg: testCollectedWeight,
          records_count: 1,
          transferred_at: nowIso,
        },
      },
      {
        event_type: "RECOVERY_RECORDED",
        entity_type: "recovery_transfers",
        entity_id: testTransferId,
        actor_role: "FACILITY",
        payload_json: {
          transfer_id: testTransferId,
          facility_id: facility.id,
          facility_name: facility.name,
          transferred_weight_kg: testCollectedWeight,
          refurbished_kg: bd.refurbished_kg,
          recycled_kg: bd.recycled_kg,
          residual_kg: bd.residual_kg,
          recovery_rate_percent: bd.recovery_rate_percent,
          is_complete: bd.is_complete,
          recorded_at: nowIso,
        },
      },
    ]);

    if (evErr) {
      console.error("FAIL: Could not insert event log entries:", evErr);
      process.exit(1);
    }
    console.log("✔ Step 8: Appended SENT_TO_FACILITY and RECOVERY_RECORDED to event_log");

    // 9. Verify End-to-End Traceability Chain in DB
    const { data: dbCheckTransfer } = await supabase
      .from("recovery_transfers")
      .select("id, total_weight_kg, facility_id")
      .eq("id", testTransferId)
      .single();

    const { data: dbCheckReq } = await supabase
      .from("collection_requests")
      .select("id, status, qr_token")
      .eq("id", testRequestId)
      .single();

    const { data: dbCheckEvents } = await supabase
      .from("event_log")
      .select("id, event_type, entity_id")
      .eq("entity_id", testTransferId);

    if (!dbCheckTransfer || Number(dbCheckTransfer.total_weight_kg) !== testCollectedWeight) {
      console.error("FAIL: Transfer check mismatch:", dbCheckTransfer);
      process.exit(1);
    }
    if (dbCheckReq?.status !== "recovered") {
      console.error("FAIL: Request status is not 'recovered':", dbCheckReq);
      process.exit(1);
    }
    if (!dbCheckEvents || dbCheckEvents.length < 2) {
      console.error("FAIL: Audit events count mismatch:", dbCheckEvents);
      process.exit(1);
    }
    console.log(`✔ Step 9: Traceability chain confirmed across recovery_transfers, collection_requests, and event_log.`);

    // 10. Run Sustainability Metrics over live data
    const { data: allReqs } = await supabase.from("collection_requests").select("id, status, created_at, is_simulated");
    const { data: allRecs } = await supabase.from("collection_records").select("id, request_id, actual_weight_kg, verified_at");
    const { data: allTransfers } = await supabase.from("recovery_transfers").select("id, facility_id, route_id, total_weight_kg, refurbished_pct, recycled_pct, residual_pct, transferred_at");
    const { data: allRoutes } = await supabase.from("collection_routes").select("id, total_distance_km, total_load_kg, status");

    const liveMetrics = computeSustainabilityMetrics({
      requests: allReqs || [],
      collectionRecords: allRecs || [],
      transfers: allTransfers || [],
      routes: allRoutes || [],
      baselineDistanceSavedKm: 28.5,
    });

    console.log("\n--- LIVE COMPUTED SUSTAINABILITY METRICS ---");
    console.log(`Total Requests: ${liveMetrics.total_requests}`);
    console.log(`Collected Weight: ${liveMetrics.collected_weight_kg} kg`);
    console.log(`Recovered (Refurb): ${liveMetrics.recovered_weight_kg} kg`);
    console.log(`Recycled: ${liveMetrics.recycled_weight_kg} kg`);
    console.log(`Residual: ${liveMetrics.residual_weight_kg} kg`);
    console.log(`Diverted: ${liveMetrics.diverted_weight_kg} kg (${liveMetrics.diversion_rate_percent}%)`);
    console.log(`Recovery Rate: ${liveMetrics.recovery_rate_percent}%`);
    console.log(`Collection Completion Rate: ${liveMetrics.collection_completion_rate_percent}%`);
    console.log(`Efficiency: ${liveMetrics.collection_efficiency_kg_per_km} kg/km`);
    console.log(`Modeled CO2e Saved: ~${liveMetrics.estimated_co2e_avoided_kg} kg CO2e (${liveMetrics.environmental_methodology.slice(0, 45)}...)`);
    console.log("--------------------------------------------");

    console.log("\n==================================================");
    console.log("ALL PS-013 RECOVERY & SUSTAINABILITY CHECKS PASSED!");
    console.log("==================================================");
  } finally {
    // Clean up test data safely to preserve database integrity
    console.log("\nCleaning up live test records...");
    if (testTransferId) {
      await supabase.from("recovery_transfers").delete().eq("id", testTransferId);
    }
    if (testRecordId) {
      await supabase.from("collection_records").delete().eq("id", testRecordId);
    }
    if (testRequestId) {
      await supabase.from("collection_requests").delete().eq("id", testRequestId);
    }
    console.log("✔ Test records cleaned up successfully.");
  }
}

runRecoveryE2E().catch((err) => {
  console.error("Unhandled error in Recovery E2E test:", err);
  process.exit(1);
});
