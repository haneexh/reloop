# RE:LOOP — PROJECT STATUS & AUDIT REPORT
**Problem Statement:** TH2-PS-SD-013 — Community E-Waste Collection Optimizer  
**Competition:** Tech Horizon 2.0  
**Stack:** Next.js 14.2.25 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), Vercel  
**Deployed URL:** https://reloop-ashen.vercel.app  
**Audit Date:** October 2026  
**Auditor Mode:** Audit and Report Only (Code Frozen)  

---

## 1. Executive Summary & Platform State

RE:LOOP is an end-to-end civic e-waste collection optimization and recovery traceability platform built for Hyderabad (with fallback coverage for Bengaluru). The codebase integrates:
1. Citizen pickup booking with automatic GPS/zone resolution and scannable QR tokens.
2. Demand intelligence analyzing spatial density across 10 municipal zones and temporal request patterns.
3. Capacity-aware fleet scheduling and Vehicle Routing Problem (CVRP) optimization (Nearest Neighbor + 2-opt + Relocate).
4. Collector mobile console for doorstep QR verification and digital scale weight validation.
5. Material recovery and facility transfer logging with an immutable, append-only event ledger.
6. Public chain-of-custody tracking with zero PII exposure.

All core engineering modules are implemented, backed by 92 automated tests (100% pass), clean TypeScript type-checking, clean linting, and successful Next.js static/dynamic production builds.

---

## 2. Infrastructure & Environment Connections

### 2.1 Vercel Deployment
- **Project Name:** `reloop`
- **Project ID:** `prj_YnwUwapko51WKKu3xeF1k5gANC sacram`
- **Owner / Team:** `cbphl` / `team_t2PC574bbP4jfbzOuPX9B346`
- **Deployed Production URL:** https://reloop-ashen.vercel.app
- **Deployment Status:** Live on commit `753ece6`.  
  *(Note: Local branch is currently ahead by 5 commits containing Part 1–5 UX refinements. As a result, certain new routes like `/track` root lookup are 404 on the currently deployed build until the next deployment release).*

### 2.2 Supabase Database Connection
- **Project URL:** `https://pebyjnafwmhbkngcrhmb.supabase.co`
- **Project Reference ID:** `pebyjnafwmhbkngcrhmb`
- **Client Configuration:** Keys configured via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Database Engine:** PostgreSQL 15 with `pgcrypto` and Row Level Security (RLS) enabled on all 11 tables.

---

## 3. Route Map & Live Verification

Below is the complete audit of every frontend route and API endpoint, cross-tested against the live production deployment (`https://reloop-ashen.vercel.app`) and local build:

