import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:LOOP — AI Circularity Decision Engine & PP-RI",
  description: "AI-Powered post-purchase circular lifecycle intelligence, PP-RI scoring, and destination routing for discarded electronics.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
        <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                <span>reloop</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
                <Link
                  href="/analyze"
                  className="font-medium text-zinc-900 hover:text-zinc-900 dark:text-zinc-100 dark:hover:text-zinc-50 transition-colors"
                >
                  Analyze Item
                </Link>
                <Link
                  href="/dashboard"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/#how-it-works"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  How It Works
                </Link>
                <Link
                  href="/#pathways"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  6 Pathways
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/analyze"
                className="hidden xs:inline-flex sm:inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                + New Intake
              </Link>
              <div className="inline-flex items-center gap-1.5 border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 rounded-md dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>Guest Mode</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>

        <footer className="border-t border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-500 sm:flex-row sm:px-6 dark:text-zinc-400">
            <p>reloop &bull; 24-Hour Hackathon MVP</p>
            <p className="flex items-center gap-4">
              <span>Next.js 14 App Router</span>
              <span>&bull;</span>
              <span>Tailwind CSS</span>
              <span>&bull;</span>
              <span>Supabase</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
