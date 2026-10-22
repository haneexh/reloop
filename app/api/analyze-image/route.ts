export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel function timeout config

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getOperatorSession } from "@/lib/operator-auth";
import type { Json } from "@/types/database";

const SYSTEM_PROMPT = `You are a precision circular economy hardware assessor for RE:LOOP.
Classify physical objects from photos into exact electronic hardware devices vs non-electronics.

If the photo does NOT show an electronic item (e.g. clothing, shirt, textile, furniture, human, food, pet, plant, book, plain paper, plastic bottle):
return:
{"is_electronic":false,"rejection_reason":"non-electronic object detected"}

If the photo shows an electronic item:
Classify it into a SPECIFIC hardware category (e.g. "Smartphone", "Laptop", "Tablet", "Desktop Computer", "Computer Monitor", "Television", "Printer / Scanner", "Audio Speaker / Headphones", "Smartwatch / Wearable", "Gaming Console", "Power Bank / Charger", "Networking Router / Modem", "Microwave / Kitchen Appliance", "Air Conditioner / Fan", "Power Tool").
Do NOT use vague or generic labels like "device", "electronics", or "Other Electronics / Unlisted" when an identifiable consumer or enterprise device is shown.

Return JSON in this exact structure:
{
  "is_electronic": true,
  "item_type": "Specific Hardware Category",
  "brand": "Manufacturer brand name or null if unbranded/unidentified",
  "estimated_age_years": number (e.g. 1 to 15),
  "condition": "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged",
  "condition_notes": "Concise physical condition assessment based on visible wear, screen status, casing integrity",
  "material_recoverable": true,
  "confidence": "high" | "medium" | "low"
}

Raw JSON only. No markdown formatting, no explanations outside JSON.`;

import {
  type AssessmentResult,
  getMemoryCache,
  setMemoryCache,
  isHighQualityAssessment,
  extractJSON,
} from "@/lib/ai-scan-cache";

const RequestSchema = z.object({
  imageBase64: z.string().min(10, "Image base64 data is required"),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  imageUrl: z.string().optional().nullable(),
  imageHash: z.string().optional().nullable(),
});

/**
 * 1. Google Gemini Single Model Vision Call with Model-Specific Thinking Settings
 */
