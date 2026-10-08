# PS-013 Product UX Audit & Design System Architecture
**Problem Statement:** TH2-PS-SD-013 — Community E-Waste Collection Optimizer  
**Project:** RE:LOOP  
**Stage:** Part 1/5 — Foundational Product UX Audit & Information Architecture  
**Audit Date:** October 8, 2026  

---

## 1. Executive UX Audit Summary
While RE:LOOP is functionally and technically complete (85/85 tests passing, robust CVRP optimizer, real scale verification, complete circular mass-balance ledger), the visual presentation exhibits several legacy prototype traits:
1. **Audience Conflation in Navigation:** Public citizen users are presented with a jumbled flat navigation bar showing operational tools (`Dispatch Ops`, `Collector Ops`, `Recovery & Impact`) right alongside citizen actions (`Schedule Pickup`).
2. **Lack of Reusable Component Primitives:** Pages construct raw HTML buttons, cards, and form inputs inline with varying padding, font sizes, and borders.
3. **Raw Technical Identifiers in Public Views:** Internal codes (`ZONE-HYD-01`, raw database timestamps, raw status keys like `sent_to_facility`) occasionally appear where human civic terminology is needed.
4. **Visual Hierarchy & Clutter:** The homepage mixes legacy circularity theory ("6 possible futures", PP-RI scoring) with the core municipal doorstep collection service.
5. **Form Usability & Cognitive Load:** Dense inputs on `/request` and `/collector` lack standardized spacing, clear field groupings, and consistent microcopy.

**All identified UX issues can be resolved entirely within the frontend presentation layer without touching any backend logic, database schemas, or API contracts.**

---

## 2. Page-by-Page UX Audit & Recommendations

| # | Page / Area | Current UX Problem | Severity | Recommended Solution | Frontend-Only? |
|---|---|---|---|---|:---:|
| **1** | **Global Header & Navigation** (`app/layout.tsx`) | Single flat nav row mixes citizen actions (`Schedule Pickup`) with internal tools (`Dispatch Ops`, `Collector Ops`, `Recovery & Impact`). On mobile, links wrap awkwardly. | **HIGH** | Separate into **Public** (Home, Schedule Pickup, Track Pickup) and **Operations** (Dispatch, Collector, Recovery & Impact) with a clean modal/popover or secondary header toggle, plus an accessible mobile drawer. | **YES** |
| **2** | **Home Page** (`app/page.tsx`) | Hero emphasizes product photo assessment rather than doorstep e-waste pickup. 4 competing CTA buttons create decision paralysis. | **HIGH** | Re-anchor hero around municipal doorstep collection with one clear primary action ("Schedule Doorstep Pickup") and one secondary action ("Track Pickup"). Present "How It Works" in 4 clear civic steps, then showcase the circular destination ecosystem. | **YES** |
| **3** | **Citizen Request Intake** (`app/request/page.tsx`) | Dense multi-step form with inline styling. Zone selection shows technical IDs (`ZONE-HYD-01`). Technical file upload and manual coordinate displays look raw. | **MEDIUM** | Standardize into a clean 4-step progressive stepper with unified Card, Input, and Button primitives. Surface friendly locality names ("HITEC City / Madhapur") instead of zone codes. | **YES** |
| **4** | **Public Request Tracking** (`app/track/[token]/page.tsx`) | Functional timeline, but status language is somewhat technical (`weighed`, `sent_to_facility`), and tracking code lacks a 1-click copy action. | **MEDIUM** | Transform into a clean parcel/consignment delivery tracker with humanized status badges, one-click copy button, and simplified timeline cards. | **YES** |
| **5** | **Operations Dispatch** (`app/dispatch/page.tsx`) | High visual density. Planning controls, demand lists, and route maps compete for attention. Technical loading text ("Initializing Leaflet Tactical Route Engine..."). | **MEDIUM** | Organize into clear operational panels: Demand Overview, Fleet Scheduling, and Route Optimization with standardized typography, calm status pills, and cleaner map framing. | **YES** |
| **6** | **Collector Mobile Interface** (`app/collector/page.tsx`) | Dense UI for a mobile field workflow. Small touch targets for verification modals. Technical variance calculations look raw. | **MEDIUM** | Emphasize large touch targets (minimum 44x44px), clear step-by-step checklist cards for stops, high-contrast QR scanner toggle, and clean scale verification inputs. | **YES** |
| **7** | **Recovery & Sustainability Dashboard** (`app/dashboard/page.tsx`) | 4-tab interface is technically rich, but metric cards have varying border treatments, and seed data warning banner could be cleaner. | **LOW** | Consolidate into standardized metric cards, clear mass balance comparison visualizer, and polished role indicator. | **YES** |
| **8** | **Status & State Language** (Global) | Backend enum keys (`pending`, `scheduled`, `assigned`, `collected`, `sent_to_facility`, `recovered`) rendered verbatim in some tables. | **MEDIUM** | Create a central `StatusBadge` and human-readable translation utility layer (`lib/status-helper.ts`). | **YES** |

---

## 3. Information Architecture (IA) Specification

### Primary Public Experience (Citizen)
1. **Home (`/`)**: Service introduction, municipal trust anchor, clear CTA to book pickup, quick tracking search.
2. **Schedule Pickup (`/request`)**: Streamlined 4-step intake (Items $\rightarrow$ Location $\rightarrow$ Time Slot $\rightarrow$ Confirmation).
3. **Track Pickup (`/track/[token]`)**: Real-time status tracker, appointment details, verified scale weight, recovery facility destination.
4. **How It Works**: Accessible from Home and header, explaining the municipal collection lifecycle in citizen terms.

