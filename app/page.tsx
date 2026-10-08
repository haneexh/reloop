import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FALLBACK_PARTNERS } from "@/lib/partners-data";
import { TrackingInputForm } from "@/components/TrackingInputForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

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
    <div className="space-y-16 sm:space-y-24">
      {/* 1. HERO SECTION */}
      <section className="relative rounded-[3px] border border-[#173d2c] bg-[#173d2c] text-white p-6 sm:p-12 overflow-hidden shadow-sm">
        {/* Subtle geometric line pattern in background (no glowing balls or 3D blobs) */}
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
                COMMUNITY E-WASTE COLLECTION
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-tight tracking-tight">
              Give your old electronics a{" "}
              <span className="text-[#9ec4ad] underline decoration-[#2e7d57] underline-offset-4">
                better destination
              </span>
              .
            </h1>

            <p className="text-base sm:text-lg text-white/85 max-w-xl leading-relaxed">
              Schedule a pickup for unwanted electronics and follow them from collection through verified recovery.
            </p>

            {/* Primary actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Link
                href="/request"
                className="inline-flex items-center justify-center rounded-[3px] bg-[#9ec4ad] px-6 py-3.5 text-xs font-bold text-[#151817] transition-all hover:bg-[#b2d5be] active:translate-y-0.5"
              >
                Schedule a Pickup &rarr;
              </Link>
              <Link
                href="#track-pickup"
                className="inline-flex items-center justify-center rounded-[3px] border border-white/40 bg-transparent px-5 py-3.5 text-xs font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Track a Pickup
              </Link>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                Doorstep Weighing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                {partnerCount} Verified Facilities
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9ec4ad]" />
                Unique QR Audit Token
              </span>
            </div>
          </div>

          {/* Restrained Architectural Service Card Visual */}
          <div className="lg:col-span-5">
            <div className="rounded-[3px] border border-white/20 bg-white/5 p-5 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#9ec4ad]">
                  Verified Service Manifest
                </span>
                <span className="font-mono text-[11px] text-white/60">
                  HYD METRO ZONE
                </span>
              </div>

              {/* Step preview card */}
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">STEP 1 · PICKUP</span>
                    <span className="text-white font-semibold">Doorstep Scale Verification</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">Calibrated</span>
                </div>

                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">STEP 2 · LOGISTICS</span>
                    <span className="text-white font-semibold">Capacity-Aware Routing</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">Optimized</span>
                </div>

                <div className="flex items-start justify-between bg-black/20 p-3 rounded-[2px] border border-white/10">
                  <div>
                    <span className="text-[10px] text-white/60 block">STEP 3 · RECOVERY</span>
                    <span className="text-white font-semibold">Authorized Recycler Custody</span>
                  </div>
                  <span className="text-[#9ec4ad] text-[11px]">Audited</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] font-mono text-white/70">
                <span>CHAIN OF CUSTODY</span>
                <span className="text-white font-semibold">100% Traceable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="space-y-2 max-w-xl">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#2e7d57] block">
            Operational Lifecycle
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#151817]">
            How it works
          </h2>
          <p className="text-sm text-[#6b746e] leading-relaxed">
            Three predictable steps from your home to verified material recovery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-6 space-y-4 flex flex-col justify-between hover:border-[#2e7d57] transition-colors">
            <div className="space-y-3">
              <span className="font-mono text-xs font-bold text-[#2e7d57] block">
                01
              </span>
              <h3 className="font-display text-lg font-bold text-[#151817]">
                REQUEST
              </h3>
              <p className="text-xs text-[#6b746e] leading-relaxed">
                Tell us what electronics you want collected.
              </p>
            </div>
            <div className="border-t border-[#d8ddd7] pt-3 text-[11px] text-[#6b746e]">
              Enter item details, address, and pick a time window. Receive an instant tracking code.
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-6 space-y-4 flex flex-col justify-between hover:border-[#2e7d57] transition-colors">
            <div className="space-y-3">
              <span className="font-mono text-xs font-bold text-[#2e7d57] block">
                02
              </span>
              <h3 className="font-display text-lg font-bold text-[#151817]">
                COLLECT
              </h3>
              <p className="text-xs text-[#6b746e] leading-relaxed">
                We schedule the pickup based on location, timing and vehicle capacity.
              </p>
            </div>
            <div className="border-t border-[#d8ddd7] pt-3 text-[11px] text-[#6b746e]">
              A collector verifies the items at your door, scans your QR code, and logs weight on a digital scale.
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-6 space-y-4 flex flex-col justify-between hover:border-[#2e7d57] transition-colors">
            <div className="space-y-3">
              <span className="font-mono text-xs font-bold text-[#2e7d57] block">
                03
              </span>
              <h3 className="font-display text-lg font-bold text-[#151817]">
                RECOVER
              </h3>
              <p className="text-xs text-[#6b746e] leading-relaxed">
                Your e-waste is weighed and tracked through verified recovery.
              </p>
            </div>
            <div className="border-t border-[#d8ddd7] pt-3 text-[11px] text-[#6b746e]">
              Consolidated payloads transfer to licensed recycling facilities where material recovery is recorded.
            </div>
          </div>
        </div>
      </section>

      {/* 3. WHAT CAN BE COLLECTED SECTION */}
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
            <Card key={cat.title} className="hover:border-[#2e7d57] transition-colors">
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

        <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6b746e]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#2e7d57] font-bold">NOTE:</span>
            <span>Unsure whether your specific electronic item qualifies? Check our destination catalog or enter it directly.</span>
          </div>
          <Link
            href="/analyze"
            className="font-semibold text-[#2e7d57] hover:underline whitespace-nowrap"
          >
            Assess an item &rarr;
          </Link>
        </div>
      </section>

      {/* 4. WHAT HAPPENS AFTER COLLECTION SECTION */}
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

        <div className="rounded-[3px] border border-[#d8ddd7] bg-white divide-y divide-[#d8ddd7] overflow-hidden">
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

      {/* 5. TRUST & TRANSPARENCY SECTION */}
      <section className="rounded-[3px] border border-[#d8ddd7] bg-[#e9ede7] p-6 sm:p-10 space-y-6">
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
          <div className="rounded-[3px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#2e7d57] block">
              1. Individual Tracking Code
            </span>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Your pickup receives a unique tracking code so you can check its status anytime without an account.
            </p>
          </div>

          <div className="rounded-[3px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
            <span className="font-mono text-xs font-bold text-[#2e7d57] block">
              2. Calibrated Scale Weighing
            </span>
            <p className="text-xs text-[#6b746e] leading-relaxed">
              Collection weight is recorded with a certified digital scale at your doorstep, not guessed by an algorithm.
            </p>
          </div>

          <div className="rounded-[3px] bg-white p-4 border border-[#d8ddd7] space-y-1.5">
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

      {/* 6. TRACKING CTA SECTION */}
      <section
        id="track-pickup"
        className="rounded-[3px] border border-[#d8ddd7] bg-white p-6 sm:p-10 space-y-6 scroll-mt-20 shadow-sm"
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
              Enter the 8-character tracking token issued when you booked (e.g. <span className="font-mono text-[#151817] font-semibold">RLP-HYD-A7F2</span>) to view current vehicle status and verified scale records.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[3px] border border-[#d8ddd7] bg-[#f4f5f1] p-5 space-y-3">
              <span className="text-xs font-semibold text-[#151817] block">
                Enter Tracking Code
              </span>
              <TrackingInputForm buttonLabel="Track Pickup" />
              <div className="flex items-center justify-between text-[11px] text-[#6b746e] pt-1">
                <span>Lost your code? Check your booking confirmation screen.</span>
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
