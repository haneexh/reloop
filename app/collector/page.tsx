"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import type { RouteStopDetail, RouteProgress } from "@/lib/collector-engine";

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
  // Collector identity state
  const [collectorRole, setCollectorRole] = useState<"COLLECTOR" | "DISPATCHER">("COLLECTOR");
  const [collectorId] = useState<string>("COL-HYD-04");

  // Route listing & selection
  const [routes, setRoutes] = useState<RouteListItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeDetail, setRouteDetail] = useState<SelectedRouteDetail | null>(null);
  const [stops, setStops] = useState<RouteStopDetail[]>([]);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
  const [qrInput, setQrInput] = useState<string>("");
  const [tokenVerified, setTokenVerified] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Weighment state
  const [actualWeightInput, setActualWeightInput] = useState<string>("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"pending" | "captured" | "unavailable">("pending");

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
      setGpsStatus("pending");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsStatus("captured");
        },
        () => {
          setGpsStatus("unavailable");
        },
        { timeout: 6000, enableHighAccuracy: true }
      );
    } else {
      setGpsStatus("unavailable");
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
  const openVerifyModal = (stop: RouteStopDetail) => {
    setActiveStop(stop);
    setQrInput(stop.qr_token || "");
    setTokenVerified(false);
    setTokenError(null);
    setActualWeightInput(stop.estimated_weight_kg ? String(stop.estimated_weight_kg) : "5.0");
    setIsVerifyModalOpen(true);
    attemptGpsCapture();
  };

  // Close Verify Modal
  const closeVerifyModal = () => {
    stopCamera();
    setIsVerifyModalOpen(false);
    setActiveStop(null);
    setTokenVerified(false);
    setTokenError(null);
  };

  // Start Camera Stream
  const startCamera = async () => {
    setIsCameraActive(true);
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
      setTokenError("Camera access denied or unavailable. Please enter the QR token manually.");
      setIsCameraActive(false);
    }
  };

  // Validate QR Token against Stop
  const validateTokenAgainstStop = (token: string, stop: RouteStopDetail | null) => {
    setTokenError(null);
    if (!token || !token.trim()) {
      setTokenError("Please enter a valid QR token.");
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

    // Check if token matches expected stop token or request ID
    if (cleanInput === cleanExpected || cleanInput === stop.request_id?.toUpperCase()) {
      setTokenVerified(true);
      setTokenError(null);
    } else {
      setTokenVerified(false);
      setTokenError(`Token mismatch: "${cleanInput}" does not match this stop (${cleanExpected || stop.request_id}).`);
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
      // Re-fetch route details to sync 100% with database
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
      const msg = err instanceof Error ? err.message : "Error skipping stop.";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Next uncollected stop
  const nextStop = stops.find(
    (s) => s.stop_type === "COLLECTION_STOP" && !s.is_collected
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-2 sm:px-4">
      {/* Top Header / Mode Switcher */}
      <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e9ede7] pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#2e7d57] animate-pulse"></span>
            <h1 className="text-xl font-bold font-display text-[#151817] tracking-tight">
              Collector Field Operations
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-[#6b746e]">Role Auth:</label>
            <select
              value={collectorRole}
              onChange={(e) => setCollectorRole(e.target.value as "COLLECTOR" | "DISPATCHER")}
              className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-2 py-1 text-xs font-mono font-semibold text-[#151817]"
            >
              <option value="COLLECTOR">COLLECTOR</option>
              <option value="DISPATCHER">DISPATCHER</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#6b746e]">
          <div>
            COLLECTOR ID: <span className="font-bold text-[#151817]">{collectorId}</span>
          </div>
          <div>
            ASSIGNED VEHICLE:{" "}
            <span className="font-bold text-[#151817]">
              {routeDetail?.vehicle_code || "Select Route"}
            </span>{" "}
            {routeDetail && (
              <span className="text-[#2e7d57]">
                (Cap: {routeDetail.vehicle_capacity_kg} kg)
              </span>
            )}
          </div>
          <div>
            JURISDICTION:{" "}
            <span className="font-bold text-[#151817]">
              {routeDetail ? `${routeDetail.zone_code} (${routeDetail.zone_name})` : "Hyderabad"}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`rounded-sm p-3 text-xs font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-[#edf5f0] text-[#1e583c] border border-[#bcdbc8]"
              : "bg-[#fdf2f2] text-[#721c24] border border-[#f5c6cb]"
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-bold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-sm bg-[#fdf2f2] border border-[#f5c6cb] p-3 text-xs text-[#721c24]">
          {error}
        </div>
      )}

      {/* Route Selector & Route Controls */}
      <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-mono font-bold uppercase text-[#6b746e] mb-1">
              Select Active Route:
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full rounded-sm border border-[#d8ddd7] p-2 text-xs font-mono text-[#151817]"
              disabled={loading || actionLoading}
            >
              {routes.length === 0 && <option value="">No routes found</option>}
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicle_code} — {r.zone_code || "HYD"} ({r.route_date}) | {r.stops_count} stops | Status: {r.status}
                </option>
              ))}
            </select>
          </div>

          {routeDetail && (
            <div className="flex items-center gap-2 pt-2 sm:pt-5">
              {routeDetail.status === "planned" || routeDetail.status === "assigned" ? (
                <button
                  type="button"
                  onClick={() => handleRouteAction("start_route")}
                  disabled={actionLoading}
                  className="rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644] transition-colors"
                >
                  🚀 Start Route
                </button>
              ) : routeDetail.status === "in_progress" ? (
                <button
                  type="button"
                  onClick={() => handleRouteAction("complete_route")}
                  disabled={actionLoading}
                  className="rounded-sm bg-[#151817] px-4 py-2 text-xs font-semibold text-white hover:bg-[#333a35] transition-colors"
                >
                  🏁 Complete Route
                </button>
              ) : (
                <span className="rounded-sm bg-[#e9ede7] px-3 py-1 text-xs font-mono font-bold uppercase text-[#2e7d57]">
                  Route Completed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live Derived Progress Cards */}
        {progress && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-sm border border-[#e9ede7] bg-[#f9faf9] p-3 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">
                Stops Progress
              </span>
              <span className="text-lg font-bold font-mono text-[#151817]">
                {progress.completed_stops} / {progress.total_stops}
              </span>
              <span className="text-[10px] text-[#2e7d57] block font-semibold">
                {progress.remaining_stops} remaining ({progress.completion_percentage}%)
              </span>
            </div>

            <div className="rounded-sm border border-[#e9ede7] bg-[#f9faf9] p-3 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">
                Collected Weight
              </span>
              <span className="text-lg font-bold font-mono text-[#151817]">
                {progress.total_actual_kg} kg
              </span>
              <span className="text-[10px] text-[#6b746e] block">
                Planned: {progress.total_estimated_kg} kg
              </span>
            </div>

            <div className="rounded-sm border border-[#e9ede7] bg-[#f9faf9] p-3 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">
                Vehicle Capacity
              </span>
              <span className="text-lg font-bold font-mono text-[#151817]">
                {progress.vehicle_capacity_kg} kg
              </span>
              <span className="text-[10px] text-[#2e7d57] block font-semibold">
                {progress.remaining_capacity_kg} kg space left
              </span>
            </div>

            <div className="rounded-sm border border-[#e9ede7] bg-[#f9faf9] p-3 text-center">
              <span className="text-[10px] font-mono uppercase text-[#6b746e] block">
                Payload Utilization
              </span>
              <span className="text-lg font-bold font-mono text-[#151817]">
                {progress.utilization_percentage}%
              </span>
              <div className="w-full bg-[#d8ddd7] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-[#2e7d57] h-full"
                  style={{ width: `${Math.min(100, progress.utilization_percentage)}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Up / Spotlight Stop Card (Mobile Priority Target) */}
      {nextStop && (
        <div className="rounded-sm border-2 border-[#2e7d57] bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#edf5f0] pb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-[#2e7d57] text-white px-2 py-0.5 text-xs font-mono font-bold">
                STOP #{nextStop.sequence}
              </span>
              <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                Current Active Pickup
              </span>
            </div>
            {nextStop.priority && (
              <span
                className={`rounded-sm px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                  nextStop.priority === "urgent"
                    ? "bg-[#fdf2f2] text-[#721c24] border border-[#f5c6cb]"
                    : nextStop.priority === "high"
                    ? "bg-[#fff3cd] text-[#856404] border border-[#ffeeba]"
                    : "bg-[#e9ede7] text-[#151817]"
                }`}
              >
                {nextStop.priority}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#6b746e] text-[11px] block">Locality / Area:</span>
              <span className="font-semibold text-sm text-[#151817]">
                {nextStop.locality || "Assigned Municipal Stop"}
              </span>
            </div>
            <div>
              <span className="text-[#6b746e] text-[11px] block">Scheduled Window:</span>
              <span className="font-mono font-semibold text-[#151817]">
                {nextStop.pickup_slot || "Regular Route Hours"}
              </span>
            </div>
            <div>
              <span className="text-[#6b746e] text-[11px] block">Items Manifest:</span>
              <span className="font-medium text-[#151817]">
                {nextStop.items_summary || "E-Waste Parcel"}
              </span>
            </div>
            <div>
              <span className="text-[#6b746e] text-[11px] block">Estimated Weight:</span>
              <span className="font-mono font-bold text-[#2e7d57]">
                ~{nextStop.estimated_weight_kg} kg
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => openVerifyModal(nextStop)}
              className="flex-1 rounded-sm bg-[#2e7d57] py-3 px-4 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#246644] text-center transition-colors flex items-center justify-center gap-2"
            >
              <span>📷</span> Scan QR / Verify Pickup
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveStop(nextStop);
                setIsDeferModalOpen(true);
              }}
              className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] py-3 px-4 text-xs font-semibold text-[#6b746e] hover:bg-[#e9ede7] transition-colors"
            >
              ⏭ Skip / Defer
            </button>
          </div>
        </div>
      )}

      {/* Sequential Route Stop Itinerary */}
      <div className="bg-white border border-[#d8ddd7] rounded-sm p-4 space-y-3">
        <h2 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono border-b border-[#e9ede7] pb-2">
          Route Itinerary Sequence ({stops.length} checkpoints)
        </h2>

        <div className="divide-y divide-[#e9ede7]">
          {stops.map((stop) => {
            const isCollection = stop.stop_type === "COLLECTION_STOP";
            const isCompleted = stop.is_collected;
            const isCurrent = nextStop?.sequence === stop.sequence;

            return (
              <div
                key={stop.sequence}
                className={`py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors rounded-xs ${
                  isCurrent
                    ? "bg-[#edf5f0] border-l-4 border-[#2e7d57]"
                    : isCompleted
                    ? "bg-[#fafbfa] opacity-80"
                    : "hover:bg-[#f9faf9]"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#6b746e]">
                      #{stop.sequence}
                    </span>
                    <span
                      className={`font-semibold ${
                        isCollection ? "text-[#151817]" : "text-[#6b746e]"
                      }`}
                    >
                      {stop.stop_type === "DEPOT_DEPARTURE"
                        ? `Depot Departure (${routeDetail?.depot_name || "Depot"})`
                        : stop.stop_type === "DEPOT_RETURN"
                        ? `Depot Return & Offload (${routeDetail?.depot_name || "Depot"})`
                        : stop.locality || "Customer Pickup"}
                    </span>
                    {isCompleted && (
                      <span className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] text-[#1e583c] px-1.5 py-0.2 text-[10px] font-mono font-bold">
                        ✓ COLLECTED
                      </span>
                    )}
                  </div>

                  {isCollection && (
                    <div className="text-[11px] text-[#6b746e] flex flex-wrap gap-x-3">
                      <span>Items: {stop.items_summary || "E-Waste"}</span>
                      <span>Est: {stop.estimated_weight_kg} kg</span>
                      {stop.actual_weight_kg && (
                        <span className="font-mono text-[#2e7d57] font-bold">
                          Actual: {stop.actual_weight_kg} kg
                        </span>
                      )}
                      {stop.qr_token && (
                        <span className="font-mono text-[#151817]">Token: {stop.qr_token}</span>
                      )}
                    </div>
                  )}
                </div>

                {isCollection && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isCompleted ? (
                      <div className="text-right">
                        <span className="text-[10px] text-[#2e7d57] font-mono block">
                          Verified at Doorstep
                        </span>
                        {stop.qr_token && (
                          <Link
                            href={`/track/${stop.qr_token}`}
                            target="_blank"
                            className="text-[10px] text-[#6b746e] underline hover:text-[#2e7d57]"
                          >
                            View Custody
                          </Link>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openVerifyModal(stop)}
                        className="rounded-sm border border-[#2e7d57] bg-white px-3 py-1.5 text-xs font-semibold text-[#2e7d57] hover:bg-[#edf5f0]"
                      >
                        Verify Pickup
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* QR VERIFICATION & WEIGHMENT MODAL */}
      {/* ======================================================== */}
      {isVerifyModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm border border-[#d8ddd7] max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#6b746e]">
                  Doorstep Verification
                </span>
                <h3 className="text-base font-bold font-display text-[#151817]">
                  Stop #{activeStop.sequence} — {activeStop.locality}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeVerifyModal}
                className="text-lg font-bold text-[#6b746e] hover:text-[#151817]"
              >
                ✕
              </button>
            </div>

            {/* Stop Manifest Summary */}
            <div className="rounded-sm bg-[#f9faf9] border border-[#e9ede7] p-3 text-xs space-y-1">
              <div className="flex justify-between text-[#6b746e]">
                <span>Items:</span>
                <span className="font-semibold text-[#151817]">
                  {activeStop.items_summary || "E-Waste Parcel"}
                </span>
              </div>
              <div className="flex justify-between text-[#6b746e]">
                <span>Intake Estimated Weight:</span>
                <span className="font-mono font-bold text-[#151817]">
                  {activeStop.estimated_weight_kg} kg
                </span>
              </div>
              <div className="flex justify-between text-[#6b746e]">
                <span>Expected Reference Token:</span>
                <span className="font-mono font-bold text-[#2e7d57]">
                  {activeStop.qr_token || activeStop.request_id}
                </span>
              </div>
            </div>

            {/* Camera / Manual Verification Section */}
            <div className="space-y-3">
              <label className="block text-xs font-mono font-bold uppercase text-[#6b746e]">
                1. QR Pass Verification
              </label>

              {isCameraActive ? (
                <div className="relative rounded-sm overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-white/40 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-[#2e7d57] rounded-sm"></div>
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute bottom-2 right-2 rounded-sm bg-black/80 px-2 py-1 text-[10px] text-white font-mono"
                  >
                    Close Camera
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] py-2 text-xs font-semibold text-[#151817] hover:bg-[#e9ede7] flex items-center justify-center gap-2"
                >
                  <span>📷</span> Turn On Camera Scanner
                </button>
              )}

              {/* Manual Token Input Fallback */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter QR token (e.g. RLP-HYD-...)"
                  value={qrInput}
                  onChange={(e) => {
                    setQrInput(e.target.value);
                    setTokenVerified(false);
                  }}
                  className="flex-1 rounded-sm border border-[#d8ddd7] p-2 text-xs font-mono uppercase text-[#151817]"
                />
                <button
                  type="button"
                  onClick={() => validateTokenAgainstStop(qrInput, activeStop)}
                  className="rounded-sm bg-[#151817] px-3 py-2 text-xs font-semibold text-white hover:bg-[#333a35]"
                >
                  Verify
                </button>
              </div>

              {tokenVerified && (
                <div className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] p-2 text-xs text-[#1e583c] flex items-center gap-1.5">
                  <span>✓</span> Token Authenticated for Stop #{activeStop.sequence}
                </div>
              )}

              {tokenError && (
                <div className="rounded-sm bg-[#fdf2f2] border border-[#f5c6cb] p-2 text-xs text-[#721c24]">
                  {tokenError}
                </div>
              )}
            </div>

            {/* Actual Weight Section */}
            <div className="space-y-3 border-t border-[#e9ede7] pt-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold uppercase text-[#6b746e]">
                  2. Certified Scale Weighment (kg)
                </label>
                {progress && (
                  <span className="text-[10px] font-mono text-[#2e7d57]">
                    Vehicle Space: {progress.remaining_capacity_kg} kg left
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  value={actualWeightInput}
                  onChange={(e) => setActualWeightInput(e.target.value)}
                  className="w-32 rounded-sm border border-[#d8ddd7] p-2 text-base font-mono font-bold text-[#151817]"
                />
                <div className="flex gap-1">
                  {[0.5, 1.0, 5.0].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(actualWeightInput) || 0;
                        setActualWeightInput((cur + delta).toFixed(1));
                      }}
                      className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-2 py-1 text-xs font-mono font-semibold hover:bg-[#e9ede7]"
                    >
                      +{delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variance Indicator */}
              {actualWeightInput && (
                <div className="text-[11px] font-mono text-[#6b746e] flex items-center gap-2">
                  <span>Estimated: {activeStop.estimated_weight_kg} kg</span>
                  <span>vs</span>
                  <span className="font-bold text-[#151817]">
                    Actual: {actualWeightInput} kg
                  </span>
                  {activeStop.estimated_weight_kg > 0 && (
                    <span
                      className={`font-semibold ${
                        parseFloat(actualWeightInput) >= activeStop.estimated_weight_kg
                          ? "text-[#2e7d57]"
                          : "text-[#c26d24]"
                      }`}
                    >
                      (
                      {(
                        parseFloat(actualWeightInput) - activeStop.estimated_weight_kg
                      ).toFixed(1)}{" "}
                      kg variance)
                    </span>
                  )}
                </div>
              )}

              {/* Geolocation Tag Badge */}
              <div className="text-[10px] font-mono flex items-center gap-1.5 pt-1">
                {gpsStatus === "captured" && gpsCoords ? (
                  <span className="text-[#2e7d57]">
                    📍 GPS Coordinates Attached ({gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)})
                  </span>
                ) : gpsStatus === "pending" ? (
                  <span className="text-[#6b746e]">📍 Querying GPS position...</span>
                ) : (
                  <span className="text-[#6b746e]">📍 GPS Unavailable (Optional — Not Blocking)</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-[#e9ede7] pt-3 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmCollection}
                disabled={actionLoading || !tokenVerified}
                className={`flex-1 rounded-sm py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white transition-colors ${
                  tokenVerified && !actionLoading
                    ? "bg-[#2e7d57] hover:bg-[#246644]"
                    : "bg-[#d8ddd7] cursor-not-allowed text-[#6b746e]"
                }`}
              >
                {actionLoading ? "Recording..." : "✓ Confirm Pickup & Weighment"}
              </button>
              <button
                type="button"
                onClick={closeVerifyModal}
                disabled={actionLoading}
                className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-4 py-2 text-xs font-semibold text-[#151817] hover:bg-[#e9ede7]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DEFER / SKIP MODAL */}
      {/* ======================================================== */}
      {isDeferModalOpen && activeStop && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm border border-[#d8ddd7] max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#151817]">
              Skip / Defer Stop #{activeStop.sequence}
            </h3>
            <p className="text-xs text-[#6b746e]">
              Please state why this scheduled pickup could not be executed:
            </p>

            <select
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              className="w-full rounded-sm border border-[#d8ddd7] p-2 text-xs text-[#151817]"
            >
              <option value="Citizen not available">Citizen not available</option>
              <option value="Premises or gate locked">Premises or gate locked</option>
              <option value="Hazardous or unaccepted items">Hazardous or unaccepted items</option>
              <option value="Item already handed over">Item already handed over</option>
              <option value="Road impassable for vehicle">Road impassable for vehicle</option>
            </select>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSkipStop}
                disabled={actionLoading}
                className="flex-1 rounded-sm bg-[#c26d24] py-2 text-xs font-bold text-white hover:bg-[#a55a1b]"
              >
                Confirm Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeferModalOpen(false);
                  setActiveStop(null);
                }}
                className="rounded-sm border border-[#d8ddd7] px-3 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
