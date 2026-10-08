# PS-013 Recovery Tracking, Facility Transfers & Sustainability Intelligence

## Architectural Overview

This module completes the circular chain of custody for the Community E-Waste Collection Optimizer:

$$\text{COLLECTED} \xrightarrow{\text{intake}} \text{SORTED} \xrightarrow{\text{batch transfer}} \text{SENT\_TO\_FACILITY} \xrightarrow{\text{material allocation}} \text{RECOVERY\_RECORDED}$$

It establishes certified accounting for mass balance, circular loop retention (refurbishment and component recovery), material smelting/recycling, landfill diversion, and fleet eco-efficiency.

---

## 1. Recovery Facility Model

Facilities are managed using the existing `partners` registry (40 verified facilities across Hyderabad and Bengaluru), mapped into standardized operational facility classifications:

| Facility Type | Partner Type | Core Capabilities | Representative Accepted Categories |
|---|---|---|---|
| **RECYCLER** | `recycler` | High-temperature smelting, hydrometallurgical leaching, circuit board base/precious metal recovery | Mixed E-Waste, PCBs, Cables, Batteries |
| **REFURBISHER** | `refurbisher` | Component testing, board-level repair, SSD/RAM upgrades, circular resale prep | Laptops, Desktops, Smartphones, Monitors |
| **DISMANTLER** | `repair` | Manual de-manufacturing, depollution, hazardous component segregation | Appliances, CRT displays, Audio hardware |
| **MRF** | `informal` | Municipal segregation, shredding, baling, informal scrap sector formalization | General residential e-waste parcels |
| **CHARITY / NGO** | `ngo` | Digital inclusion refurbishment and donation to community schools | Functional IT equipment, tablets, phones |

Each facility record tracks:
- Unique Facility ID (`id`)
- Name & Legal Entity (`name`)
- Facility Type & Operational Capability
- Geospatial Coordinates (`lat`, `lng`) & City
- Verification & Accreditation Status (`verified = true`)

---

## 2. Recovery Transfer Workflow

A recovery transfer links multiple collection records into an auditable consignment batch sent to a licensed downstream partner:

1. **Batch Selection**:
   - The operator (`DISPATCHER` or `FACILITY`) selects unallocated collection records from the database.
   - The system aggregates actual scale weights:
     $$W_{\text{batch}} = \sum_{i=1}^{N} W_{i,\text{actual}}$$
2. **Facility Assignment**:
   - The destination facility is selected from accredited partners.
3. **Consignment Creation**:
   - Persisted to `recovery_transfers`.
   - Linked requests transition to status `sent_to_facility`.
   - Append-only event `SENT_TO_FACILITY` is committed to `event_log`.
4. **Material Allocation & Closure**:
   - When the facility audits the processed lot, recovery percentages (`refurbished_pct`, `recycled_pct`, `residual_pct`) are confirmed.
   - If allocation is 100% complete, linked requests advance to `recovered`.
   - Append-only event `RECOVERY_RECORDED` is committed to `event_log`.

---

## 3. Recovery Allocation & Validation Invariants

### Mass Balance Conservation Invariant

$$\text{Refurbished kg} + \text{Material Recycled kg} + \text{Landfill Residual kg} \le \text{Total Batch kg}$$

$$\text{refurbished\_pct} + \text{recycled\_pct} + \text{residual\_pct} \le 100.0\%$$

### Validation Rules:
1. **Non-Negativity**: $\text{refurbished\_pct} \ge 0$, $\text{recycled\_pct} \ge 0$, $\text{residual\_pct} \ge 0$.
2. **No Over-Allocation**: Any sum $> 100.05\%$ is rejected with HTTP 400 Bad Request.
3. **Incomplete Allocation Visibility**: If the allocation sum is $< 100\%$, the UI explicitly identifies the remaining lot as **Awaiting Processing / Unallocated** rather than silently assuming it went to landfill.
4. **No Over-Transfer**: A transfer batch cannot claim more kilograms than was recorded on digital scales at collection.

