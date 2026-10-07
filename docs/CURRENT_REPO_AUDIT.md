# RE:LOOP — Current Codebase Audit & PS-013 Transition Baseline

**Target Problem:** TH2-PS-SD-013 — Community E-Waste Collection Optimizer  
**Project:** RE:LOOP (Intelligent E-Waste Collection & Recovery Platform)  
**Audit Date:** 2026-10-07  
**Scope:** Complete repository inspection, asset classification, gap analysis against PS-013, security review, and target architecture.

---

## Part 1 — Complete Repository Audit

### 1. `package.json`
- **Framework & Core:** Next.js `14.2.25` (App Router), React `^18`, React-DOM `^18`, TypeScript `^5`.
- **Production Dependencies:**
  - `@supabase/supabase-js` (`^2.117.2`): Used for client-side and server-side Supabase DB & Storage access.
  - `leaflet` (`^1.9.4`) & `@types/leaflet` (`^1.9.22`): Interactive map rendering.
- **Dev Dependencies:**
  - `eslint` (`^8`), `eslint-config-next` (`14.2.25`), `eslint-config-prettier` (`^10.1.8`).
  - `prettier` (`^3.9.9`), `postcss` (`^8`), `tailwindcss` (`^3.4.1`).
  - `puppeteer-core` (`^25.12.0`): Headless screenshot verification tooling.
- **Scripts:**
  - `"dev"`: `next dev`
  - `"build"`: `next build`
  - `"start"`: `next start`
  - `"lint"`: `next lint`
  - `"typecheck"`: `tsc --noEmit` *(added safely during audit, verified exit code 0)*
  - `"test"`: `node --test --experimental-strip-types tests/*.test.ts` *(Node.js 24 native test runner)*
  - `"format"`: `prettier --write .`
  - `"format:check"`: `prettier --check .`

### 2. `app/` Directory & Routes
- `app/layout.tsx`: Root layout with font configuration (Geist), metadata (favicons, OpenGraph), navigation bar, and clean footer with Privacy / Terms links.
- `app/page.tsx`: Landing page highlighting RE:LOOP's circular routing, live 40-node partner network stats, pipeline steps, and CTA to `/analyze`.
- `app/analyze/page.tsx`: Client-side intake form. Manages camera stream (`navigator.mediaDevices.getUserMedia`), file dropzone (JPG/PNG/WebP up to 8MB), calls `/api/analyze-image`, handles strict electronics gating, and provides an editable human verification form before inserting into Supabase.
- `app/analyze/[itemId]/results/page.tsx`: Individual item circular evaluation results page. Displays the Post-Purchase Repairability Index (PP-RI meter), 6-pathway comparison table, cost vs value breakdown, and avoided carbon/landfill metrics.
- `app/analyze/[itemId]/destinations/page.tsx`: Destination recommendations for an analyzed item. Uses browser geolocation or city presets, combines live Overpass OSM data with verified seed partners, and renders Leaflet map markers.
- `app/destinations/page.tsx`: Standalone searchable and filterable directory of all circular partners and live OSM nodes across 5 categories (`repair`, `refurbisher`, `ngo`, `recycler`, `informal`).
- `app/dashboard/page.tsx`: Circularity Impact Dashboard. Queries live Supabase rows from `items` and `recommendations` to compute aggregate CO2e avoided, landfill mass diverted, preserved economic value, and 7-day community pulse metrics.
- `app/privacy/page.tsx`: Honest privacy disclosure covering Gemini Vision processing, Supabase storage, ephemeral geolocation handling, and hackathon prototype scope.
- `app/terms/page.tsx`: Prototype terms of service ("as-is", no warranty, estimates are non-binding).

### 3. `components/`
- `DestinationMap.tsx`: Dynamic Leaflet map wrapper (`ssr: false`). Renders user origin marker, colored partner icons (with live OSM vs verified badges), popup cards with deep links to Google Maps navigation (`/maps/dir/?api=1&destination=lat,lng`), and responsive resize observers.
- `PathwayComparisonTable.tsx`: Side-by-side comparative table for all 6 circular pathways (Repair, Reuse, Donate, Resell, Refurbish, Recycle) sorted strictly in descending order of viability score.
- `PpriMeter.tsx`: Visual SVG radial gauge and level indicator for the 0–10 Post-Purchase Repairability Index.
- `ProcessRail.tsx`: 4-step progress stepper (Intake -> Verification -> Circular Assessment -> Drop-off / Collection).
- `LoadingSkeleton.tsx`: Tailored skeleton loaders for dashboard, destinations, and results screens.

