# PS-013 Collection Scheduler & Capacity Fleet Allocation

**Module:** [`lib/scheduler.ts`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/lib/scheduler.ts)  
**Fleet Module:** [`lib/fleet-engine.ts`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/lib/fleet-engine.ts)  
**Problem Statement:** TH2-PS-SD-013 (Community E-Waste Collection Optimizer)  

---

## 1. Overview & Objectives

The Collection Scheduler performs capacity-aware matching of pending community collection requests to the available municipal vehicle fleet. It enforces physical payload limitations, prioritizes safety risks, and provides complete traceability for every request.

**Core Invariant:** No collection request is ever silently dropped. Every evaluated request either receives a vehicle assignment or is logged as deferred with an explicit reason code and recommended remediation.

---

## 2. Priority Ordering Logic

Requests are ordered deterministically before vehicle assignment using a multi-tiered comparator:

1. **Safety Priority Rank:**
   - `urgent` (Rank 4): Immediate safety threats (e.g. leaking battery, sparking CRT).
   - `high` (Rank 3): Regulated commercial or bulky volume.
   - `normal` (Rank 2): Standard domestic intake.
   - `low` (Rank 1): Minor accessories or voluntary drop-offs.
2. **Date / Backlog Priority:**
   - Overdue backlogs (`pickup_date <= planning_date`) receive immediate precedence over future bookings.
3. **Payload Weight (Descending):**
   - Heuristic greedy bin packing: larger parcels are seated first to maximize vehicle space utilization.
4. **Stable Identifier:**
   - Ties broken deterministically by `id.localeCompare`.

---

## 3. Fleet Capacity Verification

The fleet manager reads active units from the `vehicles` table:
- Only vehicles with `status = 'available'` are considered.
- Units marked `maintenance` or `inactive` are strictly excluded from assignment.

### Cluster-Aware Bin Packing
When assigning an ordered request to an available vehicle:
1. Candidate vehicles must satisfy:
   $$\text{current\_assigned\_load\_kg} + \text{request\_weight\_kg} \le \text{vehicle.capacity\_kg}$$
2. Among candidate vehicles with capacity, the vehicle with the closest spatial proximity (from depot or its last assigned stop) to the request is chosen.
3. If no available vehicle has sufficient remaining capacity, the request is recorded as deferred.

---

## 4. Deferral Taxonomy & Explanations

| Deferral Reason | Condition | Suggested Municipal Action |
|---|---|---|
| `VEHICLE_CAPACITY_EXCEEDED` | Request weight exceeds remaining payload across all available vehicles. | Dispatch additional fleet unit or schedule evening overflow round. |
| `NO_AVAILABLE_VEHICLE` | Zero vehicles in fleet are in `available` status. | Release vehicle from depot maintenance or reallocate cross-zone van. |
| `TIME_WINDOW_CONFLICT` | Citizen selected time slot incompatible with active batch window. | Group request into corresponding slot dispatch run. |
| `OUTSIDE_PLANNING_HORIZON` | Requested date is beyond planning window threshold (> +2 days). | Retain in registry for next dispatch cycle. |
| `INVALID_LOCATION` | Request coordinates are null or NaN. | Contact resident to verify doorstep street address. |
