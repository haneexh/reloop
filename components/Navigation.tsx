"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  // Operations dropdown state
  const [isOpsOpen, setIsOpsOpen] = useState(false);
  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Track modal / popover state
  const [isTrackOpen, setIsTrackOpen] = useState(false);
  const [trackTokenInput, setTrackTokenInput] = useState("");

  const opsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route change
  useEffect(() => {
    setIsOpsOpen(false);
    setIsMobileMenuOpen(false);
    setIsTrackOpen(false);
  }, [pathname]);

  // Click outside listener for operations dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        opsDropdownRef.current &&
        !opsDropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTokenInput.trim()) return;
    const cleanToken = trackTokenInput.trim().toUpperCase();
    setIsTrackOpen(false);
    setTrackTokenInput("");
    router.push(`/track/${cleanToken}`);
  };

  const isOpsActive =
    pathname.startsWith("/dispatch") ||
    pathname.startsWith("/collector") ||
    pathname.startsWith("/dashboard");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#d8ddd7] bg-[#f4f5f1]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display font-bold text-base tracking-widest text-[#151817] uppercase transition-opacity hover:opacity-90"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2e7d57]" />
            <span>RE:LOOP</span>
          </Link>

          {/* Desktop Public Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#6b746e]">
            <Link
              href="/request"
              className={`transition-colors hover:text-[#151817] ${
                pathname === "/request"
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              Schedule Pickup
            </Link>

            <button
              onClick={() => setIsTrackOpen(!isTrackOpen)}
              type="button"
              className={`transition-colors hover:text-[#151817] flex items-center gap-1 ${
                pathname.startsWith("/track")
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              <span>Track Pickup</span>
            </button>

            <Link
              href="/destinations"
              className={`transition-colors hover:text-[#151817] ${
                pathname === "/destinations"
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              Destinations
            </Link>

            <Link
              href="/analyze"
              className={`transition-colors hover:text-[#151817] ${
                pathname.startsWith("/analyze")
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              Item Assessment
            </Link>
          </nav>
        </div>

        {/* Right: Operations Gateway & CTAs */}
        <div className="flex items-center gap-3">
          {/* Operations Dropdown (Desktop) */}
          <div className="relative hidden md:block" ref={opsDropdownRef}>
            <button
              onClick={() => setIsOpsOpen(!isOpsOpen)}
              type="button"
              aria-expanded={isOpsOpen}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                isOpsActive
                  ? "border-[#2e7d57] bg-[#e6f2e8] text-[#173d2c]"
                  : "border-[#d8ddd7] bg-white text-[#151817] hover:bg-[#e9ede7]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d57]" />
              <span>Operations Hub</span>
              <span className="text-[10px] text-[#6b746e]">▾</span>
            </button>

            {isOpsOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-[3px] border border-[#d8ddd7] bg-white p-1.5 shadow-sm">
                <div className="px-2.5 py-1.5 border-b border-[#d8ddd7] mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] block">
                    Municipal Operations
                  </span>
                </div>
                <Link
                  href="/dispatch"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold">Dispatch Ops</span>
                  <span className="text-[11px] text-[#6b746e]">Demand heatmaps &amp; CVRP routing</span>
                </Link>
                <Link
                  href="/collector"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold text-[#2e7d57]">Collector Ops</span>
                  <span className="text-[11px] text-[#6b746e]">Driver manifest &amp; scale verify</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold">Recovery &amp; Impact</span>
                  <span className="text-[11px] text-[#6b746e]">Mass balance &amp; eco-fleet ledger</span>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Primary Citizen Action */}
          <Link
            href="/request"
            className="inline-flex items-center justify-center rounded-[3px] bg-[#2e7d57] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644] active:bg-[#1e5437]"
          >
            + Book Pickup
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            aria-label="Toggle Navigation Menu"
            className="md:hidden inline-flex items-center justify-center rounded-[3px] border border-[#d8ddd7] bg-white p-2 text-[#151817] hover:bg-[#e9ede7]"
          >
            <span className="text-xs font-mono">{isMobileMenuOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Track Quick Finder Popover (Desktop / Mobile) */}
      {isTrackOpen && (
        <div className="border-t border-[#d8ddd7] bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[#151817]">
                Track Active Collection Request
              </span>
              <p className="text-[11px] text-[#6b746e]">
                Enter your 8-digit tracking token (e.g. RLP-HYD-A7F2)
              </p>
            </div>
            <form onSubmit={handleTrackSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="RLP-HYD-XXXX"
                value={trackTokenInput}
                onChange={(e) => setTrackTokenInput(e.target.value)}
                className="w-44 rounded-[3px] border border-[#d8ddd7] px-3 py-1.5 font-mono text-xs uppercase placeholder:text-[#a1aaa4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-[3px] bg-[#2e7d57] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#246644]"
              >
                Track &rarr;
              </button>
              <button
                type="button"
                onClick={() => setIsTrackOpen(false)}
                className="rounded-[3px] border border-[#d8ddd7] px-2 py-1.5 text-xs text-[#6b746e] hover:bg-[#e9ede7]"
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#d8ddd7] bg-[#f4f5f1] px-4 py-4 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] px-2 block">
              Citizen Services
            </span>
            <Link
              href="/request"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-semibold text-[#151817] bg-white border border-[#d8ddd7]"
            >
              <span>Schedule Pickup</span>
              <span className="text-[#2e7d57]">&rarr;</span>
            </Link>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsTrackOpen(true);
              }}
              type="button"
              className="w-full text-left flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Track Existing Pickup</span>
              <span className="text-xs text-[#6b746e]">🔍</span>
            </button>
            <Link
              href="/destinations"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Destination Directory</span>
              <span className="text-xs text-[#6b746e]">40 nodes</span>
            </Link>
            <Link
              href="/analyze"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Item Circular Assessment</span>
              <span className="text-xs text-[#6b746e]">PP-RI</span>
            </Link>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#d8ddd7]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] px-2 block">
              Operations &amp; Logistics
            </span>
            <Link
              href="/dispatch"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Dispatch Ops</span>
              <span className="text-[10px] font-mono text-[#6b746e]">CVRP</span>
            </Link>
            <Link
              href="/collector"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-semibold text-[#2e7d57] hover:bg-white"
            >
              <span>Collector Mobile Interface</span>
              <span className="text-[10px] font-mono text-[#2e7d57]">Driver</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-between px-2.5 py-2 rounded-[3px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Recovery &amp; Impact Ledger</span>
              <span className="text-[10px] font-mono text-[#6b746e]">Metrics</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
