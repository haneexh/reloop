# PROJECT CONTEXT

## PRODUCT
**RE:LOOP — Intelligent E-Waste Collection & Recovery**

## PROBLEM STATEMENT
**TH2-PS-SD-013 — Community E-Waste Collection Optimizer**

---

## CORE PIPELINE

```
Request
  │ (Citizen schedules pickup with photo intake + verification)
  ▼
Demand
  │ (Aggregates pending requests by weight, category, and urgency)
  ▼
Zones
  │ (Spatial clustering across metropolitan administrative zones)
  ▼
Forecast
  │ (Temporal load projection over upcoming collection cycles)
  ▼
Schedule
  │ (Batches pickups into collection slots and vehicle manifests)
  ▼
Route Optimization
  │ (Deterministic CVRP / TSP route generation with capacity limits)
  ▼
Collection
  │ (Collector execution with interactive navigation & QR scan verification)
  ▼
Recovery
  │ (Custody transfer to certified recycling and refurbishing facilities)
  ▼
Impact
  │ (Live, database-driven environmental diversion & operational metrics)
```

---

## NON-NEGOTIABLE PRINCIPLES

1. **AI only assists item classification:** Generative vision AI is strictly confined to identifying item types, brands, and preliminary physical conditions from uploaded photographs.
2. **AI never chooses routes:** Route planning, sequencing, and vehicle assignment are never delegated to probabilistic LLMs.
3. **Route optimization is deterministic code:** All route calculations are executed by transparent, reproducible algorithms (e.g. Capacitated Vehicle Routing Problem heuristics, Clarke-Wright Savings, Nearest Neighbor with 2-Opt local search).
4. **Every displayed metric must come from database records:** Dashboards and summaries must be directly computed from live database rows.
5. **Synthetic historical data must be labelled simulated:** Any generated historical benchmark or stress-test scenario must be explicitly stamped and displayed with `[SIMULATED]` indicators.
6. **Environmental metrics must be labelled estimates:** Carbon offsets and material diversion figures are calculated using established engineering baselines and must be presented as `estimates`.
7. **Exact household locations must remain private:** Public views and collector previews must truncate or protect exact household locations until authorized pickup windows.
8. **RLS must protect private data:** Row Level Security policies in Supabase must enforce proper role-scoped access control.
9. **Every important state change creates an event_log entry:** State transitions (request created, scheduled, dispatched, collected, transferred) must write an immutable record to `event_log`.
10. **No fake metrics:** No fabricated numbers or arbitrary random KPI generators.
11. **No fake accuracy:** Present confidence scores and bounds truthfully without claiming 100% certainty.
12. **Do not claim mathematical route optimality unless actually proven:** Heuristic solutions (e.g., TSP 2-Opt) must be accurately described as *heuristic optimizations*, not *global mathematical optimums*.
13. **Do not claim real-world environmental impact from simulated data:** Clearly separate actual collected batch impact from simulated scenario forecasts.

---

## REGION & GEOGRAPHY

- **Primary Target Region:** Hyderabad, Telangana, India
- **Demonstration Anchor:** HITEC City / Madhapur (Host Area)
- **Centroid Coordinates:** `17.4486° N, 78.3908° E`
- **Supported Operational Zones:**
  - `ZONE-HYD-01`: HITEC City / Madhapur / Kondapur
  - `ZONE-HYD-02`: Gachibowli / Financial District
  - `ZONE-HYD-03`: Jubilee Hills / Banjara Hills
  - `ZONE-HYD-04`: Kukatpally / KPHB Colony
  - `ZONE-HYD-05`: Secunderabad / Begumpet
  - `ZONE-HYD-06`: Old City / Charminar
- **Facility Hubs:**
  - Cherlapally Industrial Eco-Recovery Plant (`17.4623° N, 78.6012° E`)
  - Deccan Zero-Waste Processors, Jeedimetla (`17.5186° N, 78.4522° E`)