### 4. `lib/`
- `supabase.ts`: Singleton Supabase client instantiation using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `decisionEngine.ts` (1,082 lines): Deterministic, explainable scoring engine. Implements PP-RI weighted formulation (45% cost ratio, 35% condition, 20% age), hardware category baselines (`BASELINE_DATA`), condition decay factors, and strictly sorts 6 circular pathways by viability score.
- `impact-calculator.ts`: Baseline carbon and physical mass constants per hardware archetype (kg CO2e cradle-to-gate, weight in kg, depreciation curves).
- `partners-data.ts`: 40 verified seed partner nodes (20 in Hyderabad, 20 in Bengaluru), metadata mappings (`PARTNER_TYPE_META`), haversine distance calculator, city resolution dictionary, and OSM hybrid merger.
- `osm-parser.ts`: OpenStreetMap Overpass element parser, coordinate deduplicator, category classifier, and negative keyword rejection filters (excluding mis-tagged laundries, plumbers, borewells, clothing shops).

### 5. API Routes
- `app/api/analyze-image/route.ts`: Multi-provider vision pipeline (Gemini `gemini-3.1-pro-preview`/`gemini-3-flash-preview` -> Claude `claude-3-5-sonnet` -> OpenAI `gpt-4o` -> manual fallback). Enforces a 2-step structured JSON prompt: first checks if the photo depicts an electronic device/component; rejects non-electronics with `{ is_electronic: false }`; otherwise extracts item type, brand, age, condition, and confidence.
- `app/api/osm-destinations/route.ts`: Queries public Overpass API endpoints with an 8s timeout, querying real-world repair shops, recycling centers, second-hand shops, and charities within a 15km radius. Includes in-memory 5-minute cache.

### 6. Supabase Client & Server Utilities
- Client initializes via `@supabase/supabase-js` using standard environment variables with fallbacks to `SUPABASE_URL` / `SUPABASE_ANON_KEY`.
- Currently operates exclusively as client-side anonymous access (suitable for guest hackathon flow, but lacks role-based authenticated sessions).

### 7. Database Types
- `types/database.ts`: TypeScript interface defining Supabase table schemas for `items`, `partners`, and `recommendations`.
- Enums: `PartnerType` (`"repair" | "ngo" | "recycler" | "refurbisher" | "informal"`), `RecommendedAction` (`"repair" | "reuse" | "donate" | "resell" | "refurbish" | "recycle"`), `ItemCondition`.

### 8. Migrations
- `supabase/migrations/20241001000000_reloop_schema.sql`: Core schema defining `items`, `partners`, `recommendations`, indices, and anonymous RLS policies.
- `supabase/migrations/20241001000002_storage_bucket.sql`: Creation of public `item-photos` storage bucket with public SELECT/INSERT/UPDATE policies.
- `supabase/migrations/20241001000003_add_resell_pathway.sql`: Extension of `recommendations_recommended_action_check` constraint to support `resell`.
- `supabase/seed.sql`: Initial seed data containing 40 circular partners across Hyderabad and Bengaluru.

### 9. RLS Policies
- Row Level Security is enabled on all tables (`items`, `partners`, `recommendations`), but policies are open `USING (true)` and `WITH CHECK (true)` for public anonymous access.
- Storage bucket `item-photos` has open public read/insert/update policies.

### 10. Authentication
- Currently guest/anonymous mode only. No Supabase Auth (`supabase.auth`) login, sign-up, or user session state is configured.

### 11. Storage Configuration
- Bucket: `item-photos` (Public bucket, 8MB max upload enforced on frontend, public URLs generated via `getPublicUrl`).

### 12. AI / Vision Implementation
- Server-side Node runtime (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).
- Cascade: Gemini 3.1 Pro -> Claude 3.5 Sonnet -> GPT-4o -> graceful manual defaults.
- JSON extraction sanitizer handles markdown formatting and retries once if JSON is malformed.
- Hardcoded prompt gate rejects non-electronics before extracting parameters.

### 13. Map Implementation
- Leaflet 1.9.4 dynamically loaded in Next.js with OpenStreetMap standard tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
- Fully functional tile rendering with size invalidations and interactive popups linking to Google Maps directions.

