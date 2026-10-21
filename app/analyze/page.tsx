"use client";

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { evaluateItem, ITEM_TYPE_PRESETS } from "@/lib/decisionEngine";
import { ProcessRail } from "@/components/ProcessRail";
import { resizeAndCompressImage } from "@/lib/image-processing";

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

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB max raw input

export default function AnalyzePage() {
  const router = useRouter();

  // Step tracking: 'upload' | 'analyzing' | 'review' | 'saving' | 'success'
  const [step, setStep] = useState<"upload" | "analyzing" | "review" | "saving" | "success">(
    "upload"
  );

  // Image states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Url, setBase64Url] = useState<string | null>(null);
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
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [isManualFallback, setIsManualFallback] = useState(false);
  const [isLowConfidence, setIsLowConfidence] = useState(false);
  const [confidenceLevel, setConfidenceLevel] = useState<"high" | "medium" | "low">("medium");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [notElectronicError, setNotElectronicError] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [isCachedResult, setIsCachedResult] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<"uploading" | "identifying" | "assessing">("uploading");
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // Clean up camera stream on unmount or reset
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setIsStartingCamera(false);
  };

  // Start live camera stream (getUserMedia) with fallback to native capture input
  const startCamera = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setNotElectronicError(null);
    setIsStartingCamera(true);

    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setIsStartingCamera(false);
      cameraInputRef.current?.click();
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      mediaStreamRef.current = stream;
      setIsCameraOpen(true);
      setIsStartingCamera(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => console.warn("Video playback notice:", err));
      }
    } catch (err: unknown) {
      console.warn("Camera getUserMedia error / permission denied:", err);
      stopCamera();
      setInfoMessage("Camera access not available or permission denied. Switched to file picker.");
      cameraInputRef.current?.click();
    }
  };

  // Ensure video element receives the stream when modal/view mounts
  useEffect(() => {
    if (isCameraOpen && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch((err) => console.warn("Video playback notice:", err));
    }
  }, [isCameraOpen]);

  // Clean up any active media stream when component unmounts
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Capture frame from active video element to Blob / File
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setErrorMessage("Unable to capture image from camera canvas.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMessage("Failed to generate image file from camera capture.");
          return;
        }
        const file = new File([blob], `camera-intake-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopCamera();
        handleFile(file);
      },
      "image/jpeg",
      0.92
    );
  };

  // Handle file selection with client-side compression (max 1024px, 0.8 JPEG quality)
  const handleFile = async (file: File) => {
    setErrorMessage(null);
    setNotElectronicError(null);

    // Validate type
    if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type)) {
      setErrorMessage("Supported file formats: JPG, PNG, or WebP.");
      return;
    }

    // Validate size (max 12MB raw input)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage("Image file exceeds the 12MB limit. Please provide a smaller image.");
      return;
    }

    try {
      setIsCompressing(true);
      // Resize & compress to max 1024px on long side and ~0.8 JPEG quality
      const processed = await resizeAndCompressImage(file, 1024, 0.8);
      setSelectedFile(processed.file);
      setPreviewUrl(processed.previewUrl);
      setBase64Url(processed.base64Data);
      setImageHash(processed.sha256);
      setIsCompressing(false);
    } catch (err) {
      console.warn("Client compression notice:", err);
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setIsCompressing(false);
    }
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

  // Step 1 -> 2: Upload to Supabase Storage & trigger Vision API with progressive stages
  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      setErrorMessage("Please capture or upload an item photograph first.");
      return;
    }

    setStep("analyzing");
    setAnalysisStage("uploading");
    setErrorMessage(null);
    setInfoMessage(null);
    setNotElectronicError(null);

    const t1 = setTimeout(() => setAnalysisStage("identifying"), 1200);
    const t2 = setTimeout(() => setAnalysisStage("assessing"), 3000);

    try {
      // 1. Upload compressed file to Supabase Storage (bucket: 'item-photos')
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
      const base64Data = base64Url || (await fileToBase64(selectedFile));

      // 3. Call /api/analyze-image
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mediaType: selectedFile.type || "image/jpeg",
          imageUrl: publicImageUrl,
          imageHash: imageHash,
        }),
      });

      const responseJson = await res.json();

      if (res.status === 429) {
        setErrorMessage(responseJson.error || "Rate limit reached. Please wait a moment before trying again.");
        setStep("upload");
        return;
      }

      // Check strict electronics-only gate
      if (responseJson.not_electronic || (!responseJson.success && responseJson.not_electronic)) {
        const rejectionMsg =
          responseJson.message ||
          "RE:LOOP currently only assesses electronic items. This photo doesn't appear to show an electronic device. Please upload a photo of an electronic item instead.";
        setNotElectronicError(rejectionMsg);
        setStep("upload");
        return;
      }

      const parsedData = responseJson.data || {};
      const lowConf = Boolean(responseJson.manual_fallback || parsedData.is_low_confidence || parsedData.confidence === "low");

      setIsLowConfidence(lowConf);
      setConfidenceLevel(parsedData.confidence || (lowConf ? "low" : "medium"));
      setIsCachedResult(Boolean(responseJson.cached));

      if (responseJson.manual_fallback) {
        setIsManualFallback(true);
        setAiProvider(null);
        setAiModel(null);
        setInfoMessage(
          responseJson.message ||
            "Vision model provided a preliminary best-guess. Please verify item category below."
        );
      } else {
        setIsManualFallback(false);
        setAiProvider(responseJson.provider);
        setAiModel(responseJson.model || null);
      }

      setFormData({
        item_type: parsedData.item_type || "Other Electronics / Unlisted",
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
    } catch (err: unknown) {
      console.error("Analysis error:", err);
      setIsManualFallback(true);
      setErrorMessage("Network issue contacting vision API. Switched to manual calibration mode.");
      setStep("review");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
    }
  };

  // Step 3 -> 4: Save verified item to Supabase `items` table, evaluate recommendations, and redirect
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

      // 1. Calculate deterministic decision engine metrics
      const evaluation = evaluateItem({
        item_type: formData.item_type,
        brand: formData.brand.trim() || null,
        estimated_age_years: ageNum,
        condition: formData.condition,
        material_recoverable: formData.material_recoverable,
      });

      // 2. Insert item into items table
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .insert({
          image_url: uploadedPublicUrl || base64Url || previewUrl,
          item_type: formData.item_type.trim().toLowerCase(),
          brand: formData.brand.trim() || null,
          estimated_age_years: ageNum,
          condition: formData.condition,
          repair_cost_est: evaluation.repair_cost_est,
          resale_value_est: evaluation.resale_value_est,
          co2e_saved_est: evaluation.co2e_saved_kg,
          waste_avoided_kg: evaluation.waste_avoided_kg,
        })
        .select()
        .single();

      if (itemError || !itemData) {
        console.error("Database insert error:", itemError);
        throw new Error(itemError?.message || "Failed to write record to database.");
      }

      // 3. Save recommendation into recommendations table
      const { error: recError } = await supabase
        .from("recommendations")
        .insert({
          item_id: itemData.id,
          recommended_action: evaluation.recommended_action,
          confidence: evaluation.confidence,
          rationale: evaluation.rationale,
          alt_action_1: evaluation.alt_action_1,
          alt_action_2: evaluation.alt_action_2,
        });

      if (recError) {
        console.warn("Recommendation insert notice:", recError.message);
      }

      setStep("success");

      // 4. Redirect immediately to the results page
      router.push(`/analyze/${itemData.id}/results`);
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
    stopCamera();
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedPublicUrl(null);
    setErrorMessage(null);
    setInfoMessage(null);
    setNotElectronicError(null);
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

  const handleUseSampleItem = (
    sampleType: "laptop" | "phone" | "tv" | "phone_repair" | "tv_donate" | "laptop_reuse" = "laptop"
  ) => {
    stopCamera();
    setErrorMessage(null);
    setNotElectronicError(null);
    setIsManualFallback(false);
    setAiProvider("sample-template");

    if (sampleType === "phone") {
      setInfoMessage("Demo dataset item loaded: Samsung Galaxy Smartphone (Resell pathway). Verify specifications below.");
      setFormData({
        item_type: "smartphone",
        brand: "Samsung Galaxy",
        estimated_age_years: "2.0",
        condition: "functional",
        condition_notes: "Demo dataset: functional phone with intact screen and good battery health. Optimal for direct resale.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    } else if (sampleType === "phone_repair") {
      setInfoMessage("Demo dataset item loaded: Samsung Galaxy Smartphone (Repair pathway). Verify specifications below.");
      setFormData({
        item_type: "smartphone",
        brand: "Samsung Galaxy",
        estimated_age_years: "2.0",
        condition: "partially_working",
        condition_notes: "Demo dataset: broken charging port and worn battery. Highly viable for local authorized repair.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    } else if (sampleType === "laptop_reuse") {
      setInfoMessage("Demo dataset item loaded: Sony VAIO Laptop (Reuse pathway). Verify specifications below.");
      setFormData({
        item_type: "laptop",
        brand: "Sony",
        estimated_age_years: "6.0",
        condition: "functional",
        condition_notes: "Demo dataset: older functional laptop suitable for community reuse, basic web browsing, or digital literacy centers.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    } else if (sampleType === "tv_donate") {
      setInfoMessage("Demo dataset item loaded: Sony Trinitron CRT TV (Donate pathway). Verify specifications below.");
      setFormData({
        item_type: "crt_tv",
        brand: "Sony Trinitron",
        estimated_age_years: "10.0",
        condition: "functional",
        condition_notes: "Demo dataset: working CRT television in good condition, suitable for community donation or institutional reuse.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    } else if (sampleType === "tv") {
      setInfoMessage("Demo dataset item loaded: Sony Trinitron CRT Television (Recycle pathway). Verify specifications below.");
      setFormData({
        item_type: "crt_tv",
        brand: "Sony Trinitron",
        estimated_age_years: "18.0",
        condition: "severely_damaged",
        condition_notes: "Demo dataset: heavy vintage display with damaged circuitry, glass envelope intact, high material recycling yield.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    } else {
      setInfoMessage("Demo dataset item loaded: Lenovo ThinkPad Laptop (Refurbish pathway). Verify specifications below.");
      setFormData({
        item_type: "laptop",
        brand: "Lenovo ThinkPad",
        estimated_age_years: "3.5",
        condition: "cosmetic_damage",
        condition_notes: "Demo dataset: minor scuffs on outer casing and hinge wear. Display, keyboard, and motherboard fully operational for refurbishing.",
        material_recoverable: true,
      });
      const sampleImg = "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80";
      setPreviewUrl(sampleImg);
      setUploadedPublicUrl(sampleImg);
      setBase64Url(sampleImg);
    }

    setStep("review");
  };

  // Current calculated impact for live preview
  const liveImpact = evaluateItem({
    item_type: formData.item_type || "item",
    brand: formData.brand || null,
    condition: formData.condition,
    estimated_age_years: formData.estimated_age_years ? parseFloat(formData.estimated_age_years) : 2,
    material_recoverable: formData.material_recoverable,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 4-Step Process Rail */}
      <ProcessRail active={step === "upload" || step === "analyzing" ? 1 : step === "review" || step === "saving" ? 2 : 3} />

      {/* Hidden file inputs: standard browser picker & direct mobile camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Header */}
      <div className="border-b border-[#d8ddd7] pb-4 space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#2e7d57]">
          {step === "upload" || step === "analyzing" ? "Step 01 / Image Intake" : "Step 02 / Human Verification"}
        </span>
        <h1 className="text-2xl font-bold font-display text-[#151817]">
          {step === "upload" || step === "analyzing"
            ? "What should you do with this next?"
            : "Does this look right? Verify facts."}
        </h1>
        <p className="text-xs text-[#6b746e]">
          {step === "upload" || step === "analyzing"
            ? "Capture a live photo, upload an image, or try a sample item to assess its circular lifecycle."
            : "The AI provides a starting point. Your confirmed specifications drive the deterministic decision engine."}
        </p>
      </div>

      {/* Non-Electronic Item Rejection Alert Banner */}
      {notElectronicError && (
        <div className="rounded-sm border-2 border-[#a3512b] bg-[#FDF2EC] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-[#a3512b] text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#a3512b]">
                  Scope Policy Gate
                </span>
                <span className="rounded-sm bg-[#a3512b]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#a3512b]">
                  Non-Electronic Item Detected
                </span>
              </div>
              <h3 className="font-display text-sm font-semibold text-[#151817]">
                Electronics-Only Assessment Gate
              </h3>
              <p className="text-xs text-[#6b746e] leading-relaxed">
                {notElectronicError}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#a3512b]/20">
            <button
              type="button"
              onClick={() => {
                setNotElectronicError(null);
                setSelectedFile(null);
                setPreviewUrl(null);
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#151817] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2E312D]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Upload Electronic Photo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNotElectronicError(null);
                setSelectedFile(null);
                setPreviewUrl(null);
                startCamera();
              }}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span>Retake via Camera</span>
            </button>

            <button
              type="button"
              onClick={() => handleUseSampleItem("laptop")}
              className="inline-flex items-center gap-1.5 text-xs text-[#6b746e] hover:text-[#151817] underline underline-offset-2 sm:ml-auto"
            >
              Or try sample hardware (Laptop) &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="rounded-sm border border-[#a3512b]/40 bg-[#FAECE6] p-4 text-xs text-[#a3512b]">
          <div className="font-semibold mb-0.5">Assessment Error</div>
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Global Info Banner */}
      {infoMessage && (
        <div className="rounded-sm border border-[#d8ddd7] bg-[#e9ede7] p-4 text-xs text-[#151817]">
          <div className="font-semibold mb-0.5">System Notice</div>
          <div>{infoMessage}</div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 01: UPLOAD & CAMERA INTAKE */}
      {/* ========================================================================= */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Live Camera Viewport (getUserMedia) */}
          {isCameraOpen ? (
            <div className="rounded-sm border border-[#d8ddd7] bg-[#151817] p-5 space-y-4 text-center">
              <div className="flex items-center justify-between text-xs text-[#d8ddd7] pb-1 border-b border-[#2E312D]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm bg-[#2e7d57]" />
                  <span className="font-mono text-[11px] text-white">CAMERA FEED ACTIVE</span>
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-[#6b746e] hover:text-white transition-colors text-xs"
                >
                  Close Camera [ESC]
                </button>
              </div>

              <div className="relative mx-auto max-w-md overflow-hidden rounded-sm border border-[#454843] bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-4 rounded-sm border border-dashed border-white/30 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-white/90 bg-black/70 px-2 py-0.5 rounded-sm">
                    Center hardware in frame
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-2 rounded-sm bg-[#2e7d57] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644]"
                >
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-sm border border-[#454843] bg-[#2E312D] px-4 py-2 text-xs font-medium text-[#d8ddd7] transition-colors hover:bg-[#454843]"
                >
                  Cancel
                </button>
              </div>

              <p className="text-[11px] text-[#6b746e]">
                Or <button type="button" onClick={() => { stopCamera(); cameraInputRef.current?.click(); }} className="text-white underline underline-offset-2">open system file dialog</button> instead.
              </p>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-sm border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-[#2e7d57] bg-[#e6f2e8]"
                  : "border-[#d8ddd7] bg-white hover:border-[#6b746e]"
              }`}
            >
              {previewUrl ? (
                <div className="space-y-4">
                  <div className="mx-auto max-h-64 max-w-sm overflow-hidden rounded-sm border border-[#d8ddd7] bg-[#f4f5f1]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Selected item preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="font-mono text-xs text-[#6b746e]">
                    {selectedFile?.name} (
                    {(selectedFile?.size ? selectedFile.size / 1024 / 1024 : 0).toFixed(2)} MB)
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-medium text-[#151817] hover:bg-[#e9ede7] transition-colors"
                    >
                      Choose Different File
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-medium text-[#151817] hover:bg-[#e9ede7] transition-colors"
                    >
                      Retake Photo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] text-[#151817]">
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

                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-[#151817]">
                      {isCompressing ? "Compressing & optimizing image..." : "Capture or upload item photograph"}
                    </div>
                    <div className="text-xs text-[#6b746e] font-mono">
                      JPG, PNG, or WebP · Auto-compressed to 1024px for rapid scan
                    </div>
                  </div>

                  {/* Triple Action Buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={isStartingCamera}
                      className="inline-flex items-center gap-2 rounded-sm bg-[#2e7d57] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644] disabled:opacity-50"
                    >
                      {isStartingCamera ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-sm border border-white border-t-transparent" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                    >
                      <svg className="h-4 w-4 text-[#6b746e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Browse Files</span>
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      <span className="text-[11px] font-mono text-[#6b746e]">Demo dataset:</span>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("phone")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for direct Resell"
                      >
                        <span>Resell</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("phone_repair")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for Repair"
                      >
                        <span>Repair</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("laptop")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for Refurbish"
                      >
                        <span>Refurbish</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("laptop_reuse")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for Reuse"
                      >
                        <span>Reuse</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("tv_donate")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for Donate"
                      >
                        <span>Donate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseSampleItem("tv")}
                        className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-white px-2 py-1 text-[11px] font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                        title="Demo item for Recycle"
                      >
                        <span>Recycle</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6b746e] pt-1">
                    or drag and drop your file into this box
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-sm border border-[#d8ddd7] bg-white px-4 py-2 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleStartAnalysis}
              className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#246644] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Assess Item Condition &rarr;
            </button>
          </div>

          <div className="rounded-sm border border-[#d8ddd7] bg-[#e9ede7] p-3 text-[11px] text-[#6b746e]">
            <strong className="text-[#151817]">Privacy notice: </strong>
            Uploaded and captured item photos are processed to estimate physical condition and stored in your guest session database. No personal identifying information is collected.
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 02: ANALYZING SPINNER & MULTI-STAGE PROGRESS */}
      {/* ========================================================================= */}
      {step === "analyzing" && (
        <div className="rounded-sm border border-[#d8ddd7] bg-white p-8 text-center space-y-5">
          {previewUrl && (
            <div className="mx-auto h-36 w-36 overflow-hidden rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Resized image" className="h-full w-full object-contain" />
            </div>
          )}

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-sm font-semibold text-[#151817]">
              {analysisStage === "uploading" && "Uploading Compressed Image (max 1024px)..."}
              {analysisStage === "identifying" && "Identifying Device & Specifications..."}
              {analysisStage === "assessing" && "Assessing Physical Condition & Recovery Potential..."}
            </h2>
            <p className="text-xs text-[#6b746e]">
              Vision model running rapid assessment with minimal thinking budget.
            </p>
          </div>

          {/* 3-Step Live Progress Indicator */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono max-w-sm mx-auto">
            <span
              className={`px-2 py-0.5 rounded-sm border ${
                analysisStage === "uploading"
                  ? "border-[#2e7d57] bg-[#edf5f0] font-bold text-[#1e583c]"
                  : "border-[#d8ddd7] bg-[#f4f5f1] text-[#6b746e]"
              }`}
            >
              1. Uploading
            </span>
            <span className="text-[#6b746e]">&rarr;</span>
            <span
              className={`px-2 py-0.5 rounded-sm border ${
                analysisStage === "identifying"
                  ? "border-[#2e7d57] bg-[#edf5f0] font-bold text-[#1e583c]"
                  : "border-[#d8ddd7] bg-[#f4f5f1] text-[#6b746e]"
              }`}
            >
              2. Identifying
            </span>
            <span className="text-[#6b746e]">&rarr;</span>
            <span
              className={`px-2 py-0.5 rounded-sm border ${
                analysisStage === "assessing"
                  ? "border-[#2e7d57] bg-[#edf5f0] font-bold text-[#1e583c]"
                  : "border-[#d8ddd7] bg-[#f4f5f1] text-[#6b746e]"
              }`}
            >
              3. Condition
            </span>
          </div>

          <div className="w-full max-w-xs mx-auto bg-[#e9ede7] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#2e7d57] h-full transition-all duration-500 rounded-full"
              style={{
                width:
                  analysisStage === "uploading"
                    ? "30%"
                    : analysisStage === "identifying"
                    ? "68%"
                    : "94%",
              }}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 02: REVIEW & EDITABLE FORM (MANDATORY HUMAN VERIFICATION) */}
      {/* ========================================================================= */}
      {(step === "review" || step === "saving") && (
        <form onSubmit={handleConfirmAndSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Photo Preview & Detection Badge */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-sm border border-[#d8ddd7] bg-white">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Analyzed item"
                    className="h-48 w-full object-contain bg-[#f4f5f1]"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-[#6b746e]">
                    No image preview
                  </div>
                )}
              </div>

              <div className="rounded-sm border border-[#d8ddd7] bg-white p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#6b746e]">
                  <span>Model Source</span>
                  <span className="font-mono text-[11px] font-semibold text-[#151817]">
                    {isManualFallback ? "Manual Entry" : aiProvider || "Vision Model"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#6b746e]">
                  <span>Storage Target</span>
                  <span className="font-mono text-[11px] text-[#151817]">
                    item-photos
                  </span>
                </div>
              </div>

              {/* Dynamic Impact Estimation Preview */}
              <div className="rounded-sm border border-[#d8ddd7] bg-white p-3 space-y-2 text-xs">
                <div className="font-semibold text-[#151817]">Projected Metrics Preview</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                  <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-2">
                    <span className="text-[#6b746e] block text-[10px]">CO2e Avoided</span>
                    <div className="font-bold text-[#151817]">
                      {liveImpact.co2e_saved_kg} kg
                    </div>
                  </div>
                  <div className="rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] p-2">
                    <span className="text-[#6b746e] block text-[10px]">Landfill Avoided</span>
                    <div className="font-bold text-[#151817]">
                      {liveImpact.waste_avoided_kg} kg
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Editable Form Fields */}
            <div className="md:col-span-2 rounded-sm border border-[#d8ddd7] bg-white p-5 space-y-4">
              <div className="border-b border-[#f4f5f1] pb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[#151817]">
                    Human Verification &amp; Calibration
                  </h2>
                  <p className="text-xs text-[#6b746e]">
                    Confirm or correct the vision model extractions before committing to database.
                  </p>
                </div>
                {aiProvider && aiProvider !== "sample-template" && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[#bcdbc8] bg-[#edf5f0] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#1e583c]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d57]" />
                    Analyzed by {aiProvider}{aiModel ? ` (${aiModel})` : ""}{isCachedResult ? ", cached result" : ""} · {confidenceLevel.toUpperCase()}
                  </span>
                )}
                {aiProvider === "sample-template" && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[#d8ddd7] bg-[#f4f5f1] px-2.5 py-1 font-mono text-[11px] font-medium text-[#6b746e]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6b746e]" />
                    Demo dataset template (Manual verification)
                  </span>
                )}
                {isManualFallback && (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[#f3d2bb] bg-[#fcf5ed] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#964215]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#964215]" />
                    AI analysis unavailable, using guided manual entry
                  </span>
                )}
              </div>

              {/* Low Confidence Notice */}
              {isLowConfidence && (
                <div className="rounded-sm border border-[#a3512b] bg-[#fff2ed] p-3 text-xs text-[#a3512b] flex items-start gap-2.5">
                  <span className="font-mono font-bold flex-shrink-0 text-xs bg-[#a3512b] text-white px-1.5 py-0.5 rounded-[2px]">[!]</span>
                  <div className="space-y-0.5">
                    <strong className="font-semibold block text-[#151817]">
                      AI confidence: low. Please verify
                    </strong>
                    <p className="text-[11.5px] text-[#6b746e] leading-relaxed">
                      The vision model extracted a preliminary best guess ({formData.item_type || "unlisted electronic"}). Please confirm or select the closest matching category from the dropdown below.
                    </p>
                  </div>
                </div>
              )}

              {/* Item Type: Predefined Dropdown + Free-Text refinement */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#151817]">
                    Item Category / Type <span className="text-[#a3512b]">*</span>
                  </label>
                  <span className="text-[10px] text-[#6b746e]">Select category baseline or type custom</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <select
                      value={
                        ITEM_TYPE_PRESETS.find(
                          (p) =>
                            p.label.toLowerCase() === formData.item_type.toLowerCase() ||
                            p.categoryKey.toLowerCase() === formData.item_type.toLowerCase() ||
                            formData.item_type.toLowerCase().includes(p.categoryKey.toLowerCase())
                        )?.label || "custom"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          // Keep existing custom text
                        } else {
                          const preset = ITEM_TYPE_PRESETS.find((p) => p.label === val);
                          setFormData({
                            ...formData,
                            item_type: val,
                            estimated_age_years:
                              !formData.estimated_age_years && preset
                                ? String(preset.defaultAgeYears)
                                : formData.estimated_age_years,
                          });
                        }
                      }}
                      className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                    >
                      <optgroup label="Standard Categories">
                        {ITEM_TYPE_PRESETS.map((preset) => (
                          <option key={preset.categoryKey} value={preset.label}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Custom Option">
                        <option value="custom">Other, please specify (Free-text)...</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Item description / model (e.g. Sony CRT TV, VCR Player)"
                      value={formData.item_type}
                      onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                      className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10.5px] text-[#6b746e]">
                  Category baselines drive the deterministic PP-RI score, cradle-to-gate CO2e, and circular recovery matrix.
                </p>
              </div>

              {/* Brand & Estimated Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#151817]">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sony, Panasonic, BPL, Onida, Philips"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#151817]">
                    Estimated Age (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    placeholder="e.g. 15"
                    value={formData.estimated_age_years}
                    onChange={(e) =>
                      setFormData({ ...formData, estimated_age_years: e.target.value })
                    }
                    className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs font-mono text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
                  />
                </div>
              </div>

              {/* Condition Select */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#151817]">
                  Physical &amp; Operating Condition
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({ ...formData, condition: e.target.value as AssessmentCondition })
                  }
                  className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs text-[#151817] focus:border-[#2e7d57] focus:outline-none"
                >
                  <option value="functional">Functional (powers on, minimal cosmetic wear)</option>
                  <option value="cosmetic_damage">Cosmetic Damage (scratches, dents, fully working)</option>
                  <option value="partially_working">Partially Working (cracked screen, faulty port/battery)</option>
                  <option value="severely_damaged">Severely Damaged (dead motherboard, heavy structural fracture)</option>
                </select>
              </div>

              {/* Condition Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#151817]">
                  Specific Inspection Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Minor scratches near charging port, screen glass intact, powers on normally."
                  value={formData.condition_notes}
                  onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
                  className="w-full rounded-sm border border-[#d8ddd7] bg-white px-3 py-1.5 text-xs text-[#151817] placeholder-[#6b746e] focus:border-[#2e7d57] focus:outline-none"
                />
              </div>

              {/* Material Recoverable Checkbox */}
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="material_recoverable"
                  checked={formData.material_recoverable}
                  onChange={(e) =>
                    setFormData({ ...formData, material_recoverable: e.target.checked })
                  }
                  className="mt-0.5 rounded-sm border-[#d8ddd7] text-[#2e7d57] focus:ring-[#2e7d57]"
                />
                <label htmlFor="material_recoverable" className="text-xs text-[#151817] cursor-pointer">
                  Material is recoverable for recycling or certified parts harvesting
                </label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#f4f5f1]">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-sm border border-[#d8ddd7] bg-white px-3.5 py-1.5 text-xs font-medium text-[#151817] transition-colors hover:bg-[#e9ede7]"
                >
                  &larr; Retake / New Photo
                </button>

                <button
                  type="submit"
                  disabled={step === "saving"}
                  className="inline-flex items-center justify-center rounded-sm bg-[#2e7d57] px-5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#246644] disabled:opacity-50"
                >
                  {step === "saving" ? "Saving Item..." : "Confirm & Save Item →"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
