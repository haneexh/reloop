"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

const TIMELINE_STAGES = [
  {
    key: "pending",
    label: "Pickup requested",
    description: "Request logged and placed in neighborhood dispatch queue.",
  },
  {
    key: "scheduled",
    label: "Pickup scheduled",
    description: "Route planned based on neighborhood location and vehicle capacity.",
  },
  {
    key: "assigned",
    label: "Collector assigned",
    description: "Vehicle and collector assigned to today's collection route.",
  },
  {
    key: "collected",
    label: "Collected",
    description: "Items received and QR pass verified at your doorstep.",
  },
  {
    key: "weighed",
    label: "Weight verified",
    description: "Gross weight recorded on a calibrated digital scale.",
  },
  {
    key: "sent_to_facility",
    label: "Sent for recovery",
    description: "Transferred to an accredited recycling and recovery facility.",
  },
  {
    key: "recovered",
    label: "Recovery recorded",
    description: "Material fractions and circular recovery verified.",
  },
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
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    async function fetchTracking() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/requests?token=${encodeURIComponent(token)}`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(
            json.error ||
              "We could not locate this pickup request. Please check the tracking code and try again."
          );
        }

        setData(json.data);

        // Generate QR code for tracking token pass
        if (json.data?.qrToken) {
          const qr = await QRCode.toDataURL(json.data.qrToken, {
            width: 240,
            margin: 2,
            color: { dark: "#151817", light: "#ffffff" },
          });
          setQrCodeUrl(qr);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Error fetching tracking details. Please check your connection.";
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

  const handleCopyCode = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-4 sm:py-8 space-y-8">
      {/* Top Breadcrumb & Heading */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#6b746e]">
          <Link href="/" className="hover:text-[#151817]">Home</Link>
          <span>/</span>
          <Link href="/track" className="hover:text-[#151817]">Tracking</Link>
          <span>/</span>
          <span className="text-[#151817] font-mono font-bold">{token}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d8ddd7] pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#2e7d57] font-bold block">
              Pickup Status &amp; Chain of Custody
            </span>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817]">
              Track your pickup
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold bg-[#f4f5f1] border border-[#d8ddd7] px-3 py-1.5 rounded-[3px] text-[#151817]">
              {token}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="rounded-[3px] border border-[#d8ddd7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#151817] hover:bg-[#f4f5f1] transition-colors"
            >
              {copiedToken ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <Card className="p-12 text-center space-y-3">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent" />
          <p className="text-xs font-mono text-[#6b746e]">
            Looking up pickup records for {token}...
          </p>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Card className="border-[#f5c6cb] bg-[#fdf2f2] p-8 text-center space-y-3">
          <div className="text-base font-bold text-[#721c24]">Pickup Not Found</div>
          <p className="text-xs text-[#721c24] max-w-md mx-auto">{error}</p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link href="/track">
              <Button variant="outline" size="sm">
                Search another code
              </Button>
            </Link>
            <Link href="/request">
              <Button variant="primary" size="sm">
                Schedule a pickup
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Success / Data view */}
      {data && !loading && (
        <div className="space-y-8">
          {/* Main Status Header Card */}
          <Card className="border-[#2e7d57] bg-white p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d8ddd7] pb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#6b746e] block">
                  Current Status
                </span>
                <span className="text-xl font-display font-bold text-[#151817] capitalize">
                  {TIMELINE_STAGES[currentStageIndex]?.label || data.status.replace(/_/g, " ")}
                </span>
              </div>
              <Badge variant="success" size="md">
                Active Request
              </Badge>
            </div>

            <p className="text-xs sm:text-sm text-[#151817] leading-relaxed">
              {TIMELINE_STAGES[currentStageIndex]?.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2 font-mono">
              <div>
                <span className="text-[#6b746e] block text-[11px]">Scheduled Date:</span>
                <span className="font-semibold text-[#151817]">
                  {data.pickupDate || "Pending"}
                </span>
              </div>
              <div>
                <span className="text-[#6b746e] block text-[11px]">Window:</span>
                <span className="font-semibold text-[#151817]">
                  {data.pickupSlot || "Route hours"}
                </span>
              </div>
              <div>
                <span className="text-[#6b746e] block text-[11px]">Locality:</span>
                <span className="font-semibold text-[#151817]">
                  {data.area || "Hyderabad Area"}
                </span>
              </div>
              <div>
                <span className="text-[#6b746e] block text-[11px]">Items:</span>
                <span className="font-semibold text-[#151817]">
                  {data.totalItems} item(s)
                </span>
              </div>
            </div>
          </Card>

          {/* Clean Step Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Pickup &amp; Recovery Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {TIMELINE_STAGES.map((st, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div
                      key={st.key}
                      className={`rounded-[3px] border p-4 flex items-start gap-4 transition-colors ${
                        isCurrent
                          ? "border-[#2e7d57] bg-[#edf5f0]"
                          : isCompleted
                          ? "border-[#d8ddd7] bg-[#f9faf8]"
                          : "border-[#e9ede7] bg-white opacity-60"
                      }`}
                    >
                      <div className="pt-0.5">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-xs font-bold ${
                            isCurrent
                              ? "bg-[#2e7d57] text-white"
                              : isCompleted
                              ? "bg-[#173d2c] text-white"
                              : "bg-[#e9ede7] text-[#6b746e]"
                          }`}
                        >
                          {isCompleted ? "✓" : idx + 1}
                        </span>
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold ${
                              isCurrent
                                ? "text-[#173d2c]"
                                : isCompleted
                                ? "text-[#151817]"
                                : "text-[#6b746e]"
                            }`}
                          >
                            {st.label}
                          </span>
                          <span className="text-[10px] font-mono text-[#6b746e]">
                            {isCompleted ? "Completed" : isCurrent ? "In Progress" : "Upcoming"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6b746e] leading-relaxed">
                          {st.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Details & Legitimate Service Receipt Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Items Manifest (Left 7 cols) */}
            <div className="md:col-span-7 space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b border-[#d8ddd7]">
                  <div className="flex items-center justify-between">
                    <CardTitle>Manifest Items ({data.totalItems})</CardTitle>
                    <span className="font-mono text-xs font-semibold text-[#2e7d57]">
                      Est. Total: {data.estimatedWeightKg} kg
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="divide-y divide-[#d8ddd7]">
                  {data.items.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#151817]">
                          {item.item_type}
                        </span>
                        {item.brand && (
                          <span className="text-[#6b746e] ml-2">({item.brand})</span>
                        )}
                        <span className="block text-[11px] text-[#6b746e] capitalize">
                          Condition: {item.condition?.replace("_", " ") || "Standard"}
                        </span>
                      </div>
                      <div className="font-mono text-right text-xs">
                        <span className="font-semibold text-[#151817] block">
                          ~{item.waste_avoided_kg} kg
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Digital Scale Recorded Weight (if verified) */}
              {data.verifiedRecords && data.verifiedRecords.length > 0 && (
                <div className="rounded-[3px] border border-[#2e7d57] bg-[#edf5f0] p-4 text-xs text-[#1e583c] space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>✓</span> Digital Scale Audit Complete
                    </span>
                    <span className="font-mono text-[11px]">
                      Doorstep Verification
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-mono">
                    <div>
                      Actual Recorded Weight:{" "}
                      <strong className="text-sm text-[#151817]">
                        {data.verifiedRecords[0].actual_weight_kg} kg
                      </strong>
                    </div>
                    {data.estimatedWeightKg > 0 && (
                      <div className="text-[11px] text-[#6b746e]">
                        (Intake Estimate: {data.estimatedWeightKg} kg)
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-[#6b746e]">
                    Recorded: {new Date(data.verifiedRecords[0].verified_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Service Receipt / Handover Pass (Right 5 cols) */}
            <div className="md:col-span-5 space-y-4">
              <div className="rounded-[3px] border border-[#d8ddd7] bg-white p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#d8ddd7] pb-3">
                  <div className="flex items-center gap-1.5 font-display font-bold text-xs uppercase text-[#151817]">
                    <span className="h-2 w-2 rounded-sm bg-[#2e7d57]" />
                    <span>RE:LOOP RECEIPT</span>
                  </div>
                  <span className="font-mono text-[11px] text-[#6b746e]">
                    Pass #{token.slice(-4)}
                  </span>
                </div>

                {qrCodeUrl && (
                  <div className="text-center space-y-2">
                    <div className="inline-block p-2 bg-white border border-[#d8ddd7] rounded-[3px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeUrl}
                        alt="Handover QR Code"
                        className="h-36 w-36 mx-auto"
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#151817] block">
                      {token}
                    </span>
                    <p className="text-[11px] text-[#6b746e]">
                      Present to collector on arrival
                    </p>
                  </div>
                )}

                <div className="border-t border-[#d8ddd7] pt-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#6b746e]">Items:</span>
                    <span className="font-semibold text-[#151817]">{data.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b746e]">Recorded Weight:</span>
                    <span className="font-semibold text-[#151817]">
                      {data.verifiedRecords && data.verifiedRecords.length > 0
                        ? `${data.verifiedRecords[0].actual_weight_kg} kg`
                        : `~${data.estimatedWeightKg} kg (Est.)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b746e]">Pickup Date:</span>
                    <span className="font-semibold text-[#151817]">{data.pickupDate || "Pending"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6b746e]">Status:</span>
                    <span className="font-semibold text-[#2e7d57] capitalize">
                      {data.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#d8ddd7] pt-3 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.print()}
                    className="w-full text-xs"
                  >
                    Print Service Receipt
                  </Button>
                  <Link href="/request">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs text-[#2e7d57]"
                    >
                      + Schedule New Pickup
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Privacy badge */}
              <div className="rounded-[3px] border border-[#d8ddd7] bg-[#f4f5f1] p-3 text-[11px] text-[#6b746e] leading-relaxed">
                <strong className="text-[#151817]">Privacy Protection: </strong>
                Public tracking view displays masked locality and status milestones only. Personal contact numbers and exact street addresses are protected.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
