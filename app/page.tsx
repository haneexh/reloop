import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FALLBACK_PARTNERS } from "@/lib/partners-data";
import { TrackingInputForm } from "@/components/TrackingInputForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  ScanLine,
  Truck,
  Search,
  ArrowRight,
  Wrench,
  Repeat,
  HeartHandshake,
  DollarSign,
  Cpu,
  Recycle,
} from "lucide-react";

export const revalidate = 60; // revalidate at most once per minute

const ACCEPTED_CATEGORIES = [
  {
    title: "Phones & Tablets",
    examples: "Smartphones, basic mobile phones, iPads, and Android tablets.",
    guidance: "Remove SIM & memory cards. Battery-swollen devices accepted.",
    badge: "High Recycling Value",
  },
  {
    title: "Computers & Laptops",
    examples: "Laptops, notebooks, desktop CPU towers, motherboards, and servers.",
    guidance: "Hard drive wipe advised before handover. Keyboards & mice accepted.",
    badge: "Direct Component Recovery",
  },
  {
    title: "TVs & Monitors",
    examples: "Flat LED/LCD screens, desktop displays, and legacy CRT televisions.",
    guidance: "Heavy displays handled with care. Keep glass intact during handover.",
    badge: "Regulated Lead & Glass",
  },
  {
    title: "Printers",
    examples: "Inkjet printers, office laserjet copiers, scanners, and 3-in-1 units.",
    guidance: "Remove loose toner cartridges if separate; otherwise handover whole.",
    badge: "Plastics & Coils",
  },
  {
    title: "Small Electronics",
    examples: "Audio receivers, DVD players, microwave ovens, and kitchen appliances.",
    guidance: "Must be electronic or motorized home devices under 25 kg.",
    badge: "Copper & Ferrous Metals",
  },
  {
    title: "Accessories & Peripherals",
    examples: "Cables, chargers, USB cords, power bricks, webcams, and adapters.",
    guidance: "Bundle loose cables together in a box or bag for easy weighing.",
    badge: "High Copper Yield",
  },
];

const LIFECYCLE_STEPS = [
  {
    step: "01",
    title: "Scan",
    description: "Upload a photo or choose a sample device. Vision AI identifies the hardware, age, and physical condition.",
  },
  {
    step: "02",
    title: "Decide",
    description: "Our deterministic engine evaluates 6 circular pathways with the Post-Purchase Repairability Index (PP-RI) and dual environmental-economic score.",
  },
  {
    step: "03",
    title: "Act",
    description: "Connect to verified local repair clinics, refurbishers, NGOs, or schedule a municipal doorstep collection.",
  },
  {
    step: "04",
    title: "Collect",
    description: "Capacity-constrained vehicle routing (CVRP) plans efficient routes with doorstep digital scale and QR audit verification.",
  },
  {
    step: "05",
    title: "Trace",
    description: "Public chain of custody records every handover, verified scale weight, and facility transfer with a unique audit token.",
  },
  {
    step: "06",
    title: "Measure",
    description: "Municipal mass balance accounting tracks material recovery rates, informal sector formalization, and avoided CO2 emissions.",
  },
];

const CIRCULAR_PATHWAYS = [
  {
    title: "Repair",
    icon: Wrench,
    focus: "Extend functional lifespan",
    example: "Smartphone with a cracked glass panel or degraded battery. Screen and cell replacement extends useful device life by 2+ years.",
    action: "Local Repair Clinics",
  },
  {
    title: "Reuse",
    icon: Repeat,
    focus: "Direct secondary utility",
    example: "Working tablet or monitor passed to a student or secondary household member without remanufacturing overhead.",
    action: "Direct Re-allocation",
  },
  {
    title: "Donate",
    icon: HeartHandshake,
    focus: "Community digital access",
    example: "Functional desktop computer tower or peripherals gifted to registered municipal schools, training labs, or non-profit centers.",
    action: "Verified NGO Partners",
  },
  {
    title: "Resell",
    icon: DollarSign,
    focus: "Economic value recovery",
    example: "Recent DSLR camera, gaming console, or premium smartphone with significant secondary market value in Hyderabad.",
    action: "Secondary Markets",
  },
  {
    title: "Refurbish",
    icon: Cpu,
    focus: "Professional hardware upgrade",
    example: "Corporate enterprise laptops wiped of data, upgraded with additional RAM/SSD, and certified for commercial re-entry.",
    action: "Certified Refurbishers",
  },
  {
    title: "Recycle",
    icon: Recycle,
    focus: "Safe material extraction",
    example: "Obsolete CRT televisions, shattered monitors, and burnt circuit boards routed to authorized smelters for copper, gold, and lead recovery.",
    action: "State-Authorized Smelters",
  },
];

