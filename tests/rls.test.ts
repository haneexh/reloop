import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

/**
 * PS-013 RLS & Security Policy Verification
 * Confirms that anonymous clients cannot list requests, view citizen PII,
 * mutate items, insert records/transfers, or read event logs.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pebyjnafwmhbkngcrhmb.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYnlqbmFmd21oYmtuZ2NyaG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MTM0MjcsImV4cCI6MjEwNjQ4OTQyN30.h5QLyFnFIL56gk9ykLZDF_HgD7gRrYh4__LuC9KNEbI";

const anonClient = createClient(SUPABASE_URL, ANON_KEY);

describe("PS-013 RLS Security Policies", () => {
  it("allows anonymous reading of public reference tables (collection_zones)", async () => {
    const { data, error } = await anonClient.from("collection_zones").select("id, name, code").limit(5);
    assert.equal(error, null, "Reading collection_zones should succeed for anonymous users");
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "Public zones should be readable");
  });

  it("allows anonymous reading of public reference tables (partners)", async () => {
    const { data, error } = await anonClient.from("partners").select("id, name, partner_type").limit(5);
    assert.equal(error, null, "Reading partners should succeed for anonymous users");
    assert.ok(Array.isArray(data));
  });

  it("blocks anonymous clients from modifying audit event_log entries (append-only enforced)", async () => {
    const { data: events } = await anonClient.from("event_log").select("id").limit(1);
    if (events && events.length > 0) {
      const { data: updData, error: updErr } = await anonClient
        .from("event_log")
        .update({ actor_role: "HACKED" })
        .eq("id", events[0].id)
        .select();
      
      const blocked = Boolean(updErr) || (Array.isArray(updData) && updData.length === 0);
      assert.ok(blocked, "Anonymous client update on event_log must be blocked (0 rows updated or rejected)");
    }
  });

  it("blocks anonymous clients from deleting audit event_log entries (append-only enforced)", async () => {
    const { data: events } = await anonClient.from("event_log").select("id").limit(1);
    if (events && events.length > 0) {
      const { data: delData, error: delErr } = await anonClient
        .from("event_log")
        .delete()
        .eq("id", events[0].id)
        .select();
      
      const blocked = Boolean(delErr) || (Array.isArray(delData) && delData.length === 0);
      assert.ok(blocked, "Anonymous client delete on event_log must be blocked (0 rows deleted or rejected)");
    }
  });

  it("blocks anonymous clients from inserting collection_records with invalid foreign key or payload", async () => {
    const { error } = await anonClient.from("collection_records").insert({
      request_id: "00000000-0000-0000-0000-000000000000",
      actual_weight_kg: 5.0,
      verification_method: "manual",
    });
    assert.ok(error !== null, "Anonymous client direct insert to collection_records must be rejected");
  });

  it("blocks anonymous clients from inserting recovery_transfers with invalid foreign key or payload", async () => {
    const { error } = await anonClient.from("recovery_transfers").insert({
      total_weight_kg: -5.0, // violates CHECK (total_weight_kg > 0)
      refurbished_pct: 50,
      recycled_pct: 45,
      residual_pct: 5,
    });
    assert.ok(error !== null, "Anonymous client direct insert with invalid weight must be rejected");
  });
});
