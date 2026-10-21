export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel function timeout config

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limiter";
import type { Json } from "@/types/database";

const SYSTEM_PROMPT = `You are a circular economy assessor for RE:LOOP.
Classify physical electronic devices vs non-electronics.
If NOT electronic (clothing, furniture, humans, food, etc), return:
{"is_electronic":false,"rejection_reason":"non-electronic object detected"}
If electronic, return:
{"is_electronic":true,"item_type":"...","brand":"...","estimated_age_years":number,"condition":"functional"|"cosmetic_damage"|"partially_working"|"severely_damaged","condition_notes":"...","material_recoverable":true,"confidence":"high"|"medium"|"low"}
Raw JSON only.`;

export interface AssessmentResult {
  is_electronic: boolean;
  rejection_reason?: string;
  item_type: string;
  brand: string | null;
  estimated_age_years: number | null;
  condition: "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged";
  condition_notes: string;
  material_recoverable: boolean;
  confidence: "high" | "medium" | "low";
  is_low_confidence: boolean;
}

// In-memory process cache keyed by image SHA-256 for sub-millisecond edge lookups
const inMemoryCache = new Map<string, { result: AssessmentResult; provider: string; model: string }>();

const RequestSchema = z.object({
  imageBase64: z.string().min(10, "Image base64 data is required"),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  imageUrl: z.string().optional().nullable(),
  imageHash: z.string().optional().nullable(),
});

function extractJSON(text: string): AssessmentResult | null {
  if (!text) return null;

  const sanitizeParsed = (parsed: Record<string, unknown>): AssessmentResult => {
    const isElectronic = parsed.is_electronic !== false;
    const rejectionReason = typeof parsed.rejection_reason === "string" ? parsed.rejection_reason : undefined;

    if (!isElectronic) {
      return {
        is_electronic: false,
        rejection_reason: rejectionReason,
        item_type: "Non-Electronic Item",
        brand: null,
        estimated_age_years: null,
        condition: "functional",
        condition_notes: rejectionReason || "Non-electronic item detected.",
        material_recoverable: false,
        confidence: "high",
        is_low_confidence: false,
      };
    }

    const rawType = typeof parsed.item_type === "string" && parsed.item_type.trim()
      ? parsed.item_type.trim().slice(0, 80)
      : "Other Electronics / Unlisted";
    const rawBrand = typeof parsed.brand === "string" && parsed.brand.trim()
      ? parsed.brand.trim().slice(0, 80)
      : null;
    const rawAge = typeof parsed.estimated_age_years === "number" && Number.isFinite(parsed.estimated_age_years)
      ? Math.max(0, Math.min(50, parsed.estimated_age_years))
      : null;
    const rawCondition = [
      "functional",
      "cosmetic_damage",
      "partially_working",
      "severely_damaged",
    ].includes(String(parsed.condition))
      ? (parsed.condition as AssessmentResult["condition"])
      : "functional";
    const rawNotes = typeof parsed.condition_notes === "string" && parsed.condition_notes.trim()
      ? parsed.condition_notes.trim().slice(0, 500)
      : "Condition assessed via vision model.";
    const rawRecoverable =
      typeof parsed.material_recoverable === "boolean" ? parsed.material_recoverable : true;
    const rawConf = ["high", "medium", "low"].includes(String(parsed.confidence))
      ? (parsed.confidence as "high" | "medium" | "low")
      : "medium";

    const isLowConfidence = rawConf === "low" || rawType === "Other Electronics / Unlisted" || rawType.toLowerCase().includes("unknown");

    return {
      is_electronic: true,
      item_type: rawType,
      brand: rawBrand,
      estimated_age_years: rawAge,
      condition: rawCondition,
      condition_notes: rawNotes,
      material_recoverable: rawRecoverable,
      confidence: rawConf,
      is_low_confidence: isLowConfidence,
    };
  };

  try {
    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return sanitizeParsed(parsed);
    }
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed === "object") {
          return sanitizeParsed(parsed);
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * 1. Google Gemini Vision API Call with Thinking Controls & 12s Timeout
 */
async function callGeminiVision(
  base64Data: string,
  mediaType: string,
  modelOverride?: string | null
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "GEMINI_API_KEY not configured or placeholder." };
  }

  // Model selection: primary defaults to gemini-3.5-flash-lite (fastest) with gemini-3.6-flash fallback
  const primaryModel = modelOverride || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  const errors: string[] = [];

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second provider timeout

    try {
      const generationConfig: Record<string, unknown> = {
        responseMimeType: "application/json",
        temperature: 0.1,
      };

      // Set thinking to minimum for rapid classification
      if (model.includes("gemini-3") || model.includes("gemini-2.5")) {
        generationConfig.thinkingConfig = {
          thinkingLevel: "MINIMAL",
          includeThoughts: false,
        };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: SYSTEM_PROMPT },
                  {
                    inlineData: {
                      mimeType: mediaType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig,
          }),
        }
      ).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errText = await res.text();
        const msg = `Gemini (${model}) ${res.status}: ${errText.slice(0, 180)}`;
        errors.push(msg);
        console.warn(msg);
        continue;
      }

      const data = await res.json();
      const text =
        data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join("") ||
        data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text, model };
      }
      errors.push(`Gemini (${model}): empty candidate response`);
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const msg = isAbort
        ? `Gemini (${model}) timed out after 12s`
        : `Gemini (${model}) network exception: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.warn(msg);
    }
  }

  return { error: errors.join(" | ") || "All Gemini endpoints failed." };
}

/**
 * 2. Anthropic Vision API Call with 12s Timeout
 */
async function callAnthropicVision(
  base64Data: string,
  mediaType: string
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "ANTHROPIC_API_KEY not configured or placeholder." };
  }

  const primaryModel = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const fallbackModel = "claude-sonnet-5-5";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  const errors: string[] = [];

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 600,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: SYSTEM_PROMPT,
                },
              ],
            },
          ],
        }),
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errText = await res.text();
        const msg = `Anthropic (${model}) ${res.status}: ${errText.slice(0, 180)}`;
        errors.push(msg);
        console.warn(msg);
        continue;
      }

      const data = await res.json();
      const text = data.content?.find(
        (c: { type: string; text?: string }) => c.type === "text"
      )?.text;
      if (text) {
        return { text, model };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const msg = isAbort
        ? `Anthropic (${model}) timed out after 12s`
        : `Anthropic (${model}) error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.warn(msg);
    }
  }

  return { error: errors.join(" | ") || "All Anthropic endpoints failed." };
}