| Route Path | Type | Purpose | Live Status (reloop-ashen) | Local Build Status | Notes |
|---|---|---|:---:|:---:|---|
| `/` | Page (Static) | Public homepage, 3-step lifecycle, category list, trust commitments, tracking search | **200 OK** | **200 OK** | Fully operational; live partner count rendered |
| `/request` | Page (Static) | 5-step citizen e-waste pickup intake flow, zone resolution, QR code generation | **200 OK** | **200 OK** | End-to-end working; writes real requests to Supabase |
| `/track` | Page (Static) | Citizen tracking code lookup portal | **404 Not Found** *(on deployed build)* | **200 OK** *(in current commit)* | Added in recent commit; will become 200 on next Vercel deployment |
| `/track/[token]` | Page (Dynamic) | Public chain-of-custody progress rail, scale audit record, QR pass display | **200 OK** | **200 OK** | Tested with token `QR-REQ-HYD-001`; displays verified weight |
| `/dispatch` | Page (Static) | Operational dispatch console, fleet payload capacities, route planning, CVRP review | **200 OK** | **200 OK** | Renders spatial demand, fleet cards, and interactive Leaflet map |
| `/collector` | Page (Static) | Mobile field collector console, camera QR scanner (`jsQR`), actual scale weight logging | **200 OK** | **200 OK** | Touch-friendly; modal verification and actual kg submit |
| `/dashboard` | Page (Static) | Sustainability & recovery impact ledger, material flow bar, facility batch transfers | **200 OK** | **200 OK** | Mass balance accounting in kg; honest demo notice |
| `/analyze` | Page (Static) | Hardware camera intake assessment, scope gate, human verification | **200 OK** | **200 OK** | Drag-drop upload, webcam capture, Gemini/Claude vision call |
| `/analyze/[itemId]/results` | Page (Dynamic) | Decision engine results, PP-RI index, financial & carbon metrics | **200 OK** | **200 OK** | Legacy item evaluation flow |
| `/analyze/[itemId]/destinations` | Page (Dynamic) | Recommended destination partner matching for evaluated item | **200 OK** | **200 OK** | Interactive map & distance routing |
| `/destinations` | Page (Static) | Standalone circular partner directory with live OpenStreetMap integration | **200 OK** | **200 OK** | Filters by repair, refurbisher, recycler, informal, NGO |
| `/privacy` | Page (Static) | Transparent privacy policy and data handling disclosure | **200 OK** | **200 OK** | Clarifies zero server location logging and prototype status |
| `/terms` | Page (Static) | Terms of service and algorithmic estimation disclaimer | **200 OK** | **200 OK** | Clarifies modeled estimates vs commercial offers |
| `/api/requests` | API (GET, POST) | Submit pickup request (`POST`) or fetch tracking details by token (`GET`) | **200 OK** | **200 OK** | PII masked for public viewers; generates unique QR token |
| `/api/demand` | API (GET) | Aggregates spatial demand across zones and temporal demand distributions | **200 OK** | **200 OK** | Returns deterministic demand scores and run-rate forecasts |
| `/api/routes` | API (GET, POST) | Plan & optimize collection routes (`POST`) or retrieve persisted routes (`GET`) | **200 OK** | **200 OK** | CVRP heuristic optimizer with capacity constraints |
| `/api/collector/route` | API (GET, PATCH) | Collector route manifest (`GET`) or route lifecycle start/complete (`PATCH`) | **200 OK** | **200 OK** | Protected by role check (`COLLECTOR` / `DISPATCHER`) |
| `/api/collector/collect` | API (POST) | Logs verified doorstep collection, actual weight, appends to `event_log` | **200 OK** | **200 OK** | Enforces positive scale weight, updates request status |
| `/api/recovery/facilities` | API (GET) | Lists licensed recycling and refurbishment facilities | **200 OK** | **200 OK** | Returns 40 verified facility nodes |
| `/api/recovery/transfers` | API (GET, POST) | Logs batch facility transfers with material recovery percentages | **200 OK** | **200 OK** | Validates 100% mass balance allocation |
| `/api/sustainability` | API (GET) | Computes 18 sustainability & logistics eco-metrics | **200 OK** | **200 OK** | Zero-denominator safe mass balance accounting |
| `/api/analyze-image` | API (POST) | Multimodal AI vision classification route | **200 OK** | **200 OK** | Gemini &rarr; Claude &rarr; GPT-4o with graceful manual fallback |
| `/api/osm-destinations` | API (GET) | Overpass API live OSM destination query | **200 OK** | **200 OK** | Live query with verified partner fallback |

---

## 4. Data Layer Audit

### 4.1 Live Database Statistics (Queried from Supabase)
| Table Name | Total Rows | Simulated Seed Rows | Real User Rows | RLS Status | Primary Indexes |
|---|:---:|:---:|:---:|:---:|---|
| `items` | **30** | 23 | 7 | Enabled | `idx_items_created_at`, `idx_items_item_type`, `idx_items_request_id` |
| `partners` | **40** | 40 | 0 | Enabled | `idx_partners_partner_type`, `idx_partners_city`, `idx_partners_verified`, `idx_partners_coords` |
| `recommendations` | **28** | 23 | 5 | Enabled | `idx_recommendations_item_id`, `idx_recommendations_action` |
| `collection_zones` | **10** | 10 | 0 | Enabled | `idx_collection_zones_code` |
| `collection_requests` | **19** | 15 | 4 | Enabled | `idx_collection_requests_status`, `idx_collection_requests_zone_id`, `idx_collection_requests_qr_token` |
| `vehicles` | **6** | 6 | 0 | Enabled | `idx_vehicles_status`, `idx_vehicles_type` |
| `collection_routes` | **0** | 0 | 0 | Enabled | `idx_collection_routes_vehicle_id`, `idx_collection_routes_date`, `idx_collection_routes_status` |
| `collection_records` | **5** | 2 | 3 | Enabled | `idx_collection_records_request_id`, `idx_collection_records_route_id` |
| `recovery_transfers` | **2** | 1 | 1 | Enabled | `idx_recovery_transfers_facility_id`, `idx_recovery_transfers_route_id` |
| `event_log` | **20** | 4 | 16 | Enabled | `idx_event_log_entity`, `idx_event_log_event_type`, `idx_event_log_created_at` |
| `profiles` | **0** | 0 | 0 | Enabled | `idx_profiles_role` |

