"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import {
  EWASTE_TAXONOMY,
  EwasteCategoryInfo,
  mapItemToTaxonomy,
} from "@/lib/taxonomy-mapper";
import {
  FALLBACK_HYDERABAD_ZONES,
  resolveZoneFromList,
  CollectionZone,
} from "@/lib/zone-resolver";
import { calculateImpact } from "@/lib/impact-calculator";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// Citizen-friendly category groups
interface CategoryGroup {
  id: string;
  label: string;
  description: string;
  keys: string[];
}

const CITIZEN_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "phones_tablets",
    label: "Phones & Tablets",
    description: "Smartphones, basic mobile phones, iPads, and tablets",
    keys: ["smartphone", "tablet", "feature_phone"],
  },
  {
    id: "computers_laptops",
    label: "Computers & Laptops",
    description: "Laptops, notebooks, desktop towers, and servers",
    keys: ["laptop", "desktop_pc"],
  },
  {
    id: "tvs_monitors",
    label: "TVs & Monitors",
    description: "Flat screens, computer monitors, and legacy CRT displays",
    keys: ["crt_tv", "crt_monitor"],
  },
  {
    id: "printers",
    label: "Printers",
    description: "Inkjet, laser printers, copiers, and scanners",
    keys: ["printer"],
  },
  {
    id: "small_electronics",
    label: "Small Electronics",
    description: "Audio receivers, DVD players, microwaves, and home appliances",
    keys: ["small_appliance", "audio_stereo", "media_player"],
  },
  {
    id: "accessories",
    label: "Accessories",
    description: "Cables, chargers, power adapters, mice, and keyboards",
    keys: ["other_electronics"],
  },
  {
    id: "other_ewaste",
    label: "Other E-Waste",
    description: "Landline phones, digital cameras, and miscellaneous electronics",
    keys: ["landline_phone", "camera"],
  },
];

interface ManifestItem {
  id: string;
  item_type: string;
  category_key: string;
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
  // Stepper state: 1: Items, 2: Location, 3: Schedule & Contact, 4: Review, 5: Confirmed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Manifest items state
  const [items, setItems] = useState<ManifestItem[]>([]);

