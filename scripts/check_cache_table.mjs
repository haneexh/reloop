import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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
console.log("Supabase URL:", url);
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from("ai_scan_cache").select("*").limit(5);
  console.log("ai_scan_cache check:", { data, error });
}
run();
