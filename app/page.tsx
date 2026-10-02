import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section id="overview" className="border-b border-zinc-200 pb-10 dark:border-zinc-800">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-2.5 py-1 text-xs font-mono text-zinc-600 rounded-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span>CIRCULARITY DECISION ENGINE</span>
            <span>/</span>
            <span>POST-PURCHASE REPAIRABILITY INDEX (PP-RI)</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            reloop
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Post-purchase circular lifecycle intelligence for electronics and household items. Upload an item photograph to assess condition, evaluate repair vs. replace economics, score carbon avoidance, and map local destination pathways.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Analyze an Item &rarr;
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Impact Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works - 3 Step Plain Explanation */}
      <section id="how-it-works" className="space-y-6 border-b border-zinc-200 pb-12 dark:border-zinc-800">
        <div>
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Process Flow
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            How RE:LOOP Works
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            A three-step deterministic routing process from image capture to destination handover.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Step 1 */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  STEP 01
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  Vision + Review
                </span>
              </div>
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 pt-1">
                Photo & Physical Intake
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Upload a photograph of your item. The multimodal vision model detects category, brand, visible cosmetic or structural wear, and component completeness, followed by a human-in-the-loop verification step.
              </p>
            </div>
            <div className="pt-4 text-[11px] text-zinc-400 font-mono">
              Output: Category, condition, estimated age &amp; baselines
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  STEP 02
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  PP-RI Engine
                </span>
              </div>
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 pt-1">
                Six-Pathway Decision
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                The decision engine calculates the Post-Purchase Repairability Index (PP-RI, 0–10 scale) across repair cost ratio (45%), physical condition (35%), and age (20%), comparing Repair, Reuse, Donate, Resell, Refurbish, and Recycle side-by-side.
              </p>
            </div>
            <div className="pt-4 text-[11px] text-zinc-400 font-mono">
              Output: Primary action, rationale &amp; economics vs. CO2e
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  STEP 03
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  Geo Routing
                </span>
              </div>
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 pt-1">
                Local Destination Routing
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Match with nearby verified facilities and informal community collectors (kabadiwalas), sorted by straight-line Haversine distance with turn-by-turn navigation links and category filters.
              </p>
            </div>
            <div className="pt-4 text-[11px] text-zinc-400 font-mono">
              Output: OpenStreetMap locations, contact &amp; directions
            </div>
          </div>
        </div>
      </section>

      {/* Six Pathways Overview */}
      <section id="pathways" className="space-y-4 border-b border-zinc-200 pb-12 dark:border-zinc-800">
        <div>
          <div className="text-xs font-mono font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Circularity Matrix
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            Six Distinct End-of-Life Pathways
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Every evaluated item is simultaneously scored across 6 circular pathways rather than binary keep-or-toss.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>1. Repair</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Fix specific component or cosmetic failures when repair cost is &lt;50% of new replacement baseline.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span>2. Resell</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Direct peer-to-peer secondary market monetization when device condition is high and age is under 3 years.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-teal-500"></span>
              <span>3. Reuse</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Direct transfer, repurposing, or secondary utility within home or community without commercial repair.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-purple-500"></span>
              <span>4. Refurbish</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Professional restoration, battery/screen replacement, and factory re-certification for certified resale.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span>5. Donate</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Social benefit transfer to certified educational non-profits or community organizations for older functioning items.
            </p>
          </div>

          <div className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>6. Recycle</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-normal">
              Authorized e-waste material recovery, precious metal extraction, and safe hazardous substance disposal.
            </p>
          </div>
        </div>
      </section>

      {/* Architecture Cards */}
      <section id="features" className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">System Architecture</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-2">
              <svg
                className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-medium text-sm">Vision &amp; Fallbacks</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Deterministic item categorization with Claude 3.5 Sonnet / GPT-4o multimodal parsing and client-side deterministic fallback.
            </p>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-2">
              <svg
                className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
              <h3 className="font-medium text-sm">Supabase Storage &amp; DB</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              PostgreSQL relational schema storing items, recommendations, and circular partners with zero mock data.
            </p>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-2">
              <svg
                className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <h3 className="font-medium text-sm">Informal Sector Inclusion</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              First-class integration of community scrap collectors (kabadiwalas) alongside formal recyclers for grounded Indian e-waste reality.
            </p>
          </div>
        </div>
      </section>

      {/* Setup Instructions Box */}
      <section id="setup" className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Environment &amp; Quick Commands
        </h2>
        <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              1. Required Environment Variables (.env.local)
            </div>
            <div className="rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-200 overflow-x-auto">
              <div>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</div>
              <div className="text-zinc-500 pt-1"># Optional Vision Model Keys:</div>
              <div>ANTHROPIC_API_KEY=sk-ant-api03-...</div>
              <div>OPENAI_API_KEY=sk-proj-...</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              2. Verification Commands
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Run unit tests</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm test
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Build for production</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm run build
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Disclosure Notice */}
      <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">Privacy disclosure: </span>
          Uploaded item photos are processed securely to evaluate physical condition and stored in your guest session database for routing calculations. No personal identifying information or contact details are collected, tracked, or shared with third parties.
        </div>
      </section>
    </div>
  );
}
