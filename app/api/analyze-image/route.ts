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
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return sanitizeParsed(parsed);
    }
  } catch {
    // Attempt regex extraction of the first {...} block
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

async function callAnthropicVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

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
      console.error("Anthropic Vision API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const textContent = data.content?.find(
      (c: { type: string; text?: string }) => c.type === "text"
    )?.text;
    return textContent || null;
  } catch (err) {
    console.error("Anthropic Vision network error:", err);
    return null;
  }
}

async function callOpenAIVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  const imageUrl = `data:${mediaType};base64,${base64Data}`;
  const model = process.env.OPENAI_MODEL || "gpt-4o";

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
      console.error("OpenAI Vision API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("OpenAI Vision network error:", err);
    return null;
  }
}

async function callGeminiVision(
  base64Data: string,
  mediaType: string,
  isRetry = false
): Promise<string | null> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const prompt = isRetry
    ? `${SYSTEM_PROMPT}\n\nIMPORTANT: Your previous output was not valid JSON. Return ONLY the raw JSON object, starting with { and ending with }.`
    : SYSTEM_PROMPT;

  // Supported multimodal models in active priority order
  const primaryGeminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const models = Array.from(
    new Set([primaryGeminiModel, "gemini-2.0-flash", "gemini-1.5-pro"])
  );

  let lastError = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
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

        if (res.status === 503 || res.status === 429) {
          lastError = `Gemini (${model}) ${res.status}`;
          const delay = (attempt + 1) * 2000;
          console.warn(`Gemini (${model}) returned ${res.status}, retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!res.ok) {
          const errBody = await res.text();
          lastError = `Gemini (${model}) error ${res.status}: ${errBody}`;
          console.error(lastError);
          break; // Try next model in list
        }

        const data = await res.json();
        const text =
          data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join("") ||
          data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return text;
        } else {
          lastError = `Gemini returned empty candidates: ${JSON.stringify(data)}`;
        }
      } catch (err) {
        lastError = `Gemini network error (${model}): ${err instanceof Error ? err.message : String(err)}`;
        console.error(lastError);
      }
    }
  }

  if (lastError) {
    console.warn("All Gemini models failed:", lastError);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mediaType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data (imageBase64) is required." }, { status: 400 });
    }

    // Strip base64 prefix if included (e.g. data:image/png;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();

    let rawOutput: string | null = null;
    let providerUsed = "none";

    // 1. Try Gemini Vision first if GEMINI_API_KEY is present
    if (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY
    ) {
      rawOutput = await callGeminiVision(cleanBase64, mediaType);
      if (rawOutput) {
        providerUsed = "gemini";
        // Retry once if parsing fails
        if (!extractJSON(rawOutput)) {
          const retryOutput = await callGeminiVision(cleanBase64, mediaType, true);
          if (retryOutput && extractJSON(retryOutput)) {
            rawOutput = retryOutput;
          }
        }
      }
    }

    // 2. Try Claude Vision if Gemini was unavailable or failed
    if (!rawOutput && process.env.ANTHROPIC_API_KEY) {
      rawOutput = await callAnthropicVision(cleanBase64, mediaType);
      if (rawOutput) {
        providerUsed = "anthropic";
        // Retry once if parsing fails
        if (!extractJSON(rawOutput)) {
          const retryOutput = await callAnthropicVision(cleanBase64, mediaType, true);
          if (retryOutput && extractJSON(retryOutput)) {
            rawOutput = retryOutput;
          }
        }
      }
    }

    // 3. Try OpenAI Vision if others were unavailable or failed
    if (!rawOutput && process.env.OPENAI_API_KEY) {
      rawOutput = await callOpenAIVision(cleanBase64, mediaType);
      if (rawOutput) {
        providerUsed = "openai";
        // Retry once if parsing fails
        if (!extractJSON(rawOutput)) {
          const retryOutput = await callOpenAIVision(cleanBase64, mediaType, true);
          if (retryOutput && extractJSON(retryOutput)) {
            rawOutput = retryOutput;
          }
        }
      }
    }

    // 4. If raw output was received, parse it
    if (rawOutput) {
      const parsed = extractJSON(rawOutput);
      if (parsed) {
        if (!parsed.is_electronic) {
          return NextResponse.json({
            success: false,
            not_electronic: true,
            message:
              "RE:LOOP currently only assesses electronic items. This photo doesn't appear to show an electronic device - please upload a photo of an electronic item instead.",
            detected_object: parsed.rejection_reason || "Non-electronic item",
          });
        }

        return NextResponse.json({
          success: true,
          provider: providerUsed,
          manual_fallback: false,
          data: parsed,
        });
      }
    }

    // 5. Graceful Fallback if APIs are not configured or failed entirely
    return NextResponse.json({
      success: true,
      provider: "manual_fallback",
      manual_fallback: true,
      message:
        (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
          ? "Vision model could not identify with high confidence. Pre-filled with best-guess defaults."
          : "No Vision API key detected. Please verify or complete item details manually.",
      data: {
        item_type: "Other Electronics / Unlisted",
        brand: null,
        estimated_age_years: null,
        condition: "functional",
        condition_notes: "Manual assessment entered by user.",
        material_recoverable: true,
        confidence: "low",
        is_low_confidence: true,
      },
    });
  } catch (error) {
    console.error("Vision assessment route error:", error);
    return NextResponse.json(
      {
        success: false,
        manual_fallback: true,
        error: error instanceof Error ? error.message : "Internal assessment error",
        data: {
          item_type: "Other Electronics / Unlisted",
          brand: null,
          estimated_age_years: null,
          condition: "functional",
          condition_notes: "Fallback manual entry.",
          material_recoverable: true,
          confidence: "low",
          is_low_confidence: true,
        },
      },
      { status: 200 } // Return 200 with fallback data so the user is never blocked
    );
  }
}
