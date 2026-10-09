import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read env
function getEnv() {
  const env = {};
  for (const f of ['.env.production.local', '.env.local']) {
    if (fs.existsSync(f)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) {
          let val = m[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[m[1]] = val;
        }
      });
    }
  }
  return env;
}

const env = getEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in local env files.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function runVerification() {
  console.log("==================================================");
  console.log("PS-013 LIVE SUPABASE DATABASE VERIFICATION");
  console.log("Target Host:", new URL(url).host);
  console.log("==================================================\n");

  const results = {};

  // 1. collection_zones
  const { data: zones, count: zoneCount, error: zoneErr } = await supabase
    .from('collection_zones')
    .select('*', { count: 'exact' });
  results.collection_zones = {
    exists: !zoneErr,
    count: zoneCount,
    error: zoneErr?.message,
    sample: zones ? zones.slice(0, 3).map(z => `${z.code}: ${z.name}`) : null
  };

  // 2. collection_requests
  const { data: requests, count: reqCount, error: reqErr } = await supabase
    .from('collection_requests')
    .select('*', { count: 'exact' });
  results.collection_requests = {
    exists: !reqErr,
    count: reqCount,
    error: reqErr?.message,
    statuses: requests ? [...new Set(requests.map(r => r.status))] : [],
    simulatedCount: requests ? requests.filter(r => r.is_simulated).length : 0
  };

  // 3. vehicles
  const { data: vehicles, count: vehCount, error: vehErr } = await supabase
    .from('vehicles')
    .select('*', { count: 'exact' });
  results.vehicles = {
    exists: !vehErr,
    count: vehCount,
    error: vehErr?.message,
    codes: vehicles ? vehicles.map(v => `${v.vehicle_code} (${v.vehicle_type}, ${v.capacity_kg}kg)`) : null
  };

  // 4. collection_routes
  const { data: routes, count: routeCount, error: routeErr } = await supabase
    .from('collection_routes')
    .select('*', { count: 'exact' });
  results.collection_routes = {
    exists: !routeErr,
    count: routeCount,
    error: routeErr?.message
  };

  // 5. collection_records
  const { data: records, count: recCount, error: recErr } = await supabase
    .from('collection_records')
    .select('*', { count: 'exact' });
  results.collection_records = {
    exists: !recErr,
    count: recCount,
    error: recErr?.message,
    weights: records ? records.map(r => `${r.actual_weight_kg}kg via ${r.verification_method}`) : []
  };

  // 6. recovery_transfers
  const { data: transfers, count: transCount, error: transErr } = await supabase
    .from('recovery_transfers')
    .select('*', { count: 'exact' });
  results.recovery_transfers = {
    exists: !transErr,
    count: transCount,
    error: transErr?.message
  };

  // 7. event_log
  const { data: events, count: eventCount, error: eventErr } = await supabase
    .from('event_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });
  results.event_log = {
    exists: !eventErr,
    count: eventCount,
    error: eventErr?.message,
    types: events ? events.map(e => e.event_type) : []
  };

  // 8. profiles
  const { data: profiles, count: profCount, error: profErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' });
  results.profiles = {
    exists: !profErr,
    count: profCount,
    error: profErr?.message
  };

  // 9. items.request_id exists
  const { data: itemSample, error: itemErr } = await supabase
    .from('items')
    .select('*')
    .limit(1);
  const hasRequestId = itemSample && itemSample.length > 0 && ('request_id' in itemSample[0]);
  results.items_request_id = {
    column_exists: hasRequestId,
    sample_item_columns: itemSample && itemSample.length > 0 ? Object.keys(itemSample[0]) : null
  };

  // 10. Existing counts
  const { count: partnersCount } = await supabase.from('partners').select('*', { count: 'exact', head: true });
  const { count: itemsCount } = await supabase.from('items').select('*', { count: 'exact', head: true });
  const { count: recommendationsCount } = await supabase.from('recommendations').select('*', { count: 'exact', head: true });
  results.existing_table_counts = {
    partners: partnersCount,
    items: itemsCount,
    recommendations: recommendationsCount,
    counts_match_audit: partnersCount === 40 && itemsCount === 23 && recommendationsCount === 23
  };

  // 11. Foreign keys and constraints test
  // Try inserting invalid request (bad lat)
  const { error: invalidLatErr } = await supabase
    .from('collection_requests')
    .insert({
      address: 'Test Invalid Lat',
      lat: 150.0 // violates CHECK (lat BETWEEN -90 AND 90)
    });
  results.constraint_check_lat = {
    violation_caught: Boolean(invalidLatErr),
    error_message: invalidLatErr?.message
  };

  // Try inserting invalid status
  const { error: invalidStatusErr } = await supabase
    .from('collection_requests')
    .insert({
      address: 'Test Invalid Status',
      status: 'non_existent_status' // violates status CHECK
    });
  results.constraint_check_status = {
    violation_caught: Boolean(invalidStatusErr),
    error_message: invalidStatusErr?.message
  };

  // 12. Event log append-only protection test: try updating an existing event
  let eventUpdateBlocked = false;
  let eventUpdateErrMsg = '';
  if (events && events.length > 0) {
    const targetEventId = events[0].id;
    const { data: updData, error: updErr } = await supabase
      .from('event_log')
      .update({ actor_role: 'HACKED' })
      .eq('id', targetEventId)
      .select();
    
    // In PostgreSQL RLS without an update policy, update returns 0 affected rows (updData: []) or throws an error
    eventUpdateBlocked = Boolean(updErr) || (!updErr && Array.isArray(updData) && updData.length === 0);
    eventUpdateErrMsg = updErr?.message || (eventUpdateBlocked ? 'Blocked by RLS: 0 rows modified (append-only enforced)' : 'Update unexpectedly succeeded!');
  }
  results.event_log_append_only_protection = {
    update_blocked: eventUpdateBlocked,
    rejection_message: eventUpdateErrMsg
  };

  console.log(JSON.stringify(results, null, 2));
}

runVerification();
