# PS-013 Citizen E-Waste Collection Request Flow & Lifecycle Tracking

**Problem Statement:** TH2-PS-SD-013 (Community E-Waste Collection Optimizer)  
**Implementation Phase:** Prompt 3 — Citizen Intake & Digital Chain-of-Custody  
**Connected Live Database:** Supabase (`pebyjnafwmhbkngcrhmb.supabase.co`)  
**Status:** Implemented, Tested (33/33 tests passing), Linted & Production Build Verified  

---

## 1. Overview & Architecture

The Citizen Request Flow enables residents of the Greater Hyderabad Metropolitan Area to schedule doorstep e-waste collection through a certified municipal chain-of-custody workflow. The solution connects directly to the live PS-013 database foundation established in Prompt 2 while preserving all existing legacy RE:LOOP features.

### Key Flow Diagram

```
[ Citizen Device ]
        │
        ├─► 1. Capture / Upload Photo ──► [/api/analyze-image] (Electronics Gate + Classification)
        │
        ├─► 2. Verify Manifest ─────────► [Taxonomy Mapper] (Weight, Age, Regulated Hazards)
        │
        ├─► 3. Geolocation & Address ───► [Zone Resolver] (Haversine Centroid Proximity to 10 Zones)
        │
        ├─► 4. Schedule Slot ───────────► Validation (Min date = Today, Window = 09-12 / 12-15 / 15-18)
        │
        └─► 5. Atomic Submit ───────────► [/api/requests]
                                                 │
                                                 ├─► INSERT collection_requests (status='pending', qr_token)
                                                 ├─► INSERT items (linking request_id)
                                                 └─► INSERT event_log (append-only audit, actor='CITIZEN')
                                                 │
                                                 ▼
                                        [ Client Confirmation ]
                                        - Rendered QR Pass (toDataURL)
                                        - Public Tracking URL: /track/[token]
```

---

## 2. Implemented Components

### 2.1 E-Waste Taxonomy & Hazard Classifier (`lib/taxonomy-mapper.ts`)
- Maps user-entered or AI-detected devices to an official 14-category municipal e-waste taxonomy.
- Categorizes items into 4 functional groups:
  - *IT & Computing* (Laptops, Desktops, Smartphones, Tablets, Printers, Feature Phones, Landlines)
  - *Consumer & Displays* (CRT TVs, CRT Monitors, Media Players, Audio/Stereo, Cameras)
  - *Small Appliances* (Microwaves, Mixers, Toasters, etc.)
  - *Accessories & Peripherals* (Cables, Chargers, Adapters)
- Automatically annotates regulated hazard risks (e.g. *Lithium-ion Battery*, *Lead Glass*, *High Voltage Vacuum Tube*, *Transformer Oils*, *Toner Residue*).
- Supplies standard baseline weight estimates and life cycle parameters.

### 2.2 Municipal Zone Resolver (`lib/zone-resolver.ts`)
- Implements Haversine spherical distance calculation between coordinates.
- Dynamically queries `collection_zones` from the live Supabase database with fallback to the 10 seeded Hyderabad municipal zones:
  1. `ZONE-HYD-01`: HITEC City & Madhapur (4.5 km radius)
  2. `ZONE-HYD-02`: Gachibowli & Financial District (5.0 km radius)
  3. `ZONE-HYD-03`: Kondapur & Botanical Garden (4.0 km radius)
  4. `ZONE-HYD-04`: Jubilee Hills & Film Nagar (4.5 km radius)
  5. `ZONE-HYD-05`: Banjara Hills & Somajiguda (4.5 km radius)
  6. `ZONE-HYD-06`: Kukatpally & KPHB Colony (5.0 km radius)
  7. `ZONE-HYD-07`: Begumpet & Ameerpet (4.0 km radius)
  8. `ZONE-HYD-08`: Secunderabad & Paradise (5.0 km radius)
  9. `ZONE-HYD-09`: Charminar & Old City (5.5 km radius)
  10. `ZONE-HYD-10`: Uppal & Habsiguda (6.0 km radius)
- Determines closest municipal centroid and evaluates if coordinates fall within designated service radii.

