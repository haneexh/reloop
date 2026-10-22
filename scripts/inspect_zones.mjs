import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envFiles = [".env.production.local", ".env.local"];
const env = {};
for (const f of envFiles) {
  if (fs.existsSync(f)) {
    fs.readFileSync(f, "utf8").split("\n").forEach((l) => {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!env[m[1]]) env[m[1]] = v;
      }
    });
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data } = await supabase.from("collection_zones").select("id, name, code");
  console.log("Zones in DB:", data);
}
run();