### 4.2 Row Level Security (RLS) Policies
- **`collection_zones`**: Public read (`SELECT USING (true)`), operator management restricted to `DISPATCHER` or `ADMIN`.
- **`collection_requests`**: Public read (`SELECT USING (true)` for token lookup), citizen insert (`INSERT WITH CHECK (true)`), status update restricted to operational roles.
- **`vehicles`**: Public read (`SELECT USING (true)`), fleet modifications restricted to `DISPATCHER` / `ADMIN`.
- **`collection_routes`**: Public read (`SELECT USING (true)`), route persistence restricted to `DISPATCHER` / `ADMIN`.
- **`collection_records`**: Public read for tracking receipts, collector insert allowed with valid scale verification.
- **`recovery_transfers`**: Public read for public audit ledger, facility insert allowed for authorized recovery operators.
- **`event_log`**: **Append-Only Protection**:
  - `SELECT` allowed (`USING (true)`).
  - `INSERT` allowed (`WITH CHECK (true)`).
  - `UPDATE` and `DELETE` have **NO policies** and are strictly blocked by PostgreSQL trigger `trigger_event_log_no_update_delete` which throws: `"event_log is strictly append-only. Modification or deletion is prohibited."`

---

## 5. Algorithmic Architecture

### 5.1 Routing Optimization Algorithm (`lib/route-optimizer.ts`)
The collection routing engine implements a deterministic, multi-stage heuristic for the Capacitated Vehicle Routing Problem (CVRP):
1. **Tour Construction (Greedy Nearest Neighbor)**:
   - Starts at vehicle depot coordinates (`depot_lat`, `depot_lng`).
   - Iteratively selects the unvisited customer stop with minimum Haversine spherical distance.
   - Appends collection stops and completes tour back at depot.
2. **Tour Improvement Operator 1 (2-Opt Inversion)**:
   - Evaluates all pairs `(i, j)` in the tour.
   - Inverts segment `[i, j]` if candidate tour distance reduces round-trip kilometers (`candidateDist < currentDist - 0.001`).
   - Iterates until local optimum reached (capped at 50 iterations).
3. **Tour Improvement Operator 2 (Relocate Local Search)**:
   - Evaluates moving single stops to other positions in the sequence to untangle overlapping paths.
4. **Honest Baseline Comparison**:
   - Calculates unoptimized baseline distance (sequential FIFO visiting order) vs. optimized tour.
   - Computes explicit `distance_saved_km` and `distance_reduction_percent` without exaggerated claims.

### 5.2 Capacity Enforcement & Bin Packing (`lib/scheduler.ts`)
- **Capacity Constraint**: Each vehicle has a physical payload limit (`capacity_kg`, e.g., 400 kg for EV vans, 850 kg for CNG trucks).
- **Cluster-Aware Bin Packing**:
  - Valid requests are ordered deterministically:
    1. Priority score (`urgent: 4 > high: 3 > normal: 2 > low: 1`).
    2. Overdue/backlog date alignment.
    3. Estimated weight descending (First-Fit Decreasing heuristic).
    4. Stable UUID tie-breaker.
  - For each request, candidate vehicles with remaining capacity (`currentLoad + weight <= v.capacity_kg`) are evaluated.
  - The request is assigned to the vehicle whose depot or last-assigned stop is closest to minimize deadhead kilometers.
  - If no vehicle has sufficient remaining payload, the request is **never silently discarded**; it is placed into `deferred_requests` with reason `"VEHICLE_CAPACITY_EXCEEDED"`.

### 5.3 Time Window Handling
- Citizen requests carry scheduled arrival slots:
  - `09:00 - 12:00` (Morning)
  - `12:00 - 15:00` (Afternoon)
  - `15:00 - 18:00` (Evening)
- When operators dispatch a specific time-window run, requests outside that window are deferred with reason `"TIME_WINDOW_CONFLICT"` and an explanation: `"Citizen specified time slot 'X' which does not match active batch 'Y'."`

### 5.4 Demand Intelligence & Forecasting (`lib/demand-engine.ts`)
- **Spatial Aggregation**: Groups requests into 10 municipal clusters (HITEC City, Gachibowli, Kondapur, Jubilee Hills, Banjara Hills, Kukatpally, Begumpet, Secunderabad, Charminar, Uppal).
- **Deterministic Demand Scoring Formula**:
  $$\text{Score} = (10 \times \text{Volume}) + (1.5 \times \text{Weight}_{\text{kg}}) + (25 \times N_{\text{urgent}}) + (15 \times N_{\text{high}}) + (10 \times \text{RecencyBonus}_{<24\text{h}})$$
