import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "reloop — Hackathon MVP",
  description: "Next.js 14 App Router guest-only MVP built for the 24-hour hackathon",
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
              <a
                href="/"
                className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                reloop
              </a>
              <nav className="hidden sm:flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
                <a
                  href="#overview"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Overview
                </a>
                <a
                  href="#features"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Architecture
                </a>
                <a
                  href="#setup"
                  className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  Setup
                </a>
              </nav>
            </div>
            <div className="flex items-center gap-3">
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
