"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import jsQR from "jsqr";
import type { RouteStopDetail, RouteProgress } from "@/lib/collector-engine";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface RouteListItem {
  id: string;
  route_date: string;
  status: string;
  stops_count: number;
  total_load_kg: number;
  total_distance_km: number;
  vehicle_code: string;
  vehicle_capacity_kg: number;
  depot_name: string;
  zone_name: string | null;
  zone_code: string | null;
}

interface SelectedRouteDetail {
  id: string;
  route_date: string;
  status: string;
  vehicle_code: string;
  vehicle_capacity_kg: number;
  vehicle_type: string;
  depot_name: string;
  zone_name: string;
  zone_code: string;
  total_distance_km: number;
  total_load_kg: number;
  estimated_duration_minutes: number;
}

export default function CollectorOpsPage() {
  const [collectorRole] = useState<"COLLECTOR" | "DISPATCHER">("COLLECTOR");
  const [collectorId] = useState<string>("COL-HYD-04");

  // Route listing & selection
  const [routes, setRoutes] = useState<RouteListItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeDetail, setRouteDetail] = useState<SelectedRouteDetail | null>(null);
  const [stops, setStops] = useState<RouteStopDetail[]>([]);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Verification & modal state
  const [activeStop, setActiveStop] = useState<RouteStopDetail | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isDeferModalOpen, setIsDeferModalOpen] = useState<boolean>(false);
  const [deferReason, setDeferReason] = useState<string>("Citizen not available");

  // Camera & QR Scanner state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [manualInputActive, setManualInputActive] = useState<boolean>(false);
  const [qrInput, setQrInput] = useState<string>("");
  const [tokenVerified, setTokenVerified] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Weighment state
  const [actualWeightInput, setActualWeightInput] = useState<string>("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch available routes
  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/collector/route", {
        headers: { "x-user-role": collectorRole },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load routes.");
      }
      setRoutes(json.data || []);
      if (json.data && json.data.length > 0 && !selectedRouteId) {
        setSelectedRouteId(json.data[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error fetching routes.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [collectorRole, selectedRouteId]);

  // 2. Fetch specific route details & live database progress
  const fetchRouteDetails = useCallback(async (routeId: string) => {
    if (!routeId) return;
    try {
      setError(null);
      const res = await fetch(`/api/collector/route?id=${encodeURIComponent(routeId)}`, {
        headers: { "x-user-role": collectorRole },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load route details.");
      }
      setRouteDetail(json.data.route);
      setStops(json.data.stops || []);
      setProgress(json.data.progress || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading route details.";
      setError(msg);
    }
  }, [collectorRole]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (selectedRouteId) {
      fetchRouteDetails(selectedRouteId);
    }
  }, [selectedRouteId, fetchRouteDetails]);

  // Geolocation capture attempt (non-blocking)
  const attemptGpsCapture = useCallback(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { timeout: 6000, enableHighAccuracy: true }
      );
    }
  }, []);

  // Stop Camera
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Open Verify Modal for a Stop
  const openVerifyModal = (stop: RouteStopDetail, openCamera = false) => {
    setActiveStop(stop);
    setQrInput(stop.qr_token || "");
    setTokenVerified(false);
    setTokenError(null);
    setActualWeightInput(stop.estimated_weight_kg ? String(stop.estimated_weight_kg) : "5.0");
    setIsVerifyModalOpen(true);
    setManualInputActive(!openCamera);
    attemptGpsCapture();

    if (openCamera) {
      setTimeout(() => {
        startCamera();
      }, 200);
    }
  };

  // Close Verify Modal
  const closeVerifyModal = () => {
    stopCamera();
    setIsVerifyModalOpen(false);
    setActiveStop(null);
    setTokenVerified(false);
    setTokenError(null);
    setManualInputActive(false);
  };

  // Start Camera Stream
  const startCamera = async () => {
    setIsCameraActive(true);
    setManualInputActive(false);
    setTokenError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();

        // Scan frames with jsQR
        scanIntervalRef.current = setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              if (code && code.data) {
                const detected = code.data.trim();
                setQrInput(detected);
                validateTokenAgainstStop(detected, activeStop);
                stopCamera();
              }
            }
          }
        }, 350);
      }
    } catch {
      setTokenError("Camera access denied or unavailable. Please enter the QR code manually.");
      setIsCameraActive(false);
      setManualInputActive(true);
    }
  };

  // Validate QR Token against Stop
  const validateTokenAgainstStop = (token: string, stop: RouteStopDetail | null) => {
    setTokenError(null);
    if (!token || !token.trim()) {
      setTokenError("Please enter a valid QR code.");
      setTokenVerified(false);
      return;
    }

    if (!stop) {
      setTokenError("No active stop selected.");
      setTokenVerified(false);
      return;
    }

    const cleanInput = token.trim().toUpperCase();
    const cleanExpected = (stop.qr_token || "").trim().toUpperCase();

    if (cleanInput === cleanExpected || cleanInput === stop.request_id?.toUpperCase()) {
      setTokenVerified(true);
      setTokenError(null);
    } else {
      setTokenVerified(false);
      setTokenError(`Token mismatch: "${cleanInput}" does not match this stop (${cleanExpected}).`);
    }
  };

  // Handle Collection Confirmation
  const handleConfirmCollection = async () => {
    if (!activeStop || !selectedRouteId) return;

    const actualWeightNum = parseFloat(actualWeightInput);
    if (isNaN(actualWeightNum) || actualWeightNum <= 0) {
      setTokenError("Actual weighed load must be a positive number.");
      return;
    }

    // Capacity validation check
    const remainingCap = progress ? progress.remaining_capacity_kg : 500;
    if (actualWeightNum > remainingCap) {
      setTokenError(
        `Capacity Exceeded: ${actualWeightNum.toFixed(1)} kg exceeds remaining vehicle capacity (${remainingCap.toFixed(1)} kg).`
      );
      return;
    }

    setActionLoading(true);
    setTokenError(null);

    try {
      const payload = {
        route_id: selectedRouteId,
        request_id: activeStop.request_id,
        qr_token: qrInput.trim(),
        actual_weight_kg: actualWeightNum,
        verification_method: isCameraActive || qrInput === activeStop.qr_token ? "qr_scan" : "manual",
        actor_role: collectorRole,
        collector_id: collectorId,
        notes: `Verified by field collector ${collectorId}`,
        lat: gpsCoords?.lat,
        lng: gpsCoords?.lng,
      };

      const res = await fetch("/api/collector/collect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": collectorRole,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record collection.");
      }

      setNotification({
        type: "success",
        message: `Pickup confirmed for Stop #${activeStop.sequence} (${json.data.actual_weight_kg} kg recorded).`,
      });

      closeVerifyModal();
      await fetchRouteDetails(selectedRouteId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error confirming collection.";
      setTokenError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Route status action (Start / Complete)
  const handleRouteAction = async (action: "start_route" | "complete_route") => {
    if (!selectedRouteId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/collector/route", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": collectorRole,
        },
        body: JSON.stringify({
          route_id: selectedRouteId,
          action,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to execute ${action}.`);
      }

      setNotification({
        type: "success",
        message: action === "start_route" ? "Route marked In Progress." : "Route marked Completed.",
      });

      await fetchRouteDetails(selectedRouteId);
      await fetchRoutes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action error.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Skip / Defer stop
  const handleSkipStop = async () => {
    if (!activeStop || !selectedRouteId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/collector/route", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": collectorRole,
        },
        body: JSON.stringify({
          route_id: selectedRouteId,
          action: "skip_stop",
          request_id: activeStop.request_id,
          reason: deferReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to skip stop.");
      }

      setNotification({
        type: "success",
        message: `Stop #${activeStop.sequence} deferred (${deferReason}).`,
      });

      setIsDeferModalOpen(false);
      setActiveStop(null);
      await fetchRouteDetails(selectedRouteId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Defer error.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Next uncollected stop
  const nextStop = stops.find((s) => s.status === "scheduled" || s.status === "assigned" || s.status === "pending");
  const completedStopsCount = progress?.completed_stops ?? stops.filter((s) => s.status === "collected").length;
  const totalStopsCount = progress?.total_stops ?? stops.length;

  return (
    <div className="mx-auto max-w-2xl py-2 sm:py-6 space-y-6">
      {/* 1. Header & Route Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#2e7d57] font-bold block">
              Field Collector Console
            </span>
            <h1 className="text-2xl font-display font-bold text-[#151817]">
              Today&apos;s Collections
            </h1>
          </div>

          {/* Route selector dropdown */}
          {routes.length > 1 && (
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="rounded-[3px] border border-[#d8ddd7] bg-white px-2.5 py-1.5 text-xs font-mono font-semibold text-[#151817]"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicle_code} ({r.stops_count} stops)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Progress & Route Context Bar */}
        {routeDetail && (
          <Card className="p-4 bg-white border-[#d8ddd7] space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-[#151817]">
                  {routeDetail.vehicle_code}
                </span>
                <span className="text-[#6b746e]">·</span>
                <span className="text-[#6b746e]">
                  {routeDetail.zone_name || "Assigned Zone"}
                </span>
              </div>
              <Badge
                variant={routeDetail.status === "in_progress" ? "warning" : routeDetail.status === "completed" ? "success" : "neutral"}
                size="sm"
              >
                {routeDetail.status.replace(/_/g, " ")}
              </Badge>
            </div>

            {/* Simple Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-[#151817]">
                  {completedStopsCount} of {totalStopsCount} pickups completed
                </span>
                <span className="text-[#2e7d57] font-bold">
                  {progress?.total_actual_kg ?? routeDetail.total_load_kg} / {routeDetail.vehicle_capacity_kg} kg
                </span>
              </div>
              <div className="h-2 w-full bg-[#e9ede7] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#2e7d57] transition-all duration-300"
                  style={{
                    width: `${totalStopsCount > 0 ? (completedStopsCount / totalStopsCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Start / Complete Route Controls */}
            {routeDetail.status === "planned" && (
              <Button
                type="button"
                variant="primary"
                onClick={() => handleRouteAction("start_route")}
                disabled={actionLoading}
                className="w-full py-2.5 text-xs font-bold"
              >
                Start Today&apos;s Route &rarr;
              </Button>
            )}
            {routeDetail.status === "in_progress" && completedStopsCount === totalStopsCount && totalStopsCount > 0 && (
              <Button
                type="button"
                variant="primary"
                onClick={() => handleRouteAction("complete_route")}
                disabled={actionLoading}
                className="w-full py-2.5 text-xs font-bold bg-[#173d2c]"
              >
                ✓ Complete Route &amp; Return to Depot
              </Button>
            )}
          </Card>
        )}
      </div>

      {notification && (
        <div
          className={`rounded-[3px] p-3 text-xs flex items-center justify-between ${
            notification.type === "success"
              ? "bg-[#edf5f0] border border-[#bcdbc8] text-[#1e583c]"
              : "bg-[#fdf2f2] border border-[#f5c6cb] text-[#721c24]"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="font-bold ml-2 text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-[3px] border border-[#f5c6cb] bg-[#fdf2f2] p-3 text-xs text-[#721c24]">
          {error}
        </div>
      )}

      {/* 2. "Next Pickup" Focus Card */}
      {nextStop ? (
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#2e7d57] block">
            Next Pickup · Stop #{nextStop.sequence}
          </span>

          <Card className="border-[#2e7d57] p-5 space-y-4 shadow-sm bg-white">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-[#6b746e] uppercase">
                {nextStop.pickup_slot || "Scheduled Slot"} · Stop #{nextStop.sequence}
              </span>
              <h2 className="text-base font-bold text-[#151817]">
                {nextStop.locality || `Collection Location · Stop #${nextStop.sequence}`}
              </h2>
            </div>

            {/* Citizen Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#f4f5f1] p-3 rounded-[3px] border border-[#d8ddd7]">
              <div>
                <span className="text-[#6b746e] block text-[11px]">Request Token:</span>
                <span className="font-mono font-bold text-[#2e7d57]">
                  {nextStop.qr_token || nextStop.request_id?.slice(0, 8) || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#6b746e] block text-[11px]">Est. Weight:</span>
                <span className="font-mono font-bold text-[#151817]">
                  ~{nextStop.estimated_weight_kg} kg
                </span>
              </div>
            </div>

            {/* Items summary */}
            {nextStop.items_summary && (
              <div className="space-y-1 border-t border-[#d8ddd7] pt-2 text-xs">
                <span className="text-[11px] font-semibold text-[#6b746e]">Items to Collect:</span>
                <p className="font-mono text-[#151817] bg-white p-2 rounded-[2px] border border-[#e9ede7]">
                  {nextStop.items_summary}
                </p>
              </div>
            )}

            {/* Primary Action Buttons (Large, Touch-Friendly, Min 48px) */}
            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                type="button"
                variant="primary"
                onClick={() => openVerifyModal(nextStop, true)}
                className="w-full min-h-[48px] text-sm font-bold flex items-center justify-center gap-2"
              >
                <span>📷</span>
                <span>Scan Pickup Code</span>
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openVerifyModal(nextStop, false)}
                  className="min-h-[44px] text-xs font-semibold"
                >
                  Enter Code Manually
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setActiveStop(nextStop);
                    setIsDeferModalOpen(true);
                  }}
                  className="min-h-[44px] text-xs text-[#991b1b] hover:bg-[#fdf2f2]"
                >
                  Skip / Defer Stop
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center space-y-2 bg-[#edf5f0] border-[#bcdbc8]">
          <span className="text-2xl block">✓</span>
          <p className="text-sm font-bold text-[#1e583c]">All scheduled stops completed!</p>
          <p className="text-xs text-[#246644]">
            Consolidated vehicle payload is ready for facility transfer.
          </p>
        </Card>
      )}

      {/* 3. Remaining Stops List */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#151817] block">
          All Route Stops ({stops.length})
        </span>

        <div className="divide-y divide-[#d8ddd7] rounded-[3px] border border-[#d8ddd7] bg-white overflow-hidden">
          {stops.map((stop) => {
            const isDone = stop.status === "collected";
            const isCurrent = nextStop?.sequence === stop.sequence;

            return (
              <div
                key={stop.sequence}
                className={`p-3.5 flex items-center justify-between gap-3 text-xs ${
                  isCurrent ? "bg-[#f4f8f5]" : isDone ? "bg-[#fafafa]" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-xs font-bold ${
                      isDone
                        ? "bg-[#173d2c] text-white"
                        : isCurrent
                        ? "bg-[#2e7d57] text-white"
                        : "bg-[#e9ede7] text-[#6b746e]"
                    }`}
                  >
                    {isDone ? "✓" : stop.sequence}
                  </span>
                  <div>
                    <span className="font-semibold text-[#151817] block">
                      {stop.locality || `Stop #${stop.sequence}`}
                    </span>
                    <span className="text-[11px] text-[#6b746e] block font-mono">
                      {stop.pickup_slot || "Scheduled Slot"} · ~{stop.estimated_weight_kg} kg
                    </span>
                  </div>
                </div>

                <div>
                  {isDone ? (
                    <Badge variant="success" size="sm">Collected</Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openVerifyModal(stop, false)}
                    >
                      Collect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VERIFY & WEIGH MODAL */}
      {/* ========================================================= */}
      {isVerifyModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-t-lg sm:rounded-[3px] border border-[#d8ddd7] bg-white p-5 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#d8ddd7] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#2e7d57] uppercase font-bold block">
                  Stop #{activeStop.sequence} Handover
                </span>
                <h3 className="text-base font-bold text-[#151817]">
                  Verify Pickup Pass
                </h3>
              </div>
              <button
                type="button"
                onClick={closeVerifyModal}
                className="text-lg font-bold text-[#6b746e] hover:text-[#151817] px-2"
              >
                &times;
              </button>
            </div>

            {tokenError && (
              <div className="rounded-[3px] border border-[#f5c6cb] bg-[#fdf2f2] p-3 text-xs text-[#721c24]">
                {tokenError}
              </div>
            )}

            {/* Camera Viewfinder */}
            {isCameraActive && (
              <div className="space-y-2 text-center">
                <div className="relative overflow-hidden rounded-[3px] bg-black h-56 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-8 border-2 border-[#2e7d57] rounded-sm pointer-events-none" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#6b746e]">Aim camera at citizen pickup pass</span>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setManualInputActive(true);
                    }}
                    className="text-xs text-[#2e7d57] font-semibold hover:underline"
                  >
                    Enter manually instead
                  </button>
                </div>
              </div>
            )}

            {/* Manual Code Input */}
            {manualInputActive && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#151817] mb-1">
                    Pickup Pass Code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={qrInput}
                      onChange={(e) => {
                        setQrInput(e.target.value);
                        setTokenVerified(false);
                      }}
                      placeholder="RLP-HYD-XXXX"
                      className="flex-1 rounded-[3px] border border-[#d8ddd7] p-2.5 font-mono text-sm uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => validateTokenAgainstStop(qrInput, activeStop)}
                    >
                      Verify
                    </Button>
                  </div>
                </div>

                {!isCameraActive && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="text-xs text-[#2e7d57] font-semibold hover:underline"
                  >
                    📷 Switch to camera scanner
                  </button>
                )}
              </div>
            )}

            {/* Verified Indicator */}
            {tokenVerified && (
              <div className="rounded-[3px] border border-[#bcdbc8] bg-[#edf5f0] p-3 text-xs font-bold text-[#1e583c] flex items-center gap-2">
                <span>✓</span>
                <span>Pickup pass verified ({qrInput})</span>
              </div>
            )}

            {/* Weight Input (Large, Clear Numeric Input) */}
            <div className="space-y-2 border-t border-[#d8ddd7] pt-4">
              <label className="block text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                Record Actual Weight
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  value={actualWeightInput}
                  onChange={(e) => setActualWeightInput(e.target.value)}
                  className="flex-1 rounded-[3px] border border-[#d8ddd7] bg-white p-3 font-mono text-xl font-bold text-[#151817] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                />
                <span className="font-mono text-base font-bold text-[#6b746e]">
                  KG
                </span>
              </div>
              <p className="text-[11px] text-[#6b746e]">
                Weigh total collected items on your portable digital scale before confirming handover.
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-[#d8ddd7]">
              <Button
                type="button"
                variant="ghost"
                onClick={closeVerifyModal}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={actionLoading || (!tokenVerified && !qrInput.trim())}
                onClick={handleConfirmCollection}
                className="w-full sm:w-auto min-h-[48px] px-6 text-sm font-bold"
              >
                {actionLoading ? "Confirming..." : "Confirm Collection &rarr;"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DEFER / SKIP MODAL */}
      {/* ========================================================= */}
      {isDeferModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[3px] border border-[#d8ddd7] bg-white p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-[#151817]">
              Skip Stop #{activeStop.sequence}
            </h3>
            <p className="text-xs text-[#6b746e]">
              Provide an operational reason why this collection could not be completed today:
            </p>

            <select
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              className="w-full rounded-[3px] border border-[#d8ddd7] p-2 text-xs"
            >
              <option value="Citizen not available">Citizen not available / Door locked</option>
              <option value="Item not ready">Item not ready / Citizen cancelled</option>
              <option value="Incorrect address">Incorrect address / Location unreachable</option>
              <option value="Non-electronic items">Non-electronic items presented</option>
              <option value="Vehicle capacity full">Vehicle capacity full</option>
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeferModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={actionLoading}
                onClick={handleSkipStop}
              >
                {actionLoading ? "Updating..." : "Confirm Skip"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
