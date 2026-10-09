import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://placeholder.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "placeholder-anon-key";

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  supabaseAnonKey;

// Client for anonymous browser access (strictly constrained by RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Elevated client for authorized server route mutations (collector, recovery, routes)
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function getSupabaseClient() {
  return supabase;
}

export function getSupabaseAdminClient() {
  return supabaseAdmin;
}