- **Demand Levels**: Categorized into `LOW` (<30), `MEDIUM` (&ge;30), `HIGH` (&ge;80), or `CRITICAL` (&ge;150 or urgent request present).
- **Baseline Run-Rate Forecasting**: Computes zone forecasts by projecting recent weekly arrival velocity into expected pickups and kg, clearly labeled as baseline run-rate forecast (no black-box AI claims).

---

## 6. AI Vision Pipeline Audit (`app/api/analyze-image/route.ts`)

### 6.1 Wired Vision Providers & Fallback Hierarchy
The image intake route supports 3 vision model providers in strict priority order:
1. **Google Gemini Vision** (Priority 1):
   - Models: `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.8-flash`
   - Configured via `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, or `GOOGLE_API_KEY`.
   - Temperature 0.2, forced `application/json` output, 1 automatic retry on JSON parse failure, exponential backoff on 429/503.
2. **Anthropic Claude Vision** (Priority 2):
   - Model: `claude-3-5-sonnet-20241022`
   - Configured via `ANTHROPIC_API_KEY`.
   - Max tokens 1000, 1 retry on malformed JSON.
3. **OpenAI GPT-4o Vision** (Priority 3):
   - Model: `gpt-4o`
   - Configured via `OPENAI_API_KEY`.
   - `json_object` response format, 1 retry on malformed JSON.
4. **Manual Fallback** (Priority 4 / No-Key Mode):
   - If no API keys are present or all model calls fail, the endpoint returns:
     ```json
     {
       "success": true,
       "provider": "manual_fallback",
       "manual_fallback": true,
       "message": "No Vision API key detected. Please verify or complete item details manually.",
       "data": {
         "item_type": "Other Electronics / Unlisted",
         "brand": null,
         "estimated_age_years": null,
         "condition": "functional",
         "condition_notes": "Manual assessment entered by user.",
         "material_recoverable": true,
         "confidence": "medium",
         "is_low_confidence": true
       }
     }
     ```
   - **Zero 500 Crashes**: User is smoothly transitioned to the manual verification form with pre-filled safe defaults.

### 6.2 Scope Gate Policy for Non-Electronic Items
The system prompt contains a strict 2-step classification. If a photo depicts a non-electronic item (clothing, furniture, plants, paper):
- The model outputs `{"is_electronic": false, "rejection_reason": "..."}`.
- The route returns `{"success": false, "not_electronic": true, ...}`.
- The UI displays an amber Policy Gate Banner explaining that RE:LOOP exclusively processes electronic items.

---

## 7. Problem Statement PS-013 Outcomes Matrix

| # | Required PS-013 Outcome | Status | Implementation File Paths | Concrete Evidence |
|:---:|---|:---:|---|---|
| **1** | **E-waste request & location-management module** | **DONE** | `app/request/page.tsx`<br>`app/api/requests/route.ts`<br>`lib/zone-resolver.ts` | 5-step booking flow with GPS/manual zone mapping across 10 municipal zones, 7 categories, and QR tracking code generation. |
| **2** | **Collection route & schedule optimization with vehicle capacity & varying quantities** | **DONE** | `app/dispatch/page.tsx`<br>`app/api/routes/route.ts`<br>`lib/route-optimizer.ts`<br>`lib/scheduler.ts`<br>`lib/fleet-engine.ts` | Priority bin-packing enforcing vehicle `capacity_kg`, Nearest Neighbor + 2-opt tour inversion with distance-saved metrics, and deferred requests tracking. |
| **3** | **Recovery tracking & sustainability dashboard** | **DONE** | `app/dashboard/page.tsx`<br>`app/api/sustainability/route.ts`<br>`lib/sustainability-engine.ts`<br>`lib/recovery-engine.ts` | Physical mass balance accounting (`kg`) for Collected, Recovered, Recycled, Diverted with transparent EPA WARM modeled estimates. |
| **4** | **Collection-efficiency & waste-diversion analysis** | **DONE** | `app/dashboard/page.tsx`<br>`lib/sustainability-engine.ts`<br>`tests/sustainabilityEngine.test.ts` | Calculates `collection_efficiency_kg_per_km`, `vehicle_utilization_percent`, `route_distance_saved_km`, and diversion percentage with zero-division safety. |
| **5** | **Traceable collection records** | **DONE** | `app/collector/page.tsx`<br>`app/track/[token]/page.tsx`<br>`app/api/collector/collect/route.ts`<br>`supabase/migrations/20241001000004_ps013_core_schema.sql` | Doorstep camera QR scan + calibrated scale weight entry creates immutable `collection_records`, appends trigger-protected `event_log`, and updates public tracking. |
| **6** | **Spatial & temporal demand analysis** | **DONE** | `app/dispatch/page.tsx`<br>`app/api/demand/route.ts`<br>`lib/demand-engine.ts`<br>`tests/demandEngine.test.ts` | Zone-level spatial aggregation with demand score formula (volume, weight, priority, recency), temporal slots/weekdays breakdown, and baseline forecasts. |
| **7** | **Final technical report & demo** | **DONE** | `docs/PS013_FINAL_UX_READINESS.md`<br>`PROJECT_STATUS.md`<br>`docs/PS013_UX_AUDIT.md` | Full system audit, architectural verification, judge journey walkthrough, and complete operations workflow. |

---

## 8. UX, Mobile & Quality Audit

### 8.1 Empty, Loading, and Error States
- **Empty States**:
  - No pickups to dispatch: `"No pickups are currently waiting for collection."`
  - No deferred stops: `"All candidate requests were successfully scheduled."`
  - No routes planned: `"No active routes planned for this selection."`
- **Loading States**:
  - Skeleton screens for directory (`DestinationsPageSkeleton`).
  - Clear progress messages for async actions ("Acquiring location coordinates...", "Looking up pickup records for...").
- **Error States**:
  - Missing tracking token: `"We could not locate this pickup request. Please check the tracking code and try again."`
  - Zero raw database error dumps or stack traces exposed to citizens.

### 8.2 Console Errors & Network Requests
- **No Console Errors**: Client-side hydration is error-free. Leaflet maps are dynamically imported (`ssr: false`) with custom loading skeletons to prevent SSR window reference crashes.
- **Failed Requests on Live Deployed Site**:
  - `/track` root returns 404 on `reloop-ashen.vercel.app` because `app/track/page.tsx` was created in recent local commits that are not yet deployed.
  - Direct token route `/track/[token]` (e.g., `/track/QR-REQ-HYD-001`) works with HTTP 200 on live deployment.

### 8.3 Mobile Layout Verification
- **375px (iPhone SE)**:
  - Collector console buttons &ge;48px touch height (`Scan Pickup Code`, `Enter Code Manually`).
  - No horizontal scrolling or content clipping.
  - Large numeric weight input (`[ 12.5 ] KG`) optimized for single-hand field operation.
- **768px (Tablet)**: Responsive 2-column card layout.
- **1280px (Desktop)**: Split-screen dispatch review (interactive Leaflet map alongside stop manifest) and 4-column KPI cards.
- **All Tables**: Explicit `overflow-x-auto` wrappers preventing table blowout.

### 8.4 Claims vs Code Reality Audit
- **README.md Inconsistency**: The root `README.md` still reflects the initial 24-hour MVP description (mentions only `/analyze`, Claude 3.5, and 20 Bengaluru partners), omitting all completed PS-013 collection routes, dispatch, mobile collector, and tracking features.
- **Environmental Claims**: CO₂ avoided and landfill diversion numbers are clearly flagged with `ESTIMATE` tags and cite EPA WARM / UNEP methodologies (no false claims of 100% circularity).
- **Data Honesty**: Simulated seed records are explicitly disclosed on the sustainability ledger (`is_simulated` separation).

---

## 9. Launch Checklist Status

| Checklist Item | Status | Verification Detail |
|---|:---:|---|
| **Custom Domain** | **Pending** | Currently using Vercel default domain (`https://reloop-ashen.vercel.app`). No custom domain configured yet. |
| **Favicon & App Icon** | **PASS** | `app/favicon.ico` and `app/icon.svg` present and serving properly. |
| **No "Made with AI" Tag** | **PASS** | Zero boilerplate AI marketing tags or badges in root layouts or footers. |
| **Privacy Policy Page** | **PASS** | `/privacy` is live, accessible, and discloses zero server location storage. |
| **Terms of Service Page** | **PASS** | `/terms` is live, accessible, and discloses prototype estimate status. |
| **No Decorative Emojis** | **PASS** | All emojis removed; replaced with accessible vector SVG icons. |
| **No Unnecessary Gradients** | **PASS** | Only 1 subtle structural 1px background grid remains; all neon/vibe gradients eliminated. |