  // Item intake drawer / draft state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // AI assistant suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<{
    deviceTitle: string;
    brand?: string;
    condition?: string;
    taxKey: string;
  } | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);

  // Draft item being edited
  const [selectedGroup, setSelectedGroup] = useState<string>("phones_tablets");
  const [selectedTaxKey, setSelectedTaxKey] = useState<string>("smartphone");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemBrand, setItemBrand] = useState<string>("");
  const [itemCondition, setItemCondition] = useState<string>("working");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(undefined);

  // Location state
  const [locationMode, setLocationMode] = useState<"gps" | "manual">("manual");
  const [address, setAddress] = useState<string>("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    FALLBACK_HYDERABAD_ZONES[0].id
  );
  const [zoneList, setZoneList] = useState<CollectionZone[]>(FALLBACK_HYDERABAD_ZONES);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  // Schedule & Contact state
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return d.toISOString().split("T")[0];
  });
  const [pickupSlot, setPickupSlot] = useState<string>("09:00 - 12:00");
  const [citizenPhone, setCitizenPhone] = useState<string>("");
  const [citizenName, setCitizenName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
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

  // Load municipal zones on mount
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

  // When group changes, auto-select first item type in that group
  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
    const grp = CITIZEN_CATEGORY_GROUPS.find((g) => g.id === groupId);
    if (grp && grp.keys.length > 0) {
      setSelectedTaxKey(grp.keys[0]);
    }
  };

  // Photo analysis handler (Friendly AI assistance)
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    setAssistantNotice(null);
    setAiSuggestion(null);
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    if (file.size > 8 * 1024 * 1024) {
      setAssistantNotice("Please choose an image under 8MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsAnalyzing(true);

    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      const base64Data = await base64Promise;

      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mediaType: file.type,
        }),
      });

      const responseJson = await res.json();

      if (responseJson.not_electronic) {
        setAssistantNotice(
          "We couldn't detect an electronic item in this photo. Please select your item category below."
        );
        setIsAnalyzing(false);
        return;
      }

      if (responseJson.data && responseJson.data.item_type) {
        const detected = responseJson.data;
        const tax = mapItemToTaxonomy(detected.item_type);

        // Find parent group
        const matchedGroup = CITIZEN_CATEGORY_GROUPS.find((g) =>
          g.keys.includes(tax.categoryKey)
        );

        setAiSuggestion({
          deviceTitle: tax.label,
          brand: detected.brand || undefined,
          condition: detected.condition || undefined,
          taxKey: tax.categoryKey,
        });

        if (matchedGroup) {
          setSelectedGroup(matchedGroup.id);
        }
        setSelectedTaxKey(tax.categoryKey);
        if (detected.brand) setItemBrand(detected.brand);
        if (detected.condition) setItemCondition(detected.condition);
      } else {
        setAssistantNotice(
          "We couldn't automatically identify the item. Please select the category manually."
        );
      }

      // Upload in background to Supabase storage if available
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
      } catch {
        // Safe silent fallback
      }
    } catch {
      setAssistantNotice(
        "Could not analyze image right now. You can pick your item category directly below."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Add configured item to manifest
  const handleSaveItem = () => {
    const tax: EwasteCategoryInfo =
      EWASTE_TAXONOMY.find((t) => t.categoryKey === selectedTaxKey) || {
        categoryKey: "other_electronics",
        label: "Electronic Device",
        group: "Accessories & Peripherals",
        avgWeightKg: 1.5,
        potentialHazards: [],
        defaultAgeYears: 3,
      };

    const impact = calculateImpact(
      tax.label,
      itemCondition,
      tax.defaultAgeYears,
      tax.avgWeightKg
    );

    const calculatedWeight = Math.round(tax.avgWeightKg * itemQuantity * 10) / 10;

    const newItem: ManifestItem = {
      id: "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      item_type: tax.label,
      category_key: tax.categoryKey,
      brand: itemBrand.trim() || "Standard",
      condition: itemCondition,
      estimated_age_years: tax.defaultAgeYears,
      weight_kg: calculatedWeight,
      quantity: itemQuantity,
      hazards: tax.potentialHazards,
      co2e_saved_est: Math.round(impact.co2eSavedKg * itemQuantity * 10) / 10,
      waste_avoided_kg: calculatedWeight,
      image_url: uploadedImageUrl || previewUrl || undefined,
    };

    setItems((prev) => [...prev, newItem]);
    setIsAddingItem(false);

    // Reset draft fields
    setPreviewUrl(null);
    setItemBrand("");
    setItemQuantity(1);
    setUploadedImageUrl(undefined);
    setAiSuggestion(null);
    setAssistantNotice(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // GPS Location detection with human-friendly locality display
  const handleDetectGPS = () => {
    setLocationNotice(null);
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationNotice("Location detection is not supported on this browser. Please enter your address below.");
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
        setIsDetectingLocation(false);
        setLocationNotice(`Location set: ${res.zone.name}, Hyderabad`);
      },
      () => {
        setIsDetectingLocation(false);
        setLocationNotice(
          "Location access was not granted. Please enter your street address and neighborhood manually."
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Compute selected zone human name
  const currentZone = zoneList.find((z) => z.id === selectedZoneId) || zoneList[0];
  const humanArea = currentZone ? `${currentZone.name}, Hyderabad` : "Hyderabad Metro Area";

  // Total weight
  const totalWeight = Math.round(items.reduce((acc, i) => acc + i.weight_kg, 0) * 10) / 10;
  const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

  // Stepper validation
  const handleProceedToLocation = () => {
    if (items.length === 0) {
      setFormError("Please add at least one item to collect before proceeding.");
      return;
    }
    setFormError(null);
    setCurrentStep(2);
  };

  const handleProceedToSchedule = () => {
    if (!address.trim() || address.trim().length < 5) {
      setFormError("Please provide your street address or building details (minimum 5 characters).");
      return;
    }
    setFormError(null);
    setCurrentStep(3);
  };

  const handleProceedToReview = () => {
    if (!citizenPhone.trim() || citizenPhone.trim().length < 7) {
      setFormError("Please provide a valid contact mobile number.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    if (!pickupDate || pickupDate < today) {
      setFormError("Please choose a future pickup date.");
      return;
    }
    setFormError(null);
    setCurrentStep(4);
  };

  // Final request submission
  const handleSubmitRequest = async () => {
    setIsSubmitting(true);
    setFormError(null);

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
        throw new Error(data.error || "We could not schedule your pickup. Please check your information and try again.");
      }

      // Generate QR Code data URL for client pickup pass
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
        zoneName: humanArea,
        itemsCount: totalCount,
        estimatedWeightKg: totalWeight,
        trackingUrl: `/track/${data.qrToken}`,
      });

      setCurrentStep(5);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToken = () => {
    if (confirmedData?.qrToken) {
      navigator.clipboard.writeText(confirmedData.qrToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-8 space-y-8">
      {/* Header & Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-semibold text-[#6b746e] hover:text-[#151817] inline-flex items-center gap-1"
          >
            &larr; Return to Home
          </Link>
          <span className="text-[#d8ddd7]">·</span>
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#2e7d57] font-bold">
            Doorstep Collection Booking
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#151817]">
          Schedule an E-Waste Pickup
        </h1>
        <p className="text-xs sm:text-sm text-[#6b746e] leading-relaxed">
          Book a free doorstep pickup for unwanted electronics. Every pickup receives a unique tracking pass and doorstep digital scale verification.
        </p>
      </div>

      {/* Progress Indicator (Steps 1 to 4) */}
      {currentStep < 5 && (
        <nav aria-label="Booking Progress" className="border-b border-[#d8ddd7] pb-4">
          <ol className="flex items-center justify-between text-xs font-semibold text-[#6b746e]">
            {[
              { num: 1, label: "Items" },
              { num: 2, label: "Location" },
              { num: 3, label: "Schedule" },
              { num: 4, label: "Review" },
            ].map((st) => {
              const isActive = currentStep === st.num;
              const isPast = currentStep > st.num;
              return (
                <li key={st.num} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-xs ${
                      isActive
                        ? "bg-[#2e7d57] text-white font-bold"
                        : isPast
                        ? "bg-[#e6f2e8] text-[#173d2c] font-bold border border-[#2e7d57]"
                        : "bg-[#e9ede7] text-[#6b746e]"
                    }`}
                  >
                    {isPast ? "✓" : st.num}
                  </span>
                  <span className={isActive ? "text-[#151817] font-bold" : isPast ? "text-[#173d2c]" : ""}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Error banner */}
      {formError && (
        <div className="rounded-[3px] border border-[#f5c6cb] bg-[#fdf2f2] p-3.5 text-xs text-[#721c24] flex items-center justify-between">
          <span>{formError}</span>
          <button
            onClick={() => setFormError(null)}
            className="text-sm font-bold text-[#721c24] hover:opacity-75"
          >
            &times;
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 1: ITEMS ("WHAT") */}
      {/* ========================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2e7d57] font-bold block">
              Step 1 of 4
            </span>
            <h2 className="text-xl font-display font-bold text-[#151817]">
              What would you like us to collect?
            </h2>
            <p className="text-xs text-[#6b746e]">
              Add one or more electronic items. You can snap an optional photo for assistance or pick from standard categories.
            </p>
          </div>

          {/* Added items list */}
          {items.length > 0 ? (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-[#151817] block">
                Items to Collect ({items.length}) · Est. Weight: {totalWeight} kg
              </span>
              <div className="divide-y divide-[#d8ddd7] rounded-[3px] border border-[#d8ddd7] bg-white overflow-hidden">
                {items.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#151817]">
                          {item.item_type}
                        </span>
                        <Badge variant="neutral" size="sm">
                          Qty: {item.quantity}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-[#6b746e] flex flex-wrap items-center gap-3">
                        <span>Brand: {item.brand}</span>
                        <span>·</span>
                        <span className="capitalize">Condition: {item.condition}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-[#151817]">
                          ~{item.weight_kg} kg
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-xs text-[#991b1b] hover:underline px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[3px] border border-dashed border-[#d8ddd7] bg-white p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[#151817]">No items added yet</p>
              <p className="text-xs text-[#6b746e] max-w-sm mx-auto">
                Select your electronic device categories below to add them to your collection manifest.
              </p>
            </div>
          )}

          {/* Add item interface */}
          {!isAddingItem ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddingItem(true)}
              className="w-full py-3 text-xs font-bold"
            >
              + Add an Item
            </Button>
          ) : (
            <Card className="border-[#2e7d57] shadow-sm">
              <CardHeader className="pb-3 border-b border-[#d8ddd7]">
                <div className="flex items-center justify-between">
                  <CardTitle>Add Electronic Item</CardTitle>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingItem(false);
                      setAiSuggestion(null);
                      setPreviewUrl(null);
                    }}
                    className="text-xs text-[#6b746e] hover:text-[#151817]"
                  >
                    Cancel
                  </button>
                </div>
                <CardDescription>
                  Upload a photo for quick identification assistance, or choose a category manually.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* Photo upload assistance */}
                <div className="space-y-2 rounded-[3px] border border-[#d8ddd7] bg-[#f9faf8] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#151817]">
                      Photo Assistance (Optional)
                    </span>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl(null);
                          setAiSuggestion(null);
                        }}
                        className="text-[11px] text-[#6b746e] hover:underline"
                      >
                        Clear photo
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {!previewUrl ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-[3px] border border-dashed border-[#d8ddd7] bg-white py-3 text-xs font-medium text-[#2e7d57] hover:bg-[#f4f5f1] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Take or upload a photo of your device</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Item preview"
                        className="h-16 w-16 object-cover rounded-[3px] border border-[#d8ddd7]"
                      />
                      <div className="space-y-1">
                        {isAnalyzing ? (
                          <div className="flex items-center gap-2 text-xs text-[#2e7d57] font-medium">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent" />
                            <span>Identifying device...</span>
                          </div>
                        ) : aiSuggestion ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-[#151817]">
                              We think this is a {aiSuggestion.deviceTitle}. Is that right?
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="success" size="sm">
                                Detected: {aiSuggestion.deviceTitle}
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#6b746e]">Photo attached.</span>
                        )}
                      </div>
                    </div>
                  )}

                  {assistantNotice && (
                    <p className="text-[11px] text-[#6b746e] pt-1">{assistantNotice}</p>
                  )}
                </div>

                {/* Step A: Category Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[#151817]">
                    1. Select Item Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CITIZEN_CATEGORY_GROUPS.map((grp) => {
                      const isSelected = selectedGroup === grp.id;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => handleGroupSelect(grp.id)}
                          className={`p-3 text-left rounded-[3px] border text-xs transition-colors ${
                            isSelected
                              ? "border-[#2e7d57] bg-[#edf5f0] text-[#173d2c] font-semibold"
                              : "border-[#d8ddd7] bg-white text-[#151817] hover:bg-[#f4f5f1]"
                          }`}
                        >
                          <span className="block font-bold leading-tight">{grp.label}</span>
                          <span className="block text-[10px] text-[#6b746e] mt-1 leading-tight line-clamp-2">
                            {grp.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step B: Specific Item Type in Group */}
                {(() => {
                  const currentGrp = CITIZEN_CATEGORY_GROUPS.find((g) => g.id === selectedGroup);
                  const availableTaxes = EWASTE_TAXONOMY.filter((t) =>
                    currentGrp?.keys.includes(t.categoryKey)
                  );

                  return (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-[#151817]">
                        2. Specific Device Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableTaxes.map((tax) => {
                          const isPicked = selectedTaxKey === tax.categoryKey;
                          return (
                            <button
                              key={tax.categoryKey}
                              type="button"
                              onClick={() => setSelectedTaxKey(tax.categoryKey)}
                              className={`px-3 py-1.5 rounded-[3px] border text-xs font-medium transition-colors ${
                                isPicked
                                  ? "border-[#2e7d57] bg-[#2e7d57] text-white"
                                  : "border-[#d8ddd7] bg-white text-[#151817] hover:bg-[#f4f5f1]"
                              }`}
                            >
                              {tax.label} (~{tax.avgWeightKg} kg)
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Step C: Quantity, Brand & Condition */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Brand / Model (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dell, Apple, Sony"
                      value={itemBrand}
                      onChange={(e) => setItemBrand(e.target.value)}
                      className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151817] mb-1">
                      Condition
                    </label>
                    <select
                      value={itemCondition}
                      onChange={(e) => setItemCondition(e.target.value)}
                      className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs"
                    >
                      <option value="working">Working / Powers On</option>
                      <option value="repairable">Damaged / Needs Repair</option>
                      <option value="scrap">End of Life / For Scrap</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#d8ddd7]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingItem(false);
                      setAiSuggestion(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" onClick={handleSaveItem}>
                    Add to Pickup List &rarr;
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stepper Navigation */}
          <div className="pt-4 flex items-center justify-between border-t border-[#d8ddd7]">
            <span className="text-xs text-[#6b746e]">
              {items.length === 0 ? "Add at least 1 item to proceed" : `${items.length} item(s) configured`}
            </span>
            <Button
              type="button"
              variant="primary"
              onClick={handleProceedToLocation}
              disabled={items.length === 0}
            >
              Continue to Location &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: LOCATION ("WHERE") */}
      {/* ========================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2e7d57] font-bold block">
              Step 2 of 4
            </span>
            <h2 className="text-xl font-display font-bold text-[#151817]">
              Where should we collect it?
            </h2>
            <p className="text-xs text-[#6b746e]">
              Provide your street address so our collection vehicle can arrive at your doorstep.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setLocationMode("gps");
                handleDetectGPS();
              }}
              className={`p-4 rounded-[3px] border text-left transition-colors flex items-start gap-3 ${
                locationMode === "gps"
                  ? "border-[#2e7d57] bg-[#edf5f0]"
                  : "border-[#d8ddd7] bg-white hover:bg-[#f4f5f1]"
              }`}
            >
              <span className="text-lg">📍</span>
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#151817] block">
                  Use my current location
                </span>
                <span className="text-[11px] text-[#6b746e] block">
                  Automatically match your neighborhood zone via GPS
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setLocationMode("manual")}
              className={`p-4 rounded-[3px] border text-left transition-colors flex items-start gap-3 ${
                locationMode === "manual"
                  ? "border-[#2e7d57] bg-[#edf5f0]"
                  : "border-[#d8ddd7] bg-white hover:bg-[#f4f5f1]"
              }`}
            >
              <span className="text-lg">✍️</span>
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#151817] block">
                  Enter address manually
                </span>
                <span className="text-[11px] text-[#6b746e] block">
                  Type your street, building, or landmark directly
                </span>
              </div>
            </button>
          </div>

          {isDetectingLocation && (
            <div className="rounded-[3px] border border-[#d8ddd7] bg-[#f9faf8] p-3 text-xs text-[#2e7d57] flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#2e7d57] border-t-transparent" />
              <span>Acquiring location coordinates...</span>
            </div>
          )}

          {locationNotice && (
            <div className="rounded-[3px] border border-[#bcdbc8] bg-[#edf5f0] p-3 text-xs text-[#1e583c]">
              {locationNotice}
            </div>
          )}

          {/* Address input */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <label htmlFor="address-input" className="block text-xs font-semibold text-[#151817] mb-1">
                  Street Address &amp; Door / Flat Number *
                </label>
                <textarea
                  id="address-input"
                  rows={2}
                  required
                  placeholder="e.g. Flat 402, Green Residency, Road No. 12, Banjara Hills"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-[3px] border border-[#d8ddd7] bg-white p-2.5 text-xs text-[#151817] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57]"
                />
              </div>

              {/* Human-readable pickup area */}
              <div className="rounded-[3px] bg-[#f4f5f1] border border-[#d8ddd7] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#6b746e]">
                    Pickup Area:
                  </span>
                  <span className="text-xs font-bold text-[#151817]">
                    {humanArea}
                  </span>
                </div>
                <div>
                  <label htmlFor="zone-select" className="block text-[11px] text-[#6b746e] mb-1">
                    Select neighborhood zone manually if different:
                  </label>
                  <select
                    id="zone-select"
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="w-full rounded-[3px] border border-[#d8ddd7] bg-white p-2 text-xs"
                  >
                    {zoneList.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}, Hyderabad
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stepper Navigation */}
          <div className="pt-4 flex items-center justify-between border-t border-[#d8ddd7]">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
              &larr; Back to Items
            </Button>
            <Button type="button" variant="primary" onClick={handleProceedToSchedule}>
              Continue to Schedule &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 3: SCHEDULE & CONTACT ("WHEN") */}
      {/* ========================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2e7d57] font-bold block">
              Step 3 of 4
            </span>
            <h2 className="text-xl font-display font-bold text-[#151817]">
              When should we collect it?
            </h2>
            <p className="text-xs text-[#6b746e]">
              Choose a collection date and preferred arrival window.
            </p>
          </div>

          <Card>
            <CardContent className="p-5 space-y-5">
              {/* Date selection */}
              <div>
                <label htmlFor="pickup-date" className="block text-xs font-semibold text-[#151817] mb-1.5">
                  Pickup Date *
                </label>
                <input
                  id="pickup-date"
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs font-mono"
                />
              </div>

              {/* Time slots */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#151817]">
                  Time Window *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { slot: "09:00 - 12:00", title: "Morning", hours: "9:00 AM – 12:00 PM" },
                    { slot: "12:00 - 15:00", title: "Afternoon", hours: "1:00 PM – 4:00 PM" },
                    { slot: "15:00 - 18:00", title: "Evening", hours: "4:00 PM – 7:00 PM" },
                  ].map((s) => {
                    const isSelected = pickupSlot === s.slot;
                    return (
                      <button
                        key={s.slot}
                        type="button"
                        onClick={() => setPickupSlot(s.slot)}
                        className={`p-3 rounded-[3px] border text-left transition-colors ${
                          isSelected
                            ? "border-[#2e7d57] bg-[#edf5f0] text-[#173d2c]"
                            : "border-[#d8ddd7] bg-white text-[#151817] hover:bg-[#f4f5f1]"
                        }`}
                      >
                        <span className="block font-bold text-xs">{s.title}</span>
                        <span className="block text-[11px] text-[#6b746e] mt-0.5">{s.hours}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact information */}
              <div className="border-t border-[#d8ddd7] pt-4 space-y-3">
                <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono block">
                  Contact Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="phone-input" className="block text-xs font-semibold text-[#151817] mb-1">
                      Mobile Number *
                    </label>
                    <input
                      id="phone-input"
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={citizenPhone}
                      onChange={(e) => setCitizenPhone(e.target.value)}
                      className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs font-mono"
                    />
                    <span className="text-[10px] text-[#6b746e] mt-1 block">
                      Used only to coordinate your pickup arrival.
                    </span>
                  </div>

                  <div>
                    <label htmlFor="name-input" className="block text-xs font-semibold text-[#151817] mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      id="name-input"
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={citizenName}
                      onChange={(e) => setCitizenName(e.target.value)}
                      className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="notes-input" className="block text-xs font-semibold text-[#151817] mb-1">
                    Notes for Collector (Optional)
                  </label>
                  <input
                    id="notes-input"
                    type="text"
                    placeholder="Gate code, parking instructions, or landmark"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stepper Navigation */}
          <div className="pt-4 flex items-center justify-between border-t border-[#d8ddd7]">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
              &larr; Back to Location
            </Button>
            <Button type="button" variant="primary" onClick={handleProceedToReview}>
              Continue to Review &rarr;
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 4: REVIEW ("REVIEW YOUR PICKUP") */}
      {/* ========================================================= */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2e7d57] font-bold block">
              Step 4 of 4
            </span>
            <h2 className="text-xl font-display font-bold text-[#151817]">
              Review your pickup
            </h2>
            <p className="text-xs text-[#6b746e]">
              Please verify your items, address, and scheduled window before confirming.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Items summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#d8ddd7] pb-2">
                  <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                    Items to Collect ({totalCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-xs font-semibold text-[#2e7d57] hover:underline"
                  >
                    Edit items
                  </button>
                </div>
                <div className="divide-y divide-[#d8ddd7]">
                  {items.map((i) => (
                    <div key={i.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#151817]">{i.item_type}</span>
                        <span className="text-[#6b746e] ml-2">({i.brand}) &times; {i.quantity}</span>
                      </div>
                      <span className="font-mono text-[#151817]">~{i.weight_kg} kg</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 font-mono text-xs font-bold text-[#151817]">
                  <span>Total Estimated Weight:</span>
                  <span className="text-[#2e7d57]">{totalWeight} kg</span>
                </div>
              </div>

              {/* Location summary */}
              <div className="space-y-2 border-t border-[#d8ddd7] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                    Pickup Location
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-semibold text-[#2e7d57] hover:underline"
                  >
                    Edit location
                  </button>
                </div>
                <p className="text-xs text-[#151817] font-medium">{address}</p>
                <p className="text-[11px] text-[#6b746e]">Area: {humanArea}</p>
              </div>

              {/* Schedule summary */}
              <div className="space-y-2 border-t border-[#d8ddd7] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
                    Schedule &amp; Contact
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="text-xs font-semibold text-[#2e7d57] hover:underline"
                  >
                    Edit schedule
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Date:</span>
                    <span className="font-mono font-semibold text-[#151817]">{pickupDate}</span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Time Window:</span>
                    <span className="font-mono font-semibold text-[#151817]">{pickupSlot}</span>
                  </div>
                  <div>
                    <span className="text-[#6b746e] block text-[11px]">Phone:</span>
                    <span className="font-mono font-semibold text-[#151817]">{citizenPhone}</span>
                  </div>
                  {notes && (
                    <div>
                      <span className="text-[#6b746e] block text-[11px]">Notes:</span>
                      <span className="text-[#151817]">{notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stepper Navigation */}
          <div className="pt-4 flex items-center justify-between border-t border-[#d8ddd7]">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setCurrentStep(3)}
            >
              &larr; Back to Schedule
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isSubmitting}
              onClick={handleSubmitRequest}
              className="px-6 py-3"
            >
              {isSubmitting ? "Scheduling Pickup..." : "Confirm Pickup &rarr;"}
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 5: SUCCESS STATE */}
      {/* ========================================================= */}
      {currentStep === 5 && confirmedData && (
        <div className="space-y-8">
          <Card className="border-[#2e7d57] bg-white p-6 sm:p-10 text-center space-y-6 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#edf5f0] text-[#2e7d57] text-xl font-bold">
              ✓
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#2e7d57] font-bold block">
                Confirmed Booking
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#151817]">
                Pickup requested
              </h2>
              <p className="text-xs sm:text-sm text-[#6b746e] max-w-md mx-auto">
                Your collection pass is active. Keep your tracking code or QR code handy for the driver during pickup.
              </p>
            </div>

            {/* Tracking Code Box */}
            <div className="mx-auto max-w-sm rounded-[3px] border border-[#d8ddd7] bg-[#f4f5f1] p-5 space-y-3">
              <span className="text-[11px] font-mono text-[#6b746e] uppercase tracking-wider block">
                Your Tracking Code
              </span>
              <div className="font-mono text-2xl font-bold text-[#151817] tracking-wider select-all">
                {confirmedData.qrToken}
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="rounded-[3px] border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-semibold text-[#151817] hover:bg-[#e9ede7] transition-colors"
                >
                  {copiedToken ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* QR Code Pass */}
            {qrCodeDataUrl && (
              <div className="space-y-2">
                <div className="inline-block p-2 bg-white border border-[#d8ddd7] rounded-[3px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeDataUrl}
                    alt="Pickup QR Pass"
                    className="h-44 w-44 mx-auto"
                  />
                </div>
                <p className="text-[11px] text-[#6b746e]">
                  The driver will scan this pass at your door to open the digital weighing scale record.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={confirmedData.trackingUrl}>
                <Button variant="primary" className="w-full sm:w-auto px-6 py-2.5">
                  Track Pickup Status &rarr;
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="w-full sm:w-auto"
              >
                Save Pickup Pass
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setItems([]);
                  setCurrentStep(1);
                  setConfirmedData(null);
                }}
                className="w-full sm:w-auto"
              >
                Schedule another pickup
              </Button>
            </div>
          </Card>

          {/* Operational reassurance */}
          <div className="rounded-[3px] border border-[#d8ddd7] bg-[#f9faf8] p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#151817] uppercase tracking-wider font-mono">
              Next Steps:
            </h3>
            <ul className="space-y-2 text-xs text-[#6b746e]">
              <li className="flex items-start gap-2">
                <span className="font-mono text-[#2e7d57] font-bold">1.</span>
                <span>Our municipal route scheduler will batch your request into the daily collection route.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-[#2e7d57] font-bold">2.</span>
                <span>The driver will arrive during your scheduled window ({confirmedData.pickupDate}, {confirmedData.pickupSlot}).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-mono text-[#2e7d57] font-bold">3.</span>
                <span>Your items will be weighed on a calibrated scale, and custody transfer will be logged on your tracking page.</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
