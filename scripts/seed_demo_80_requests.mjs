import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function getEnv() {
  const env = {};
  for (const f of ['.env.production.local', '.env.local']) {
    if (fs.existsSync(f)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (m) {
          let val = m[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[m[1]]) env[m[1]] = val;
        }
      });
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Zones mapping
const ZONES = [
  { id: '00000000-0000-0000-0000-000000000001', code: 'ZONE-HYD-01', name: 'HITEC City & Madhapur', lat: 17.4486, lng: 78.3908 },
  { id: '00000000-0000-0000-0000-000000000002', code: 'ZONE-HYD-02', name: 'Gachibowli & Financial District', lat: 17.4401, lng: 78.3489 },
  { id: '00000000-0000-0000-0000-000000000003', code: 'ZONE-HYD-03', name: 'Kondapur & Botanical Garden', lat: 17.4699, lng: 78.3578 },
  { id: '00000000-0000-0000-0000-000000000004', code: 'ZONE-HYD-04', name: 'Jubilee Hills & Film Nagar', lat: 17.4319, lng: 78.4073 },
  { id: '00000000-0000-0000-0000-000000000005', code: 'ZONE-HYD-05', name: 'Banjara Hills & Somajiguda', lat: 17.4156, lng: 78.4357 },
  { id: '00000000-0000-0000-0000-000000000006', code: 'ZONE-HYD-06', name: 'Kukatpally & KPHB Colony', lat: 17.4938, lng: 78.3995 },
  { id: '00000000-0000-0000-0000-000000000007', code: 'ZONE-HYD-07', name: 'Begumpet & Ameerpet', lat: 17.4447, lng: 78.4664 },
  { id: '00000000-0000-0000-0000-000000000008', code: 'ZONE-HYD-08', name: 'Secunderabad & Paradise', lat: 17.4399, lng: 78.4983 },
  { id: '00000000-0000-0000-0000-000000000009', code: 'ZONE-HYD-09', name: 'Charminar & Old City', lat: 17.3616, lng: 78.4747 },
  { id: '00000000-0000-0000-0000-000000000010', code: 'ZONE-HYD-10', name: 'Uppal & Habsiguda', lat: 17.4042, lng: 78.5606 }
];

// Target allocation per zone (sums to 80)
const ZONE_COUNTS = [13, 11, 9, 8, 9, 10, 7, 5, 5, 3];

// Categories & sample items
const CATEGORY_ITEMS = [
  { item_type: 'Smartphone', brand: 'Samsung', weight: 0.25, co2e: 18.5, condition: 'functional' },
  { item_type: 'Laptop Computer', brand: 'Dell', weight: 2.2, co2e: 110.0, condition: 'cosmetic_damage' },
  { item_type: 'Tablet', brand: 'Apple', weight: 0.48, co2e: 35.0, condition: 'partially_working' },
  { item_type: 'Desktop Monitor', brand: 'LG', weight: 4.5, co2e: 45.0, condition: 'functional' },
  { item_type: 'Desktop CPU Tower', brand: 'HP', weight: 8.5, co2e: 135.0, condition: 'partially_working' },
  { item_type: 'Microwave Oven', brand: 'IFB', weight: 14.0, co2e: 85.0, condition: 'severely_damaged' },
  { item_type: 'CRT Television', brand: 'Sony', weight: 18.5, co2e: 65.0, condition: 'severely_damaged' },
  { item_type: 'Laser Printer', brand: 'Canon', weight: 7.2, co2e: 52.0, condition: 'partially_working' },
  { item_type: 'Lithium Battery Pack', brand: 'Exide', weight: 3.5, co2e: 42.0, condition: 'severely_damaged' },
  { item_type: 'Power Cables & Adapters', brand: 'Generic', weight: 1.8, co2e: 14.0, condition: 'functional' }
];

// Realistic citizens names & localities in Hyderabad
const CITIZEN_PROFILES = [
  { name: 'Pooja Sharma', phone: '+91-98490-21041', loc: 'Plot 42, Cyber Hills, Madhapur' },
  { name: 'Karthik Varma', phone: '+91-98765-33102', loc: 'Flat 502, Jayabheri Silicon, Kondapur' },
  { name: 'Sunita Reddy', phone: '+91-99890-44123', loc: 'Villa 14, Rainbow Vistas, Moosapet' },
  { name: 'Mohd Rizwan', phone: '+91-98851-55234', loc: 'House 8-2-12, Banjara Hills Rd 12' },
  { name: 'Ananya Rao', phone: '+91-97012-66345', loc: 'Flat 304, Aparna Sarovar, Nallagandla' },
  { name: 'Srinivas Goud', phone: '+91-98480-77456', loc: 'Plot 105, KPHB Phase 4, Kukatpally' },
  { name: 'Fatima Begum', phone: '+91-99491-88567', loc: 'Opposite High Court, Ghansi Bazaar, Old City' },
  { name: 'Vikram Joshi', phone: '+91-98662-99678', loc: 'Lane 4, Sindhi Colony, Begumpet' },
  { name: 'Divya Nair', phone: '+91-99593-10789', loc: 'Sector 3, Alwal, Secunderabad' },
  { name: 'Ramesh Naidu', phone: '+91-98494-21890', loc: 'Street 8, Ramanthapur, Uppal' }
];

async function seedData() {
  console.log("Starting idempotent expansion of 80 demo collection requests...");

  // Calculate 8-week dates starting 56 days ago
  const now = new Date();
  const requests = [];
  const items = [];
  const collectionRecords = [];
  
  let globalIndex = 0;

  for (let zIdx = 0; zIdx < ZONES.length; zIdx++) {
    const zone = ZONES[zIdx];
    const count = ZONE_COUNTS[zIdx];

    for (let i = 0; i < count; i++) {
      globalIndex++;
      const reqId = `e0000000-0000-0000-0000-${String(globalIndex).padStart(12, '0')}`;
      const qrToken = `QR-DEMO-HYD-${String(globalIndex).padStart(3, '0')}`;
      const citizen = CITIZEN_PROFILES[globalIndex % CITIZEN_PROFILES.length];

      // Temporal distribution:
      // Last 8 weeks = 56 days.
      // Festival bump around days 25 to 35 ago (mid/late September).
      let dayOffset;
      if (globalIndex % 4 === 0) {
        // Festival surge window (25 to 35 days ago)
        dayOffset = 25 + (globalIndex % 10);
      } else if (globalIndex > 74) {
        // Active/pending upcoming requests (1 day in future)
        dayOffset = -1;
      } else if (globalIndex > 70) {
        // Today
        dayOffset = 0;
      } else {
        // Linear spread over 56 days
        dayOffset = Math.floor((globalIndex / 70) * 54);
      }

      const reqDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const isWeekend = reqDate.getDay() === 0 || reqDate.getDay() === 6;
      const pickupDateStr = reqDate.toISOString().split('T')[0];
      const slot = (globalIndex % 3 === 0 || isWeekend) ? '09:00 - 12:00' : '14:00 - 17:00';

      // Status assignment:
      let status = 'recovered';
      if (globalIndex > 76) {
        status = 'pending';
      } else if (globalIndex > 74) {
        status = 'scheduled';
      } else if (globalIndex > 70) {
        status = 'assigned'; // 6 assigned for pre-dispatched routes
      } else if (globalIndex > 56) {
        status = 'collected'; // 14 collected awaiting facility transfer
      } else if (globalIndex > 36) {
        status = 'sent_to_facility'; // 20 sent to facility
      } else {
        status = 'recovered'; // 36 fully recovered
      }

      // Small jitter for lat/lng inside zone radius
      const latJitter = (Math.sin(globalIndex * 1.7) * 0.015);
      const lngJitter = (Math.cos(globalIndex * 1.3) * 0.015);
      const reqLat = Math.round((zone.lat + latJitter) * 10000) / 10000;
      const reqLng = Math.round((zone.lng + lngJitter) * 10000) / 10000;

      const priority = globalIndex % 9 === 0 ? 'urgent' : globalIndex % 5 === 0 ? 'high' : 'normal';

      requests.push({
        id: reqId,
        citizen_name: citizen.name,
        citizen_phone: citizen.phone,
        address: `${citizen.loc}, ${zone.name}, Hyderabad`,
        zone_id: zone.id,
        lat: reqLat,
        lng: reqLng,
        pickup_date: pickupDateStr,
        pickup_slot: slot,
        status,
        priority,
        notes: `[Demo dataset] Priority household e-waste pickup (${zone.code})`,
        qr_token: qrToken,
        is_simulated: true,
        created_at: reqDate.toISOString(),
        updated_at: reqDate.toISOString()
      });

      // Child items: 1 to 2 items per request
      const numItems = (globalIndex % 3 === 0) ? 2 : 1;
      let reqTotalWeight = 0;
      for (let itemIdx = 0; itemIdx < numItems; itemIdx++) {
        const itemTemplate = CATEGORY_ITEMS[(globalIndex + itemIdx) % CATEGORY_ITEMS.length];
        const itemId = `e1000000-0000-0000-0000-${String(globalIndex * 10 + itemIdx).padStart(12, '0')}`;
        items.push({
          id: itemId,
          request_id: reqId,
          item_type: itemTemplate.item_type,
          brand: itemTemplate.brand,
          estimated_age_years: 2 + (globalIndex % 8),
          condition: itemTemplate.condition,
          repair_cost_est: 450 + (globalIndex % 600),
          resale_value_est: 1200 + (globalIndex % 3000),
          waste_avoided_kg: itemTemplate.weight,
          co2e_saved_est: itemTemplate.co2e,
          created_at: reqDate.toISOString()
        });
        reqTotalWeight += itemTemplate.weight;
      }

      // If collected or beyond, add collection record
      if (status === 'collected' || status === 'sent_to_facility' || status === 'recovered') {
        const verifiedTime = new Date(reqDate.getTime() + 4 * 60 * 60 * 1000).toISOString();
        collectionRecords.push({
          id: `e2000000-0000-0000-0000-${String(globalIndex).padStart(12, '0')}`,
          request_id: reqId,
          actual_weight_kg: Math.round((reqTotalWeight * 1.05) * 10) / 10,
          verified_at: verifiedTime,
          verification_method: (globalIndex % 4 === 0) ? 'digital_scale' : 'qr_scan',
          notes: '[Demo dataset] Calibrated doorstep digital scale audit verified.'
        });
      }
    }
  }

  console.log(`Generated ${requests.length} requests, ${items.length} child items, ${collectionRecords.length} collection records.`);

  // Upsert requests in batches of 20
  for (let i = 0; i < requests.length; i += 20) {
    const chunk = requests.slice(i, i + 20);
    const { error } = await supabase.from('collection_requests').upsert(chunk, { onConflict: 'id' });
    if (error) console.error("Error upserting requests chunk:", error.message);
  }
  console.log("Requests upserted.");

  // Upsert items in batches of 25
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    const { error } = await supabase.from('items').upsert(chunk, { onConflict: 'id' });
    if (error) console.error("Error upserting items chunk:", error.message);
  }
  console.log("Items upserted.");

  // Upsert collection records in batches of 20
  for (let i = 0; i < collectionRecords.length; i += 20) {
    const chunk = collectionRecords.slice(i, i + 20);
    const { error } = await supabase.from('collection_records').upsert(chunk, { onConflict: 'id' });
    if (error) console.error("Error upserting collection records chunk:", error.message);
  }
  console.log("Collection records upserted.");

  // Pre-dispatched routes for tomorrow (2 active routes)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const preDispatchedRoutes = [
    {
      id: 'e3000000-0000-0000-0000-000000000001',
      vehicle_id: '10000000-0000-0000-0000-000000000001', // EV-VAN-01
      zone_id: '00000000-0000-0000-0000-000000000001', // HITEC City
      route_date: tomorrow,
      status: 'assigned',
      total_distance_km: 14.8,
      total_load_kg: 28.5,
      estimated_duration_minutes: 85,
      stops_json: [
        { sequence: 1, stop_type: 'DEPOT_DEPARTURE', lat: 17.4520, lng: 78.3840, estimated_weight_kg: 0 },
        { sequence: 2, stop_type: 'COLLECTION_STOP', request_id: requests[70].id, lat: requests[70].lat, lng: requests[70].lng, estimated_weight_kg: 9.5, priority: 'normal', pickup_slot: '09:00 - 12:00' },
        { sequence: 3, stop_type: 'COLLECTION_STOP', request_id: requests[71].id, lat: requests[71].lat, lng: requests[71].lng, estimated_weight_kg: 8.0, priority: 'high', pickup_slot: '09:00 - 12:00' },
        { sequence: 4, stop_type: 'COLLECTION_STOP', request_id: requests[72].id, lat: requests[72].lat, lng: requests[72].lng, estimated_weight_kg: 11.0, priority: 'urgent', pickup_slot: '09:00 - 12:00' },
        { sequence: 5, stop_type: 'DEPOT_RETURN', lat: 17.4520, lng: 78.3840, estimated_weight_kg: 0 }
      ]
    },
    {
      id: 'e3000000-0000-0000-0000-000000000002',
      vehicle_id: '10000000-0000-0000-0000-000000000003', // CNG-TRUCK-01
      zone_id: '00000000-0000-0000-0000-000000000002', // Gachibowli
      route_date: tomorrow,
      status: 'assigned',
      total_distance_km: 19.2,
      total_load_kg: 34.0,
      estimated_duration_minutes: 105,
      stops_json: [
        { sequence: 1, stop_type: 'DEPOT_DEPARTURE', lat: 17.4580, lng: 78.4420, estimated_weight_kg: 0 },
        { sequence: 2, stop_type: 'COLLECTION_STOP', request_id: requests[73].id, lat: requests[73].lat, lng: requests[73].lng, estimated_weight_kg: 12.0, priority: 'normal', pickup_slot: '14:00 - 17:00' },
        { sequence: 3, stop_type: 'COLLECTION_STOP', request_id: requests[74].id, lat: requests[74].lat, lng: requests[74].lng, estimated_weight_kg: 7.5, priority: 'normal', pickup_slot: '14:00 - 17:00' },
        { sequence: 4, stop_type: 'COLLECTION_STOP', request_id: requests[75].id, lat: requests[75].lat, lng: requests[75].lng, estimated_weight_kg: 14.5, priority: 'urgent', pickup_slot: '14:00 - 17:00' },
        { sequence: 5, stop_type: 'DEPOT_RETURN', lat: 17.4580, lng: 78.4420, estimated_weight_kg: 0 }
      ]
    }
  ];

  const { error: routeErr } = await supabase.from('collection_routes').upsert(preDispatchedRoutes, { onConflict: 'id' });
  if (routeErr) console.error("Error upserting routes:", routeErr.message);
  else console.log("2 pre-dispatched routes upserted for tomorrow:", tomorrow);

  // Recovery Transfers: 8 realistic batches with formal (65%) and informal (35%) split
  const recoveryTransfers = [
    // Formal facilities (~65% of mass)
    {
      id: 'e4000000-0000-0000-0000-000000000001',
      facility_id: 'bb0bffba-c9d9-4f52-8abe-fba63d57fc76', // Cherlapally Eco-Recovery & Smelting (recycler)
      total_weight_kg: 120.0,
      refurbished_pct: 15,
      recycled_pct: 78,
      residual_pct: 7,
      transferred_at: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Formal PRO smelting batch (PCBs and metal housings)'
    },
    {
      id: 'e4000000-0000-0000-0000-000000000002',
      facility_id: '8b5d7876-4e5c-4812-af5a-a012fff5c1cc', // NextCycle Systems & Laptops (refurbisher)
      total_weight_kg: 85.0,
      refurbished_pct: 82,
      recycled_pct: 14,
      residual_pct: 4,
      transferred_at: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Formal refurbished IT equipment batch (Corporate laptops & tablets)'
    },
    {
      id: 'e4000000-0000-0000-0000-000000000003',
      facility_id: '57ae1847-93f7-4f2e-9a1b-941a38d50237', // EcoMetallix E-Waste Processors (recycler)
      total_weight_kg: 75.0,
      refurbished_pct: 10,
      recycled_pct: 84,
      residual_pct: 6,
      transferred_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Formal material recovery run (Cables, transformers & motors)'
    },
    // Informal channel aggregators (~35% of mass)
    {
      id: 'e4000000-0000-0000-0000-000000000004',
      facility_id: 'b68fbc29-80c6-466f-ac4d-d62feb30bbd3', // Ramesh Kabadiwala Verified Collection Point (informal)
      total_weight_kg: 68.0,
      refurbished_pct: 45,
      recycled_pct: 48,
      residual_pct: 7,
      transferred_at: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Verified informal network aggregation (Small appliances & components)'
    },
    {
      id: 'e4000000-0000-0000-0000-000000000005',
      facility_id: '4cee3842-1196-472f-bc90-85f6b9400fff', // Syed & Sons Verified Scrap Sorters (informal)
      total_weight_kg: 52.0,
      refurbished_pct: 35,
      recycled_pct: 58,
      residual_pct: 7,
      transferred_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Verified informal scrap sorters collective (Dismantled casings & chassis)'
    },
    {
      id: 'e4000000-0000-0000-0000-000000000006',
      facility_id: '70322b6d-c112-48b0-a703-63916098f959', // Babu Bhai Verified Electronics Aggregator (informal)
      total_weight_kg: 40.0,
      refurbished_pct: 50,
      recycled_pct: 44,
      residual_pct: 6,
      transferred_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: '[Demo dataset] Verified informal micro-aggregator handoff'
    }
  ];

  // Delete existing demo transfers if any, then insert
  await supabase.from('recovery_transfers').delete().in('id', recoveryTransfers.map(t => t.id));
  const { error: trErr } = await supabase.from('recovery_transfers').insert(recoveryTransfers);
  if (trErr) console.error("Error upserting recovery transfers:", trErr.message);
  else console.log("6 recovery transfers upserted with formal/informal diversion split.");

  console.log("\n========================================================");
  console.log("DEMO EXPANSION SEED COMPLETE!");
  console.log("Total Requests:", requests.length);
  console.log("Pre-dispatched Routes:", preDispatchedRoutes.length);
  console.log("Recovery Transfers:", recoveryTransfers.length);
  console.log("========================================================\n");
}

seedData();