---

## 10. Automated Quality Gate Results

All four quality verification commands were executed locally:

1. **ESLint (`npm run lint`)**:
   ```
   > reloop@0.1.0 lint
   > next lint
   ✔ No ESLint warnings or errors
   ```
   **Result: PASS (0 warnings, 0 errors)**

2. **TypeScript (`npm run typecheck`)**:
   ```
   > reloop@0.1.0 typecheck
   > tsc --noEmit
   ```
   **Result: PASS (0 type errors)**

3. **Automated Unit Tests (`npm test`)**:
   ```
   ℹ tests 92
   ℹ suites 13
   ℹ pass 92
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ duration_ms 2005.3
   ```
   **Result: PASS (92/92 tests passing across 13 test suites)**

4. **Production Build (`npm run build`)**:
   ```
   ✓ Compiled successfully
   ✓ Linting and checking validity of types
   ✓ Collecting page data
   ✓ Generating static pages (23/23)
   ✓ Finalizing page optimization
   ```
   **Result: PASS (All 23 static & dynamic routes compiled and generated)**

---

## 11. Ranked List of the 10 Highest-Impact Fixes for Hackathon Demo

Below is the prioritized list of high-impact improvements for the live demo, ordered by impact and estimated effort:

| Rank | Action / Fix | Area | Impact | Est. Effort (Mins) |
|:---:|---|---|---|:---:|
| **1** | **Deploy local commits to Vercel (`git push origin main`)**<br>The local branch is 5 commits ahead of remote. Pushing will deploy the new `/track` lookup page and Part 1–5 UX polish to `reloop-ashen.vercel.app`. | Deployment | Resolves live `/track` 404 and brings deployed site to 100% polish. | **5 mins** |
| **2** | **Update root `README.md` to reflect PS-013**<br>Replace old preliminary MVP readme with comprehensive PS-013 architecture, live URL, CVRP routing details, and judge walkthrough. | Documentation | Judges reviewing GitHub repository immediately see full civic optimizer story. | **15 mins** |
| **3** | **Pre-seed 1–2 Dispatched Collection Routes in Database**<br>`collection_routes` currently has 0 rows in live Supabase. Operators can plan a route on `/dispatch`, and hitting "Dispatch Route" writes a live route to Supabase for instant collector demoing. | Database / Demo Data | Allows judges to immediately open `/collector` without first having to generate a route in `/dispatch`. | **10 mins** |
| **4** | **Add Quick "Demo Scenario" autofill button on `/request`**<br>Add a discreet "Quick Fill Demo Request" button (e.g., pre-populates 2 laptops, Banjara Hills address, phone number). | Citizen Booking | Accelerates live judging demos by avoiding manual form typing. | **15 mins** |
| **5** | **Prominent "Copy Tracking Code" button on Booking Success**<br>Add one-click "Copy Code & Open Tracking" link on `/request` step 5 to immediately transition the citizen from booking to live tracking. | Citizen Flow | Makes the citizen-to-tracking transition frictionless during demo presentations. | **10 mins** |
| **6** | **Add simulated scale toggle / mock scanner button on `/collector`**<br>For judges testing on desktop laptops without rear webcams or physical scales, add a 1-click "Simulate Scale Reading (12.5 kg)" test shortcut. | Collector Ops | Prevents desktop webcam scanning friction during remote evaluation. | **15 mins** |
| **7** | **Add Quick-Switch Role bar on header for judges**<br>A subtle top demo bar: `[Viewing as: Citizen / Dispatcher / Collector / Impact Auditor]` that navigates between the 4 perspectives. | Presentation / Navigation | Clarifies multi-stakeholder platform architecture in first 10 seconds of pitch. | **20 mins** |
| **8** | **Include route Polyline preview in `/collector` stop focus card**<br>Show a mini Leaflet map snippet showing vehicle heading to next stop in collector console. | Collector UX | Enhances visual realism of mobile field navigation. | **30 mins** |
| **9** | **Export verified Collection Certificate / PDF receipt link**<br>Provide a printable/downloadable verified recycling receipt on `/track/[token]` once status reaches `recovered`. | Compliance / Trust | Tangible takeaway showcasing civic accountability and EPR compliance. | **35 mins** |
| **10** | **Assign custom domain in Vercel (e.g., `reloop.civic` or custom subdomain)**<br>Attach a clean custom domain in Vercel project settings to replace `reloop-ashen.vercel.app`. | Branding | Elevates presentation from student hobby project to public municipal infrastructure. | **15 mins** |
