import type { Metadata } from "next";
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
import { Footer } from "@/components/Footer";
import { JudgeDemoBar } from "@/components/JudgeDemoBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4f5f1] text-[#151817] antialiased flex flex-col font-sans selection:bg-[#2e7d57] selection:text-white">
        <JudgeDemoBar />
        <Navigation />

        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
