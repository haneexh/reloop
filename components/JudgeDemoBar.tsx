"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function JudgeDemoBar() {
  const pathname = usePathname();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Active persona determination
  const isCitizen =
    pathname === "/" ||
    pathname.startsWith("/request") ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/destinations");
  const isDispatcher = pathname.startsWith("/dispatch");
  const isCollector = pathname.startsWith("/collector");
  const isImpact = pathname.startsWith("/dashboard");

  const steps = [
    {
      num: "1",
      title: "Citizen Intake",
      desc: "Schedule pickup with AI photo classification",
      href: "/request",
      active: pathname.startsWith("/request"),
    },
    {
      num: "2",
      title: "Public Tracking",
      desc: "Custody badges, ETA, and QR verification pass",
      href: "/track/QR-DEMO-HYD-001",
      active: pathname.startsWith("/track"),
    },
    {
      num: "3",
      title: "Dispatch Operations",
      desc: "Spatial demand clustering & CVRP capacity routes",
      href: "/dispatch",
      active: isDispatcher,
    },
    {
      num: "4",
      title: "Field Collection",
      desc: "Driver manifests, scale weights & QR scans",
      href: "/collector",
      active: isCollector,
    },
    {
      num: "5",
      title: "Circularity & Diversion",
      desc: "Formal vs informal split & mass balance",
      href: "/dashboard",
      active: isImpact,
    },
  ];

  return (
    <aside aria-label="Demo and Role Navigation" className="w-full border-b border-[#d8ddd7] bg-[#f9faf8] text-[#151817]">
      {/* Top Role Bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-1.5 sm:px-6 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#6b746e] whitespace-nowrap">
            Role:
          </span>

          <Link
            href="/request"
            className={`px-2.5 py-0.5 rounded-[3px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isCitizen
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            Citizen
          </Link>

          <Link
            href="/dispatch"
            className={`px-2.5 py-0.5 rounded-[3px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isDispatcher
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            Dispatcher
          </Link>

          <Link
            href="/collector"
            className={`px-2.5 py-0.5 rounded-[3px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isCollector
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            Collector
          </Link>

          <Link
            href="/dashboard"
            className={`px-2.5 py-0.5 rounded-[3px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isImpact
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            Impact
          </Link>
        </div>

        {/* Right: Demo Guide Toggle & Dataset Flag */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-[2px] bg-[#edf5f0] border border-[#bcdbc8] font-mono text-[10px] text-[#1e583c]">
            Demo dataset (80 pickups)
          </span>

          <button
            type="button"
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border border-[#d8ddd7] bg-white text-[11px] font-semibold text-[#151817] hover:bg-[#e9ede7] transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-[#2e7d57]" />
            <span>Judge Guide (5 Steps)</span>
            <span className="text-[10px] text-[#6b746e]">{isGuideOpen ? "▲" : "▼"}</span>
          </button>
        </div>
      </div>

      {/* Expandable 5-Step Guided Demo Flow */}
      {isGuideOpen && (
        <div className="border-t border-[#d8ddd7] bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-5xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#6b746e]">
                Evaluation Pathway (Complete Loop in 3 Minutes)
              </span>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-[11px] text-[#6b746e] hover:text-[#151817]"
              >
                Close guide
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {steps.map((st) => (
                <Link
                  key={st.num}
                  href={st.href}
                  className={`p-2.5 rounded-[3px] border text-left transition-all block ${
                    st.active
                      ? "border-[#2e7d57] bg-[#edf5f0]/70"
                      : "border-[#d8ddd7] bg-[#f9faf8] hover:bg-[#f4f5f1]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] bg-[#151817] text-[10px] font-mono font-bold text-white">
                      {st.num}
                    </span>
                    {st.active && (
                      <span className="text-[9px] font-mono text-[#2e7d57] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-xs text-[#151817] leading-snug">
                    {st.title}
                  </h3>
                  <p className="text-[10px] text-[#6b746e] mt-0.5 leading-tight">
                    {st.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
