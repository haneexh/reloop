"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import {
  EWASTE_TAXONOMY,
  mapItemToTaxonomy,
} from "@/lib/taxonomy-mapper";
import {
  FALLBACK_HYDERABAD_ZONES,
  resolveZoneFromList,
  CollectionZone,
} from "@/lib/zone-resolver";
import { calculateImpact } from "@/lib/impact-calculator";

interface ManifestItem {
  id: string;
  item_type: string;
  brand: string;
  condition: string;
  estimated_age_years: number;
  weight_kg: number;
  quantity: number;
  hazards: string[];
  co2e_saved_est: number;
  waste_avoided_kg: number;
  image_url?: string;
}

export default function CitizenRequestPage() {
  // Navigation steps: 1: items, 2: location, 3: schedule, 4: review, 5: confirmed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Manifest items state
  const [items, setItems] = useState<ManifestItem[]>([]);

  // Item form modal / drawer state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Current item being configured
  const [categoryKey, setCategoryKey] = useState<string>("smartphone");
  const [itemBrand, setItemBrand] = useState<string>("");
  const [itemCondition, setItemCondition] = useState<string>("functional");
  const [itemAge, setItemAge] = useState<number>(2);
  const [itemWeight, setItemWeight] = useState<number>(0.2);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemHazards, setItemHazards] = useState<string[]>(["Lithium-ion Battery"]);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(undefined);

  // Location & Zone state
  const [address, setAddress] = useState<string>("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    FALLBACK_HYDERABAD_ZONES[0].id
  );
  const [zoneList, setZoneList] = useState<CollectionZone[]>(FALLBACK_HYDERABAD_ZONES);
  const [resolvedDistanceKm, setResolvedDistanceKm] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Schedule & Contact state
  const [citizenName, setCitizenName] = useState<string>("");
  const [citizenPhone, setCitizenPhone] = useState<string>("");
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return d.toISOString().split("T")[0];
  });
  const [pickupSlot, setPickupSlot] = useState<string>("09:00 - 12:00");
  const [notes, setNotes] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [confirmedData, setConfirmedData] = useState<{
    requestId: string;
    qrToken: string;
    pickupDate: string;
    pickupSlot: string;
    zoneName: string;
    itemsCount: number;
    estimatedWeightKg: number;
    trackingUrl: string;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load zones on mount
  useEffect(() => {
    async function loadZones() {
      try {
        const { data } = await supabase
          .from("collection_zones")
          .select("id, name, code, center_lat, center_lng, radius_km")
          .order("code", { ascending: true });

        if (data && data.length > 0) {
          const mapped: CollectionZone[] = data.map((z) => ({
            id: z.id,
            name: z.name,
            code: z.code,
            center_lat: Number(z.center_lat),
            center_lng: Number(z.center_lng),
            radius_km: Number(z.radius_km),
          }));
          setZoneList(mapped);
          setSelectedZoneId(mapped[0].id);
        }
      } catch (err) {
        console.warn("Could not fetch remote zones, using fallback:", err);
      }
    }
    loadZones();
  }, []);

  // Update category defaults when category changes
  const handleCategoryChange = (key: string) => {
    setCategoryKey(key);
    const tax = EWASTE_TAXONOMY.find((t) => t.categoryKey === key);
    if (tax) {
      setItemWeight(tax.avgWeightKg);
      setItemAge(tax.defaultAgeYears);
      setItemHazards(tax.potentialHazards);
    }
  };

  // Handle Photo selection & AI classification
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    setAnalysisError(null);
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    if (file.size > 8 * 1024 * 1024) {
      setAnalysisError("File size exceeds 8MB limit.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsAnalyzing(true);

    try {
      // 1. Convert to base64
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      const base64Data = await base64Promise;

      // 2. Call /api/analyze-image
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mediaType: file.type,
        }),
      });

      const responseJson = await res.json();

      if (responseJson.not_electronic || (!responseJson.success && responseJson.not_electronic)) {
        setAnalysisError(
          responseJson.message ||
            "RE:LOOP only accepts electronic items. This photo was classified as non-electronic. Please choose an electronic device."
        );
        setIsAnalyzing(false);
        return;
      }

      if (responseJson.data) {
        const d = responseJson.data;
        if (d.item_type) {
          const tax = mapItemToTaxonomy(d.item_type);
          setCategoryKey(tax.categoryKey);
          setItemWeight(tax.avgWeightKg);
          setItemAge(d.estimated_age_years || tax.defaultAgeYears);
          setItemHazards(tax.potentialHazards);
        }
        if (d.brand) {
          setItemBrand(d.brand);
        }
        if (d.condition) {
          setItemCondition(d.condition);
        }
      }

      // Try background upload to Supabase storage
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const filename = `requests/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("item-photos")
          .upload(filename, file);
        if (!uploadErr) {
          const { data: pub } = supabase.storage
            .from("item-photos")
            .getPublicUrl(filename);
          if (pub?.publicUrl) {
            setUploadedImageUrl(pub.publicUrl);
          }
        }
      } catch (uploadNotice) {
        console.warn("Storage upload notice:", uploadNotice);
      }
    } catch (err: unknown) {
      console.warn("AI analysis error:", err);
      setAnalysisError("AI analysis encountered an error. You can still set the item details manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Commit item to manifest
  const handleSaveItem = () => {
    const tax = EWASTE_TAXONOMY.find((t) => t.categoryKey === categoryKey) || {
      categoryKey: "other_electronics",
      label: "Electronics Item",
      group: "IT & Computing",
      avgWeightKg: 2.0,
      potentialHazards: [],
      defaultAgeYears: 3,
    };

    const impact = calculateImpact(
      tax.label,
      itemCondition,
      itemAge,
      itemWeight
    );

    const newItem: ManifestItem = {
      id: "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      item_type: tax.label,
      brand: itemBrand.trim() || "Unbranded / Unknown",
      condition: itemCondition,
      estimated_age_years: itemAge,
      weight_kg: Number(itemWeight) || tax.avgWeightKg,
      quantity: Number(itemQuantity) || 1,
      hazards: itemHazards,
      co2e_saved_est: Math.round(impact.co2eSavedKg * 10) / 10,
      waste_avoided_kg: Math.round((Number(itemWeight) || tax.avgWeightKg) * 10) / 10,
      image_url: uploadedImageUrl || previewUrl || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setIsAddingItem(false);

    // Reset draft fields
    setPreviewUrl(null);
    setItemBrand("");
    setItemQuantity(1);
    setUploadedImageUrl(undefined);
    setAnalysisError(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // GPS Location detection & zone auto-resolution
  const handleDetectGPS = () => {
    setLocationError(null);
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);

        const res = resolveZoneFromList(lat, lng, zoneList);
        setSelectedZoneId(res.zone.id);
        setResolvedDistanceKm(res.distanceKm);
        setIsDetectingLocation(false);
      },
      (err) => {
        setIsDetectingLocation(false);
        setLocationError("Unable to acquire GPS location. Please select your municipal zone manually below.");
        console.warn("GPS error:", err);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Final request submission
  const handleSubmitRequest = async () => {
    if (items.length === 0) {
      setSubmissionError("Please add at least one electronic item before scheduling.");
      return;
    }

    if (!citizenPhone.trim() || citizenPhone.trim().length < 7) {
      setSubmissionError("Please provide a valid contact phone number.");
      return;
    }

    if (!address.trim() || address.trim().length < 5) {
      setSubmissionError("Please provide a full pickup address (minimum 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const payloadItems = items.map((i) => ({
        item_type: i.item_type,
        brand: i.brand,
        condition: i.condition,
        estimated_age_years: i.estimated_age_years,
        weight_kg: i.weight_kg,
        image_url: i.image_url,
        quantity: i.quantity,
      }));

      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizen_name: citizenName || null,
          citizen_phone: citizenPhone,
          address,
          lat: userLat,
          lng: userLng,
          zone_id: selectedZoneId,
          pickup_date: pickupDate,
          pickup_slot: pickupSlot,
          notes: notes || null,
          items: payloadItems,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit request.");
      }

      // Generate QR Code data URL for client receipt
      const qrDataUrl = await QRCode.toDataURL(data.qrToken, {
        width: 320,
        margin: 2,
        color: {
          dark: "#151817",
          light: "#ffffff",
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      setConfirmedData({
        requestId: data.requestId,
        qrToken: data.qrToken,
        pickupDate: data.pickupDate,
        pickupSlot: data.pickupSlot,
        zoneName: data.zoneName || "Assigned Municipal Zone",
        itemsCount: data.itemsCount,
        estimatedWeightKg: data.estimatedWeightKg,
        trackingUrl: data.trackingUrl,
      });

      setCurrentStep(5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed.";
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cumulative impact
  const totalWeight = items.reduce((sum, i) => sum + i.weight_kg * i.quantity, 0);
  const totalCO2e = items.reduce((sum, i) => sum + i.co2e_saved_est * i.quantity, 0);
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const selectedZone = zoneList.find((z) => z.id === selectedZoneId) || zoneList[0];

  return (
    <div className="space-y-8">
      {/* Page Title & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#6b746e] uppercase tracking-wider mb-1">
          <Link href="/" className="hover:text-[#2e7d57]">Platform</Link>
          <span>/</span>
          <span className="text-[#151817] font-semibold">Municipal Intake</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817] tracking-tight">
          Citizen E-Waste Pickup Request
        </h1>
        <p className="mt-1 text-sm text-[#4b554d] max-w-2xl">
          Schedule municipal doorstep collection for end-of-life electronics. Certified chain of custody from household handover to accredited recycling facilities.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-4 gap-2 border-b border-[#d8ddd7] pb-4">
        {[
          { num: 1, label: "Item Manifest" },
          { num: 2, label: "Pickup Location" },
          { num: 3, label: "Date & Contact" },
          { num: 4, label: "Review & Submit" },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 text-xs font-mono ${
                isActive
                  ? "text-[#2e7d57] font-bold"
                  : isDone
                  ? "text-[#151817]"
                  : "text-[#9ca39e]"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-sm text-[11px] font-bold ${
                  isActive
                    ? "bg-[#2e7d57] text-white"
                    : isDone
                    ? "bg-[#151817] text-white"
                    : "bg-[#e9ede7] text-[#6b746e]"
                }`}
              >
                {isDone ? "✓" : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* STEP 1: ITEM INTAKE & MANIFEST */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#151817]">Electronic Items Manifest</h2>
              <p className="text-xs text-[#6b746e]">
                Add all devices, chargers, or appliances intended for handover.
              </p>
            </div>
            {!isAddingItem && (
              <button
                type="button"
                onClick={() => {
                  handleCategoryChange("smartphone");
                  setIsAddingItem(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-sm bg-[#2e7d57] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#246644] transition-colors"
              >
                + Add Item
              </button>
            )}
          </div>

          {/* Item List Table or Empty State */}
          {items.length === 0 && !isAddingItem && (
            <div className="rounded-sm border border-dashed border-[#c5ccc3] bg-[#f9faf8] p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-sm bg-[#e9ede7] text-sm text-[#2e7d57] font-mono">
                [+]
              </div>
              <h3 className="mt-3 text-sm font-semibold text-[#151817]">No items added yet</h3>
              <p className="mt-1 text-xs text-[#6b746e] max-w-sm mx-auto">
                Snap a photo with AI device classification or pick from the standard e-waste taxonomy.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleCategoryChange("smartphone");
                  setIsAddingItem(true);
                }}
                className="mt-4 inline-flex items-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644]"
              >
                + Add First Electronic Item
              </button>
            </div>
          )}

          {/* Manifest Table */}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-sm border border-[#d8ddd7] bg-white">
              <div className="p-3 bg-[#f4f5f1] border-b border-[#d8ddd7] flex justify-between items-center text-xs font-mono">
                <span className="font-semibold text-[#151817]">
                  Items Count: {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                </span>
                <span className="text-[#2e7d57] font-semibold">
                  Est. Total Weight: {Math.round(totalWeight * 10) / 10} kg
                </span>
              </div>
              <div className="divide-y divide-[#e9ede7]">
                {items.map((it) => (
                  <div key={it.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#151817]">{it.item_type}</span>
                        {it.quantity > 1 && (
                          <span className="rounded-sm bg-[#e9ede7] px-1.5 py-0.5 text-[10px] font-mono text-[#151817]">
                            ×{it.quantity}
                          </span>
                        )}
                        <span className="rounded-sm border border-[#d8ddd7] px-2 py-0.5 text-[10px] uppercase font-mono text-[#6b746e]">
                          {it.condition.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-[#6b746e]">
                        {it.brand && <span>Brand: {it.brand}</span>}
                        <span>·</span>
                        <span>Est. Weight: {it.weight_kg} kg</span>
                        <span>·</span>
                        <span className="text-[#2e7d57] font-medium">CO₂e Avoided: {it.co2e_saved_est} kg</span>
                      </div>
                      {it.hazards.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {it.hazards.map((h, i) => (
                            <span
                              key={i}
                              className="rounded-sm bg-[#fff8e6] border border-[#f5dfa8] px-1.5 py-0.2 text-[10px] font-mono text-[#8a5d00]"
                            >
                              ⚠ {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      className="self-start sm:self-center text-xs font-mono text-[#b33a3a] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ITEM ADDING MODAL / FORM */}
          {isAddingItem && (
            <div className="rounded-sm border border-[#2e7d57] bg-white p-5 space-y-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e9ede7] pb-3">
                <h3 className="text-sm font-bold text-[#151817]">Add Item to Collection Manifest</h3>
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="text-xs text-[#6b746e] hover:text-[#151817]"
                >
                  ✕ Cancel
                </button>
              </div>

              {/* Photo Upload & AI Gate */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#151817]">
                  Photograph or Visual Inspection (Optional)
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-4 py-2 text-xs font-medium text-[#151817] hover:bg-[#e9ede7] transition-colors disabled:opacity-50"
                  >
                    {isAnalyzing ? "Analyzing Photo..." : "📷 Upload / Take Photo for AI Detection"}
                  </button>
                  {previewUrl && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Item preview"
                        className="h-10 w-10 object-cover rounded-sm border border-[#d8ddd7]"
                      />
                      <span className="text-[11px] text-[#6b746e]">Image Attached</span>
                    </div>
                  )}
                </div>

                {/* Electronics Gate Rejection or Notice */}
                {analysisError && (
                  <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-3 text-xs text-[#721c24]">
                    <strong>Notice:</strong> {analysisError}
                  </div>
                )}
              </div>

              {/* Manual/Refined Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#151817] mb-1">
                    Device Category *
                  </label>
                  <select
                    value={categoryKey}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                  >
                    {EWASTE_TAXONOMY.map((tax) => (
                      <option key={tax.categoryKey} value={tax.categoryKey}>
                        {tax.label} ({tax.group})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#151817] mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={itemBrand}
                    onChange={(e) => setItemBrand(e.target.value)}
                    placeholder="e.g. Dell, Samsung, Apple, Sony"
                    className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#151817] mb-1">
                    Physical Condition *
                  </label>
                  <select
                    value={itemCondition}
                    onChange={(e) => setItemCondition(e.target.value)}
                    className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                  >
                    <option value="functional">Functional / Powers On</option>
                    <option value="cosmetic_damage">Minor Cosmetic Scratches / Wear</option>
                    <option value="partially_working">Partially Working / Faulty Screen or Battery</option>
                    <option value="severely_damaged">Severely Damaged / Scrap / Non-Functional</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Age (yrs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={itemAge}
                      onChange={(e) => setItemAge(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={itemWeight}
                      onChange={(e) => setItemWeight(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                      className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Hazardous Materials Detection */}
              {itemHazards.length > 0 && (
                <div className="rounded-sm bg-[#faf8f2] border border-[#e8dfcf] p-2.5">
                  <div className="text-[11px] font-semibold text-[#665022] mb-1">
                    Special Handling / Regulated Hazard Tags:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {itemHazards.map((h, i) => (
                      <span
                        key={i}
                        className="rounded-sm bg-white border border-[#d1c7b2] px-2 py-0.5 text-[10px] font-mono text-[#544119]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="rounded-sm border border-[#d8ddd7] px-3.5 py-1.5 text-xs text-[#6b746e] hover:bg-[#f4f5f1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="rounded-sm bg-[#2e7d57] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#246644]"
                >
                  Confirm &amp; Add to Manifest
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end pt-4 border-t border-[#d8ddd7]">
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => setCurrentStep(2)}
              className="rounded-sm bg-[#2e7d57] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#246644] disabled:opacity-40 transition-colors"
            >
              Continue to Location Selection →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: LOCATION & MUNICIPAL ZONE RESOLUTION */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#151817]">Pickup Address &amp; Municipal Zone</h2>
            <p className="text-xs text-[#6b746e]">
              Provide doorstep coordinates to assign your pickup to the nearest municipal fleet route.
            </p>
          </div>

          <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
            {/* GPS Detection Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#f4f5f1] rounded-sm border border-[#e2e6df]">
              <div>
                <div className="text-xs font-semibold text-[#151817]">Browser Geolocation</div>
                <div className="text-[11px] text-[#6b746e]">
                  Auto-resolves your municipal cluster using Haversine centroid proximity.
                </div>
              </div>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isDetectingLocation}
                className="inline-flex items-center gap-1.5 rounded-sm bg-white border border-[#2e7d57] px-3 py-1.5 text-xs font-semibold text-[#2e7d57] hover:bg-[#ebf5ef] transition-colors disabled:opacity-50"
              >
                {isDetectingLocation ? "Acquiring Coordinates..." : "📍 Use My Current Location"}
              </button>
            </div>

            {locationError && (
              <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-2.5 text-xs text-[#721c24]">
                {locationError}
              </div>
            )}

            {/* Resolved Zone Badge if available */}
            {userLat && userLng && (
              <div className="rounded-sm bg-[#edf5f0] border border-[#bcdbc8] p-3 text-xs text-[#1e583c] flex items-center justify-between">
                <div>
                  <span className="font-bold">Detected Centroid Proximity: </span>
                  {selectedZone.name} ({selectedZone.code})
                  {resolvedDistanceKm !== null && (
                    <span className="ml-1 text-[11px] font-mono">
                      · ~{resolvedDistanceKm} km from zone center
                    </span>
                  )}
                </div>
                <span className="rounded-sm bg-[#2e7d57] text-white px-2 py-0.5 text-[10px] font-mono font-bold">
                  ACTIVE CLUSTER
                </span>
              </div>
            )}

            {/* Full Street Address */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#151817]">
                Doorstep Pickup Address *
              </label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat / House No., Apartment or Building name, Street, Locality, Landmark, Hyderabad"
                className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2.5 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
              />
              <p className="text-[11px] text-[#6b746e]">
                Minimum 5 characters required for driver routing navigation.
              </p>
            </div>

            {/* Zone Selector */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#151817]">
                Assigned Municipal Zone *
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => {
                  setSelectedZoneId(e.target.value);
                  setResolvedDistanceKm(null);
                }}
                className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
              >
                {zoneList.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code}: {z.name} (Coverage Radius: {z.radius_km} km)
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#6b746e]">
                Managed under the Greater Hyderabad Municipal Corporation (GHMC) E-Waste Framework.
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-[#d8ddd7]">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="rounded-sm border border-[#d8ddd7] px-4 py-2 text-xs font-medium text-[#6b746e] hover:bg-[#f4f5f1]"
            >
              ← Back to Manifest
            </button>
            <button
              type="button"
              disabled={address.trim().length < 5}
              onClick={() => setCurrentStep(3)}
              className="rounded-sm bg-[#2e7d57] px-6 py-2 text-xs font-semibold text-white hover:bg-[#246644] disabled:opacity-40"
            >
              Continue to Scheduling →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SCHEDULE & CONTACT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#151817]">Date &amp; Citizen Contact</h2>
            <p className="text-xs text-[#6b746e]">
              Pick your preferred collection time slot and enter phone number for pickup OTP and coordination.
            </p>
          </div>

          <div className="rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#151817] mb-1">
                  Citizen / Resident Name
                </label>
                <input
                  type="text"
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#151817] mb-1">
                  Mobile Phone Number *
                </label>
                <input
                  type="tel"
                  value={citizenPhone}
                  onChange={(e) => setCitizenPhone(e.target.value)}
                  placeholder="+91 98490 00000"
                  className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                />
                <p className="text-[11px] text-[#6b746e] mt-1">
                  Driver will SMS arrival window before dispatch.
                </p>
              </div>
            </div>

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#151817]">
                Preferred Collection Date *
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full sm:w-64 rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none font-mono"
              />
            </div>

            {/* Time Slot Radio Buttons */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#151817]">
                Municipal Route Time Window *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { slot: "09:00 - 12:00", label: "Morning Window", sub: "09:00 AM - 12:00 PM" },
                  { slot: "12:00 - 15:00", label: "Afternoon Window", sub: "12:00 PM - 03:00 PM" },
                  { slot: "15:00 - 18:00", label: "Evening Window", sub: "03:00 PM - 06:00 PM" },
                ].map((s) => (
                  <label
                    key={s.slot}
                    className={`cursor-pointer rounded-sm border p-3 flex flex-col gap-1 transition-colors ${
                      pickupSlot === s.slot
                        ? "border-[#2e7d57] bg-[#edf5f0]"
                        : "border-[#d8ddd7] bg-white hover:bg-[#f9faf8]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#151817]">{s.label}</span>
                      <input
                        type="radio"
                        name="pickup_slot"
                        value={s.slot}
                        checked={pickupSlot === s.slot}
                        onChange={(e) => setPickupSlot(e.target.value)}
                        className="text-[#2e7d57] focus:ring-0"
                      />
                    </div>
                    <span className="text-[11px] font-mono text-[#6b746e]">{s.sub}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#151817]">
                Access Instructions / Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Ring bell 4B, security gate code 1234, heavy items need trolley"
                className="w-full rounded-sm border border-[#d8ddd7] bg-[#fdfdfc] p-2 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-[#d8ddd7]">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="rounded-sm border border-[#d8ddd7] px-4 py-2 text-xs font-medium text-[#6b746e] hover:bg-[#f4f5f1]"
            >
              ← Back to Location
            </button>
            <button
              type="button"
              disabled={!citizenPhone.trim() || !pickupDate}
              onClick={() => setCurrentStep(4)}
              className="rounded-sm bg-[#2e7d57] px-6 py-2 text-xs font-semibold text-white hover:bg-[#246644] disabled:opacity-40"
            >
              Review Request →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & CONFIRM */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#151817]">Review Collection Request</h2>
            <p className="text-xs text-[#6b746e]">
              Verify pickup logistics and manifest summary before municipal route booking.
            </p>
          </div>

          {submissionError && (
            <div className="rounded-sm border border-[#f5c6cb] bg-[#fdf2f2] p-3 text-xs text-[#721c24]">
              <strong>Error:</strong> {submissionError}
            </div>
          )}

          {/* Logistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono border-b border-[#e9ede7] pb-2">
                Pickup Logistics
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#6b746e] block text-[11px]">Address:</span>
                  <span className="font-semibold text-[#151817]">{address}</span>
                </div>
                <div>
                  <span className="text-[#6b746e] block text-[11px]">Assigned Zone:</span>
                  <span className="font-medium text-[#151817]">
                    {selectedZone.name} ({selectedZone.code})
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Date:</span>
                    <span className="font-mono font-semibold text-[#151817]">{pickupDate}</span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Time Window:</span>
                    <span className="font-mono font-semibold text-[#151817]">{pickupSlot}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#6b746e] block text-[11px]">Contact:</span>
                  <span className="font-medium text-[#151817]">
                    {citizenName ? `${citizenName} · ` : ""}
                    {citizenPhone}
                  </span>
                </div>
                {notes && (
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Notes:</span>
                    <span className="text-[#151817] italic">{notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Impact Metric Summary */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono border-b border-[#e9ede7] pb-2">
                Forecasted Circular Impact
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-sm bg-[#f4f5f1] p-3 text-center border border-[#e2e6df]">
                  <div className="text-xl font-bold font-mono text-[#2e7d57]">
                    {Math.round(totalWeight * 10) / 10} kg
                  </div>
                  <div className="text-[11px] text-[#6b746e] mt-0.5">E-Waste Diverted</div>
                </div>
                <div className="rounded-sm bg-[#f4f5f1] p-3 text-center border border-[#e2e6df]">
                  <div className="text-xl font-bold font-mono text-[#2e7d57]">
                    {Math.round(totalCO2e * 10) / 10} kg
                  </div>
                  <div className="text-[11px] text-[#6b746e] mt-0.5">CO₂e Abated</div>
                </div>
              </div>
              <p className="text-[11px] text-[#6b746e] pt-1">
                Material recovery is routed through verified R2/ISO-14001 processing facilities in Hyderabad.
              </p>
            </div>
          </div>

          {/* Item Review Mini Table */}
          <div className="rounded-sm border border-[#d8ddd7] bg-white p-4 space-y-2">
            <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
              Manifest Items ({totalUnits} total)
            </h3>
            <div className="divide-y divide-[#e9ede7] text-xs">
              {items.map((it) => (
                <div key={it.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-[#151817]">{it.item_type}</span>
                    <span className="text-[#6b746e] ml-2">({it.brand}) × {it.quantity}</span>
                  </div>
                  <span className="font-mono text-[#6b746e]">{it.weight_kg * it.quantity} kg</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-[#d8ddd7]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setCurrentStep(3)}
              className="rounded-sm border border-[#d8ddd7] px-4 py-2 text-xs font-medium text-[#6b746e] hover:bg-[#f4f5f1]"
            >
              ← Back to Details
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitRequest}
              className="rounded-sm bg-[#2e7d57] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#246644] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Registering Request in Database..." : "Confirm & Schedule Pickup ✓"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: CONFIRMATION & QR PASS */}
      {currentStep === 5 && confirmedData && (
        <div className="space-y-6">
          <div className="rounded-sm border border-[#2e7d57] bg-[#f9fbf9] p-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#2e7d57] text-white text-xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-display font-bold text-[#151817]">
              Collection Request Confirmed!
            </h2>
            <p className="text-xs text-[#4b554d] max-w-md mx-auto">
              Your request has been logged in the municipal scheduling system. Your tracking pass and QR token are ready.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* QR Code Pass Box */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 text-center space-y-4 shadow-sm">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#6b746e]">
                Municipal Verification Token
              </div>

              {qrCodeDataUrl ? (
                <div className="inline-block p-3 bg-white border border-[#d8ddd7] rounded-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="Pickup QR Code"
                    className="h-48 w-48 mx-auto"
                  />
                </div>
              ) : (
                <div className="h-48 w-48 mx-auto bg-[#f4f5f1] flex items-center justify-center font-mono text-xs">
                  Generating QR...
                </div>
              )}

              <div className="font-mono text-base font-bold text-[#151817] tracking-wider bg-[#f4f5f1] py-1.5 px-3 rounded-sm border border-[#d8ddd7] inline-block">
                {confirmedData.qrToken}
              </div>

              <p className="text-[11px] text-[#6b746e]">
                Present this QR code to the municipal collector during handover for weight scale validation.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                {qrCodeDataUrl && (
                  <a
                    href={qrCodeDataUrl}
                    download={`${confirmedData.qrToken}-pass.png`}
                    className="inline-flex items-center justify-center rounded-sm border border-[#2e7d57] px-4 py-2 text-xs font-semibold text-[#2e7d57] hover:bg-[#edf5f0] transition-colors"
                  >
                    ⬇ Download QR Pass
                  </a>
                )}
                <Link
                  href={confirmedData.trackingUrl}
                  className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white hover:bg-[#246644] transition-colors"
                >
                  Track Live Status →
                </Link>
              </div>
            </div>

            {/* Preparation Instructions */}
            <div className="rounded-sm border border-[#d8ddd7] bg-white p-6 space-y-4">
              <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono border-b border-[#e9ede7] pb-2">
                Handover Checklist &amp; Next Steps
              </h3>
              <ul className="space-y-3 text-xs text-[#4b554d]">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#2e7d57] font-mono">1.</span>
                  <span>
                    <strong>Personal Data Wipe:</strong> Please sign out of Apple/Google accounts and factory reset mobile devices and computers where feasible.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#2e7d57] font-mono">2.</span>
                  <span>
                    <strong>Unplug &amp; Wrap Cords:</strong> Keep cords and peripheral power adapters grouped with their primary units.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#2e7d57] font-mono">3.</span>
                  <span>
                    <strong>Scheduled Pickup:</strong> Driver arrival window is{" "}
                    <strong>{confirmedData.pickupDate}</strong> during{" "}
                    <strong>{confirmedData.pickupSlot}</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-[#2e7d57] font-mono">4.</span>
                  <span>
                    <strong>Digital Scale Verification:</strong> The collector will weigh the items on-site and record certified weights directly into the recovery ledger.
                  </span>
                </li>
              </ul>

              <div className="pt-4 border-t border-[#e9ede7] flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-3.5 py-1.5 text-xs text-[#151817] hover:bg-[#e9ede7]"
                >
                  🖨 Print Confirmation
                </button>
                <Link
                  href="/request"
                  onClick={() => {
                    setCurrentStep(1);
                    setItems([]);
                    setConfirmedData(null);
                  }}
                  className="rounded-sm border border-[#d8ddd7] px-3.5 py-1.5 text-xs text-[#6b746e] hover:bg-[#f4f5f1]"
                >
                  + Schedule Another Pickup
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
