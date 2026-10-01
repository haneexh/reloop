"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { calculateCircularImpact } from "@/lib/impact-calculator";

type AssessmentCondition =
  "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged";

interface ItemFormData {
  item_type: string;
  brand: string;
  estimated_age_years: string;
  condition: AssessmentCondition;
  condition_notes: string;
  material_recoverable: boolean;
}

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export default function AnalyzePage() {
  // Step tracking: 'upload' | 'analyzing' | 'review' | 'saving' | 'success'
  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "saving" | "success">(
    "upload"
  );

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedPublicUrl, setUploadedPublicUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form & AI assessment state
  const [formData, setFormData] = useState<ItemFormData>({
    item_type: "",
    brand: "",
    estimated_age_years: "",
    condition: "functional",
    condition_notes: "",
    material_recoverable: true,
  });

  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [isManualFallback, setIsManualFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
      setErrorMessage("Please select a JPG, PNG, or WebP image.");
      return;
    }

    // Validate size (8MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("Image file exceeds the 8MB limit. Please upload a smaller file.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Step 1 -> 2: Upload to Supabase Storage & trigger Vision API
  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an image first.");
      return;
    }

    setStep("analyzing");
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      // 1. Upload to Supabase Storage (bucket: 'item-photos')
      let publicImageUrl = previewUrl;
      try {
        const fileExt = selectedFile.name.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("item-photos")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("item-photos").getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            publicImageUrl = urlData.publicUrl;
            setUploadedPublicUrl(urlData.publicUrl);
          }
        } else {
          console.warn("Supabase Storage upload notice:", uploadError.message);
        }
      } catch (storageErr) {
        console.warn("Storage upload fallback:", storageErr);
      }

      // 2. Prepare Base64 payload for Vision API
      const base64Data = await fileToBase64(selectedFile);

      // 3. Call /api/analyze-image
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mediaType: selectedFile.type,
          imageUrl: publicImageUrl,
        }),
      });

      const responseJson = await res.json();

      if (responseJson.manual_fallback) {
        setIsManualFallback(true);
        setInfoMessage(
          responseJson.message ||
            "Vision assessment unavailable. Please review and input item specs manually."
        );
      } else {
        setIsManualFallback(false);
        setAiProvider(responseJson.provider);
      }

      const parsedData = responseJson.data || {};
      setFormData({
        item_type: parsedData.item_type || "",
        brand: parsedData.brand || "",
        estimated_age_years:
          parsedData.estimated_age_years !== null && parsedData.estimated_age_years !== undefined
            ? String(parsedData.estimated_age_years)
            : "",
        condition: parsedData.condition || "functional",
        condition_notes: parsedData.condition_notes || "",
        material_recoverable:
          typeof parsedData.material_recoverable === "boolean"
            ? parsedData.material_recoverable
            : true,
      });

      setStep("review");
    } catch (err) {
      console.error("Analysis error:", err);
      setIsManualFallback(true);
      setInfoMessage("Could not contact Vision API. Switched to manual item specification mode.");
      setStep("review");
    }
  };

  // Step 3 -> 4: Save verified item to Supabase `items` table
  const handleConfirmAndSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_type.trim()) {
      setErrorMessage("Please specify the item type before saving.");
      return;
    }

    setStep("saving");
    setErrorMessage(null);

    try {
      const ageNum = formData.estimated_age_years ? parseFloat(formData.estimated_age_years) : null;

      // Calculate baseline circular metrics
      const impact = calculateCircularImpact({
        itemType: formData.item_type,
        condition: formData.condition,
        estimatedAgeYears: ageNum,
      });

      const { data, error } = await supabase
        .from("items")
        .insert({
          image_url: uploadedPublicUrl || previewUrl,
          item_type: formData.item_type.trim().toLowerCase(),
          brand: formData.brand.trim() || null,
          estimated_age_years: ageNum,
          condition: formData.condition,
          repair_cost_est: impact.repairCostEst,
          resale_value_est: impact.resaleValueEst,
          co2e_saved_est: impact.co2eSavedEst,
          waste_avoided_kg: impact.wasteAvoidedKg,
        })
        .select()
        .single();

      if (error) {
        console.error("Database insert error:", error);
        throw new Error(error.message);
      }

      setSavedItemId(data?.id || "saved");
      setStep("success");
    } catch (err) {
      console.error("Save error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to save item to database. Please check your Supabase connection."
      );
      setStep("review");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedPublicUrl(null);
    setSavedItemId(null);
    setErrorMessage(null);
    setInfoMessage(null);
    setFormData({
      item_type: "",
      brand: "",
      estimated_age_years: "",
      condition: "functional",
      condition_notes: "",
      material_recoverable: true,
    });
    setStep("upload");
  };

  // Current calculated impact for live preview
  const liveImpact = calculateCircularImpact({
    itemType: formData.item_type || "item",
    condition: formData.condition,
    estimatedAgeYears: formData.estimated_age_years ? parseFloat(formData.estimated_age_years) : 2,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Item Intake & Condition Assessment
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Phase 1: Multi-modal vision analysis with mandatory human-in-the-loop verification
          </p>
        </div>
        <div className="text-xs font-mono text-zinc-400">
          {step === "upload" && "Step 1 of 3: Upload"}
          {step === "analyzing" && "Processing Vision"}
          {step === "review" && "Step 2 of 3: Verify"}
          {step === "saving" && "Saving to Database"}
          {step === "success" && "Step 3 of 3: Ready"}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <div className="font-medium mb-0.5">Error Notice</div>
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Global Info Banner */}
      {infoMessage && (
        <div className="rounded-md border border-zinc-300 bg-zinc-100 p-4 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
          <div className="font-medium mb-0.5">System Notice</div>
          <div>{infoMessage}</div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD STATE */}
      {/* ========================================================================= */}
      {step === "upload" && (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-md border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="space-y-4">
                <div className="mx-auto max-h-64 max-w-sm overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected item preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="text-xs text-zinc-500">
                  {selectedFile?.name} (
                  {(selectedFile?.size ? selectedFile.size / 1024 / 1024 : 0).toFixed(2)} MB)
                </div>
                <p className="text-xs text-zinc-400">Click or drag a new image to replace</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Drop an item photo here, or click to browse
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Supports JPG, PNG, or WebP up to 8MB
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleStartAnalysis}
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Assess Item Condition
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ANALYZING SPINNER */}
      {/* ========================================================================= */}
      {step === "analyzing" && (
        <div className="rounded-md border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"></div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Assessing Item via Vision API...
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Uploading photo to Supabase Storage and running condition classification.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW & EDITABLE FORM (MANDATORY HUMAN VERIFICATION) */}
      {/* ========================================================================= */}
      {(step === "review" || step === "saving") && (
        <form onSubmit={handleConfirmAndSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Photo Preview & Detection Badge */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Analyzed item"
                    className="h-48 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-zinc-400">
                    No image preview
                  </div>
                )}
              </div>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Assessor</span>
                  <span className="font-mono text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                    {isManualFallback ? "Manual Entry" : aiProvider || "Vision Model"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Storage</span>
                  <span className="font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                    item-photos
                  </span>
                </div>
              </div>

              {/* Dynamic Impact Estimation Preview */}
              <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 space-y-2 text-xs">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">Estimated Impact</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                  <div className="rounded border border-zinc-100 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="text-zinc-500">CO2e Saved</span>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {liveImpact.co2eSavedEst} kg
                    </div>
                  </div>
                  <div className="rounded border border-zinc-100 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="text-zinc-500">Waste Avoided</span>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {liveImpact.wasteAvoidedKg} kg
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Editable Assessment Inputs */}
            <div className="md:col-span-2 space-y-4 rounded-md border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Verify & Edit Item Details
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Review the assessment below. Correct any parameters before saving to the database.
                </p>
              </div>

              {/* Item Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Item Type <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. laptop, smartphone, office chair, microwave"
                  value={formData.item_type}
                  onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                />
              </div>

              {/* Brand & Estimated Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dell, Apple, Samsung (optional)"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Estimated Age (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    placeholder="e.g. 2.5 (optional)"
                    value={formData.estimated_age_years}
                    onChange={(e) =>
                      setFormData({ ...formData, estimated_age_years: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                  />
                </div>
              </div>

              {/* Condition Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Assessed Condition <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: e.target.value as AssessmentCondition,
                    })
                  }
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                >
                  <option value="functional">Functional (Working, normal wear)</option>
                  <option value="cosmetic_damage">
                    Cosmetic Damage (Scratches, minor exterior flaws)
                  </option>
                  <option value="partially_working">
                    Partially Working (Faulty battery/subcomponent)
                  </option>
                  <option value="severely_damaged">
                    Severely Damaged (Non-functional / E-waste ready)
                  </option>
                </select>
              </div>

              {/* Condition Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Condition & Visual Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes on visible damage, screen integrity, missing parts..."
                  value={formData.condition_notes}
                  onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={step === "saving"}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Upload Another
                </button>

                <button
                  type="submit"
                  disabled={step === "saving"}
                  className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {step === "saving" ? "Saving Item..." : "Confirm & Save Item"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: SUCCESS STATE */}
      {/* ========================================================================= */}
      {step === "success" && (
        <div className="rounded-md border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 space-y-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Item Saved to RE:LOOP
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The item has been recorded in the database with verified condition metrics.
            </p>
          </div>

          <div className="mx-auto max-w-sm rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 text-left text-xs font-mono space-y-1.5">
            <div className="text-zinc-500">Item ID:</div>
            <div className="truncate text-zinc-900 dark:text-zinc-100 font-semibold">
              {savedItemId}
            </div>
            <div className="text-zinc-500 pt-1">Type & Condition:</div>
            <div className="text-zinc-900 dark:text-zinc-100 capitalize">
              {formData.item_type} ({formData.condition.replace("_", " ")})
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Analyze Another Item
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Back to Overview
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