/**
 * 3. OpenAI Vision API Call with 12s Timeout
 */
async function callOpenAIVision(
  base64Data: string,
  mediaType: string
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "OPENAI_API_KEY not configured or placeholder." };
  }

  const imageUrl = `data:${mediaType};base64,${base64Data}`;
  const primaryModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const fallbackModel = "gpt-4o";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  const errors: string[] = [];

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Classify item." },
                { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
              ],
            },
          ],
        }),
      }).finally(() => clearTimeout(timeoutId));

      if (!res.ok) {
        const errText = await res.text();
        const msg = `OpenAI (${model}) ${res.status}: ${errText.slice(0, 180)}`;
        errors.push(msg);
        console.warn(msg);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { text: content, model };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const msg = isAbort
        ? `OpenAI (${model}) timed out after 12s`
        : `OpenAI (${model}) error: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.warn(msg);
    }
  }

  return { error: errors.join(" | ") || "All OpenAI endpoints failed." };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. IP Rate Limiting (10 scans per 60 seconds per IP)
    const rateCheck = checkRateLimit(req, 10, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Maximum 10 scans per minute per IP.",
          retry_after_secs: rateCheck.resetInSecs,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.resetInSecs) },
        }
      );
    }

    // 2. Body Read & Size Check (Max 5 MB payload)
    const rawText = await req.text();
    if (rawText.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Payload exceeds 5MB size limit. Please compress image before upload." },
        { status: 413 }
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
    }

    // 3. Schema Validation & MIME Check
    const validation = RequestSchema.safeParse(parsedBody);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload or unsupported media type.",
          details: validation.error.format(),
        },
        { status: 400 }
      );
    }

    const { imageBase64, mediaType } = validation.data;
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

    if (!cleanBase64 || cleanBase64.length < 50) {
      return NextResponse.json({ error: "Invalid or empty image base64 data." }, { status: 400 });
    }

    // 4. Compute Image SHA-256 for result caching
    const imageHash =
      validation.data.imageHash ||
      crypto.createHash("sha256").update(Buffer.from(cleanBase64, "base64")).digest("hex");

    // 5. Result Caching: Check in-memory cache first
    const memCache = inMemoryCache.get(imageHash);
    if (memCache) {
      return NextResponse.json({
        success: true,
        cached: true,
        provider: memCache.provider,
        model: memCache.model,
        latency_ms: Date.now() - startTime,
        data: memCache.result,
        provider_attempts: [{ provider: memCache.provider, model: memCache.model, status: "success", cached: true }],
      });
    }

    // Check persistent Supabase cache (event_log)
    try {
      const { data: dbCache } = await supabase
        .from("event_log")
        .select("payload_json")
        .eq("event_type", "AI_SCAN_CACHE")
        .contains("payload_json", { image_hash: imageHash })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbCache?.payload_json && typeof dbCache.payload_json === "object" && "result" in dbCache.payload_json) {
        const cachedPayload = dbCache.payload_json as Record<string, unknown>;
        const cachedResult = cachedPayload.result as AssessmentResult;
        const cachedProvider = typeof cachedPayload.provider === "string" ? cachedPayload.provider : "gemini";
        const cachedModel = typeof cachedPayload.model === "string" ? cachedPayload.model : "cached";

        // Seed into memory cache
        inMemoryCache.set(imageHash, {
          result: cachedResult,
          provider: cachedProvider,
          model: cachedModel,
        });

        return NextResponse.json({
          success: true,
          cached: true,
          provider: cachedProvider,
          model: cachedModel,
          latency_ms: Date.now() - startTime,
          data: cachedResult,
          provider_attempts: [
            { provider: cachedProvider, model: cachedModel, status: "success", cached: true },
          ],
        });
      }
    } catch (cacheErr) {
      console.warn("[AI Cache] Supabase lookup notice:", cacheErr);
    }

    // 6. Provider Pipeline Execution
    const modelOverride = req.headers.get("x-model-override");
    const providerAttempts: Array<{ provider: string; model?: string; status: "success" | "error"; error?: string }> = [];
    let successResult: { text: string; provider: string; model: string } | null = null;

    // 1. Gemini Vision
    const geminiRes = await callGeminiVision(cleanBase64, mediaType, modelOverride);
    if ("text" in geminiRes) {
      providerAttempts.push({ provider: "gemini", model: geminiRes.model, status: "success" });
      successResult = { text: geminiRes.text, provider: "gemini", model: geminiRes.model };
    } else {
      providerAttempts.push({ provider: "gemini", status: "error", error: geminiRes.error });
    }

    // 2. Anthropic Vision Fallback
    if (!successResult) {
      const anthropicRes = await callAnthropicVision(cleanBase64, mediaType);
      if ("text" in anthropicRes) {
        providerAttempts.push({ provider: "anthropic", model: anthropicRes.model, status: "success" });
        successResult = { text: anthropicRes.text, provider: "anthropic", model: anthropicRes.model };
      } else {
        providerAttempts.push({ provider: "anthropic", status: "error", error: anthropicRes.error });
      }
    }

    // 3. OpenAI Vision Fallback
    if (!successResult) {
      const openAiRes = await callOpenAIVision(cleanBase64, mediaType);
      if ("text" in openAiRes) {
        providerAttempts.push({ provider: "openai", model: openAiRes.model, status: "success" });
        successResult = { text: openAiRes.text, provider: "openai", model: openAiRes.model };
      } else {
        providerAttempts.push({ provider: "openai", status: "error", error: openAiRes.error });
      }
    }

    const latencyMs = Date.now() - startTime;

    // 7. Parse and Validate Output
    if (successResult) {
      const parsed = extractJSON(successResult.text);
      if (parsed) {
        if (!parsed.is_electronic) {
          return NextResponse.json({
            success: false,
            not_electronic: true,
            provider: successResult.provider,
            model: successResult.model,
            latency_ms: latencyMs,
            message:
              "RE:LOOP currently only assesses electronic items. This photo doesn't appear to show an electronic device - please upload a photo of an electronic item instead.",
            detected_object: parsed.rejection_reason || "Non-electronic item",
            provider_attempts: providerAttempts,
          });
        }

        // Cache genuine AI assessment result into in-memory cache and Supabase event_log
        inMemoryCache.set(imageHash, {
          result: parsed,
          provider: successResult.provider,
          model: successResult.model,
        });

        try {
          await supabase
            .from("event_log")
            .insert({
              event_type: "AI_SCAN_CACHE",
              entity_type: "scan",
              entity_id: "00000000-0000-0000-0000-000000000000",
              actor_role: "SYSTEM",
              payload_json: {
                image_hash: imageHash,
                provider: successResult.provider,
                model: successResult.model,
                result: parsed,
                timestamp: new Date().toISOString(),
              } as unknown as Json,
            });
        } catch (dbErr) {
          console.warn("[AI Cache] Persistence notice:", dbErr);
        }

        return NextResponse.json({
          success: true,
          cached: false,
          provider: successResult.provider,
          model: successResult.model,
          latency_ms: latencyMs,
          manual_fallback: false,
          data: parsed,
          provider_attempts: providerAttempts,
        });
      }
    }

    // 8. Explicit fallback if all providers failed
    return NextResponse.json({
      success: true,
      provider: "manual_fallback",
      model: "none",
      latency_ms: latencyMs,
      manual_fallback: true,
      message: "AI analysis unavailable, using guided manual entry",
      provider_attempts: providerAttempts,
      data: {
        item_type: "Other Electronics / Unlisted",
        brand: null,
        estimated_age_years: null,
        condition: "functional",
        condition_notes: "AI analysis unavailable, using guided manual entry",
        material_recoverable: true,
        confidence: "low",
        is_low_confidence: true,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        manual_fallback: true,
        provider: "manual_fallback",
        model: "none",
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : "Internal assessment error",
        message: "AI analysis unavailable, using guided manual entry",
        data: {
          item_type: "Other Electronics / Unlisted",
          brand: null,
          estimated_age_years: null,
          condition: "functional",
          condition_notes: "AI analysis unavailable, using guided manual entry",
          material_recoverable: true,
          confidence: "low",
          is_low_confidence: true,
        },
      },
      { status: 200 }
    );
  }
}
