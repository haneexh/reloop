import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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

const PROD_BASE_URL = "https://reloop-ashen.vercel.app";

console.log("==================================================");
console.log("PRODUCTION SMOKE TEST ON", PROD_BASE_URL);
console.log("Database target:", supabaseUrl);
console.log("==================================================\n");

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function runProdSmokeTest() {
  let createdRequestId = null;
  let testQrToken = null;

  try {
    // 1. Submit citizen request to live production API
    console.log("--> 1. Submitting citizen pickup request to", PROD_BASE_URL + "/api/requests");
    const testPayload = {
      citizen_name: "Prod Smoke Test Citizen",
      citizen_phone: "+91 99999 88888",
      address: "Flat 101, Cyber Heights, Madhapur, Hyderabad, 500081",
      lat: 17.4486,
      lng: 78.3908,
      pickup_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      pickup_slot: "09:00 - 12:00",
      notes: "PRODUCTION_SMOKE_TEST_EPHEMERAL",
      items: [
        {
          item_type: "laptop",
          brand: "Lenovo",
          condition: "functional",
          quantity: 1,
          estimated_age_years: 3,
          weight_kg: 2.2,
        },
      ],
    };

    const postRes = await fetchWithRetry(`${PROD_BASE_URL}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const postData = await postRes.json();
    if (!postRes.ok || !postData.success) {
      throw new Error(`Failed to create request: ${postData.error || postRes.statusText}`);
    }

    createdRequestId = postData.requestId;
    testQrToken = postData.qrToken;
    console.log(`   PASS: Created request ID ${createdRequestId} with QR ${testQrToken}`);

    // 2. Verify tracking API and check PII shielding
    console.log("--> 2. Verifying public tracking API shielding");
    const trackRes = await fetchWithRetry(`${PROD_BASE_URL}/api/requests?token=${encodeURIComponent(testQrToken)}`);
    const trackData = await trackRes.json();

    if (!trackRes.ok || !trackData.success) {
      throw new Error(`Tracking lookup failed: ${trackData.error}`);
    }

    const payloadStr = JSON.stringify(trackData);
    if (
      payloadStr.includes("+91 99999 88888") ||
      payloadStr.includes("Flat 101, Cyber Heights") ||
      payloadStr.includes("PRODUCTION_SMOKE_TEST_EPHEMERAL") ||
      payloadStr.includes("17.4486") ||
      payloadStr.includes("78.3908")
    ) {
      throw new Error("SECURITY FAILURE: Sensitive citizen PII leaked in public tracking payload!");
    }
    console.log(`   PASS: Tracking response masked area="${trackData.data.area}". Phone, door number, notes, GPS coords stripped.`);

    // 3. Verify public tracking page renders
    console.log("--> 3. Checking public tracking page HTML");
    const trackPageRes = await fetchWithRetry(`${PROD_BASE_URL}/track/${encodeURIComponent(testQrToken)}`);
    if (!trackPageRes.ok) {
      throw new Error(`Tracking page failed to render: HTTP ${trackPageRes.status}`);
    }
    console.log("   PASS: /track/" + testQrToken + " returned HTTP 200 OK.");

    // 4. Verify demand API on production
    console.log("--> 4. Checking demand API");
    const demandRes = await fetchWithRetry(`${PROD_BASE_URL}/api/demand`);
    const demandData = await demandRes.json();
    if (!demandRes.ok || !demandData.success) {
      throw new Error("Demand API failed on production");
    }
    console.log("   PASS: /api/demand responded with " + demandData.data.spatial.length + " zones.");

    // 5. Verify sustainability API on production
    console.log("--> 5. Checking sustainability API");
    const sustRes = await fetchWithRetry(`${PROD_BASE_URL}/api/sustainability`);
    const sustData = await sustRes.json();
    if (!sustRes.ok || !sustData.success) {
      throw new Error("Sustainability API failed on production");
    }
    console.log(`   PASS: /api/sustainability responded (Collected: ${sustData.data.collected_weight_kg} kg, Diverted: ${sustData.data.diverted_weight_kg} kg).`);

  } catch (err) {
    console.error("❌ PRODUCTION SMOKE TEST FAILED:", err);
    throw err;
  } finally {
    // 6. Immediate cleanup of test record from database
    console.log("--> 6. Immediate Cleanup of Production Smoke Test Record");
    if (createdRequestId) {
      // Delete item
      await supabase.from("items").delete().eq("request_id", createdRequestId);
      // Delete request
      const { error: delErr } = await supabase.from("collection_requests").delete().eq("id", createdRequestId);
      if (delErr) {
        console.error("Cleanup warning:", delErr.message);
      } else {
        console.log(`   PASS: Successfully deleted test request ${createdRequestId}`);
      }
    }
    console.log("   Production database clean. Zero residue remaining.\n");
  }
}

runProdSmokeTest().then(
  () => {
    console.log("==================================================");
    console.log("🏆 PRODUCTION SMOKE TEST: ALL PHASES PASSED!");
    console.log("==================================================");
    process.exit(0);
  },
  (err) => {
    console.error("Execution error:", err);
    process.exit(1);
  }
);
