# RE:LOOP — PS-013 Migration & Implementation Plan

**Problem Statement:** TH2-PS-SD-013 — Community E-Waste Collection Optimizer  
**Architecture Principle:** Minimum Viable Complexity, Maximum Robustness, Zero Black-Box Routing  
**Implementation Order:** Dependency-first (P0 -> P1 -> P2)

---

## Migration Strategy & Guardrails

1. **Non-Destructive Schema Evolution:**
   - Existing tables (`items`, `partners`, `recommendations`) and data (23 items, 40 partners) remain active.
   - New migrations introduce `collection_zones`, `collection_requests`, `vehicles`, `collection_routes`, `collection_records`, `recovery_transfers`, and `event_log`.
   - Add a nullable foreign key `request_id` to `items` so existing items remain valid standalone records while new requests group multiple items under one pickup.
2. **Deterministic Routing:**
   - Route optimization will be executed using pure deterministic algorithmic logic (Capacitated Vehicle Routing Problem / Clarke-Wright Savings heuristic with 2-Opt local search). No generative AI in path generation.
3. **Data Authenticity:**
   - Every metric on the dashboard must be derived from database rows.
   - Synthetic historical data used for temporal forecasting demonstrations must be explicitly marked `is_simulated = true`.
   - Environmental savings must be explicitly designated as `estimated`.

---

## Phase 1 (P0) — Core Infrastructure & Route Optimization Engine

### Step 1.1: Database Schema & RLS Setup
- **Goal:** Create foundational tables and append-only event logging.
- **Migration:** `supabase/migrations/20241001000004_ps013_core_schema.sql`
  - `collection_zones`: Zone definitions for Hyderabad (HITEC City, Gachibowli, Banjara Hills, Jubilee Hills, Kukatpally, Secunderabad) with polygon/centroid coordinates.
  - `collection_requests`: Citizen collection requests with citizen contact, address, zone assignment, status (`pending`, `scheduled`, `assigned`, `collected`, `cancelled`), and verification token.
  - Alter `items`: Add nullable `request_id UUID REFERENCES collection_requests(id)`.
  - `vehicles`: Fleet vehicles with capacity (kg), fuel type (Electric Van, CNG Mini Truck), and depot base coordinates.
  - `collection_routes`: Planned routes with vehicle association, scheduled date, total distance, stops JSON, and status.
  - `event_log`: Append-only audit trail capturing state changes (`event_type`, `entity_type`, `entity_id`, `actor_role`, `metadata`, `created_at`).
  - Update RLS: Ensure public read/insert for citizen flow and scoped update policies.
- **Artifacts:** `types/ps013.ts`, `lib/supabase-admin.ts` (if needed for elevated actions).

### Step 1.2: Citizen Request Intake & Location Management
- **Goal:** Adapt `/analyze` to a seamless Citizen E-Waste Collection Request intake.
- **Files Modified / Created:**
  - `app/request/page.tsx` (or upgraded `app/analyze/page.tsx`):
    - Multi-item intake with AI vision classification + human verification.
    - Household address input with Hyderabad zone auto-detection (using haversine bounding against `collection_zones`).
    - Preferred collection slot selection (Morning: 09:00–12:00, Afternoon: 14:00–17:00).
    - Generates unique tracking code and QR verification token.
  - `app/track/[requestId]/page.tsx`: Public citizen status tracker displaying real-time pickup status, driver ETA, and QR code to present upon arrival.

### Step 1.3: Demand Aggregation & Spatial/Temporal Clustering
- **Goal:** Aggregate pending citizen requests into actionable collection demand.
- **Files Created:**
  - `lib/demand-aggregator.ts`:
    - Groups pending collection requests by `zone_id`.
    - Computes total estimated weight (kg), item volume, and high-priority flags (e.g. hazardous battery load).
    - Temporal slot grouping for scheduled collection days.

