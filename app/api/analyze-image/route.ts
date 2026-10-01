import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an item-condition assessor for a circular economy app. Given a photo of an unwanted household/electronic item, return ONLY valid JSON with these fields:
{ item_type: string, brand: string|null, estimated_age_years: number|null, condition: 'functional' | 'cosmetic_damage' | 'partially_working' | 'severely_damaged', condition_notes: string, material_recoverable: boolean }
Be conservative — if you can't tell brand or age from the image, use null. No text outside the JSON.`;

interface AssessmentResult {
  item_type: string;
  brand: string | null;
  estimated_age_years: number | null;
  condition: "functional" | "cosmetic_damage" | "partially_working" | "severely_damaged";
  condition_notes: string;
  material_recoverable: boolean;
}

function extractJSON(text: string): AssessmentResult | null {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      return {
        item_type: parsed.item_type || "electronic_item",
        brand: parsed.brand ?? null,
        estimated_age_years:
          typeof parsed.estimated_age_years === "number" ? parsed.estimated_age_years : null,
        condition: [
          "functional",
          "cosmetic_damage",
          "partially_working",
          "severely_damaged",
        ].includes(parsed.condition)
          ? parsed.condition
          : "functional",
        condition_notes: parsed.condition_notes || "Condition assessed via vision model.",
        material_recoverable:
          typeof parsed.material_recoverable === "boolean" ? parsed.material_recoverable : true,
      };
    }
  } catch {
    // Attempt regex extraction of the first {...} block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          item_type: parsed.item_type || "electronic_item",
          brand: parsed.brand ?? null,
          estimated_age_years:
            typeof parsed.estimated_age_years === "number" ? parsed.estimated_age_years : null,
          condition: [
            "functional",
            "cosmetic_damage",
            "partially_working",
            "severely_damaged",
          ].includes(parsed.condition)
            ? parsed.condition
            : "functional",
          condition_notes: parsed.condition_notes || "Condition assessed via vision model.",
          material_recoverable:
            typeof parsed.material_recoverable === "boolean" ? parsed.material_recoverable : true,
        };
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
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
    console.error("Anthropic Vision API error:", await res.text());
    return null;
  }

  const data = await res.json();
  const textContent = data.content?.find(
    (c: { type: string; text?: string }) => c.type === "text"
  )?.text;
  return textContent || null;
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
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
    console.error("OpenAI Vision API error:", await res.text());
    return null;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mediaType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "Image data (imageBase64) is required." }, { status: 400 });
    }

    // Strip base64 prefix if included (e.g. data:image/png;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    let rawOutput: string | null = null;
    let providerUsed = "none";

    // 1. Try Claude Vision if ANTHROPIC_API_KEY is present
    if (process.env.ANTHROPIC_API_KEY) {
      providerUsed = "anthropic";
      rawOutput = await callAnthropicVision(cleanBase64, mediaType);

      // Retry once if parsing fails
      if (rawOutput && !extractJSON(rawOutput)) {
        rawOutput = await callAnthropicVision(cleanBase64, mediaType, true);
      }
    }

    // 2. Try OpenAI Vision if ANTHROPIC was unavailable or failed
    if (!rawOutput && process.env.OPENAI_API_KEY) {
      providerUsed = "openai";
      rawOutput = await callOpenAIVision(cleanBase64, mediaType);

      // Retry once if parsing fails
      if (rawOutput && !extractJSON(rawOutput)) {
        rawOutput = await callOpenAIVision(cleanBase64, mediaType, true);
      }
    }

    // 3. If raw output was received, parse it
    if (rawOutput) {
      const parsed = extractJSON(rawOutput);
      if (parsed) {
        return NextResponse.json({
          success: true,
          provider: providerUsed,
          manual_fallback: false,
          data: parsed,
        });
      }
    }

    // 4. Graceful Fallback if APIs are not configured or failed entirely
    return NextResponse.json({
      success: true,
      provider: "manual_fallback",
      manual_fallback: true,
      message:
        providerUsed === "none"
          ? "No Vision API key detected. Please fill in the item details manually."
          : "Vision model response could not be parsed. Pre-filled with manual entry defaults.",
      data: {
        item_type: "",
        brand: null,
        estimated_age_years: null,
        condition: "functional",
        condition_notes: "Manual assessment entered by user.",
        material_recoverable: true,
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
          item_type: "",
          brand: null,
          estimated_age_years: null,
          condition: "functional",
          condition_notes: "Fallback manual entry.",
          material_recoverable: true,
        },
      },
      { status: 200 } // Return 200 with fallback data so the user is never blocked
    );
  }
}
