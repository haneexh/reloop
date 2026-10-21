"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  // Operations dropdown state
  const [isOpsOpen, setIsOpsOpen] = useState(false);
  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Demo mode active state
  const [isDemoActive, setIsDemoActive] = useState(false);

  const opsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on route change
  useEffect(() => {
    setIsOpsOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Sync demo mode status with localStorage & custom event
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDemoActive(window.localStorage.getItem("reloop_demo_active") === "true");
    }

    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ active?: boolean }>;
      if (typeof customEvent.detail?.active === "boolean") {
        setIsDemoActive(customEvent.detail.active);
      } else {
        setIsDemoActive((prev) => !prev);
      }
    };
    window.addEventListener("reloop-demo-toggle", handleToggle);
    return () => window.removeEventListener("reloop-demo-toggle", handleToggle);
  }, []);

  const handleToggleDemo = () => {
    const next = !isDemoActive;
    setIsDemoActive(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("reloop_demo_active", next ? "true" : "false");
      window.dispatchEvent(
        new CustomEvent("reloop-demo-toggle", { detail: { active: next } })
      );
    }
  };

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

  const isOpsActive =
    pathname.startsWith("/dispatch") ||
    pathname.startsWith("/collector") ||
    pathname.startsWith("/dashboard");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#d8ddd7] bg-[#f4f5f1]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Identity & Public Navigation */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-display font-bold text-base tracking-widest text-[#151817] uppercase transition-opacity hover:opacity-90"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#2e7d57]" />
            <span>RE:LOOP</span>
          </Link>

          {/* Desktop Public Navigation */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-[#6b746e]">
            <Link
              href="/analyze"
              className={`transition-colors hover:text-[#151817] ${
                pathname.startsWith("/analyze")
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              Scan Item
            </Link>

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

            <Link
              href="/track"
              className={`transition-colors hover:text-[#151817] ${
                pathname.startsWith("/track")
                  ? "text-[#151817] font-semibold border-b-2 border-[#2e7d57] pb-1 -mb-1"
                  : ""
              }`}
            >
              Track
            </Link>

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
          </nav>
        </div>

        {/* Right: Demo Mode Toggle, Operations Gateway & CTA */}
        <div className="flex items-center gap-2.5">
          {/* Rectangular Demo Mode Toggle */}
          <button
            type="button"
            onClick={handleToggleDemo}
            title="Toggle Judge & Evaluator Demonstration Mode"
            className={`inline-flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isDemoActive
                ? "border-[#2e7d57] bg-[#edf5f0] text-[#1e583c] font-semibold"
                : "border-[#d8ddd7] bg-white text-[#6b746e] hover:text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-sm ${
                isDemoActive ? "bg-[#2e7d57]" : "bg-[#a1aaa4]"
              }`}
            />
            <span>Demo Mode</span>
          </button>

          {/* Operations Dropdown (Desktop) */}
          <div className="relative hidden md:block" ref={opsDropdownRef}>
            <button
              onClick={() => setIsOpsOpen(!isOpsOpen)}
              type="button"
              aria-expanded={isOpsOpen}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1.5 rounded-[2px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                isOpsActive
                  ? "border-[#2e7d57] bg-[#e6f2e8] text-[#173d2c]"
                  : "border-[#d8ddd7] bg-white text-[#151817] hover:bg-[#e9ede7]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-sm bg-[#2e7d57]" />
              <span>Operations</span>
              <ChevronDown className="h-3 w-3 text-[#6b746e]" />
            </button>

            {isOpsOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-[2px] border border-[#d8ddd7] bg-white p-1.5 shadow-sm">
                <div className="px-2.5 py-1.5 border-b border-[#d8ddd7] mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] block">
                    Operations Portal
                  </span>
                </div>
                <Link
                  href="/dispatch"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold">Dispatch</span>
                  <span className="text-[11px] text-[#6b746e]">Demand analysis &amp; route planning</span>
                </Link>
                <Link
                  href="/collector"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold text-[#2e7d57]">Collector</span>
                  <span className="text-[11px] text-[#6b746e]">Field manifest &amp; scale verification</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="flex flex-col px-2.5 py-2 rounded-[2px] text-xs text-[#151817] hover:bg-[#f4f5f1] transition-colors"
                >
                  <span className="font-semibold">Impact</span>
                  <span className="text-[11px] text-[#6b746e]">Facility transfer &amp; recovery ledger</span>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Primary Citizen Action */}
          <Link
            href="/request"
            className="inline-flex items-center justify-center rounded-[2px] bg-[#2e7d57] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644] active:bg-[#1e5437]"
          >
            + Book Pickup
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
            aria-label="Toggle Navigation Menu"
            className="md:hidden inline-flex items-center justify-center rounded-[2px] border border-[#d8ddd7] bg-white p-2 text-[#151817] hover:bg-[#e9ede7]"
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4 text-[#151817]" />
            ) : (
              <Menu className="h-4 w-4 text-[#151817]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#d8ddd7] bg-[#f4f5f1] px-4 py-4 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] px-2 block">
              Citizen Services
            </span>
            <Link
              href="/analyze"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Scan Item (AI Evaluation)</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#2e7d57]" />
            </Link>
            <Link
              href="/request"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-semibold text-[#151817] bg-white border border-[#d8ddd7]"
            >
              <span>Schedule Pickup</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#2e7d57]" />
            </Link>
            <Link
              href="/track"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Track Pickup</span>
              <span className="text-xs text-[#6b746e] font-mono">Token lookup</span>
            </Link>
            <Link
              href="/destinations"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Destinations &amp; Centers</span>
              <span className="text-xs text-[#6b746e]">Directory</span>
            </Link>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#d8ddd7]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e] px-2 block">
              Operations Portal
            </span>
            <Link
              href="/dispatch"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Dispatch</span>
              <span className="text-[10px] font-mono text-[#6b746e]">Fleet &amp; Routes</span>
            </Link>
            <Link
              href="/collector"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-semibold text-[#2e7d57] hover:bg-white"
            >
              <span>Collector</span>
              <span className="text-[10px] font-mono text-[#2e7d57]">Driver Manifest</span>
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-[2px] text-xs font-medium text-[#151817] hover:bg-white"
            >
              <span>Impact</span>
              <span className="text-[10px] font-mono text-[#6b746e]">Mass Balance</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