const OPERATIONAL_CHAIN = [
  {
    step: "01",
    status: "Pickup requested",
    description: "You submit your items, address, and preferred time window. A unique tracking code is generated immediately.",
    detail: "Item manifest logged · PII protected · Zone mapped",
  },
  {
    step: "02",
    status: "Pickup scheduled",
    description: "Our municipal dispatch engine groups stops by neighborhood zone and vehicle payload capacity to minimize transit emissions.",
    detail: "Fleet route planned · Carbon-conscious dispatch",
  },
  {
    step: "03",
    status: "Collected & weighed",
    description: "A verified collection driver arrives during your window, verifies the QR code at your door, and logs the gross weight on a calibrated digital scale.",
    detail: "Doorstep scale audit · Custody transfer logged",
  },
  {
    step: "04",
    status: "Transferred to recovery facility",
    description: "Batched e-waste is transferred directly to state-authorized recycling, refurbishment, and scrap processing partners.",
    detail: "Licensed processors · Formal chain of custody",
  },
  {
    step: "05",
    status: "Recovery recorded",
    description: "Processing facilities report audited outcomes: metals extracted, components refurbished, and hazardous materials safely neutralised.",
    detail: "Audited mass balance · Public tracking update",
  },
];

export default async function Home() {
  let partnerCount = FALLBACK_PARTNERS.filter((p) => p.verified !== false).length;
  try {
    const { count, error } = await supabase
      .from("partners")
      .select("*", { count: "exact", head: true });
    if (!error && typeof count === "number") {
      partnerCount = count;
    }
  } catch (err) {
    console.error("Live partner count query error:", err);
  }

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* 1. HERO SECTION */}
      <section className="relative rounded-[2px] border border-[#173d2c] bg-[#173d2c] text-white p-6 sm:p-12 overflow-hidden shadow-sm">
        {/* Subtle geometric line pattern in background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-[#9ec4ad]" />
              <span className="font-mono text-xs font-bold tracking-widest text-[#9ec4ad] uppercase">
                COMMUNITY E-WASTE COLLECTION OPTIMIZER (PS-013)
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-tight tracking-tight">
              Assess an electronic item or{" "}
              <span className="text-[#9ec4ad] underline decoration-[#2e7d57] underline-offset-4">
                schedule a verified pickup
              </span>
              .
            </h1>

            <p className="text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
              Scan devices to evaluate repair, reuse, resale, and recycling viability, or schedule a doorstep e-waste pickup with capacity-optimized routing and verified scale weighing.
            </p>

            {/* Equal Primary Actions: Scan Item & Schedule Pickup */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center gap-2 rounded-[2px] bg-[#9ec4ad] px-5 py-3.5 text-xs font-bold text-[#151817] transition-all hover:bg-[#b2d5be] active:translate-y-0.5"
              >
                <ScanLine className="h-4 w-4" />
                <span>Scan an item</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/request"
                className="inline-flex items-center justify-center gap-2 rounded-[2px] bg-white px-5 py-3.5 text-xs font-bold text-[#151817] transition-all hover:bg-[#e9ede7] active:translate-y-0.5"
              >
                <Truck className="h-4 w-4 text-[#2e7d57]" />
                <span>Schedule a pickup</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="#track-pickup"
                className="inline-flex items-center justify-center rounded-[2px] border border-white/40 bg-transparent px-4 py-3.5 text-xs font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Track a pickup
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                PP-RI Repairability Index
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                Doorstep Digital Scale
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                {partnerCount} Verified Facilities
              </span>
            </div>
          </div>

          {/* Architectural Service Card Visual */}
          <div className="lg:col-span-5">
            <div className="rounded-[2px] border border-white/20 bg-white/5 p-5 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#9ec4ad]">
                  Dual Engine Architecture
                </span>
                <span className="font-mono text-[11px] text-white/60">
                  HYD METRO ZONE
                </span>
              </div>

              {/* Step preview card */}
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">FEATURE A: AI INTAKE</span>
                    <span className="text-white font-semibold">6-Pathway Decision &amp; PP-RI</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">Deterministic</span>
                </div>

                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">FEATURE B: FLEET LOGISTICS</span>
                    <span className="text-white font-semibold">CVRP Capacity Routing</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">Optimized</span>
                </div>

                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">CHAIN OF CUSTODY</span>
                    <span className="text-white font-semibold">Scale Weight &amp; QR Audit</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">100% Traceable</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] font-mono text-white/70">
                <span>OPERATIONAL RIGOR</span>
                <span className="text-white font-semibold">Zero Fake Metrics</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRY THE DEMO STRIP */}
      <section className="rounded-[2px] border border-[#bcdbc8] bg-[#edf5f0] p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-sm bg-[#2e7d57]" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#1e583c]">
              Evaluation Quick Access
            </span>
          </div>
          <p className="text-xs text-[#151817]">
            Test the entire loop in 3 minutes without entering real personal data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-white border border-[#bcdbc8] font-semibold text-[#151817] hover:bg-[#e9ede7] transition-colors"
          >
            <ScanLine className="h-3.5 w-3.5 text-[#2e7d57]" />
            <span>Try Sample Scan (3 Devices)</span>
          </Link>
          <Link
            href="/track/QR-REQ-HYD-001"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-white border border-[#bcdbc8] font-semibold text-[#151817] hover:bg-[#e9ede7] transition-colors"
          >
            <Search className="h-3.5 w-3.5 text-[#2e7d57]" />
            <span>Load Demo Pass (QR-REQ-HYD-001)</span>
          </Link>
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#2e7d57] font-semibold text-white hover:bg-[#246644] transition-colors"
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Open Fleet Operations</span>
          </Link>
        </div>
      </section>

      {/* 3. LIFECYCLE SECTION: SCAN, DECIDE, ACT, COLLECT, TRACE, MEASURE */}
      <section className="space-y-8 scroll-mt-20">
        <div className="space-y-2 max-w-xl">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
            End-To-End Architecture
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
            Scan, Decide, Act, Collect, Trace, Measure
          </h2>
          <p className="text-sm text-[#6b746e] leading-relaxed">
            Six disciplined operational phases linking citizen decision-making with municipal logistics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {LIFECYCLE_STEPS.map((st) => (
            <div
              key={st.step}
              className="rounded-[2px] border border-[#d8ddd7] bg-white p-5 space-y-3 hover:border-[#2e7d57] transition-colors flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#2e7d57]">
                    {st.step}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#6b746e]">
                    Phase {st.step}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-[#151817]">
                  {st.title}
                </h3>
                <p className="text-xs text-[#6b746e] leading-relaxed">
                  {st.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SIX CIRCULAR PATHWAYS SECTION */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
              Circular Decision Framework
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
              Six pathways for electronics
            </h2>
            <p className="text-sm text-[#6b746e] leading-relaxed">
              Every device is unique. Rather than treating all e-waste as uniform scrap, our engine routes hardware to the highest-utility outcome.
            </p>
          </div>
          <Link
            href="/analyze"
            className="text-xs font-semibold text-[#2e7d57] hover:underline whitespace-nowrap"
          >
            Assess a device now &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CIRCULAR_PATHWAYS.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.title} className="hover:border-[#2e7d57] transition-colors rounded-[2px]">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-[2px] bg-[#edf5f0] flex items-center justify-center text-[#2e7d57]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-display text-base font-bold text-[#151817]">
                        {p.title}
                      </h3>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {p.focus}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#151817] leading-relaxed">
                    {p.example}
                  </p>
                  <div className="border-t border-[#d8ddd7] pt-2 text-[11px] font-mono text-[#6b746e] flex items-center justify-between">
                    <span>Target Node:</span>
                    <span className="text-[#2e7d57] font-semibold">{p.action}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 5. WHAT CAN BE COLLECTED SECTION */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
              Accepted Materials
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
              What can be collected
            </h2>
            <p className="text-sm text-[#6b746e]">
              We accept consumer, home, and office electronics across standardized civic categories.
            </p>
          </div>
          <Link
            href="/request"
            className="text-xs font-semibold text-[#2e7d57] hover:underline whitespace-nowrap"
          >
            Schedule item pickup &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ACCEPTED_CATEGORIES.map((cat) => (
            <Card key={cat.title} className="hover:border-[#2e7d57] transition-colors rounded-[2px]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-[#151817]">
                    {cat.title}
                  </h3>
                  <Badge variant="neutral" size="sm">
                    {cat.badge}
                  </Badge>
                </div>
                <p className="text-xs text-[#151817] font-medium leading-relaxed">
                  {cat.examples}
                </p>
                <p className="text-[11px] text-[#6b746e] leading-relaxed border-t border-[#d8ddd7] pt-2">
                  {cat.guidance}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="rounded-[2px] border border-[#d8ddd7] bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6b746e]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#2e7d57] font-bold">NOTE:</span>
            <span>Unsure whether your electronic item qualifies? Test it in our AI intake or view verified drop-off centers.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/analyze"
              className="font-semibold text-[#2e7d57] hover:underline whitespace-nowrap"
            >
              Scan an item &rarr;
            </Link>
            <Link
              href="/destinations"
              className="font-medium text-[#6b746e] hover:underline whitespace-nowrap"
            >
              View directory &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* 6. WHAT HAPPENS AFTER COLLECTION SECTION */}
      <section className="space-y-8">
        <div className="space-y-2 max-w-xl">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
            End-To-End Traceability
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
            What happens after collection
          </h2>
          <p className="text-sm text-[#6b746e] leading-relaxed">
            Your e-waste does not disappear into an anonymous dump. Every kilogram follows a documented custody chain.
          </p>
        </div>

        <div className="rounded-[2px] border border-[#d8ddd7] bg-white divide-y divide-[#d8ddd7] overflow-hidden">
          {OPERATIONAL_CHAIN.map((item) => (
            <div
              key={item.step}
              className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:bg-[#f9faf8] transition-colors"
            >
              <div className="md:col-span-1 font-mono text-xs font-bold text-[#2e7d57]">
                {item.step}
              </div>
              <div className="md:col-span-4 space-y-1">
                <h3 className="font-display text-sm font-bold text-[#151817]">
                  {item.status}
                </h3>
                <span className="font-mono text-[11px] text-[#6b746e] block">
                  {item.detail}
                </span>
              </div>
              <div className="md:col-span-7 text-xs text-[#6b746e] leading-relaxed">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. TRUST & TRANSPARENCY SECTION */}
      <section className="rounded-[2px] border border-[#d8ddd7] bg-[#e9ede7] p-6 sm:p-10 space-y-6">
        <div className="space-y-2 max-w-2xl">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
            Factual Standards
          </span>
          <h2 className="font-display text-2xl font-bold text-[#151817]">
            Built on operational facts, not marketing claims
          </h2>
          <p className="text-xs sm:text-sm text-[#6b746e] leading-relaxed">
            Civic infrastructure must be honest. We report verified scale measurements and facility transfer receipts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-[2px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#2e7d57] block">
              1. Individual Tracking Code
            </span>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Your pickup receives a unique tracking code so you can check its status anytime without an account.
            </p>
          </div>

          <div className="rounded-[2px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#2e7d57] block">
              2. Calibrated Scale Weighing
            </span>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Collection weight is recorded with a certified digital scale at your doorstep, not guessed by an algorithm.
            </p>
          </div>

          <div className="rounded-[2px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#2e7d57] block">
              3. Facility Transfer Audit
            </span>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Recovery outcomes are recorded after facility transfer, creating a verifiable paper trail for material recovery.
            </p>
          </div>
        </div>

        <div className="border-t border-[#d8ddd7] pt-4 text-[11px] text-[#6b746e] leading-relaxed">
          <strong className="text-[#151817]">Our Transparency Commitment: </strong>
          We do not claim 100% recycling or zero-landfill miracles. Electronics contain complex composite fractions; we report real audited mass balance figures across materials recovered, components refurbished, and residual waste handled according to environmental regulations.
        </div>
      </section>

      {/* 8. TRACKING CTA SECTION */}
      <section
        id="track-pickup"
        className="rounded-[2px] border border-[#d8ddd7] bg-white p-6 sm:p-10 space-y-6 scroll-mt-20 shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
              Active Request Lookup
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
              Already requested a pickup?
            </h2>
            <p className="text-xs sm:text-sm text-[#6b746e] leading-relaxed">
              Enter the tracking token issued when you booked (e.g. <span className="font-mono text-[#151817] font-semibold">QR-REQ-HYD-001</span>) to view current vehicle status and verified scale records.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[2px] border border-[#d8ddd7] bg-[#f4f5f1] p-5 space-y-3">
              <span className="text-xs font-semibold text-[#151817] block">
                Enter Tracking Code
              </span>
              <TrackingInputForm buttonLabel="Track Pickup" />
              <div className="flex items-center justify-between text-[11px] text-[#6b746e] pt-1">
                <span>Demo token: QR-REQ-HYD-001</span>
                <Link href="/request" className="text-[#2e7d57] hover:underline font-semibold">
                  New request &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
