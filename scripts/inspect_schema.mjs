import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const f of ['.env.local', '.env.production.local']) {
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

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function inspect() {
  const items = await supabase.from('items').select('*').limit(1);
  console.log('items columns:', items.data && items.data.length > 0 ? Object.keys(items.data[0]) : items.error);

  const partners = await supabase.from('partners').select('*').limit(1);
  console.log('partners columns:', partners.data && partners.data.length > 0 ? Object.keys(partners.data[0]) : partners.error);

  const recs = await supabase.from('recommendations').select('*').limit(1);
  console.log('recommendations columns:', recs.data && recs.data.length > 0 ? Object.keys(recs.data[0]) : recs.error);

  const checkProfiles = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles table exists?:', checkProfiles.error ? checkProfiles.error.message : 'EXISTS');

  const checkZones = await supabase.from('collection_zones').select('*').limit(1);
  console.log('collection_zones table exists?:', checkZones.error ? checkZones.error.message : 'EXISTS');

  const checkRequests = await supabase.from('collection_requests').select('*').limit(1);
  console.log('collection_requests table exists?:', checkRequests.error ? checkRequests.error.message : 'EXISTS');
}

inspect();
