export default function Home() {
  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section id="overview" className="border-b border-zinc-200 pb-10 dark:border-zinc-800">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 border border-zinc-200 bg-white px-2.5 py-1 text-xs font-mono text-zinc-600 rounded-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <span>MVP SKELETON</span>
            <span>/</span>
            <span>PHASE 0</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
            reloop
          </h1>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            A rapid-iteration platform built with Next.js 14 App Router, TypeScript, Tailwind CSS,
            and Supabase. Designed for guest-only workflows with zero friction.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#setup"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get Started
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              System Specs
            </a>
          </div>
        </div>
      </section>

      {/* Architecture Cards */}
      <section id="features" className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Core Foundation</h2>
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
              <h3 className="font-medium text-sm">Next.js 14 App Router</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Server and client component architecture with type-safe routing and fast refresh.
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
              <h3 className="font-medium text-sm">Supabase Client</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              Initialized client in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
                lib/supabase.ts
              </code>{" "}
              ready for database queries.
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
              <h3 className="font-medium text-sm">Guest-Only MVP</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-normal">
              No login or auth barriers. Anonymous session storage and immediate accessibility.
            </p>
          </div>
        </div>
      </section>

      {/* Setup Instructions Box */}
      <section id="setup" className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Environment & Quick Commands
        </h2>
        <div className="rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              1. Required Environment Variables (.env.local)
            </div>
            <div className="rounded-md bg-zinc-950 p-3 font-mono text-xs text-zinc-200 overflow-x-auto">
              <div>SUPABASE_URL=https://your-project.supabase.co</div>
              <div>SUPABASE_ANON_KEY=your-anon-key</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              2. Development Commands
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Start dev server</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm run dev
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Build for production</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm run build
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Check linting</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm run lint
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <span className="text-zinc-500"># Format codebase</span>
                <div className="text-zinc-900 dark:text-zinc-200 font-semibold mt-0.5">
                  npm run format
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