async function callSingleGeminiModel(
  model: string,
  base64Data: string,
  mediaType: string,
  apiKey: string
): Promise<{ text: string; model: string } | { error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second provider timeout

  try {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      temperature: 0.1,
    };

    // Configure model-specific thinking controls per Google official documentation:
    // gemini-3.5-flash-lite supports minimal thinking for ultra-fast throughput.
    // gemini-3.6-flash and 3.5-flash use "LOW" thinking level to maintain deep
    // classification accuracy without output truncation or falling back to generic classes.
    if (model === "gemini-3.5-flash-lite") {
      generationConfig.thinkingConfig = {
        thinkingLevel: "MINIMAL",
        includeThoughts: false,
      };
    } else if (model.includes("gemini-3.6") || model.includes("gemini-3.5-flash")) {
      generationConfig.thinkingConfig = {
        thinkingLevel: "LOW",
        includeThoughts: false,
      };
    } else if (model.includes("gemini-3") || model.includes("gemini-4")) {
      generationConfig.thinkingConfig = {
        thinkingLevel: "LOW",
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
      return { error: `Gemini (${model}) ${res.status}: ${errText.slice(0, 180)}` };
    }

    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join("") ||
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      return { text, model };
    }
    return { error: `Gemini (${model}): empty candidate response` };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      error: isAbort
        ? `Gemini (${model}) timed out after 12s`
        : `Gemini (${model}) network exception: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 2. Anthropic Single Model Vision API Call with 12s Timeout
 */
async function callSingleAnthropicModel(
  model: string,
  base64Data: string,
  mediaType: string,
  apiKey: string
): Promise<{ text: string; model: string } | { error: string }> {
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
      return { error: `Anthropic (${model}) ${res.status}: ${errText.slice(0, 180)}` };
    }

    const data = await res.json();
    const text = data.content?.find(
      (c: { type: string; text?: string }) => c.type === "text"
    )?.text;

    if (text) {
      return { text, model };
    }
    return { error: `Anthropic (${model}): empty content` };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      error: isAbort
        ? `Anthropic (${model}) timed out after 12s`
        : `Anthropic (${model}) error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 3. OpenAI Single Model Vision API Call with 12s Timeout
 */
async function callSingleOpenAIModel(
  model: string,
  base64Data: string,
  mediaType: string,
  apiKey: string
): Promise<{ text: string; model: string } | { error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  const imageUrl = `data:${mediaType};base64,${base64Data}`;

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
      return { error: `OpenAI (${model}) ${res.status}: ${errText.slice(0, 180)}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return { text: content, model };
    }
    return { error: `OpenAI (${model}): empty choices` };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      error: isAbort
        ? `OpenAI (${model}) timed out after 12s`
        : `OpenAI (${model}) error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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

    // 5. Result Caching & Operator Diagnostic Test Hooks
    // Test hooks are strictly disabled in production unless an authenticated operator session is present
    const operatorSession = getOperatorSession(req);
    const isOperator = operatorSession !== null;
    const bypassCache = isOperator && req.headers.get("x-bypass-cache") === "true";
    const forceFailPrimary =
      isOperator &&
      (req.headers.get("x-force-fail-primary") === "true" ||
        req.headers.get("x-simulate-failure") === "primary");
    const forceFailAll =
      isOperator &&
      (req.headers.get("x-force-fail-all") === "true" ||
        req.headers.get("x-simulate-failure") === "all");
    const forceFailModelsRaw = isOperator ? (req.headers.get("x-force-fail-models") || "") : "";
    const forceFailModels = forceFailModelsRaw
      ? forceFailModelsRaw.split(",").map((s) => s.trim().toLowerCase())
      : [];

    if (!bypassCache) {
      // Check in-memory cache first
      const memCache = getMemoryCache(imageHash);
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

      // Check dedicated ai_scan_cache table in Supabase
      try {
        const { data: dbCache } = await supabase
          .from("ai_scan_cache")
          .select("image_sha256, provider, model, result, hit_count")
          .eq("image_sha256", imageHash)
          .maybeSingle();

        if (dbCache && dbCache.result && typeof dbCache.result === "object") {
          const cachedPayload = dbCache.result as Record<string, unknown>;
          const cachedResult = cachedPayload as unknown as AssessmentResult;
          const cachedProvider = typeof dbCache.provider === "string" ? dbCache.provider : "gemini";
          const cachedModel = typeof dbCache.model === "string" ? dbCache.model : "cached";

          // Increment hit_count asynchronously
          supabase
            .from("ai_scan_cache")
            .update({ hit_count: (dbCache.hit_count || 1) + 1 })
            .eq("image_sha256", imageHash)
            .then();

          // Seed into memory cache
          setMemoryCache(imageHash, {
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
        console.warn("[AI Cache] ai_scan_cache lookup notice:", cacheErr);
      }
    }

    // 6. Provider Pipeline Execution with Strict Quality Gate
    const modelOverride = req.headers.get("x-model-override");
    const providerOverride = req.headers.get("x-provider-override");

    const providerAttempts: Array<{
      provider: string;
      model?: string;
      status: "success" | "error";
      error?: string;
      item_type?: string;
    }> = [];

    let acceptedResult: {
      parsed: AssessmentResult;
      provider: string;
      model: string;
    } | null = null;

    // Define provider candidate sequence:
    // 1. Primary Gemini model (defaults to gemini-3.5-flash-lite)
    // 2. Secondary Gemini fallback model (defaults to gemini-3.6-flash, LOW thinking)
    // 3. Tertiary Gemini fallback model (defaults to gemini-3.5-flash, LOW thinking)
    // 4. Anthropic Claude (claude-haiku-5-5 / claude-sonnet-5-5)
    // 5. OpenAI (gpt-4o-mini / gpt-4o)

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    interface CandidateProvider {
      provider: "gemini" | "anthropic" | "openai";
      model: string;
      execute: () => Promise<{ text: string; model: string } | { error: string }>;
    }

    const candidates: CandidateProvider[] = [];

    if (modelOverride) {
      // Direct model override (e.g. for benchmark testing)
      if (modelOverride.includes("claude") && anthropicKey && anthropicKey !== "[SENSITIVE]") {
        candidates.push({
          provider: "anthropic",
          model: modelOverride,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailModels.includes(modelOverride.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${modelOverride}) forced to fail` });
            return callSingleAnthropicModel(modelOverride, cleanBase64, mediaType, anthropicKey);
          },
        });
      } else if (modelOverride.includes("gpt") && openAiKey && openAiKey !== "[SENSITIVE]") {
        candidates.push({
          provider: "openai",
          model: modelOverride,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailModels.includes(modelOverride.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${modelOverride}) forced to fail` });
            return callSingleOpenAIModel(modelOverride, cleanBase64, mediaType, openAiKey);
          },
        });
      } else if (geminiKey && geminiKey !== "[SENSITIVE]") {
        candidates.push({
          provider: "gemini",
          model: modelOverride,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailModels.includes(modelOverride.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${modelOverride}) forced to fail` });
            return callSingleGeminiModel(modelOverride, cleanBase64, mediaType, geminiKey);
          },
        });
      }
    } else {
      // Normal multi-provider fallback order
      if ((!providerOverride || providerOverride === "gemini") && geminiKey && geminiKey !== "[SENSITIVE]") {
        const primaryGemini = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
        const fallbackGemini = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
        const tertiaryGemini = process.env.GEMINI_TERTIARY_MODEL || "gemini-3.5-flash";

        candidates.push({
          provider: "gemini",
          model: primaryGemini,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailPrimary) return Promise.resolve({ error: `[Simulated Failure] Primary model (${primaryGemini}) forced to fail via test hook` });
            if (forceFailModels.includes(primaryGemini.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${primaryGemini}) forced to fail via test hook` });
            return callSingleGeminiModel(primaryGemini, cleanBase64, mediaType, geminiKey);
          },
        });

        if (fallbackGemini !== primaryGemini) {
          candidates.push({
            provider: "gemini",
            model: fallbackGemini,
            execute: () => {
              if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
              if (forceFailModels.includes(fallbackGemini.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${fallbackGemini}) forced to fail via test hook` });
              return callSingleGeminiModel(fallbackGemini, cleanBase64, mediaType, geminiKey);
            },
          });
        }

        if (tertiaryGemini !== primaryGemini && tertiaryGemini !== fallbackGemini) {
          candidates.push({
            provider: "gemini",
            model: tertiaryGemini,
            execute: () => {
              if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
              if (forceFailModels.includes(tertiaryGemini.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${tertiaryGemini}) forced to fail via test hook` });
              return callSingleGeminiModel(tertiaryGemini, cleanBase64, mediaType, geminiKey);
            },
          });
        }
      }

      if ((!providerOverride || providerOverride === "anthropic") && anthropicKey && anthropicKey !== "[SENSITIVE]") {
        const primaryAnthropic = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
        candidates.push({
          provider: "anthropic",
          model: primaryAnthropic,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailModels.includes(primaryAnthropic.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${primaryAnthropic}) forced to fail via test hook` });
            return callSingleAnthropicModel(primaryAnthropic, cleanBase64, mediaType, anthropicKey);
          },
        });
      }

      if ((!providerOverride || providerOverride === "openai") && openAiKey && openAiKey !== "[SENSITIVE]") {
        const primaryOpenAI = process.env.OPENAI_MODEL || "gpt-4o-mini";
        candidates.push({
          provider: "openai",
          model: primaryOpenAI,
          execute: () => {
            if (forceFailAll) return Promise.resolve({ error: "[Simulated Failure] All models forced to fail via test hook" });
            if (forceFailModels.includes(primaryOpenAI.toLowerCase())) return Promise.resolve({ error: `[Simulated Failure] Model (${primaryOpenAI}) forced to fail via test hook` });
            return callSingleOpenAIModel(primaryOpenAI, cleanBase64, mediaType, openAiKey);
          },
        });
      }
    }

    // Execute candidate sequence with Quality Gate
    for (const candidate of candidates) {
      const callRes = await candidate.execute();

      if ("error" in callRes) {
        providerAttempts.push({
          provider: candidate.provider,
          model: candidate.model,
          status: "error",
          error: callRes.error,
        });
        continue;
      }

      // Candidate returned text — now enforce strict Quality Gate
      const parsed = extractJSON(callRes.text);

      if (!parsed) {
        const parseMsg = "Quality gate failed: invalid or unparseable JSON output";
        console.warn(`[Quality Gate] ${candidate.provider} (${candidate.model}): ${parseMsg}`);
        providerAttempts.push({
          provider: candidate.provider,
          model: candidate.model,
          status: "error",
          error: parseMsg,
        });
        continue; // Fall through to next candidate!
      }

      if (!isHighQualityAssessment(parsed)) {
        const lowInfoMsg = `Quality gate failed: low-information result "${parsed.item_type}"`;
        console.warn(`[Quality Gate] ${candidate.provider} (${candidate.model}): ${lowInfoMsg}. Falling through to next provider.`);
        providerAttempts.push({
          provider: candidate.provider,
          model: candidate.model,
          status: "error",
          error: lowInfoMsg,
          item_type: parsed.item_type,
        });
        continue; // Fall through to next candidate!
      }

      // Passed Quality Gate!
      providerAttempts.push({
        provider: candidate.provider,
        model: candidate.model,
        status: "success",
        item_type: parsed.item_type,
      });

      acceptedResult = {
        parsed,
        provider: candidate.provider,
        model: candidate.model,
      };
      break; // Successfully obtained high-quality assessment!
    }

    const latencyMs = Date.now() - startTime;

    // 7. Process Accepted High-Quality Result
    if (acceptedResult) {
      const { parsed, provider, model } = acceptedResult;

      // Non-electronic rejection
      if (!parsed.is_electronic) {
        return NextResponse.json({
          success: false,
          not_electronic: true,
          provider,
          model,
          latency_ms: latencyMs,
          message:
            "RE:LOOP currently only assesses electronic items. This photo doesn't appear to show an electronic device - please upload a photo of an electronic item instead.",
          detected_object: parsed.rejection_reason || "Non-electronic item",
          provider_attempts: providerAttempts,
        });
      }

      // Cache genuine high/medium confidence AI assessment result into in-memory cache and dedicated ai_scan_cache table
      if (
        parsed.is_electronic &&
        (parsed.confidence === "high" || parsed.confidence === "medium") &&
        isHighQualityAssessment(parsed)
      ) {
        setMemoryCache(imageHash, {
          result: parsed,
          provider,
          model,
        });

        try {
          await supabase
            .from("ai_scan_cache")
            .upsert(
              {
                image_sha256: imageHash,
                provider,
                model,
                result: parsed as unknown as Json,
                created_at: new Date().toISOString(),
                hit_count: 1,
              },
              { onConflict: "image_sha256" }
            );
        } catch (dbErr) {
          console.warn("[AI Cache] ai_scan_cache persistence notice:", dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        cached: false,
        provider,
        model,
        latency_ms: latencyMs,
        manual_fallback: false,
        data: parsed,
        provider_attempts: providerAttempts,
      });
    }

    // 8. Explicit fallback if all providers failed or returned low-information results
    // Notice: We strictly NEVER attribute this to any provider ("Analyzed by <provider>")
    return NextResponse.json({
      success: true,
      provider: "manual_fallback",
      model: "none",
      latency_ms: latencyMs,
      manual_fallback: true,
      message: "AI analysis unavailable or returned low-information result. Using guided manual entry.",
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
