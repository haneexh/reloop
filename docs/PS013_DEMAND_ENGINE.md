# PS-013 Demand Intelligence & Forecasting Engine

**Module:** [`lib/demand-engine.ts`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/lib/demand-engine.ts)  
**Endpoint:** [`/api/demand`](file:///c:/Users/chila/OneDrive/Desktop/ReLoop/app/api/demand/route.ts)  
**Problem Statement:** TH2-PS-SD-013 (Community E-Waste Collection Optimizer)  

---

## 1. Design Principles & Determinism

The Demand Intelligence Engine analyzes community collection requests across Greater Hyderabad to forecast e-waste inflow density and highlight priority zones for municipal fleet dispatch.

Key engineering constraints:
1. **Pure TypeScript Determinism:** No external machine learning models, cloud forecasting APIs, or non-deterministic heuristics. Every score and forecast can be reproduced with mathematical certainty.
2. **Explicit Formula Transparency:** Scoring constants are centralized in `DEMAND_SCORING_WEIGHTS` with clear operational rationale.
3. **Real vs. Simulated Data Separation:** All queries and outputs strictly separate real citizen requests (`is_simulated = false`) from seeded scenario records (`is_simulated = true`).
4. **Strict Privacy Boundary:** The `/api/demand` endpoint serves only aggregated, zone-level intelligence. Citizen phone numbers, street names, flat numbers, notes, and QR tokens are never returned.

---

## 2. Demand Scoring Formula

For each municipal collection zone, a composite demand score is computed from four operational dimensions:

$$\text{demand\_score} = (N \cdot W_{\text{VOL}}) + (M \cdot W_{\text{KG}}) + P_{\text{PRIORITY}} + R_{\text{RECENCY}}$$

### Centralized Parameters (`DEMAND_SCORING_WEIGHTS`)

| Constant | Value | Description & Rationale |
|---|---|---|
| `volumeWeight` ($W_{\text{VOL}}$) | `10.0` | Points per collection request. Reflects vehicle stop overhead. |
| `weightKgWeight` ($W_{\text{KG}}$) | `1.5` | Points per estimated kg of e-waste. Reflects fleet payload pressure. |
| `urgentPriorityBonus` | `25.0` | Additional points per urgent request (e.g. swollen Li-ion batteries). |
| `highPriorityBonus` | `15.0` | Additional points per high-priority request. |
| `recencyWindowHours` | `24` | Cutoff window for recent submission bonus. |
| `recencyBonus` | `10.0` | Points awarded if the zone has new requests within 24 hours. |

### Discrete Demand Level Categorization

| Demand Level | Threshold Criteria | Action Directive |
|---|---|---|
| **CRITICAL** | `urgent_count >= 1` OR `demand_score >= 150` OR `total_weight_kg >= 100` | Immediate dispatch priority; safety hazards present. |
| **HIGH** | `demand_score >= 80` OR `request_count >= 5` OR `total_weight_kg >= 50` | Include in current planning cycle batch. |
| **MEDIUM** | `demand_score >= 30` OR `request_count >= 2` | Scheduled within 24–48 hours. |
| **LOW** | `demand_score < 30` | Regular route monitoring active. |

---

## 3. Spatial Aggregation

Spatial aggregation groups all actionable requests (`status IN ('pending', 'scheduled', 'assigned')`) by their assigned municipal zone:

- `request_count`: Total active collection stops in zone.
- `total_estimated_weight_kg`: Summed payload mass from linked item manifests.
- `average_request_weight_kg`: Mean weight per stop.
- `urgent_count` & `high_priority_count`: Safety and SLA escalation counts.
- `real_request_count` vs `simulated_request_count`: Source breakdown.
- `latest_request_at`: Timestamp of most recent resident submission.

---

## 4. Temporal Aggregation

Aggregates demand along temporal horizons:
- **By Date:** Daily request volumes, total kg, and real vs. simulated counts.
- **By Pickup Slot:** Distribution across standard dispatch windows (`09:00 - 12:00`, `12:00 - 15:00`, `15:00 - 18:00`).
- **By Weekday:** 7-day cyclical distribution pattern across days of the week.

---

## 5. Demand Forecasting & Explainability

Rather than using black-box neural networks without trained weights, the engine employs a deterministic backlog-and-rate forecast:

$$\text{Forecast Volume} = \text{pending\_count} + \max\left(0, \left\lfloor \frac{\text{demand\_score}}{40} \right\rceil\right)$$
$$\text{Forecast Mass (kg)} = \text{Forecast Volume} \times \max(6.0, \text{average\_request\_weight\_kg})$$

### Human-Understandable Explanations
Every forecast outputs an explanation for municipal supervisors. Example:
> *"HIGH demand in HITEC City & Madhapur with 5 active requests (28.4 kg estimated load) including 1 high-priority item(s) requiring dispatch scheduling across 4 pending locations."*
