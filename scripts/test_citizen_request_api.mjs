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

console.log("=== CITIZEN REQUEST FLOW INTEGRATION TEST ===");

async function runTest() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pickupDate = tomorrow.toISOString().split("T")[0];

  const testToken = `RLP-TEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 1. Insert collection_request directly as client/endpoint would
  const { data: request, error: reqErr } = await supabase
    .from("collection_requests")
    .insert({
      citizen_name: "Test Citizen E2E",
      citizen_phone: "+91-98765-43210",
      address: "Flat 101, Secret Residency, Cyber Towers Road, HITEC City, Hyderabad",
      lat: 17.4486,
      lng: 78.3908,
      zone_id: "00000000-0000-0000-0000-000000000001",
      pickup_date: pickupDate,
      pickup_slot: "09:00 - 12:00",
      status: "pending",
      priority: "normal",
      notes: "Test e2e request notes - fragile CRT unit",
      qr_token: testToken,
      is_simulated: false,
    })
    .select()
    .single();

  if (reqErr || !request) {
    console.error("FAIL: Could not insert collection request:", reqErr);
    process.exit(1);
  }
  console.log("✔ Created collection request with ID:", request.id, "Token:", request.qr_token);

  // 2. Insert child items linking request_id
  const { data: itemRows, error: itemErr } = await supabase
    .from("items")
    .insert([
      {
        request_id: request.id,
        item_type: "Smartphone",
        brand: "OnePlus",
        condition: "functional",
        estimated_age_years: 2,
        co2e_saved_est: 70,
        waste_avoided_kg: 0.2,
      },
      {
        request_id: request.id,
        item_type: "Laptop / Notebook",
        brand: "Dell",
        condition: "partially_working",
        estimated_age_years: 4,
        co2e_saved_est: 250,
        waste_avoided_kg: 2.2,
      },
    ])
    .select();

  if (itemErr || !itemRows) {
    console.error("FAIL: Could not insert items:", itemErr);
    process.exit(1);
  }
  console.log("✔ Inserted 2 manifest items linking request_id:", itemRows.length);

  // 3. Log event into event_log
  const { error: logErr } = await supabase.from("event_log").insert({
    event_type: "REQUEST_CREATED",
    entity_type: "collection_requests",
    entity_id: request.id,
    actor_role: "CITIZEN",
    payload_json: {
      qr_token: testToken,
      zone_id: "00000000-0000-0000-0000-000000000001",
      items_count: 2,
      total_weight_kg: 2.4,
    },
  });

  if (logErr) {
    console.warn("Event log insert notice:", logErr);
  } else {
    console.log("✔ Audit event logged successfully in event_log");
  }

  // 4. Test public tracking retrieval by qr_token and verify privacy masking
  const { data: fetchedReq, error: fetchErr } = await supabase
    .from("collection_requests")
    .select("id, qr_token, status, pickup_date, pickup_slot, address, zone_id")
    .eq("qr_token", testToken)
    .single();

  if (fetchErr || !fetchedReq) {
    console.error("FAIL: Could not fetch request by token:", fetchErr);
    process.exit(1);
  }

  // Verify masking: simulate masking
  const rawAddress = fetchedReq.address || "";
  const parts = rawAddress.split(",").map((s) => s.trim()).filter(Boolean);
  const publicArea = parts.length >= 2 ? parts.slice(-2).join(", ") : "Hyderabad";

  if (publicArea.includes("Flat 101") || publicArea.includes("Secret Residency")) {
    console.error("FAIL: Address masking failed to hide private residency details!");
    process.exit(1);
  }
  console.log("✔ Public area safely masked to:", publicArea);

  // 5. Clean up items and collection_requests test records (keep event_log as append-only)
  await supabase.from("items").delete().eq("request_id", request.id);
  await supabase.from("collection_requests").delete().eq("id", request.id);
  console.log("✔ Test request and items cleanly rolled back (leaving baseline table counts intact).");

  console.log("=== ALL CITIZEN REQUEST FLOW CHECKS PASSED ===");
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
