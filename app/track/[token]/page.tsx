"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

interface TrackItem {
  id: string;
  item_type: string;
  brand: string | null;
  condition: string | null;
  waste_avoided_kg: number | null;
  co2e_saved_est: number | null;
}

interface VerifiedRecord {
  actual_weight_kg: number;
  verified_at: string;
  verification_method: string | null;
}

interface TrackData {
  id: string;
  qrToken: string;
  status: string;
  priority: string;
  pickupDate: string | null;
  pickupSlot: string | null;
  createdAt: string;
  updatedAt: string;
  area: string;
  zone: { name: string; code: string } | null;
  items: TrackItem[];
  totalItems: number;
  estimatedWeightKg: number;
  verifiedRecords: VerifiedRecord[];
}

const LIFECYCLE_STAGES = [
  { key: "pending", label: "Requested", desc: "Logged in municipal registry" },
  { key: "scheduled", label: "Scheduled", desc: "Collection route planned" },
  { key: "assigned", label: "Assigned", desc: "Vehicle & collector assigned" },
  { key: "collected", label: "Collected", desc: "Handover verified at doorstep" },
  { key: "weighed", label: "Weighed", desc: "Certified digital scale audit" },
  { key: "sent_to_facility", label: "Sent to Facility", desc: "Dispatched to accredited recycler" },
  { key: "recovered", label: "Recovered", desc: "Materials extracted / refurbished" },
];

