import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:LOOP | Post-Purchase Circularity Decision Engine",
  description:
    "Transparent post-purchase circular routing, PP-RI scoring, and physical destination routing for discarded electronics.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f5f1] text-[#151817] antialiased flex flex-col font-sans selection:bg-[#2e7d57] selection:text-white">
        <header className="w-full border-b border-[#d8ddd7] bg-[#f4f5f1]">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-8">
              <Link
                href="/"
                className="font-display font-bold text-base tracking-widest text-[#151817] uppercase flex items-center gap-2.5"
              >
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2e7d57]"></span>
                <span>RE:LOOP</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-6 text-xs font-medium text-[#6b746e]">
                <Link
                  href="/request"
                  className="hover:text-[#2e7d57] transition-colors font-semibold text-[#151817]"
                >
                  Schedule Pickup
                </Link>
                <Link
                  href="/analyze"
                  className="hover:text-[#2e7d57] transition-colors"
                >
                  Intake Assessment
                </Link>
                <Link
                  href="/destinations"
                  className="hover:text-[#2e7d57] transition-colors"
                >
                  Destination Directory
                </Link>
                <Link
                  href="/dispatch"
                  className="hover:text-[#2e7d57] transition-colors"
                >
                  Dispatch Ops
                </Link>
                <Link
                  href="/dashboard"
                  className="hover:text-[#2e7d57] transition-colors"
                >
                  Ledger &amp; Fleet
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
              >
                + New Intake
              </Link>
              <div className="hidden xs:inline-flex items-center gap-1.5 border border-[#d8ddd7] bg-[#e9ede7] px-2.5 py-1 font-mono text-[11px] text-[#151817] rounded-sm">
                <span className="h-1.5 w-1.5 rounded-sm bg-[#2e7d57]"></span>
                <span>GUEST SESSION</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-[#d8ddd7] bg-[#e9ede7] py-6 text-xs text-[#6b746e]">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-mono text-[11px] text-[#151817]">
                RE:LOOP | Circular Lifecycle Intelligence Platform
              </p>
              <span className="hidden sm:inline text-[#d8ddd7]">·</span>
              <div className="flex items-center gap-3 text-[11px]">
                <Link href="/privacy" className="hover:text-[#151817] underline underline-offset-2 transition-colors">
                  Privacy Policy
                </Link>
                <span>·</span>
                <Link href="/terms" className="hover:text-[#151817] underline underline-offset-2 transition-colors">
                  Terms of Service
                </Link>
              </div>
            </div>

            <span className="font-mono text-[11px] text-[#6b746e]">
              Deterministic scoring · No black-box AI
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
