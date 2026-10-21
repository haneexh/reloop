"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

export function JudgeDemoBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [signingInRole, setSigningInRole] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Check ?demo=1 query parameter or existing demo cookie / localStorage
  useEffect(() => {
    const hasDemoParam = searchParams.get("demo") === "1";

    // Read cookie directly
    const hasSessionCookie = typeof document !== "undefined" && document.cookie.includes("reloop_operator_session=");
    const hasStoredFlag = typeof window !== "undefined" && window.localStorage.getItem("reloop_demo_active") === "true";

    if (hasDemoParam || hasSessionCookie || hasStoredFlag) {
      setIsVisible(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("reloop_demo_active", "true");
      }
    }

    // Check active role from server session
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/operator");
        const json = await res.json();
        if (json.authenticated) {
          setCurrentRole(json.role);
          setIsVisible(true);
        }
      } catch {
        // Fallback
      }
    }
    checkSession();

    // Listen for custom toggle event from Navigation bar
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ active?: boolean }>;
      if (typeof customEvent.detail?.active === "boolean") {
        setIsVisible(customEvent.detail.active);
      } else {
        setIsVisible((prev) => !prev);
      }
    };
    window.addEventListener("reloop-demo-toggle", handleToggle);
    return () => window.removeEventListener("reloop-demo-toggle", handleToggle);
  }, [searchParams]);

  const handleResetDemoData = async () => {
    setIsResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) {
        setResetMessage("Reset complete");
        setTimeout(() => setResetMessage(null), 3000);
        router.refresh();
      } else {
        setResetMessage("Reset failed");
      }
    } catch {
      setResetMessage("Reset failed");
    } finally {
      setIsResetting(false);
    }
  };

  const handleRoleSignIn = async (role: "DISPATCHER" | "COLLECTOR" | "AUDITOR", targetUrl: string) => {
    setSigningInRole(role);
    try {
      const res = await fetch("/api/auth/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, isDemo: true }),
      });
      if (res.ok) {
        setCurrentRole(role);
        router.push(targetUrl);
      }
    } catch (e) {
      console.error("Demo login error:", e);
    } finally {
      setSigningInRole(null);
    }
  };

  if (!isVisible) return null;

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
      href: "/request?demo=1",
      active: pathname.startsWith("/request"),
    },
    {
      num: "2",
      title: "Public Tracking",
      desc: "Custody badges, ETA, and QR verification pass",
      href: "/track/QR-REQ-HYD-001?demo=1",
      active: pathname.startsWith("/track"),
    },
    {
      num: "3",
      title: "Dispatch Operations",
      desc: "Spatial demand clustering & CVRP capacity routes",
      href: "/dispatch?demo=1",
      active: isDispatcher,
      roleRequired: "DISPATCHER" as const,
    },
    {
      num: "4",
      title: "Field Collection",
      desc: "Driver manifests, scale weights & QR scans",
      href: "/collector?demo=1",
      active: isCollector,
      roleRequired: "COLLECTOR" as const,
    },
    {
      num: "5",
      title: "Circularity & Diversion",
      desc: "Formal vs informal split & mass balance",
      href: "/dashboard?demo=1",
      active: isImpact,
      roleRequired: "AUDITOR" as const,
    },
  ];

  return (
    <aside aria-label="Demo and Role Navigation" className="w-full border-b border-[#d8ddd7] bg-[#f9faf8] text-[#151817]">
      {/* Top Role Bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-1.5 sm:px-6 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#6b746e] whitespace-nowrap">
            Judge Role:
          </span>

          <Link
            href="/request?demo=1"
            className={`px-2.5 py-0.5 rounded-[2px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isCitizen
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            Citizen
          </Link>

          <button
            type="button"
            disabled={signingInRole === "DISPATCHER"}
            onClick={() => handleRoleSignIn("DISPATCHER", "/dispatch?demo=1")}
            className={`px-2.5 py-0.5 rounded-[2px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isDispatcher || currentRole === "DISPATCHER"
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            {signingInRole === "DISPATCHER" ? "Signing in..." : "Dispatcher [Demo Login]"}
          </button>

          <button
            type="button"
            disabled={signingInRole === "COLLECTOR"}
            onClick={() => handleRoleSignIn("COLLECTOR", "/collector?demo=1")}
            className={`px-2.5 py-0.5 rounded-[2px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isCollector || currentRole === "COLLECTOR"
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            {signingInRole === "COLLECTOR" ? "Signing in..." : "Collector [Demo Login]"}
          </button>

          <button
            type="button"
            disabled={signingInRole === "AUDITOR"}
            onClick={() => handleRoleSignIn("AUDITOR", "/dashboard?demo=1")}
            className={`px-2.5 py-0.5 rounded-[2px] border font-medium text-[11px] transition-colors whitespace-nowrap ${
              isImpact || currentRole === "AUDITOR"
                ? "bg-[#2e7d57] border-[#2e7d57] text-white font-semibold"
                : "bg-white border-[#d8ddd7] text-[#151817] hover:bg-[#e9ede7]"
            }`}
          >
            {signingInRole === "AUDITOR" ? "Signing in..." : "Auditor [Demo Login]"}
          </button>
        </div>

        {/* Right: Demo Guide Toggle & Reset Action */}
        <div className="flex items-center gap-2">
          {resetMessage && (
            <span className="font-mono text-[10px] text-[#2e7d57] font-semibold">
              {resetMessage}
            </span>
          )}

          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetDemoData}
            title="Reset demo routes and requests back to initial planned state"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[2px] border border-[#d8ddd7] bg-white text-[11px] font-medium text-[#151817] hover:bg-[#e9ede7] transition-colors"
          >
            <RotateCcw className={`h-3 w-3 text-[#6b746e] ${isResetting ? "animate-spin" : ""}`} />
            <span>{isResetting ? "Resetting..." : "Reset demo data"}</span>
          </button>

          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-[2px] bg-[#edf5f0] border border-[#bcdbc8] font-mono text-[10px] text-[#1e583c]">
            Demo Active
          </span>

          <button
            type="button"
            onClick={() => setIsGuideOpen(!isGuideOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border border-[#d8ddd7] bg-white text-[11px] font-semibold text-[#151817] hover:bg-[#e9ede7] transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-sm bg-[#2e7d57]" />
            <span>Judge Guide (5 Steps)</span>
            {isGuideOpen ? (
              <ChevronUp className="h-3 w-3 text-[#6b746e]" />
            ) : (
              <ChevronDown className="h-3 w-3 text-[#6b746e]" />
            )}
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
                <button
                  key={st.num}
                  type="button"
                  onClick={() => {
                    if (st.roleRequired) {
                      handleRoleSignIn(st.roleRequired, st.href);
                    } else {
                      router.push(st.href);
                    }
                  }}
                  className={`p-2.5 rounded-[2px] border text-left transition-all block ${
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
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