### Step 1.4: Deterministic Multi-Vehicle Route Optimization
- **Goal:** Solve the Capacitated Vehicle Routing Problem (CVRP) for collection vehicles.
- **Files Created:**
  - `lib/route-optimizer.ts`:
    - Inputs: List of pending pickup requests (lat, lng, weight_kg), available vehicles (capacities, starting depot).
    - Algorithm:
      1. Distance Matrix computation via Haversine distance.
      2. Cluster-first, route-second approach: assign stops to vehicles respecting vehicle weight capacity (e.g., 500 kg max).
      3. Nearest Neighbor TSP with 2-Opt local search per vehicle cluster to minimize travel distance and turnarounds.
    - Outputs: Ordered sequence of stops, total distance (km), estimated duration, baseline unoptimized distance comparison, and fuel/carbon avoided by route consolidation.
    - Non-negotiable: Pure deterministic TypeScript, zero nondeterministic AI.
  - `tests/routeOptimizer.test.ts`: Unit tests validating capacity limit enforcement, stop ordering, and reproducibility.

---

## Phase 2 (P1) — Field Operations, QR Verification & Impact Dashboard

### Step 2.1: Dispatcher Fleet & Route Management
- **Goal:** Provide dispatcher interface to review demand, trigger route optimization, and assign routes.
- **Files Created:**
  - `app/fleet/page.tsx`:
    - View active vehicles, depots, and pending demand by zone.
    - One-click "Optimize Today's Routes" button.
    - Review generated routes before publishing to drivers.
    - Displays route efficiency: total km, payload utilization %, estimated fuel avoided.

### Step 2.2: Collector Mobile Execution & Route Visualization
- **Goal:** Provide clean mobile-friendly driver view.
- **Files Created:**
  - `app/collector/[routeId]/page.tsx`:
    - Interactive Leaflet map displaying the vehicle's assigned sequence of stops with colored polyline paths and stop numbering.
    - Turn-by-turn stop list with citizen address and items summary.
    - One-tap "Navigate via Google Maps" button for each stop.

### Step 2.3: QR Pickup Verification & Custody Handoff
- **Goal:** Prove physical collection occurred at the household.
- **Files Created:**
  - `app/collector/verify/page.tsx` & `/api/collector/verify-pickup`:
    - Collector scans citizen QR or enters 6-character pickup token.
    - Collector confirms actual collected weight (scale reading).
    - Atomic transaction: Updates `collection_requests.status = 'collected'`, inserts into `collection_records`, appends to `event_log`.

### Step 2.4: Recovery Facility Management & Transfer
- **Goal:** Track custody transfer from collection vehicle to recovery facility.
- **Files Created:**
  - `app/recovery/page.tsx`:
    - Log handover of collected batch to verified recovery partners (e.g., Cherlapally Eco-Recovery Plant).
    - Log material outcome: % refurbished vs % material recycling recovery.
    - Inserts into `recovery_transfers` and appends to `event_log`.

### Step 2.5: Upgraded Sustainability & Efficiency Dashboard
- **Goal:** Provide comprehensive municipal-level circularity metrics.
- **Files Modified:**
  - `app/dashboard/page.tsx`:
    - Total e-waste diverted (kg) and avoided carbon (kg CO2e).
    - Collection route efficiency: total vehicle-km saved through batching vs individual drop-offs.
    - Zone demand breakdown (HITEC City vs Kukatpally vs Banjara Hills).
    - Circular recovery breakdown (% Refurbished vs % Recycled vs % Component Harvested).
    - Live feed from `event_log`.

---

## Phase 3 (P2) — Advanced Scenarios, Simulation & Polish

### Step 3.1: Dynamic Re-Optimization & Incident Handling
- **Goal:** Handle real-world disruptions gracefully.
- **Features:**
  - Simulate vehicle breakdown: reassign pending stops to neighboring vehicles.
  - Urgent same-day pickup injection: insert high-priority pickup into existing active route with minimal detour insertion.

### Step 3.2: Community Demand Forecasting & Scenario Simulator
- **Goal:** Allow municipal planners to simulate collection policies.
- **Features:**
  - `app/simulator/page.tsx`:
    - Simulate a tech corridor corporate e-waste drive (e.g. +2,000 kg surge in HITEC City).
    - Observe required fleet scaling, projected route miles, and carbon offset.
    - Time-series demand forecasting using moving averages over historical + simulated baseline.

### Step 3.3: Production Hardening, Audit & Polish
- **Features:**
  - Role switcher in navbar (Citizen / Fleet Dispatcher / Field Collector / Facility Admin) for effortless hackathon evaluation.
  - Complete verification tests across all new modules.
  - Final build and deployment validation.