### Operations Hub (Municipal Staff / Evaluators)
1. **Dispatch Operations (`/dispatch`)**:
   - Spatial Demand Heatmaps & Run-Rate Load Projections
   - Fleet Capacity Allocation
   - Capacity-Aware Route Optimizer (CVRP Nearest-Neighbor + 2-Opt)
2. **Collector Mobile Interface (`/collector`)**:
   - Active Vehicle Route Manifest
   - Doorstep QR Code Scanner & Manual Token Verification
   - Digital Scale Weight Entry & Overload Protection
3. **Recovery & Impact Dashboard (`/dashboard`)**:
   - Circular Mass Balance (Refurbished vs Recycled vs Residual)
   - Certified Facility Consignment Ledger
   - Eco-Fleet Efficiency ($\text{kg/km}$, capacity utilization, avoided mileage)
   - Real vs Simulated Data Transparency

### Supporting & Exploratory
1. **Item Assessment (`/analyze`)**: Vision AI circular assessment sandbox (Repair vs Reuse vs Refurbish vs Recycle).
2. **Destination Directory (`/destinations`)**: Interactive Leaflet map of 40 verified Indian recycling and repair nodes.
3. **Policies (`/privacy`, `/terms`)**: Data minimization and civic service guidelines.

---

## 4. Design System Tokens & Style Guide

### 4.1. Philosophy: Civic Utility & Restrained Precision
- **No Vibe-Coded Trappings:** No purple/violet gradients, no glassmorphism blur layers, no floating neon blobs, no pill-shaped buttons, no emoji icons, no fake counters.
- **Visual Feel:** Resembles high-grade municipal services (like UK Gov.uk, Swiss Post, or Singapore GovTech) paired with a modern linear precision tool.

### 4.2. Color Palette
| Token Name | Hex Code | Usage |
|---|---|---|
| `bg` | `#f4f5f1` | Warm canvas / paper background |
| `surface` | `#ffffff` | Primary container background |
| `surface-subtle` | `#e9ede7` | Secondary card background, subtle headers |
| `ink` | `#151817` | High-contrast primary text, headings |
| `ink-muted` | `#6b746e` | Secondary metadata, captions, helper text |
| `border` | `#d8ddd7` | Crisp divider and container border |
| `forest` (Primary) | `#2e7d57` | Primary action button, active state, success |
| `forest-dark` | `#173d2c` | Hero backgrounds, primary branding mark |
| `forest-light` | `#e6f2e8` | Active badge background, light highlights |
| `amber` (Warning) | `#b7791f` | Pending review, scheduled status |
| `rust` (Critical) | `#a3512b` | Capacity exceeded, deferral, high urgency |

### 4.3. Typography
- **Headings & Display:** `Space Grotesk`, sans-serif (Clean geometric neo-grotesque, weights: 500, 600, 700).
- **Body & Controls:** `Inter`, system-ui, sans-serif (High legibility, weights: 400, 500, 600).
- **Technical Codes & Tabular Data:** Monospace (`SFMono-Regular`, `Consolas`, `monospace`) exclusively for tracking tokens (`RLP-HYD-XXXX`), weights, and coordinates.

### 4.4. Component Geometry
- **Border Radius:** `2px` to `4px` maximum. Never `rounded-full` (no pill buttons).
- **Borders:** Crisp `1px solid #d8ddd7`.
- **Shadows:** Minimal to none (`shadow-none` or `shadow-sm` on elevated modals). Structural depth created via color borders and contrast rather than heavy drop shadows.

---

## 5. Standardized Status Language Mapping
Centralized frontend mapping layer converting raw backend database enums into human-centered civic terminology:

| Database Status | Civic UI Label | Semantic Badge Type | Citizen Context |
|---|---|---|---|
| `pending` | **Pickup Requested** | Neutral / Amber | Logged in municipal registry, awaiting dispatch |
| `scheduled` | **Pickup Scheduled** | Information | Assigned to upcoming collection cycle |
| `assigned` | **Collector Assigned** | Information | Vehicle manifest confirmed, driver en route |
| `in_progress` | **Route In Progress** | Accent | Driver currently collecting in zone |
| `collected` | **E-Waste Collected** | Success | Doorstep handover verified at physical scale |
| `sent_to_facility` | **Dispatched to Facility** | Accent | En route to certified recycler / refurbisher |
| `recovered` | **Recovery Completed** | Success | Materials processed, mass balance recorded |
| `cancelled` | **Request Cancelled** | Neutral | Cancelled by citizen or operations |
| `deferred` | **Pickup Rescheduled** | Warning | Deferred due to capacity / access constraints |

---

## 6. Implementation Plan for Foundational Design System (Part 1)
1. **Create Base UI Primitives (`components/ui/`):**
   - `Button.tsx` (primary, secondary, outline, danger)
   - `Badge.tsx` (neutral, success, warning, danger, info)
   - `Card.tsx` (standard structural card with header and body)
   - `Input.tsx` (text, select, textarea with consistent focus rings)
2. **Create Status Helper (`lib/status-helper.ts`):**
   - Central translation and badge color resolution.
3. **Refactor Global Navigation (`components/Navigation.tsx` & `app/layout.tsx`):**
   - Clear separation between **Public Citizen** and **Municipal Operations** navigation.
   - Clean mobile responsive drawer.
   - Elimination of cluttered inline header links.
4. **Run All Quality Gates:**
   - Typecheck, unit tests, lint, and build.