### 2.3 Server API (`app/api/requests/route.ts`)
- **`POST` Endpoint:**
  - Validates contact phone (minimum 7 characters).
  - Validates full address (minimum 5 characters).
  - Validates pickup date (disallows past dates).
  - Validates manifest items (requires at least 1 item).
  - Automatically resolves closest municipal zone if not manually designated.
  - Generates cryptographic token `RLP-HYD-[A-F0-9]{8}`.
  - Performs atomic inserts into `collection_requests` (`status = 'pending'`, `priority = 'normal'`).
  - Inserts child records into `items` with foreign key `request_id`.
  - Appends audit event `REQUEST_CREATED` into `event_log` without storing sensitive PII in the JSON payload.
- **`GET` Endpoint:**
  - Secure public tracking lookup via `?token=...` or `?id=...`.
  - Strict privacy boundary: Masked address returns only the locality and city (`[Locality], Hyderabad`), completely omitting flat numbers, house numbers, or building identifiers.
  - Redacts citizen phone numbers and private access notes.
  - Returns request details, zone profile, manifest items, and certified weighment records.

### 2.4 Citizen Intake Portal (`app/request/page.tsx`)
- 5-step intuitive intake experience:
  1. **Item Manifest:** Multi-item intake with optional camera/photo upload, AI classification via `/api/analyze-image`, strict non-electronics gate notice, physical condition selector, and hazard indicators.
  2. **Location:** Browser GPS geolocation button with live Haversine distance feedback to nearest municipal cluster + manual dropdown selector across all 10 zones.
  3. **Schedule & Contact:** Name, validated phone, datepicker (min = today), and radio time windows (`09:00 - 12:00`, `12:00 - 15:00`, `15:00 - 18:00`).
  4. **Review:** Clear logistics review, forecast circular impact metrics (E-waste diverted kg, CO₂e abated kg).
  5. **Confirmation & QR Pass:** Client-rendered SVG/Canvas QR pass (using `qrcode`), download pass link, print option, and direct link to live tracking.

### 2.5 Public Custody Tracker (`app/track/[token]/page.tsx`)
- Displays live status stepper across 7 lifecycle stages:
  1. *Requested* (Logged in registry)
  2. *Scheduled* (Route planned)
  3. *Assigned* (Vehicle & collector allocated)
  4. *Collected* (Handover verified at doorstep)
  5. *Weighed* (Certified digital scale audit)
  6. *Sent to Facility* (Dispatched to accredited recycler)
  7. *Recovered* (Materials extracted / refurbished)
- Shows verified scale weights from `collection_records` when verified by collectors.
- Displays full manifest summary and printable custody receipt.

---

## 3. Verification & Test Results

### 3.1 Automated Test Suite
```bash
npm test
```
- **33/33 Tests Passing** across 4 test suites:
  - `tests/citizenRequest.test.ts`:
    - Taxonomy definitions & positive weights check (PASS)
    - Smartphone variants taxonomy resolution (PASS)
    - Laptop and PC variants resolution (PASS)
    - Hazardous legacy CRT displays resolution (PASS)
    - Fallback baseline for unlisted electronics (PASS)
    - Haversine distance accuracy (PASS)
    - Cyber Towers coordinate resolution to `ZONE-HYD-01` (PASS)
    - Financial District coordinate resolution to `ZONE-HYD-02` (PASS)
    - Secunderabad coordinate resolution to `ZONE-HYD-08` (PASS)
    - Street address masking for privacy safety (PASS)
    - Token format specification regex (PASS)
  - `tests/decisionEngine.test.ts`: 14 tests passing.
  - `tests/osmDestinations.test.ts`: 7 tests passing.

### 3.2 Code Quality & Static Analysis
- `npm run typecheck`: **0 errors** (`tsc --noEmit` clean).
- `npm run lint`: **0 warnings, 0 errors** (`next lint` clean).
- `npm run build`: **Compiled successfully** (13/13 routes generated, `/request` and `/track/[token]` integrated).

### 3.3 Live Supabase Database Verification
- Script `scripts/test_citizen_request_api.mjs` executed directly against `pebyjnafwmhbkngcrhmb.supabase.co`:
  - Created test collection request with ID and token.
  - Inserted 2 manifest items linked to `request_id`.
  - Appended `REQUEST_CREATED` audit event to `event_log`.
  - Verified public area masked safely to `HITEC City, Hyderabad`.
  - Successfully rolled back test records, preserving exact baseline table counts (`partners` = 40, `items` = 23, `recommendations` = 23).
