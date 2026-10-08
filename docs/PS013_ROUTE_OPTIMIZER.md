# PS-013 Route Optimization Engine & Baseline Evaluation

**Module:** [`lib/route-optimizer.ts`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/lib/route-optimizer.ts)  
**Map Component:** [`components/DispatchRouteMap.tsx`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/components/DispatchRouteMap.tsx)  
**Operator Interface:** [`app/dispatch/page.tsx`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/app/dispatch/page.tsx)  
**Problem Statement:** TH2-PS-SD-013 (Community E-Waste Collection Optimizer)  

---

## 1. Algorithm Design & Heuristic Architecture

The Route Optimization Engine is a deterministic capacity-aware routing solver for municipal collection vehicles. It operates without external routing APIs or cloud solver dependencies.

### Heuristic Pipeline

```
1. Input: Assigned Stops for Vehicle + Vehicle Depot (Lat/Lng)
   │
   ▼
2. Baseline Construction (Raw FIFO / Submission Order)
   Tour: Depot ──► Stop 1 ──► Stop 2 ──► ... ──► Stop N ──► Depot
   │
   ▼
3. Nearest-Neighbor Tour Construction (Initial Feasible Solution)
   Greedy selection of closest unvisited collection point from current location.
   │
   ▼
4. 2-Opt Local Search (Tour Inversion)
   Iteratively reverses sub-paths [i, j] if Δ distance < 0.
   │
   ▼
5. Relocate / Or-Opt Improvement
   Tests reinserting individual collection stops at alternative tour positions.
   │
   ▼
6. Validation & Honest Baseline Comparison
   If optimized distance < baseline: adopt optimized tour.
   Else: report baseline honestly (distance_saved = 0).
```

---

## 2. Distance Metric & Limitations

- **Distance Metric:** Great-circle distance computed via the **Haversine formula** using WGS84 earth radius ($R = 6371\text{ km}$).
- **Labeling Standard:** All outputs and UI components explicitly label distances as:
  > *"Estimated route distance (Haversine)*"
- **Cycle Time Model:**
  $$\text{Cycle Duration (mins)} = \text{round}\left( \frac{\text{Distance (km)}}{25.0\text{ km/h}} \times 60 + (\text{Stops Count} \times 12\text{ mins}) \right)$$
  - Assumes typical urban transit velocity of $25\text{ km/h}$ in Hyderabad traffic.
  - Adds $12\text{ minutes}$ handling time per household handover (scale setup, digital weighing, manifest check).

---

## 3. Baseline Comparison & Operational Metrics

Every generated route computes an unsequenced baseline for direct comparison:
- `baseline_distance_km`: Round-trip distance visiting stops in original submission order.
- `optimized_distance_km`: Final distance after Nearest Neighbor + 2-opt + Relocate.
- `distance_saved_km`: $\max(0, \text{baseline} - \text{optimized})$.
- `distance_reduction_percent`: Percentage savings achieved.
- `capacity_utilization_percent`: $\frac{\text{total\_load\_kg}}{\text{vehicle.capacity\_kg}} \times 100\%$.

---

## 4. Brute-Force Small-Case Validation

To verify the heuristic without relying on ungrounded optimality claims, the test suite includes a brute-force validator:
- Evaluates a 4-stop instance by enumerating all $4! = 24$ complete round-trip permutations.
- Identifies the true global minimum tour distance starting and ending at the depot.
- Compares the heuristic output against the global minimum:
  $$\text{Heuristic Distance} \le \text{Global Minimum} \times 1.05$$
- **Result:** In automated unit tests (`tests/routeOptimizer.test.ts`), the heuristic consistently matches the global minimum.
