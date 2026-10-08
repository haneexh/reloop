import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#d8ddd7] bg-[#e9ede7] py-10 text-xs text-[#6b746e]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Description */}
          <div className="md:col-span-5 space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display font-bold text-sm tracking-widest text-[#151817] uppercase"
            >
              <span className="h-2 w-2 rounded-sm bg-[#2e7d57]" />
              <span>RE:LOOP</span>
            </Link>
            <p className="text-xs text-[#6b746e] leading-relaxed max-w-sm">
              Community e-waste collection optimizer and verified material recovery tracking platform. We connect residents, municipal collection fleets, and certified recyclers with transparent scale audits.
            </p>
            <div className="pt-1 flex items-center gap-2 font-mono text-[11px] text-[#2e7d57]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2e7d57]" />
              <span>Civic Infrastructure · TH2-PS-SD-013</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#151817] font-bold block">
                Citizen Services
              </span>
              <ul className="space-y-2">
                <li>
                  <Link href="/request" className="hover:text-[#151817] transition-colors">
                    Schedule Pickup
                  </Link>
                </li>
                <li>
                  <Link href="/track" className="hover:text-[#151817] transition-colors">
                    Track Pickup
                  </Link>
                </li>
                <li>
                  <Link href="/#how-it-works" className="hover:text-[#151817] transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/destinations" className="hover:text-[#151817] transition-colors">
                    Destinations
                  </Link>
                </li>
                <li>
                  <Link href="/analyze" className="hover:text-[#151817] transition-colors">
                    Item Assessment
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#151817] font-bold block">
                Operations
              </span>
              <ul className="space-y-2">
                <li>
                  <Link href="/dispatch" className="hover:text-[#151817] transition-colors">
                    Dispatch Hub
                  </Link>
                </li>
                <li>
                  <Link href="/collector" className="hover:text-[#151817] transition-colors">
                    Collector App
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-[#151817] transition-colors">
                    Impact Ledger
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#151817] font-bold block">
                Trust &amp; Legal
              </span>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy" className="hover:text-[#151817] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-[#151817] transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <span className="text-[#a1aaa4] cursor-default">
                    Append-Only Ledger
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#d8ddd7] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] font-mono text-[#6b746e]">
          <div>
            <span>&copy; {new Date().getFullYear()} RE:LOOP. Community E-Waste Collection Optimizer.</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Verified Scales · Capacity-Aware Routes · No Black-Box Claims</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
