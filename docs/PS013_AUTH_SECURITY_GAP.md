# PS-013 Authentication & Security Gap Disclosure
**Document Classification:** Technical Security Audit & Post-Hackathon Remediation Plan  
**Target Project:** RE:LOOP (TH2-PS-SD-013 Community E-Waste Collection Optimizer)  
**Date:** October 8, 2026  

---

## Executive Summary
In accordance with our engineering honesty principles, this document provides a comprehensive security disclosure regarding the authentication and authorization mechanism currently utilized in this demonstration prototype.

During hackathon development and local validation, role-based access control (RBAC) was implemented using a simulated client-supplied header (`x-user-role`). This permitted rapid verification of distinct actor workflows (`CITIZEN`, `COLLECTOR`, `DISPATCHER`, `FACILITY`, `ADMIN`) without requiring complex multi-session browser login state orchestration during rapid prototyping.

**This is a development boundary, NOT production-grade authentication.**

---

## 1. Current Development Mechanism
In the current prototype codebase:
1. Operational APIs inspect an HTTP request header named `x-user-role` (or fallback body attribute `actor_role`):
   ```typescript
   const role = req.headers.get("x-user-role") || body.actor_role || "COLLECTOR";
   ```
2. The role is validated against in-memory helper functions:
   - `isAuthorizedCollector(role)`: Allows `COLLECTOR`, `DISPATCHER`, `ADMIN`; rejects `CITIZEN`.
   - `isAuthorizedRecoveryOperator(role)`: Allows `DISPATCHER`, `FACILITY`, `ADMIN`; rejects `CITIZEN`, `COLLECTOR`.
3. The UI components (`app/collector/page.tsx`, `app/dashboard/page.tsx`) provide visible development role switchers allowing judges and developers to simulate executing actions from different actor perspectives.

---

## 2. Why Client-Supplied Role Headers Are NOT Production Authentication
In a production web application exposed to the public internet:
1. **Header Spoofing:** Any external HTTP client (via `curl`, Postman, or custom scripts) can forge arbitrary HTTP headers (`x-user-role: ADMIN` or `x-user-role: DISPATCHER`).
2. **Lack of Cryptographic Identity:** The header contains no cryptographic signature proving that the sender was authenticated by a trusted Identity Provider (IdP).
3. **No Session Expiry or Revocation:** There is no token expiration, refresh mechanism, or credential revocation list.
4. **Bypassed Row-Level Security (RLS) User Context:** Because requests to Supabase currently use the anon key with service logic checks rather than `auth.uid()`, Supabase RLS cannot verify the individual citizen or driver UUID.

---

## 3. Exact APIs Affected
The following endpoints currently rely on the development header/body role check:
1. `POST /api/collector/collect`: Verifies `isAuthorizedCollector(role)` to prevent citizens from recording fake scale weights.
2. `GET /api/collector/route`: Verifies `isAuthorizedCollector(role)` to prevent citizens from browsing driver manifests.
3. `POST /api/collector/route`: Verifies `isAuthorizedCollector(role)` to start or complete vehicle routes.
4. `POST /api/recovery/transfers`: Verifies `isAuthorizedRecoveryOperator(role)` to prevent citizens or unaccredited entities from logging facility transfers.

---

## 4. Deployment Risk Assessment
- **Hackathon Demo / Sandbox Environment:** **LOW RISK**. In a controlled presentation or evaluation sandbox with synthetic data, the role switcher allows judges to interactively test all four operational user personas without logging in and out of five different email accounts.
- **Production Internet Deployment:** **HIGH RISK**. If deployed as-is to a publicly indexed production domain without network isolation or reverse-proxy protection, unauthorized actors could invoke collector or facility APIs by providing the header.

---

## 5. Recommended Post-Hackathon Production Remediation
To transition this prototype into a production municipal deployment, the following standard Supabase Auth architecture should be implemented:

### Step 1: Enforce Supabase Auth JWT Sessions
Replace client-supplied headers with Supabase's cryptographically signed JWT tokens:
```typescript
import { createServerClient } from "@supabase/ssr";

// In API Route:
const supabase = createServerClient(...);
const { data: { user }, error } = await supabase.auth.getUser();

if (!user || error) {
  return NextResponse.json({ error: "Unauthorized: Valid session required" }, { status: 401 });
}
```

### Step 2: Query Role from Secure `profiles` Table
Query the verified user role from the database rather than trusting client headers:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single();

if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
  return NextResponse.json({ error: "Forbidden: Insufficient privileges" }, { status: 403 });
}
```

### Step 3: Enforce Native RLS with `auth.jwt()`
Update Supabase RLS policies to inspect the user's role directly within PostgreSQL:
```sql
CREATE POLICY "collector_create_collection_records"
ON collection_records FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('collector', 'dispatcher', 'admin')
  )
);
```

---

## Conclusion
This architecture was chosen intentionally to facilitate comprehensive functional testing and live judge demonstrations across all four actor roles within a unified evaluation session. The limitation is transparently documented, and the migration path to production Supabase Auth is fully mapped.
