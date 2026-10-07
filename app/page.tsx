import Link from "next/link";
import { ProcessRail } from "@/components/ProcessRail";
import { supabase } from "@/lib/supabase";
import { FALLBACK_PARTNERS } from "@/lib/partners-data";

export const revalidate = 60; // revalidate at most once per minute

const pathways = [
  { number: "01", title: "Repair", desc: "Keep the thing you own working longer." },
  { number: "02", title: "Reuse", desc: "Give the product another job before replacing it." },
  { number: "03", title: "Donate", desc: "Move useful value to someone who needs it." },
  { number: "04", title: "Resell", desc: "Recover value while keeping materials in motion." },
  { number: "05", title: "Refurbish", desc: "Restore more than function — restore confidence." },
  { number: "06", title: "Recycle", desc: "Recover material when the next use has run out." },
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
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="rounded-sm bg-[#173d2c] text-white p-8 sm:p-12 relative overflow-hidden border border-[#173d2c]">
        {/* Subtle background circular motif */}
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full border border-white/10 pointer-events-none" />
        <div className="absolute -right-36 -top-36 w-[32rem] h-[32rem] rounded-full border border-white/5 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#9ec4ad] uppercase">
              <span className="inline-block w-6 h-[1px] bg-[#9ec4ad]" />
              <span>POST-PURCHASE CIRCULARITY ENGINE</span>
            </div>

            <h1 className="text-4xl font-display font-medium tracking-tight sm:text-6xl text-white leading-tight">
              Make the <em className="italic font-serif text-[#9cc9ad]">next move</em> count.
            </h1>

            <p className="text-base sm:text-lg text-white/80 max-w-2xl leading-relaxed">
              RE:LOOP turns a product photo or live camera capture into a transparent recommendation for what to do with it next — not just &ldquo;recycle this.&rdquo;
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center justify-center rounded-sm bg-white px-5 py-3 text-xs font-bold text-[#151817] transition-transform hover:-translate-y-0.5 hover:bg-[#f4f5f1]"
              >
                Start Assessment &rarr;
              </Link>
              <Link
                href="/destinations"
                className="inline-flex items-center justify-center rounded-sm border border-white/30 bg-transparent px-4 py-3 text-xs font-medium text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Browse Destination Directory
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-sm border border-white/30 bg-transparent px-4 py-3 text-xs font-medium text-white transition-colors hover:border-white hover:bg-white/10"
              >
                View Fleet Ledger
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4 border-l border-white/20 pl-6 space-y-3">
            <p className="font-display text-xl sm:text-2xl text-white/95 leading-snug font-medium">
              A decision engine for the next life of the things you already own.
            </p>
            <p className="text-xs text-white/70 leading-relaxed">
              AI identifies. You verify. Deterministic rules show the trade-offs.
            </p>
          </div>
        </div>
      </section>

      {/* Horizontal Process Rail Component */}
      <ProcessRail active={1} />

      {/* Six Possible Futures Section */}
      <section className="space-y-6">
        <div className="space-y-1 max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#2e7d57]">
            One item. Six possible futures.
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#151817]">
            The right answer is rarely a single bin.
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            RE:LOOP compares the full circularity set so you can see the most useful next step — economically and environmentally.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#d8ddd7] border border-[#d8ddd7] rounded-sm overflow-hidden">
          {pathways.map((item) => (
            <article
              key={item.title}
              className="bg-white p-6 min-h-[160px] flex flex-col justify-between hover:bg-[#e6f2e8]/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#2e7d57]">
                  {item.number}
                </span>
                <span className="text-sm text-[#2e7d57] font-bold">↗</span>
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-[#151817]">
                  {item.title}
                </h3>
                <p className="text-xs text-[#6b746e] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Methodology: Explainable by Design Dark Band Section */}
      <section className="rounded-sm bg-[#173d2c] text-white p-8 sm:p-10 border border-[#173d2c]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9ec4ad]">
              How the decision is made
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-medium text-white">
              Explainable by design.
            </h2>
            <p className="text-xs text-white/70 leading-relaxed pt-2">
              No black-box verdicts. The system keeps the reasoning visible, then lets you verify and adjust facts before a recommendation is finalized.
            </p>
          </div>

          <div className="lg:col-span-7 divide-y divide-white/15 border-t border-b border-white/15">
            <div className="grid grid-cols-12 gap-4 py-4">
              <span className="col-span-2 font-display font-bold text-sm text-[#9ec4ad]">
                01
              </span>
              <div className="col-span-10 space-y-0.5">
                <h3 className="font-display text-sm font-semibold text-white">
                  AI identifies
                </h3>
                <p className="text-xs text-white/70">
                  Multimodal vision models (Gemini 2.0 Flash / Claude / OpenAI) extract a structured first read on item type, brand, and condition.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 py-4">
              <span className="col-span-2 font-display font-bold text-sm text-[#9ec4ad]">
                02
              </span>
              <div className="col-span-10 space-y-0.5">
                <h3 className="font-display text-sm font-semibold text-white">
                  Human verifies
                </h3>
                <p className="text-xs text-white/70">
                  Confirm what is true. Edit fields that matter. Human verification drives the deterministic model.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 py-4">
              <span className="col-span-2 font-display font-bold text-sm text-[#9ec4ad]">
                03
              </span>
              <div className="col-span-10 space-y-0.5">
                <h3 className="font-display text-sm font-semibold text-white">
                  Rules decide
                </h3>
                <p className="text-xs text-white/70">
                  A transparent Post-Purchase Repairability Index (PP-RI) and 6-pathway economic/carbon matrix compute trade-offs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 py-4">
              <span className="col-span-2 font-display font-bold text-sm text-[#9ec4ad]">
                04
              </span>
              <div className="col-span-10 space-y-0.5">
                <h3 className="font-display text-sm font-semibold text-white">
                  Destinations act
                </h3>
                <p className="text-xs text-white/70">
                  Find verified repair centers, refurbishers, NGOs, formal recyclers, or informal collectors (kabadiwalas) nearby via GPS sorting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Data Specification Summary */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-[#151817] uppercase tracking-wider font-mono">
          System Capability Summary
        </h2>
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-[#6b746e] block text-[11px]">Database Nodes</span>
              <span className="text-base font-bold text-[#151817]">{partnerCount} Verified</span>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[11px]">Coverage Metros</span>
              <span className="text-base font-bold text-[#151817]">Hyderabad + BLR</span>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[11px]">Decision Model</span>
              <span className="text-base font-bold text-[#2e7d57]">Deterministic PP-RI</span>
            </div>
            <div>
              <span className="text-[#6b746e] block text-[11px]">Vision Inference</span>
              <span className="text-base font-bold text-[#151817]">Gemini / Claude / GPT</span>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Notice */}
      <section className="border-t border-[#d8ddd7] pt-6">
        <div className="rounded-sm border border-[#d8ddd7] bg-[#e9ede7] p-3 text-[11px] text-[#6b746e] leading-relaxed">
          <strong className="text-[#151817]">Privacy specification: </strong>
          Item photographs and geolocation coordinates are processed exclusively during active client sessions to generate decision metrics and find nearby circular partners. No personal tracking, advertisement identifiers, or location histories are stored.
        </div>
      </section>
    </div>
  );
}
