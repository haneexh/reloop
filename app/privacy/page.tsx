import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | RE:LOOP",
  description: "Transparent data handling notice for the RE:LOOP circularity prototype.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="border-b border-[#d8ddd7] pb-4 space-y-1">
        <div className="flex items-center gap-2 font-mono text-xs text-[#6b746e]">
          <Link href="/" className="hover:text-[#151817] transition-colors">
            &larr; Return Home
          </Link>
          <span>|</span>
          <span>LEGAL &amp; COMPLIANCE</span>
        </div>
        <h1 className="text-3xl font-bold font-display text-[#151817]">
          Privacy Policy
        </h1>
        <p className="text-xs text-[#6b746e] font-mono">
          Last updated: October 2026 · Transparent prototype disclosure
        </p>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-6 text-sm leading-relaxed text-[#151817]">
        {/* Notice Card */}
        <div className="rounded-sm border border-[#2e7d57]/30 bg-[#e6f2e8]/60 p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-xs text-[#2e7d57] uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-[#2e7d57]" />
            Prototype Data Disclosure
          </div>
          <p className="text-xs text-[#151817] leading-relaxed">
            RE:LOOP is a hackathon prototype designed to demonstrate circular electronics routing, Post-Purchase Repairability Index (PP-RI) calculations, and decentralized destination matching. This service is not intended for production processing of sensitive personal data.
          </p>
        </div>

        <section className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold font-display text-[#151817]">
            1. Photo Uploads &amp; AI Vision Processing
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            When you upload or capture a photograph of hardware for intake assessment:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-[#151817] pl-2">
            <li>
              <strong>Google Gemini Vision API:</strong> Image data is submitted via secure API to Google Gemini models solely to infer item category, brand, physical condition, and visible defect characteristics.
            </li>
            <li>
              <strong>Supabase Storage:</strong> Uploaded images are stored in a public Supabase Storage bucket (<code className="font-mono text-[11px] bg-[#f4f5f1] px-1 py-0.5 rounded-sm">item-photos</code>) to display visual confirmation thumbnails on the verification and results screens.
            </li>
            <li>
              <strong>No Personal Identifiers:</strong> We advise users not to photograph receipts, government IDs, address labels, or private personal documents.
            </li>
          </ul>
        </section>

        <section className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold font-display text-[#151817]">
            2. Browser Geolocation
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            When you interact with the Destination Directory or Map router:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-[#151817] pl-2">
            <li>
              Your browser may request geolocation permissions to sort nearby circular destination partners (repair clinics, e-waste drop-offs, NGOs, and informal dismantlers) by straight-line distance.
            </li>
            <li>
              <strong>Zero Server Storage:</strong> Your geographic coordinates are computed entirely client-side in your local browser runtime. Coordinates are never written to our database or logged to external analytics servers.
            </li>
          </ul>
        </section>

        <section className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold font-display text-[#151817]">
            3. Database Records &amp; Guest Sessions
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            Intake records (item type, estimated age, condition rating, and computed financial/environmental metrics) are recorded in a Supabase PostgreSQL database to power the public Ledger &amp; Fleet Dashboard and calculate aggregate community impact metrics.
          </p>
        </section>

        <section className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
          <h2 className="text-lg font-bold font-display text-[#151817]">
            4. Third-Party Services
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            RE:LOOP interfaces with the following infrastructure providers:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-3 text-xs">
              <strong>Google Gemini API</strong>
              <p className="text-[11px] text-[#6b746e] mt-1">Multimodal vision inference &amp; feature extraction.</p>
            </div>
            <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-3 text-xs">
              <strong>Supabase</strong>
              <p className="text-[11px] text-[#6b746e] mt-1">Cloud PostgreSQL database &amp; image object storage.</p>
            </div>
            <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-3 text-xs">
              <strong>Vercel</strong>
              <p className="text-[11px] text-[#6b746e] mt-1">Edge hosting &amp; Next.js serverless execution.</p>
            </div>
          </div>
        </section>

        <section className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-2">
          <h2 className="text-lg font-bold font-display text-[#151817]">
            5. Contact
          </h2>
          <p className="text-xs text-[#6b746e] leading-relaxed">
            For questions regarding this prototype or data deletion inquiries, open an issue in the project repository.
          </p>
        </section>
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-[#d8ddd7]">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
        >
          &larr; Back to Overview
        </Link>
        <Link
          href="/terms"
          className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
        >
          View Terms of Service &rarr;
        </Link>
      </div>
    </div>
  );
}