export default function TrackRequestPage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTracking() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/requests?token=${encodeURIComponent(token)}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || "Unable to locate collection request.");
        }

        setData(json.data);

        // Generate QR code for tracking token
        if (json.data?.qrToken) {
          const qr = await QRCode.toDataURL(json.data.qrToken, {
            width: 240,
            margin: 2,
            color: { dark: "#151817", light: "#ffffff" },
          });
          setQrCodeUrl(qr);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error fetching tracking details.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchTracking();
    }
  }, [token]);

  // Determine stage progression index based on status and certified collection record
  const getStageIndex = (status: string, hasVerifiedRecord: boolean) => {
    switch (status) {
      case "pending":
        return 0;
      case "scheduled":
        return 1;
      case "assigned":
        return 2;
      case "collected":
        // If collection record with actual scale weight exists, advance through Weighed
        return hasVerifiedRecord ? 4 : 3;
      case "weighed":
      case "sorted":
        return 4;
      case "sent_to_facility":
        return 5;
      case "recovered":
        return 6;
      default:
        return 0;
    }
  };

  const currentStageIndex = data
    ? getStageIndex(data.status, Boolean(data.verifiedRecords && data.verifiedRecords.length > 0))
    : 0;

  return (
    <div className="space-y-8">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#6b746e] uppercase tracking-wider mb-1">
          <Link href="/" className="hover:text-[#2e7d57]">Platform</Link>
          <span>/</span>
          <Link href="/request" className="hover:text-[#2e7d57]">Intake</Link>
          <span>/</span>
          <span className="text-[#151817] font-semibold">Chain of Custody</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817] tracking-tight">
              E-Waste Collection Tracking
            </h1>
            <p className="mt-1 text-xs text-[#6b746e] font-mono">
              TOKEN: <span className="text-[#151817] font-bold">{token}</span>
            </p>
          </div>
          {data && (
            <div className="inline-flex items-center gap-2 rounded-sm bg-[#e9ede7] border border-[#d8ddd7] px-3 py-1 font-mono text-xs">
              <span className="h-2 w-2 rounded-full bg-[#2e7d57] animate-pulse"></span>
              <span className="font-bold uppercase text-[#151817]">
                {data.status.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent mb-3"></div>
          <div className="text-xs font-mono text-[#6b746e]">
            Querying Municipal Ledger for Token {token}...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-6 text-center space-y-3">
          <div className="text-base font-bold text-[#721c24]">Request Not Found</div>
          <p className="text-xs text-[#721c24] max-w-md mx-auto">{error}</p>
          <div className="pt-2">
            <Link
              href="/request"
              className="inline-flex items-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644]"
            >
              ← Schedule New Pickup
            </Link>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
              <h2 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                Chain of Custody Lifecycle
              </h2>
              <span className="text-[11px] font-mono text-[#6b746e]">
                Updated: {new Date(data.updatedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2">
              {LIFECYCLE_STAGES.map((st, idx) => {
                const isPassed = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={st.key}
                    className={`rounded-sm border p-3 flex flex-col justify-between transition-colors ${
                      isCurrent
                        ? "border-[#2e7d57] bg-[#edf5f0]"
                        : isPassed
                        ? "border-[#151817] bg-[#f4f5f1]"
                        : "border-[#e9ede7] bg-white opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-[#6b746e]">
                          0{idx + 1}
                        </span>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isCurrent
                              ? "bg-[#2e7d57] animate-ping"
                              : isPassed
                              ? "bg-[#151817]"
                              : "bg-[#d8ddd7]"
                          }`}
                        ></span>
                      </div>
                      <div className="text-xs font-bold text-[#151817] leading-tight">
                        {st.label}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#6b746e] mt-2 leading-tight">
                      {st.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Grid: Left Logistics, Right QR Pass */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logistics Info (2 cols) */}
            <div className="md:col-span-2 space-y-6">
              <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
                <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono border-b border-[#e9ede7] pb-2">
                  Collection Schedule &amp; Jurisdiction
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Scheduled Pickup Date:</span>
                    <span className="font-mono font-semibold text-[#151817]">
                      {data.pickupDate || "Pending Schedule"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Time Window:</span>
                    <span className="font-mono font-semibold text-[#151817]">
                      {data.pickupSlot || "Regular Route Hours"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Municipal Zone:</span>
                    <span className="font-medium text-[#151817]">
                      {data.zone ? `${data.zone.code} — ${data.zone.name}` : "Central Zone"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Pickup Locality (Masked):</span>
                    <span className="font-medium text-[#151817]">{data.area}</span>
                  </div>
                </div>

                {/* Verified Weight Badge if weighed */}
                {data.verifiedRecords && data.verifiedRecords.length > 0 && (
                  <div className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] p-3 text-xs text-[#1e583c] space-y-1.5">
                    <div className="font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>✓</span> Certified Scale Verification Complete
                      </span>
                      <span className="font-mono text-[11px] text-[#2e7d57] uppercase font-semibold">
                        Chain of Custody Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <div>
                        Actual Weighed Load:{" "}
                        <strong className="text-base text-[#151817]">
                          {data.verifiedRecords[0].actual_weight_kg} kg
                        </strong>
                      </div>
                      {data.estimatedWeightKg > 0 && (
                        <div className="text-[11px] text-[#6b746e]">
                          Intake Est: {data.estimatedWeightKg} kg (
                          {data.verifiedRecords[0].actual_weight_kg >= data.estimatedWeightKg
                            ? `+${(data.verifiedRecords[0].actual_weight_kg - data.estimatedWeightKg).toFixed(1)} kg`
                            : `${(data.verifiedRecords[0].actual_weight_kg - data.estimatedWeightKg).toFixed(1)} kg`}
                          )
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-[#2e7d57]">
                      Recorded:{" "}
                      {new Date(data.verifiedRecords[0].verified_at).toLocaleString()} via{" "}
                      {data.verifiedRecords[0].verification_method || "qr_scan"}
                    </div>
                  </div>
                )}
              </div>

              {/* Items Manifest */}
              <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#e9ede7] pb-2">
                  <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                    Manifest Items ({data.totalItems})
                  </h3>
                  <span className="text-xs font-mono font-semibold text-[#2e7d57]">
                    Est. Total: {data.estimatedWeightKg} kg
                  </span>
                </div>

                <div className="divide-y divide-[#e9ede7]">
                  {data.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[#151817]">
                          {item.item_type}
                          {item.brand && (
                            <span className="font-normal text-[#6b746e] ml-2">
                              ({item.brand})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6b746e] capitalize">
                          Condition: {item.condition?.replace("_", " ") || "Inspected"}
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-end gap-1 font-mono text-[11px]">
                        <span className="text-[#151817] font-semibold">
                          {item.waste_avoided_kg} kg
                        </span>
                        {item.co2e_saved_est && (
                          <span className="text-[#2e7d57]">
                            ~{item.co2e_saved_est} kg CO₂e saved
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Pass Box */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 text-center space-y-4">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#6b746e]">
                Collector Pass
              </div>

              {qrCodeUrl ? (
                <div className="inline-block p-2 bg-white border border-[#d8ddd7] rounded-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="Pickup QR Code"
                    className="h-44 w-44 mx-auto"
                  />
                </div>
              ) : (
                <div className="h-44 w-44 mx-auto bg-[#f4f5f1] flex items-center justify-center font-mono text-xs">
                  Generating QR...
                </div>
              )}

              <div className="font-mono text-sm font-bold text-[#151817] bg-[#f4f5f1] py-1 px-3 rounded-sm border border-[#d8ddd7] inline-block">
                {data.qrToken}
              </div>

              <p className="text-[11px] text-[#6b746e]">
                Driver scans this token on arrival to open the digital collection record.
              </p>

              <div className="pt-2 border-t border-[#e9ede7] flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-4 py-2 text-xs font-semibold text-[#151817] hover:bg-[#e9ede7]"
                >
                  🖨 Print Custody Receipt
                </button>
                <Link
                  href="/request"
                  className="rounded-sm border border-[#2e7d57] px-4 py-2 text-xs font-semibold text-[#2e7d57] hover:bg-[#edf5f0]"
                >
                  + New Collection Request
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
