# PS-013 Collector Operations, QR Pickup Verification & Traceable Collection

## Architectural Overview

This module provides field collectors with a mobile-first digital workflow for executing verified e-waste pickups on assigned collection routes. It establishes an unbroken, cryptographically auditable Chain of Custody:

$$\text{collection\_request} \xrightarrow{\text{assigned to}} \text{collection\_route} \xrightarrow{\text{verified at doorstep}} \text{collection\_record} \xrightarrow{\text{append audit}} \text{event\_log}$$

---

## 1. Collector Field Workflow

1. **Route Selection**:
   - The field collector opens `/collector` on their mobile device or in-cab tablet.
   - The collector selects their active route for the day (e.g., `EV-VAN-01` in `ZONE-HYD-01`).
   - The system retrieves all assigned stops, depot coordinates, scheduled time windows, item manifest summaries, and live database progress.
2. **Sequential Execution**:
   - The interface spotlights the **Current Active Pickup** (the first uncollected stop in the optimized tour sequence).
   - If starting the shift, the collector clicks **Start Route**, which updates `collection_routes.status` to `in_progress` and logs `ROUTE_STARTED`.
3. **Doorstep Handover**:
   - Upon arriving at the citizen's location, the collector taps **Scan QR / Verify Pickup**.
   - The camera viewfinder activates or the collector inputs the citizen's QR token (e.g., `RLP-HYD-ABCD`).
4. **Scale Weighment & Capacity Check**:
   - The collector places items on the vehicle's certified digital scale.
   - The actual weight is entered into the collector interface.
   - The system checks remaining vehicle capacity:
     $$\text{current\_loaded\_kg} + \text{actual\_weight\_kg} \le \text{vehicle.capacity\_kg}$$
   - Any capacity violation triggers an immediate, non-bypassable rejection.
5. **Confirmation & Persistence**:
   - Tapping **Confirm Pickup & Weighment** securely commits the collection record, transitions request status to `collected`, and appends immutable audit events to `event_log`.

---

## 2. QR Token Verification

- **Token Format**: Standardized high-entropy format generated at citizen intake (e.g., `RLP-HYD-XXXX` or legacy `QR-REQ-HYD-XXX`).
- **Scanning Methods**:
  1. **Live Camera Scanner**: Client-side QR decoding using `jsQR` over an HTML5 `<video>` feed. Zero cloud dependency.
  2. **Manual Input Fallback**: Immediate fallback input field if camera access is denied, unsupported, or damaged.
- **Verification Invariants**:
  - The scanned token must resolve to a valid `collection_requests` row.
  - The request ID **must** appear in the active route's `stops_json` manifest.
  - Cross-route collection is strictly prevented (HTTP 403 `NOT_ON_ROUTE`).

---

## 3. Actual Weight Recording & Variance

- **Validation Rules**:
  - Value must be numeric, finite, and $> 0.0\text{ kg}$.
  - Physical sanity bound: $\le 1000.0\text{ kg}$ per single residential stop.
  - Cannot exceed vehicle remaining payload capacity.
- **Explainable Variance**:
  $$\Delta W = W_{\text{actual}} - W_{\text{estimated}}$$
  $$\% \text{ Variance} = \frac{W_{\text{actual}} - W_{\text{estimated}}}{W_{\text{estimated}}} \times 100$$
  - The UI and audit logs preserve both $W_{\text{estimated}}$ and $W_{\text{actual}}$ side-by-side without overwriting intake figures.

---

## 4. Lifecycle State Transitions

$$\text{REQUESTED (pending)} \longrightarrow \text{SCHEDULED} \longrightarrow \text{ASSIGNED} \longrightarrow \text{COLLECTED} \longrightarrow \text{WEIGHED}$$

- When a collector records the pickup:
  - `collection_requests.status` transitions from `assigned` (or `scheduled`) to `collected`.
  - `collection_records` stores the certified scale weight and timestamp.
  - The public tracking page at `/track/[token]` advances to stage `04` (Weighed), displaying verified collection time and actual weighed kilograms.
- When all stops on a route have collection records:
  - `collection_routes.status` transitions from `in_progress` to `completed`.

---

## 5. Duplicate & Collision Protection

- **Server-Side Enforcement**:
  - Before writing a collection record, the backend queries `collection_records` for `request_id = target_id`.
  - If a record already exists, or if `collection_requests.status` is already `collected` or `weighed`, the API rejects the request with HTTP 409 Conflict (`RECORD_EXISTS`).
  - No duplicate records or duplicate `ITEM_COLLECTED` events can be created.

---

## 6. Capacity Protection (Fleet Safety)

- **Protection Invariant**:
  $$\sum_{i \in \text{collected}} W_i + W_{\text{new}} \le \text{Vehicle Payload Capacity}$$
- If a collection would push the vehicle payload over its certified limit:
  - The backend returns HTTP 400 Bad Request with remaining capacity details.
  - No record is created.
  - Request status is unchanged.
  - Collector UI displays the remaining available space and disables confirmation.

---

## 7. Append-Only Event Logging

Every verified collection generates two audit entries in `event_log`:

1. `ITEM_COLLECTED`:
   ```json
   {
     "request_id": "20000000-0000-0000-0000-000000000004",
     "collection_record_id": "30000000-0000-0000-0000-000000000001",
     "route_id": "route-uuid",
     "vehicle_id": "vehicle-uuid",
     "qr_token": "RLP-HYD-004",
     "actual_weight_kg": 4.2,
     "estimated_weight_kg": 4.0,
     "variance_kg": 0.2,
     "verification_method": "qr_scan",
     "gps_captured": true,
     "collected_at": "2026-10-08T14:15:00.000Z"
   }
   ```
2. `WEIGHT_RECORDED`:
   ```json
   {
     "collection_record_id": "30000000-0000-0000-0000-000000000001",
     "actual_weight_kg": 4.2,
     "estimated_weight_kg": 4.0,
     "variance_percent": 5.0
   }
   ```

---

## 8. Privacy & Citizen PII Protection

- **Field Collector Interface**:
  - Displays masked municipal locality (e.g. `KPHB Colony, Kukatpally`).
  - Citizen phone numbers, flat/door numbers, and private internal notes are not exposed on field screens.
- **Public Tracking URL (`/track/[token]`)**:
  - Shows verified status, timestamp, high-level locality, and certified scale weight.
  - Never reveals exact GPS coordinates, collector identities, or vehicle route manifests.

---

## 9. Geolocation (GPS) Behavior

- On opening the verification modal, the browser requests `navigator.geolocation.getCurrentPosition()`.
- **Non-blocking guarantee**: If GPS permission is denied, timed out, or unavailable (e.g. in a basement parking lot), the badge displays `GPS Unavailable (Optional)` and pickup verification continues uninterrupted.

---

## 10. Role-Based Authorization & Known Limitations

- **Authorization Boundary**:
  - Allowed roles: `COLLECTOR`, `DISPATCHER`, `ADMIN`.
  - Disallowed role: `CITIZEN` cannot mark collections (HTTP 403 Forbidden).
- **Development vs. Production Note**:
  - In development, the role is passed via `x-user-role` header or parameter.
  - In full production deployment, this maps to Supabase Auth JWT claims (`auth.jwt() -> app_metadata.role`).
