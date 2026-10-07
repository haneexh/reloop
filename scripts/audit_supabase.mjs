import fs from "fs";
import { createClient } from "@supabase/supabase-js";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

console.log("=== SUPABASE AUDIT ===");
console.log("Supabase URL configured:", Boolean(url));
if (url) {
  try {
    const u = new URL(url);
    console.log("Supabase Host:", u.host);
    const projRef = u.host.split(".")[0];
    console.log("Supabase Project Ref:", projRef);
  } catch (e) {
    console.log("Invalid URL format:", e.message);
  }
}
console.log("Supabase Anon Key configured:", Boolean(key));

if (!url || !key) {
  console.log("Missing Supabase credentials in local env files.");
  process.exit(1);
}

const supabase = createClient(url, key);

try {
  // 1. Partners
  const { data: partners, error: pErr } = await supabase
    .from("partners")
    .select("*", { count: "exact" })
    .limit(1);

  const { count: totalPartners, error: countErr } = await supabase
    .from("partners")
    .select("*", { count: "exact", head: true });

  console.log("\n[TABLE: partners]");
  if (pErr || countErr) {
    console.log("Error querying partners:", (pErr || countErr).message);
  } else {
    console.log("Status: REACHABLE");
    console.log("Total row count:", totalPartners);
    if (partners && partners.length > 0) {
      console.log("Columns:", Object.keys(partners[0]).join(", "));
    }
  }

  // 2. Items
  const { count: totalItems, error: iErr } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true });

  console.log("\n[TABLE: items]");
  if (iErr) {
    console.log("Error querying items:", iErr.message);
  } else {
    console.log("Status: REACHABLE");
    console.log("Total row count:", totalItems);
  }

  // 3. Recommendations
  const { count: totalRecs, error: rErr } = await supabase
    .from("recommendations")
    .select("*", { count: "exact", head: true });

  console.log("\n[TABLE: recommendations]");
  if (rErr) {
    console.log("Error querying recommendations:", rErr.message);
  } else {
    console.log("Status: REACHABLE");
    console.log("Total row count:", totalRecs);
  }

  // 4. Storage Buckets
  console.log("\n[STORAGE]");
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log("Error listing buckets:", bErr.message);
  } else {
    console.log("listBuckets() returned:", buckets.map((b) => b.name).join(", ") || "(empty array or restricted by RLS)");
  }

  const { data: files, error: fErr } = await supabase.storage.from("item-photos").list("", { limit: 5 });
  if (fErr) {
    console.log("Direct access to 'item-photos':", fErr.message);
  } else {
    console.log("Direct access to 'item-photos': REACHABLE, files found:", files.length);
    if (files.length > 0) {
      console.log("Sample files:", files.slice(0, 3).map((f) => f.name).join(", "));
    }
  }

  // 5. Auth
  console.log("\n[AUTH]");
  const { data: authSession, error: aErr } = await supabase.auth.getSession();
  if (aErr) {
    console.log("Auth error:", aErr.message);
  } else {
    console.log("Auth status: REACHABLE (Guest/Anonymous mode active, no active session)");
  }
} catch (err) {
  console.error("General error connecting to Supabase:", err.message);
}
