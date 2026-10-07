# RE:LOOP — PS-013 Database Baseline

**Project Reference:** `pebyjnafwmhbkngcrhmb`  
**Host:** `pebyjnafwmhbkngcrhmb.supabase.co`  
**Inspection Date:** 2026-10-07  
**Status:** Live & Authoritative Baseline  

---

## 1. Verified Live Tables & Row Counts

| Table | Status | Row Count | Primary Key | Foreign Keys |
|---|---|---|---|---|
| **`items`** | Active | **23** | `id` (UUID) | None |
| **`partners`** | Active | **40** | `id` (UUID) | None |
| **`recommendations`** | Active | **23** | `id` (UUID) | `item_id -> items.id` (ON DELETE CASCADE) |
| **`profiles`** | Non-existent | 0 | N/A | N/A |
| **`collection_zones`** | Non-existent | 0 | N/A | N/A |
| **`collection_requests`** | Non-existent | 0 | N/A | N/A |

---

## 2. Table Schemas Prior to PS-013 Migration

### 2.1. `items` Table
- `id` (UUID, PK, default `gen_random_uuid()`)
- `image_url` (TEXT)
- `item_type` (TEXT)
- `brand` (TEXT, Nullable)
- `estimated_age_years` (NUMERIC, Nullable)
- `condition` (TEXT: `functional`, `cosmetic_damage`, `partially_working`, `severely_damaged`)
- `repair_cost_est` (NUMERIC)
- `resale_value_est` (NUMERIC)
- `co2e_saved_est` (NUMERIC)
- `waste_avoided_kg` (NUMERIC)
- `created_at` (TIMESTAMPTZ, default `now()`)
- *Note:* `request_id` column does not exist in this baseline.

### 2.2. `partners` Table
- `id` (UUID, PK, default `gen_random_uuid()`)
- `name` (TEXT NOT NULL)
- `partner_type` (TEXT NOT NULL, CHECK: `repair`, `ngo`, `recycler`, `refurbisher`, `informal`)
- `lat` (NUMERIC NOT NULL)
- `lng` (NUMERIC NOT NULL)
- `city` (TEXT NOT NULL)
- `contact` (TEXT, Nullable)
- `verified` (BOOLEAN, default `true`)

### 2.3. `recommendations` Table
- `id` (UUID, PK, default `gen_random_uuid()`)
- `item_id` (UUID NOT NULL, FK -> `items.id` ON DELETE CASCADE)
- `recommended_action` (TEXT NOT NULL, CHECK: `repair`, `reuse`, `donate`, `resell`, `refurbish`, `recycle`)
- `confidence` (NUMERIC)
- `rationale` (TEXT)
- `alt_action_1` (TEXT, Nullable)
- `alt_action_2` (TEXT, Nullable)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

## 3. Existing Indexes

- `items`:
  - `idx_items_created_at` ON `items(created_at DESC)`
  - `idx_items_item_type` ON `items(item_type)`
  - `idx_items_condition` ON `items(condition)`
- `partners`:
  - `idx_partners_partner_type` ON `partners(partner_type)`
  - `idx_partners_city` ON `partners(city)`
  - `idx_partners_verified` ON `partners(verified)`
  - `idx_partners_coords` ON `partners(lat, lng)`
- `recommendations`:
  - `idx_recommendations_item_id` ON `recommendations(item_id)`
  - `idx_recommendations_recommended_action` ON `recommendations(recommended_action)`
  - `idx_recommendations_created_at` ON `recommendations(created_at DESC)`

---

## 4. Current RLS & Access Policies

All three existing tables have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), but use permissive guest policies:

- **`items`**:
  - `Public items access (select)`: `USING (true)`
  - `Public items access (insert)`: `WITH CHECK (true)`
  - `Public items access (update)`: `USING (true)`
- **`partners`**:
  - `Public partners access (select)`: `USING (true)`
  - `Public partners access (insert)`: `WITH CHECK (true)`
- **`recommendations`**:
  - `Public recommendations access (select)`: `USING (true)`
  - `Public recommendations access (insert)`: `WITH CHECK (true)`

---

## 5. Storage Baseline (`item-photos`)

- Bucket ID: `item-photos`
- Public access: `public = true`
- Policies:
  - `SELECT`: `bucket_id = 'item-photos'`
  - `INSERT`: `bucket_id = 'item-photos'`
  - `UPDATE`: `bucket_id = 'item-photos'`
- Content: Contains previously uploaded item photographs in `items/` subpath.

---

## 6. Authentication Baseline

- Supabase Auth is active in anonymous/guest mode.
- No `auth.users` accounts are enrolled or required for current web flows.
- No `profiles` or user-role lookup table exists in the current baseline.