### 14. Dashboard
- Live aggregate querying of `items` joined with `recommendations`. Computes total evaluated hardware, total CO2e avoided, total landfill waste diverted, economic value preserved, and 7-day community pulse.

### 15. Decision Engine
- Deterministic TypeScript implementation (`lib/decisionEngine.ts`) with unit test validation. Never relies on generative AI for math or routing.

### 16. Tests
- 22 passing tests in Node.js native test runner (`node --test --experimental-strip-types`):
  - 15 tests in `tests/decisionEngine.test.ts` (weights sum to 1.0, 6 pathway routes, PP-RI scoring, CRT TV legacy hardware, descending viability sort).
  - 7 tests in `tests/osmDestinations.test.ts` (OSM parsing, negative keyword rejections, verified partner fallback).

### 17. Environment Variables
- Local configuration in `.env.local` / `.env.production.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

### 18. Documentation
- `README.md`: Covers guest MVP, tech stack, local setup, and core flows.
- `docs/INTEGRATION_STATUS.md`: Complete audit of GitHub, Supabase, Vercel, and local builds.

### 19. Deployment Configuration
- Vercel project `cbphl/reloop` connected to GitHub repository `haneexh/reloop` on branch `main`. Output directory `.next`, framework Next.js.

---

## Part 2 — Code Classification

| Component / File | Classification | Rationale & Transition Plan |
|---|---|---|
| `app/api/analyze-image/route.ts` | **KEEP** | Multi-provider vision pipeline with electronics-only gate. Directly solves PS-013 AI-assisted item classification. |
| `lib/supabase.ts` | **KEEP** | Standard Supabase client instantiation. Add server/admin client for protected role operations. |
| `components/DestinationMap.tsx` | **ADAPT** | High-quality Leaflet map. Adapt to support collection zones, multi-stop vehicle routes, and depot/facility markers. |
| `lib/osm-parser.ts` & Overpass route | **ADAPT** | Keep for geo-distance utilities and partner lookups, adapt to support recovery facility discovery. |
| `lib/partners-data.ts` | **ADAPT** | Verified partners table contains recyclers and refurbishers. Adapt into PS-013 `recovery_facilities` and `collection_zones`. |
| `app/destinations/page.tsx` | **ADAPT** | Re-purpose into the public collection/drop-off & recovery facility locator. |
| `app/dashboard/page.tsx` | **ADAPT** | Transform into the PS-013 Sustainability & Efficiency Dashboard (collection metrics, zone heatmaps, diversion rates). |
| `app/analyze/page.tsx` | **ADAPT** | Adapt from individual DIY assessment to Citizen E-Waste Collection Request intake (add address/zone, pickup slot, batch items). |
| `app/analyze/[itemId]/results/page.tsx` | **LEGACY** | Old individual 6-pathway decision view. Keep active under `/legacy/analyze/[itemId]` or `/circular-index`, but route new citizen flow to request confirmation + QR tracking. |
| `lib/decisionEngine.ts` | **ADAPT / LEGACY** | Decision engine is valuable for hardware classification, baseline weights, and CO2e estimation; retire the 6-way consumer DIY routing to LEGACY in favor of municipal e-waste recovery routing. |
| `lib/impact-calculator.ts` | **KEEP** | Baseline physical weights and embodied carbon formulas are 100% reusable for community diversion metrics. |
| `components/PathwayComparisonTable.tsx` | **LEGACY** | Consumer pathway comparison table. Keep for backward compatibility; not required on primary PS-013 collection flow. |
| `components/PpriMeter.tsx` | **LEGACY** | Consumer repairability gauge. Keep as an auxiliary component for item quality grading. |
| `supabase/migrations/*` | **KEEP** | Existing tables (`items`, `partners`, `recommendations`) must remain untouched to avoid breaking existing data. |
| `tests/*.test.ts` | **KEEP** | 22 unit tests preserve baseline reliability. Add new tests for scheduling, clustering, and route optimization. |

---

## Part 3 — Mapping Existing Code to PS-013 Requirements

| Requirement | Status | Existing Files / Tables / Assets | Gap / Action Needed for PS-013 |
|---|---|---|---|
| **A. Citizen e-waste request** | **PARTIALLY EXISTS** | `app/analyze/page.tsx`, `items` table | Currently intakes single item for DIY advice; needs multi-item request, contact details, address, pickup time window, status (`submitted`, `scheduled`, `assigned`, `collected`, `recovered`). |
| **B. Location management** | **PARTIALLY EXISTS** | `lib/partners-data.ts`, `DEFAULT_USER_LOCATION`, Hyderabad presets | Geocoding and presets exist. Needs citizen pickup address capture, lat/lng resolution, and zone geofence assignment. |
| **C. E-waste taxonomy** | **EXISTS** | `ITEM_TYPE_PRESETS` in `decisionEngine.ts`, `BASELINE_DATA` | 16 categories covering large IT, mobile, consumer electronics, CRT displays, appliances with weight baselines. Can be formalized into PS-013 standard categories. |
| **D. AI-assisted classification** | **EXISTS** | `app/api/analyze-image/route.ts` | Fully working multi-model vision extraction with electronics gate. |
| **E. Human verification** | **EXISTS** | `app/analyze/page.tsx` (Step 02) | Fully working human-in-the-loop review form with editable category, brand, age, condition, and notes before DB commit. |
| **F. Spatial demand analysis** | **MISSING** | None | Need spatial aggregation of pending requests by zone/neighborhood in Hyderabad. |
| **G. Temporal demand analysis** | **MISSING** | `created_at` timestamp in `items` table | Need aggregation by day/week/slot to analyze temporal surge patterns. |
| **H. Historical demand records** | **PARTIALLY EXISTS** | `items` table (23 rows) | Need synthetic historical demand generator clearly labeled as *simulated* to demonstrate predictive analytics. |
| **I. Demand forecasting** | **MISSING** | None | Need deterministic time-series/moving-average forecasting module to project weekly collection loads per zone. |
| **J. Collection zones** | **PARTIALLY EXISTS** | City presets in `partners-data.ts` | Need explicit `collection_zones` table/definitions (e.g. HITEC City, Gachibowli, Banjara Hills, Secunderabad, Kukatpally). |
| **K. Vehicle management** | **MISSING** | None | Need `vehicles` table/schema (vehicle ID, capacity in kg/volume, type: EV Van / Mini Truck, status, current depot). |
| **L. Collection scheduling** | **MISSING** | None | Need dispatch scheduler assigning pending citizen requests to vehicle runs and collection slots. |
| **M. Capacity constraints** | **MISSING** | None | Vehicle capacity limits (e.g., 500 kg max) must constrain route planning so overloaded stops trigger additional runs. |
| **N. Multi-vehicle route optimization** | **MISSING** | `haversineDistanceKm` in `osm-parser.ts` | Need deterministic multi-stop route optimizer (Clarke-Wright Savings or Nearest Neighbor TSP with 2-opt) respecting vehicle capacities. |
| **O. Route visualization** | **PARTIALLY EXISTS** | `components/DestinationMap.tsx` | Leaflet map renders points; needs multi-stop polyline rendering showing sequential collection stops with stop numbers. |
| **P. QR pickup verification** | **MISSING** | None | Need citizen request QR code generator and collector QR scan/confirmation endpoint. |
| **Q. Collection records** | **MISSING** | None | Need `collection_records` table linking request, vehicle, collector, actual weight collected, and pickup timestamp. |
| **R. Recovery facility management** | **PARTIALLY EXISTS** | `partners` table (recyclers, refurbishers, repair labs) | 40 verified facilities exist in database. Need formal classification as designated e-waste drop-off/processing hubs. |
| **S. Recovery tracking** | **MISSING** | None | Need recovery logging: which collected batch was transferred to which certified recycler, fraction refurbished vs material recovery. |
| **T. Chain of custody** | **MISSING** | None | Need end-to-end audit trail: Request -> Pickup -> Transfer -> Final Recycling/Refurbishing with custodial timestamps. |
| **U. Sustainability dashboard** | **PARTIALLY EXISTS** | `app/dashboard/page.tsx` | Computes live CO2e and waste avoided; needs municipal collection KPIs (collection efficiency, diversion rate, vehicle fuel/km saved). |
| **V. Collection-efficiency analysis** | **MISSING** | None | Metrics comparing route distance vs baseline unoptimized trips, kg collected per vehicle-km. |
| **W. Waste-diversion analysis** | **PARTIALLY EXISTS** | `app/dashboard/page.tsx` | Baseline diversion formulas exist; needs breakdown by destination facility and recovery pathway. |
| **X. Authentication / RBAC** | **MISSING** | None | Need role switching or mock roles: Citizen, Dispatcher / Fleet Manager, Field Collector, Recovery Facility Admin. |
| **Y. Supabase RLS** | **PARTIALLY EXISTS** | Public RLS policies in `supabase/migrations/` | RLS is active but completely permissive; needs role-based scoping (citizens see only their requests, dispatchers see all). |
| **Z. Append-only event log** | **MISSING** | None | Need `event_log` table capturing every major state change (request created, scheduled, collected, transferred) with timestamp and actor. |
| **AA. Scenario simulation** | **MISSING** | None | Interactive scenario simulator: inject sudden surge in a zone (e.g., tech park e-waste drive) and re-run optimization. |
| **AB. Re-optimization** | **MISSING** | None | Ability to re-optimize routes when a vehicle breaks down or high-priority pickup is added. |
| **AC. Public tracking** | **MISSING** | `/analyze/[itemId]/results` exists | Need public `/track/[requestId]` page where citizens view real-time request status and verification QR. |

---

## Part 4 — Database Audit

### Existing Tables (Live in Supabase)
1. **`items` (23 rows):**
   - Columns: `id` (UUID PK), `image_url` (TEXT), `item_type` (TEXT), `brand` (TEXT), `estimated_age_years` (NUMERIC), `condition` (TEXT), `repair_cost_est` (NUMERIC), `resale_value_est` (NUMERIC), `co2e_saved_est` (NUMERIC), `waste_avoided_kg` (NUMERIC), `created_at` (TIMESTAMPTZ).
   - Constraints: None except PK.
   - Indices: `idx_items_created_at`, `idx_items_item_type`, `idx_items_condition`.
2. **`partners` (40 rows):**
   - Columns: `id` (UUID PK), `name` (TEXT), `partner_type` (TEXT: `repair`, `ngo`, `recycler`, `refurbisher`, `informal`), `lat` (NUMERIC), `lng` (NUMERIC), `city` (TEXT), `contact` (TEXT), `verified` (BOOLEAN).
   - Constraints: `partner_type CHECK (partner_type IN ('repair', 'ngo', 'recycler', 'refurbisher', 'informal'))`.
   - Indices: `idx_partners_partner_type`, `idx_partners_city`, `idx_partners_verified`, `idx_partners_coords`.
3. **`recommendations` (23 rows):**
   - Columns: `id` (UUID PK), `item_id` (UUID FK -> `items.id`), `recommended_action` (TEXT), `confidence` (NUMERIC), `rationale` (TEXT), `alt_action_1` (TEXT), `alt_action_2` (TEXT), `created_at` (TIMESTAMPTZ).
   - Constraints: `recommended_action CHECK (...)`.
   - Indices: `idx_recommendations_item_id`, `idx_recommendations_recommended_action`, `idx_recommendations_created_at`.

### Existing Storage
- `item-photos` (Public bucket, RLS enabled with public select/insert/update).

### Required Additions for PS-013 (Non-Destructive)
To preserve all 23 items and 40 partners without drop or reset, add new tables:
1. `collection_zones`: Defined polygons or centroid coordinates for municipal zones (HITEC City, Gachibowli, Banjara Hills, Secunderabad, Kukatpally).
2. `collection_requests`: Parent table for citizen requests (`id`, `citizen_name`, `citizen_phone`, `address`, `zone_id`, `lat`, `lng`, `status`, `scheduled_slot`, `qr_code_token`, `created_at`).
   - Add optional `request_id` FK column to existing `items` table so multiple items can belong to a single collection request.
3. `vehicles`: Fleet inventory (`id`, `vehicle_code`, `capacity_kg`, `vehicle_type`, `status`, `depot_lat`, `depot_lng`).
4. `collection_routes`: Optimized routes (`id`, `vehicle_id`, `route_date`, `status`, `total_distance_km`, `total_load_kg`, `stops_json`, `created_at`).
5. `collection_records`: Verification logs (`id`, `request_id`, `route_id`, `collector_id`, `actual_weight_kg`, `verified_at`, `verification_method`).
6. `recovery_transfers`: Custody transfers from collector to recovery facility (`id`, `facility_id`, `route_id`, `total_weight_kg`, `transferred_at`, `status`).
7. `event_log`: Append-only immutable log (`id`, `event_type`, `entity_type`, `entity_id`, `payload`, `created_at`).

### Potential Naming Conflicts
- The existing `items` table already stores individual hardware pieces. Retain `items` as the line-item table for e-waste items and introduce `collection_requests` as the pickup request container.

---

## Part 5 — Security Audit

### 1. Storage Security (`item-photos`)
- **Current State:** The bucket is configured with `public: true`, and RLS policies allow anyone to `SELECT`, `INSERT`, and `UPDATE` objects in `item-photos`.
- **Finding:** Client-side uploads directly write to the bucket without user authentication. While acceptable for a hackathon guest demo, it allows unrestricted file uploads.
- **Signed URLs:** Not currently used; images use permanent public URLs (`supabase.storage.from("item-photos").getPublicUrl(filePath)`).
- **Vision API Dependency:** The AI route currently receives the image as Base64 in the POST body (`imageBase64`), so the vision model does *not* strictly require the public URL to analyze the image; the public URL is solely used to store `image_url` on the item record.

### 2. Database RLS Policies
- **Current State:** `items`, `partners`, and `recommendations` have RLS enabled, but all policies are `USING (true)` and `WITH CHECK (true)`.
- **Finding:** Any anonymous user with the anon key can run `supabase.from("items").select()` or `update()` or `insert()`.
- **Recommendation:** Implement row ownership or guest-session tokens, and introduce role-based policies (citizen read-only for own requests, dispatcher/collector authenticated access for routes).

### 3. API Authentication & Rate Limiting
- `/api/analyze-image`: No rate limiting or API authentication. Vulnerable to abuse if publicly flooded.
- `/api/osm-destinations`: Includes an in-memory 5-minute cache and coordinates validation, but no rate limiting.

### 4. Client-Side Secrets
- Confirmed: No secret keys (Anthropic API key, Gemini API key, OpenAI API key, or Supabase Service Role key) are exposed in client bundles or public repositories. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are client-accessible, which is standard for Supabase.

---

## Part 6 — Package and Build Audit

### Existing Dependencies
- Everything needed for core web, API, and mapping is installed: Next.js 14, React 18, Supabase client, Leaflet, Tailwind CSS, TypeScript 5.

### What Is Actually Missing?
- A lightweight QR code generator (e.g. `qrcode` or SVG QR renderer) for Citizen collection verification.
- Everything else (route optimization algorithms, spatial clustering, forecasting, statistics) can and should be implemented in pure, deterministic TypeScript without adding heavy external dependencies.

### Typecheck Script Addition
- Successfully added `"typecheck": "tsc --noEmit"` to `package.json`.
- Added `"allowImportingTsExtensions": true` to `tsconfig.json` so Node's native test runner (`node --test --experimental-strip-types`) and `tsc --noEmit` coexist without TS5097 errors.
- Verified: `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` all pass with exit code 0.

---

## Part 7 — PS-013 Target Architecture

```
[ Citizen Pickup Request ] 
   │  - Photo upload + Vision AI classification
   │  - Human verification & calibration
   │  - Address / GPS in Hyderabad zone
   ▼
[ Demand & Zone Aggregator ]
   │  - Spatial clustering (Zone assignment)
   │  - Temporal aggregation (Daily slot demand)
   │  - Demand forecasting (Historical + simulated baseline)
   ▼
[ Deterministic Route Optimizer ] (Zero Black-Box AI)
   │  - Vehicle fleet capacity constraints (kg / volume)
   │  - Clarke-Wright / 2-Opt TSP optimization
   │  - Output: Ordered stops, ETA, distance, CO2 saved
   ▼
[ Collection Dispatch & Execution ]
   │  - Interactive Leaflet route map with sequential polylines
   │  - Digital QR code generation for citizen
   │  - Collector QR scan & weight verification
   ▼
[ Custody Transfer & Recovery Tracking ]
   │  - Transfer to verified recovery partners (Cherlapally, etc.)
   │  - Refurbish vs certified recycling material breakdown
   │  - Append-only event log audit trail
   ▼
[ Sustainability & Efficiency Dashboard ]
   │  - Live database-driven KPIs: kg collected, routes run, fuel avoided
   │  - Zone demand heatmaps & diversion rates
   │  - Scenario simulation (surge demand, fleet re-optimization)
```
