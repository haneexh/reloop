# RE:LOOP — Community E-Waste Collection & Circular Optimization Platform

> **Tech Horizon 2.0 Entry**  
> **Problem Statement**: `TH2-PS-SD-013` — *Community E-Waste Collection Optimizer*  
> **Live Production**: [https://reloop-ashen.vercel.app](https://reloop-ashen.vercel.app)

RE:LOOP is an enterprise-grade municipal e-waste orchestration platform built for the Greater Hyderabad Municipal Corporation (GHMC) and sustainable circular economy partners. It unifies **AI Vision Scan & Decision Intelligence (PP-RI)** with **Doorstep Pickup Scheduling, Vehicle Routing Problem (VRP) Optimization, Collector Scale Verification, and Mass-Balance Traceability**.

---

## Required Problem Statement Outcomes (TH2-PS-SD-013)

1. **E-Waste Request & Location-Management Module**: Full citizen intake with spatial zone clustering (`lib/zone-resolver.ts`) resolving Hyderabad localities to municipal operational zones (`ZONE-HYD-01` to `ZONE-HYD-10`).
2. **Collection Route & Schedule Optimization**: Capacitated Vehicle Routing Problem (CVRP) engine (`lib/routeOptimizer.ts`) balancing payload capacities, priority windows, Haversine travel distances, and depot departure/return cycles.
3. **Recovery Tracking & Sustainability Dashboard**: Real-time civic ledger (`/dashboard`, `lib/sustainabilityEngine.ts`) calculating mass-balance e-waste diversion, gross carbon abatement ($\text{kg CO}_2\text{e}$), and material fractions (ferrous, non-ferrous, precious metals, plastics).
4. **Collection-Efficiency & Waste-Diversion Analysis**: Dynamic route metrics comparing baseline distance against optimized routes, vehicle capacity utilization rates, and variance audits between citizen intake estimates and calibrated digital scale weights.
5. **Traceable Collection Records**: Tamper-proof, immutable chain of custody with cryptographically secure $\ge 50$-bit tracking tokens (`RLP-HYD-XXXXXXXXXX`), collector geo-stamps, scale readings, and append-only audit event logging.
6. **Spatial & Temporal Demand Analysis**: Municipal heatmaps and priority queue sorting balancing time urgency against geographical proximity.
7. **Production Architecture & Demo Harness**: Role-switcher test harness (Citizen, Dispatcher, Collector, Auditor), verifiable demo passes (`QR-REQ-HYD-001`), and rate-limited seed reset (`/api/demo/reset`).

---

## Core System Architecture

```
                                 [Citizen Intake]
                               /                 \
        [AI Vision Scan (/analyze)]            [Direct Pickup (/request)]
                   │                                      │
       [Quality Gate & Dedicated Cache]                   │
        (gemini-3.6-flash / Claude / GPT)                 │
                   │                                      │
    [Decision Engine: PP-RI & Dual Score]                 │
 (Resell, Reuse, Repair, Refurbish, Recycle)              │
                   │                                      │
          [Schedule Doorstep Pickup] ─────────────────────┘
                   │
    [Canonical 50-Bit Tracking Token: RLP-HYD-XXXXXXXXXX]
                   │
        [Fleet Dispatch & VRP Route Optimization (/dispatch)]
                   │
        [Field Collector Scale & QR Verification (/collector)]
                   │
    [Municipal Mass-Balance & Material Recovery (/dashboard)]
                   │
       [Immutable Audit Trail & Public Tracking (/track/[token])]
```

---

## AI Vision Engine & Quality Gate

RE:LOOP features an intelligent multi-provider vision pipeline (`app/api/analyze-image/route.ts`):

- **Primary Vision Model**: `gemini-3.6-flash` (with `thinkingLevel: "LOW"` to prevent reasoning starvation on technical electronic components while maintaining $<6\text{s}$ latency).
- **Secondary Fallback**: `gemini-3.5-flash` (`thinkingLevel: "LOW"`).
- **Tertiary Fast Fallback**: `gemini-3.5-flash-lite` (`thinkingLevel: "MINIMAL"`).
- **Enterprise Fallbacks**: Anthropic Claude (`claude-3-5-sonnet-20241022` / `claude-sonnet-5-5`), OpenAI GPT-4o (`gpt-4o`).
- **Enforced Quality Gate (`isHighQualityAssessment`)**: Rejects shallow or low-information classifications (`"Other Electronics / Unlisted"`, vague generic labels, or parse errors). When a provider fails the quality gate, the pipeline automatically falls through to the next provider before finally defaulting to guided manual entry. Low-information results are **never** attributed as `"Analyzed by <provider>"`.
- **Dedicated Cache Table (`ai_scan_cache`)**: Image SHA-256 hashes cache successful high-confidence evaluations with strict RLS blocking anonymous reads/writes. Non-audit scan data is kept strictly isolated from the immutable civic `event_log`.

---

## Cryptographically Secure Tracking Tokens

Tracking tokens are generated via `lib/tracking-token.ts`:
- **Format**: `RLP-HYD-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}`
- **Entropy**: 10 characters chosen from Crockford Base32 alphabet ($32 = 2^5$ symbols).
  $$\text{Entropy} = 10 \times \log_2(32) = 10 \times 5 = 50\text{ bits}$$
  Yielding $2^{50} \approx 1.125 \times 10^{15}$ collision-resistant permutations.
- **Modulo Bias**: Exactly zero bias because $\frac{256}{32} = 8$ (256 is an exact multiple of 32).
- **Safety**: Unambiguous alphabet excludes visual duplicates (`0`, `1`, `I`, `L`, `O`) to prevent citizen transcription errors.
- **Evaluation Dataset**: Pre-seeded demo passes (`QR-REQ-HYD-001` through `009`) remain available for rapid jury testing.

---

## Security & Row-Level Security (RLS)

1. **Anonymous Citizens**:
   - Can insert new collection requests with strict schema validation.
   - Can read public reference tables (`collection_zones`, `partners`).
   - Can query single tracking records strictly by exact token match through non-PII projection.
   - PII (phone number, exact street address) is masked on public views.
2. **Immutable Event Log (`event_log`)**:
   - Enforced by database trigger `trigger_event_log_no_update_delete`.
   - Blocks all `UPDATE` and `DELETE` operations, preserving an untampered audit trail.
3. **Role Enforcement**:
   - Dispatcher and Collector write mutations require valid authenticated role sessions through `lib/operator-auth.ts`.
   - Cache clearing endpoint (`DELETE /api/analyze-image/cache`) strictly requires operator authentication (returns 401 Unauthorized otherwise).
   - Demo reset (`POST /api/demo/reset`) requires operator session and is IP rate-limited.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Database & Storage**: Supabase (PostgreSQL 15 + RLS + PostGIS geo-functions)
- **AI / Multimodal Vision**: Google Gemini (`@google/genai`), Anthropic Claude (`@anthropic-ai/sdk`), OpenAI (`openai`)
- **Optimization Algorithms**: 2-Opt TSP / Capacitated VRP Heuristics with Haversine metrics
- **Styling**: Tailwind CSS with civic design tokens (Clean, contrast-compliant typography)
- **Testing**: Node.js Native Test Runner (`node:test`, 110 tests across 16 test suites)

---

## Getting Started

### 1. Prerequisites
- Node.js 18.17+ or 20+
- npm or pnpm

### 2. Setup
```bash
git clone https://github.com/haneexh/reloop.git
cd reloop
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-3.6-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash

ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

### 4. Run Locally
```bash
npm run dev
```

### 5. Run Verification Suite
```bash
npm run typecheck   # TypeScript check
npm run lint        # ESLint check
npm test            # 110 unit & integration tests
npm run build       # Next.js production build
```

---

## Production Deployment
The live service is deployed on Vercel at [https://reloop-ashen.vercel.app](https://reloop-ashen.vercel.app).
