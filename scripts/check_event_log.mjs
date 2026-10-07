import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
);

async function check() {
  const { data: rows } = await supabase.from('event_log').select('*');
  console.log('All event_log actor_roles in DB:');
  console.log(rows.map(r => ({ id: r.id, event: r.event_type, actor: r.actor_role })));

  // Try updating with .select() so PostgREST returns rows modified
  const { data: updData, error: updErr } = await supabase
    .from('event_log')
    .update({ actor_role: 'HACKED' })
    .eq('id', rows[0].id)
    .select();

  console.log('Update result data (rows returned):', updData);
  console.log('Update result error:', updErr);

  // Try deleting an event row
  const { data: delData, error: delErr } = await supabase
    .from('event_log')
    .delete()
    .eq('id', rows[0].id)
    .select();

  console.log('Delete result data (rows returned):', delData);
  console.log('Delete result error:', delErr);

  // Re-verify count in DB
  const { count } = await supabase.from('event_log').select('*', { count: 'exact', head: true });
  console.log('Total event_log count in DB after update/delete attempt:', count);
}

check();
