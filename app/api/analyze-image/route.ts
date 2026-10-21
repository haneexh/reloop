export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a circular economy assessor for RE:LOOP.
RE:LOOP STRICTLY AND EXCLUSIVELY assesses physical electronic devices, electrical equipment, and electronics hardware/components.

STEP 1: FIRST, inspect the photograph and classify whether it shows a physical electronic device or electronic component (anything that contains circuitry, a battery, a power cord/plug, an electric motor, or an electronic display/screen - for example: phones, laptops, PCs, monitors, CRT TVs, appliances with electronic controls, audio equipment, gaming consoles, cables, chargers, power supplies, circuit boards, cameras, printers, electronic tools, etc.).

If the photo does NOT depict an electronic item (for example: clothing, apparel, shoes, wooden/fabric furniture, plants, food, humans, pets/animals, books, tableware, sports gear, non-electronic toys, plastic containers, paper products, etc.):
You MUST return ONLY this JSON:
{
  "is_electronic": false,
  "rejection_reason": "Non-electronic object detected (briefly name what is in the photo, e.g., 'clothing' or 'wooden chair' or 'houseplant')."
}

STEP 2: If the photo DOES depict an electronic device or component, set "is_electronic": true and return:
{
  "is_electronic": true,
  "item_type": string,
  "brand": string | null,
  "estimated_age_years": number | null,
  "condition": "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged",
  "condition_notes": string,
  "material_recoverable": boolean,
  "confidence": "high" | "medium" | "low"
}

CRITICAL RULES FOR ELECTRONICS:
1. For electronic hardware, ALWAYS attempt your best guess for item_type, brand, and age, even for old, vintage, obscure, damaged, or partially obscured electronics.
2. If you are uncertain of the exact electronic model or type, set "confidence": "low" and explain your best guess in "condition_notes", but still provide the closest matching electronic item_type.
3. Be realistic with age: legacy electronics like CRT TVs and VCRs are typically 10-25 years old.
4. Output raw JSON only. No markdown formatting, no conversational text.`;

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
 * 1. Google Gemini Vision API Call
 * Primary: GEMINI_MODEL or gemini-3.6-flash
 * Fallback: GEMINI_FALLBACK_MODEL or gemini-3.5-flash
 */
async function callGeminiVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "GEMINI_API_KEY not configured or placeholder." };
  }

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  const errors: string[] = [];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mediaType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        const msg = `Gemini (${model}) ${res.status}: ${errText.slice(0, 200)}`;
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
      const msg = `Gemini (${model}) network exception: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.warn(msg);
    }
  }

  return { error: errors.join(" | ") || "All Gemini endpoints failed." };
}

/**
 * 2. Anthropic Vision API Call
 * Primary: ANTHROPIC_MODEL or claude-sonnet-5-5
 * Fallback: claude-haiku-5-5
 */
async function callAnthropicVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "ANTHROPIC_API_KEY not configured or placeholder." };
  }

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  const primaryModel = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const fallbackModel = "claude-haiku-5-5";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  let lastError = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
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
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `Anthropic (${model}) ${res.status}: ${errText.slice(0, 200)}`;
        console.warn(lastError);
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
      lastError = `Anthropic (${model}) network exception: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(lastError);
    }
  }

  return { error: lastError || "All Anthropic endpoints failed." };
}

/**
 * 3. OpenAI Vision API Call
 * Primary: OPENAI_MODEL or gpt-4o
 * Fallback: gpt-4o-mini
 */
async function callOpenAIVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<{ text: string; model: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "[SENSITIVE]") {
    return { error: "OPENAI_API_KEY not configured or placeholder." };
  }

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  const imageUrl = `data:${mediaType};base64,${base64Data}`;
  const primaryModel = process.env.OPENAI_MODEL || "gpt-4o";
  const fallbackModel = "gpt-4o-mini";
  const models = Array.from(new Set([primaryModel, fallbackModel]));

  let lastError = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Assess this item for circular economy re-use or recycling." },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                    detail: "low",
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `OpenAI (${model}) ${res.status}: ${errText.slice(0, 200)}`;
        console.warn(lastError);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { text: content, model };
      }
    } catch (err) {
      lastError = `OpenAI (${model}) network exception: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(lastError);
    }
  }

  return { error: lastError || "All OpenAI endpoints failed." };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { imageBase64, mediaType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data (imageBase64) is required." }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

    const providerAttempts: Array<{ provider: string; model?: string; status: "success" | "error"; error?: string }> = [];

    let successResult: { text: string; provider: string; model: string } | null = null;

    // 1. Try Gemini Vision (Primary: gemini-3.5-flash)
    console.log("[AI Vision] Attempting Gemini...");
    const geminiRes = await callGeminiVision(cleanBase64, mediaType);
    if ("text" in geminiRes) {
      providerAttempts.push({ provider: "gemini", model: geminiRes.model, status: "success" });
      successResult = { text: geminiRes.text, provider: "gemini", model: geminiRes.model };
    } else {
      providerAttempts.push({ provider: "gemini", status: "error", error: geminiRes.error });
    }

    // 2. Try Anthropic Vision (Fallback: claude-sonnet-5-5)
    if (!successResult) {
      console.log("[AI Vision] Attempting Anthropic...");
      const anthropicRes = await callAnthropicVision(cleanBase64, mediaType);
      if ("text" in anthropicRes) {
        providerAttempts.push({ provider: "anthropic", model: anthropicRes.model, status: "success" });
        successResult = { text: anthropicRes.text, provider: "anthropic", model: anthropicRes.model };
      } else {
        providerAttempts.push({ provider: "anthropic", status: "error", error: anthropicRes.error });
      }
    }

    // 3. Try OpenAI Vision (Fallback: gpt-4o)
    if (!successResult) {
      console.log("[AI Vision] Attempting OpenAI...");
      const openAiRes = await callOpenAIVision(cleanBase64, mediaType);
      if ("text" in openAiRes) {
        providerAttempts.push({ provider: "openai", model: openAiRes.model, status: "success" });
        successResult = { text: openAiRes.text, provider: "openai", model: openAiRes.model };
      } else {
        providerAttempts.push({ provider: "openai", status: "error", error: openAiRes.error });
      }
    }

    const latencyMs = Date.now() - startTime;

    // If an AI provider succeeded, parse result
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

        return NextResponse.json({
          success: true,
          provider: successResult.provider,
          model: successResult.model,
          latency_ms: latencyMs,
          manual_fallback: false,
          data: parsed,
          provider_attempts: providerAttempts,
        });
      }
    }

    // All providers failed or were unconfigured: explicitly report fallback and error trail
    console.warn("[AI Vision] All providers failed. Returning manual fallback. Attempts:", providerAttempts);
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
    console.error("Vision assessment route error:", error);
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