---

## 4. End-to-End Traceability Chain

$$\begin{aligned}
\text{collection\_request} &\xrightarrow{\text{assigned}} \text{collection\_route} \\
&\xrightarrow{\text{pickup}} \text{collection\_record} \\
&\xrightarrow{\text{consignment}} \text{recovery\_transfers} \\
&\xrightarrow{\text{audit}} \text{event\_log}
\end{aligned}$$

Every state transition is timestamped and auditable. Public tracking users querying `/track/[token]` observe high-level milestones:
`Requested → Scheduled → Assigned → Collected → Weighed → Sent to Facility → Recovered`.

---

## 5. Sustainability Intelligence Formulas

All metrics computed in `lib/sustainability-engine.ts` are derived directly from live database tables:

1. **Recovery Rate (%)**:
   $$\text{Recovery Rate} = \frac{W_{\text{recovered}} + W_{\text{recycled}}}{W_{\text{collected}}} \times 100$$
2. **Landfill Diversion (kg & %)**:
   $$W_{\text{diverted}} = \max(0, W_{\text{collected}} - W_{\text{residual}})$$
   $$\text{Diversion Rate} = \frac{W_{\text{diverted}}}{W_{\text{collected}}} \times 100$$
3. **Collection Completion Rate (%)**:
   $$\text{Completion Rate} = \frac{N_{\text{collected}}}{N_{\text{scheduled}}} \times 100$$
4. **Collection Efficiency (kg/km)**:
   $$\text{Efficiency} = \frac{W_{\text{collected}}}{\text{Total Route Distance (km)}}$$
5. **Vehicle Capacity Utilization (%)**:
   $$\text{Utilization} = \frac{W_{\text{assigned}}}{\text{Vehicle Capacity (kg)}} \times 100$$
6. **Average Pickup Lead Time**:
   $$\text{Lead Time} = \frac{1}{N} \sum (T_{\text{verified}} - T_{\text{request\_created}})$$

### Zero-Denominator Safety
Every formula incorporates defensive bounds: empty database sets or zero distances evaluate to `0.0` with guaranteed finite numeric outputs (never `NaN` or `Infinity`).

---

## 6. Modeled Environmental Estimates

In compliance with hackathon transparency guidelines, all environmental impact metrics are explicitly flagged as **ESTIMATE**:

- **CO₂e Emissions Avoided (kg)**:
  - Modeled based on secondary lifecycle assessments (LCA):
    - Refurbished/reused electronics: $\sim 45.0\text{ kg CO}_2\text{e per kg}$ embodied footprint avoided.
    - Recycled base and precious metals: $\sim 12.5\text{ kg CO}_2\text{e per kg}$ avoided vs virgin ore smelting.
- **Landfill Volume Saved (m³)**:
  - Modeled based on average municipal uncompacted electronic scrap density:
    $$V_{\text{landfill}} = \frac{W_{\text{diverted}}}{250.0\text{ kg/m}^3}$$

---

## 7. Real Platform Records vs. Simulated Demo Data

The sustainability engine strictly isolates genuine citizen requests from simulated demo records:
- `collection_requests.is_simulated = false` denotes real citizen entries.
- `collection_requests.is_simulated = true` denotes simulated municipal test batches.
- Both the executive dashboard and API report `real_requests_count` and `simulated_requests_count` side-by-side.

---

## 8. Role-Based Access Control & Security

- **Server-Side Authorization Boundary**:
  - `FACILITY`: Permitted to view transfers and submit recovery breakdown allocations.
  - `DISPATCHER`: Permitted to create transfers, assign routes, and manage batches.
  - `ADMIN`: Unrestricted operational control.
  - `CITIZEN`: Read-only public tracking; strictly prohibited from creating or modifying transfers or event logs (HTTP 403 Forbidden).
- **Public Impact View**: Exposes aggregate counts and percentages only. Citizen names, phone numbers, exact addresses, GPS coordinates, and private operational notes are never exposed.
