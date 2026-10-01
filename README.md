# reloop

A Next.js 14 (App Router) guest-only MVP built for a 24-hour hackathon.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Minimal design system, neutral palette, crisp borders)
- **Backend / Database**: Supabase (`@supabase/supabase-js`)
- **Vision Models**: Claude 3.5 Sonnet / OpenAI GPT-4o with automatic fallback to manual entry
- **Code Quality**: ESLint + Prettier

---

## Getting Started

### 1. Prerequisites

Ensure you have Node.js 18.17+ installed.

### 2. Installation

Clone or navigate to the project directory:

```bash
cd reloop
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your configuration:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Vision Models (Optional, fallback enabled)
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
```

### 4. Running the Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or navigate directly to [http://localhost:3000/analyze](http://localhost:3000/analyze)).

---

## Project Structure

```
reloop/
├── app/
│   ├── analyze/
│   │   └── page.tsx        # Drag-and-drop upload & interactive condition assessment
│   ├── api/
│   │   └── analyze-image/
│   │       └── route.ts    # Vision API route (Claude 3.5 / GPT-4o + retries & fallbacks)
│   ├── globals.css         # Minimal styling tokens & Tailwind setup
│   ├── layout.tsx          # Root layout with header & guest mode badge
│   └── page.tsx            # Minimal MVP placeholder homepage
├── lib/
│   ├── impact-calculator.ts# Circular economy metrics (CO2e, waste, repair, resale)
│   └── supabase.ts         # Initialized Supabase client instance
├── supabase/
│   ├── migrations/
│   │   ├── 20241001000000_reloop_schema.sql
│   │   └── 20241001000002_storage_bucket.sql
│   └── seed.sql            # 20 verified Bengaluru partners across 5 categories
├── types/
│   └── database.ts         # TypeScript definitions for items, partners, recommendations
├── .env.example            # Template for environment variables
├── .eslintrc.json          # ESLint rules
├── .prettierrc             # Prettier configuration
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

---

## Core Flows

### 1. Item Intake & Assessment (`/analyze`)

- **Drag-and-Drop Dropzone**: Supports `.jpg`, `.png`, and `.webp` up to 8MB.
- **Supabase Storage**: Automatically stores images under the `item-photos` bucket.
- **Vision Model Analysis**: Calls Claude 3.5 Sonnet or GPT-4o with structured JSON schema and a 1-retry fallback.
- **Human-in-the-Loop Confirmation**: Displays parsed values (`item_type`, `brand`, `age`, `condition`, `notes`) with editable inputs before any row is written to the database.
- **Graceful Degradation**: If no vision keys are provided or an error occurs, the user seamlessly receives a pre-filled manual entry form.

---

## Vercel Deployment

1. Run:
   ```bash
   npx vercel --prod
   ```
2. Configure environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) on the Vercel dashboard.
