# RE:LOOP — PS-013 Row Level Security (RLS) & Access Control Model

**Problem Statement:** TH2-PS-SD-013 — Community E-Waste Collection Optimizer  
**Compliance Target:** Safe Public Citizen Intake + Role-Scoped Dispatcher & Collector Operations  

---

## 1. Role Hierarchy & Profiles

| Role | Operational Scope | Access Level |
|---|---|---|
| **`CITIZEN`** | Submits e-waste requests, views own tracking status via QR/ID | Public insert, selective read (by ID or QR token), no modification of routes/fleet |
| **`DISPATCHER`** | Manages zones, vehicles, schedules, and generates optimized routes | Read/write across requests, routes, vehicles, zones, transfers |
| **`COLLECTOR`** | Executes daily collection runs, records scale weights, verifies QR | Read assigned routes, update request status to 'collected', insert collection records |
| **`FACILITY`** | Receives custodial batches at recovery plant | Read transferred routes, insert/update recovery transfers |
| **`ADMIN`** | System administrator | Full operational read/write access |

---

## 2. RLS Policies by Table

### 2.1. `collection_zones`
- `SELECT`: Public access (`USING (true)`). Needed for citizen zone selection and map boundary rendering.
- `INSERT` / `UPDATE`: Restricted to `DISPATCHER` or `ADMIN` roles.

### 2.2. `collection_requests`
- `SELECT`: Public access (`USING (true)`) permitted for status queries and tracking pages (`/track/[requestId]`).
- `INSERT`: Public access (`WITH CHECK (true)`). Any citizen can register an e-waste collection pickup without forced account creation.
- `UPDATE`: Restricted to operational roles (`DISPATCHER`, `COLLECTOR`, `ADMIN`) or verified session.

### 2.3. `vehicles` & `collection_routes`
- `SELECT`: Public/Collector read access for route execution and dashboard transparency.
- `INSERT` / `UPDATE` / `DELETE`: Restricted to `DISPATCHER` and `ADMIN`. Citizens cannot modify vehicle manifests or routes.

### 2.4. `collection_records`
- `SELECT`: Public/Driver read access.
- `INSERT`: Restricted to `COLLECTOR` and `DISPATCHER` upon physical verification.
- `UPDATE` / `DELETE`: Prohibited to preserve custodial chain integrity.

### 2.5. `recovery_transfers`
- `SELECT`: Public/Facility read access.
- `INSERT`: Restricted to `FACILITY` and `DISPATCHER`.

### 2.6. `event_log` (Strict Append-Only Protection)
- **Principle:** Under no circumstances can event log entries be altered or erased by standard users or operators.
- `SELECT`: Public/Admin read access for audit verification and live dashboard event streams.
- `INSERT`: Public/Server insert access (`WITH CHECK (true)`).
- `UPDATE`: **EXPLICITLY BLOCKED**. No UPDATE policy exists. A database trigger (`prevent_event_log_modification`) raises an exception on any UPDATE attempt.
- `DELETE`: **EXPLICITLY BLOCKED**. No DELETE policy exists. The database trigger raises an exception on any DELETE attempt.

---

## 3. Storage Security Model (`item-photos`)

### Current State
- The bucket `item-photos` is public with client-side upload policies for guest MVP compatibility.
- Client uploads directly to `items/<uuid>.<ext>` using the public anonymous key.

### Security Protocol for PS-013
1. **Server-Side Validation:** The `/api/analyze-image` route strictly enforces MIME type validation (JPG, PNG, WebP) and checks payload bounds before processing.
2. **Preservation:** No destructive storage migrations or bucket renames are applied to prevent breaking existing item photos.
3. **Controlled Follow-Up:** For production enterprise rollout, migrate to presigned upload URLs generated via Supabase Storage API (`createSignedUploadUrl`), restricting direct unauthenticated public writes while maintaining instant photo accessibility for verified recovery records.
