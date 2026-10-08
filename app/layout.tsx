import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RE:LOOP | Community E-Waste Collection Optimizer & Circular Recovery",
  description:
    "Intelligent municipal e-waste collection optimizer: capacity-aware fleet scheduling, CVRP route optimization, doorstep QR scale verification, and circular recovery mass balance.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

import { Navigation } from "@/components/Navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f5f1] text-[#151817] antialiased flex flex-col font-sans selection:bg-[#2e7d57] selection:text-white">
        <Navigation />

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
