# reloop

A Next.js 14 (App Router) guest-only MVP built for a 24-hour hackathon.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Minimal design system, neutral palette, crisp borders)
- **Backend / Database**: Supabase (`@supabase/supabase-js`)
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

Copy `.env.example` to `.env.local` and add your Supabase credentials:

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Client-accessible Supabase variables (if needed by browser components)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Running the Development Server

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
reloop/
├── app/
│   ├── globals.css         # Minimal styling tokens & Tailwind setup
│   ├── layout.tsx          # Root layout with header & guest mode badge
│   └── page.tsx            # Minimal MVP placeholder homepage
├── lib/
│   └── supabase.ts         # Initialized Supabase client instance
├── public/                 # Static assets
├── .env.example            # Template for environment variables
├── .eslintrc.json          # ESLint rules
├── .prettierrc             # Prettier configuration
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

---

## Scripts

- `npm run dev`: Start Next.js development server
- `npm run build`: Build production bundle
- `npm run start`: Run production server
- `npm run lint`: Run ESLint checks
- `npm run format`: Format codebase with Prettier
- `npm run format:check`: Verify formatting with Prettier

---

## Supabase Client Usage

Import the initialized client anywhere in server or client components:

```typescript
import { supabase } from "@/lib/supabase";

// Example query
async function fetchData() {
  const { data, error } = await supabase.from("items").select("*");
  return data;
}
```

---

## Vercel Deployment

### Option 1: Automatic Deployment via GitHub (Recommended)

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial skeleton commit"
   git remote add origin https://github.com/<your-username>/reloop.git
   git branch -M main
   git push -u origin main
   ```
2. Import the repository in [Vercel Dashboard](https://vercel.com/new).
3. In Project Settings &rarr; Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy! Every future push to `main` will automatically build and deploy.

### Option 2: Deploy via Vercel CLI

1. Run the deployment command:
   ```bash
   npx vercel
   ```
2. For subsequent production releases with zero manual steps:
   ```bash
   npx vercel --prod
   ```
