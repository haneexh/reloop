import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { resolveZoneByCoordinates, getCollectionZones } from "@/lib/zone-resolver";
import { calculateCircularImpact } from "@/lib/impact-calculator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { generateSecureTrackingToken, isDemoTrackingToken } from "@/lib/tracking-token";
import type { CollectionRequestStatus, CollectionRequestPriority } from "@/types/database";

const RequestItemSchema = z
  .object({
    item_type: z.string().min(1).max(80),
    brand: z.string().max(80).nullable().optional(),
    condition: z.enum(["functional", "cosmetic_damage", "partially_working", "severely_damaged"]).nullable().optional(),
    estimated_age_years: z.number().min(0).max(50).nullable().optional(),
    weight_kg: z.number().min(0).max(500).nullable().optional(),
    image_url: z.string().url().max(1000).nullable().optional(),
    quantity: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const CreateRequestSchema = z
  .object({
    citizen_name: z.string().max(100).nullable().optional(),
    citizen_phone: z.string().min(7, "Phone number must be at least 7 digits").max(20),
    address: z.string().min(5, "Address must be at least 5 characters").max(500),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    zone_id: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid zone ID").nullable().optional(),
    pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    pickup_slot: z.string().max(50),
    notes: z.string().max(500).nullable().optional(),
    items: z.array(RequestItemSchema).min(1, "At least one e-waste item is required").max(50),
    linked_item_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    // 1. IP rate limiting (20 requests per minute)
    const rate = checkRateLimit(req, 20, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many intake requests. Please wait ${rate.resetInSecs} seconds before trying again.` },
        { status: 429, headers: { "Retry-After": String(rate.resetInSecs) } }
      );
    }

    // 2. Body size check (reject payload > 100KB to prevent abuse)
    const rawText = await req.text();
    if (rawText.length > 100 * 1024) {
      return NextResponse.json(
        { error: "Payload exceeds 100KB size limit." },
        { status: 413 }
      );
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
    }

    // 3. Strict schema validation
    const parsed = CreateRequestSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload or unknown fields detected.",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Verify date is not in the past
    const today = new Date().toISOString().split("T")[0];
    if (body.pickup_date < today) {
      return NextResponse.json(
        { error: "Pickup date cannot be in the past." },
        { status: 400 }
      );
    }

    const validSlots = ["09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00"];
    const slot = validSlots.includes(body.pickup_slot) ? body.pickup_slot : "09:00 - 12:00";

    // 4. Zone resolution
    let zoneId = body.zone_id || null;
    let resolvedZoneName: string | null = null;

    if (!zoneId && typeof body.lat === "number" && typeof body.lng === "number") {
      const resolution = await resolveZoneByCoordinates(body.lat, body.lng);
      zoneId = resolution.zone.id;
      resolvedZoneName = resolution.zone.name;
    } else if (zoneId) {
      const zones = await getCollectionZones();
      const matched = zones.find((z) => z.id === zoneId);
      if (matched) resolvedZoneName = matched.name;
    }

    // 5. Generate cryptographically random 128-bit URL-safe token
    const qrToken = generateSecureTrackingToken();

    // 6. Insert collection request
    const requestInsertPayload = {
      citizen_name: body.citizen_name || null,
      citizen_phone: body.citizen_phone,
      address: body.address,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      zone_id: zoneId,
      pickup_date: body.pickup_date,
      pickup_slot: slot,
      status: "pending" as CollectionRequestStatus,
      priority: "normal" as CollectionRequestPriority,
      notes: body.notes || null,
      qr_token: qrToken,
      is_simulated: false,
    };

    const { data: requestData, error: requestError } = await supabase
      .from("collection_requests")
      .insert(requestInsertPayload)
      .select("id, qr_token, status, pickup_date, pickup_slot, zone_id")
      .single();

    if (requestError || !requestData) {
      console.error("Database insert error:", requestError);
      return NextResponse.json(
        { error: "Failed to persist pickup request." },
        { status: 500 }
      );
    }

    const requestId = requestData.id;

    // 7. Calculate impact and insert items
    let totalWeightEst = 0;
    const itemsToInsert = body.items.map((item) => {
      const impact = calculateCircularImpact({
        itemType: item.item_type,
        condition: item.condition || "functional",
        estimatedAgeYears: item.estimated_age_years ?? undefined,
      });

      const weight = item.weight_kg || impact.wasteAvoidedKg || 2.0;
      totalWeightEst += weight;

      return {
        request_id: requestId,
        item_type: item.item_type,
        brand: item.brand || null,
        condition: item.condition || "functional",
        estimated_age_years: item.estimated_age_years || null,
        waste_avoided_kg: impact.wasteAvoidedKg,
        co2e_saved_est: impact.co2eSavedEst,
        resale_value_est: impact.resaleValueEst,
        repair_cost_est: impact.repairCostEst,
        image_url: item.image_url || null,
      };
    });

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.warn("Notice: Items insertion warning:", itemsError);
      }
    }

    // 7b. If this request originated from an AI scan assessment, link the item
    if (body.linked_item_id) {
      const { error: linkErr } = await supabase
        .from("items")
        .update({ request_id: requestId })
        .eq("id", body.linked_item_id);

      if (linkErr) {
        console.warn("Notice: Linked item update warning:", linkErr);
      } else {
        await supabase.from("event_log").insert({
          event_type: "ITEM_LINKED",
          entity_type: "items",
          entity_id: body.linked_item_id,
          actor_role: "CITIZEN",
          payload_json: {
            request_id: requestId,
            qr_token: qrToken,
            message: "Item linked from AI scan assessment to municipal pickup request",
          },
        });
      }
    }

    // 8. Log audit event
    await supabase.from("event_log").insert({
      event_type: "REQUEST_CREATED",
      entity_type: "collection_requests",
      entity_id: requestId,
      actor_role: "CITIZEN",
      payload_json: {
        qr_token: qrToken,
        zone_id: zoneId,
        zone_name: resolvedZoneName,
        items_count: itemsToInsert.length,
        estimated_weight_kg: Math.round(totalWeightEst * 10) / 10,
        pickup_date: body.pickup_date,
        pickup_slot: slot,
      },
    });

    return NextResponse.json({
      success: true,
      requestId,
      qrToken,
      trackingUrl: `/track/${qrToken}`,
      pickupDate: requestData.pickup_date,
      pickupSlot: requestData.pickup_slot,
      status: requestData.status,
      zoneName: resolvedZoneName,
      itemsCount: itemsToInsert.length,
      estimatedWeightKg: Math.round(totalWeightEst * 10) / 10,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/requests error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Public tracking retrieval by QR token or ID (Strictly non-PII, rate-limited, uniform 404).
 */
export async function GET(req: NextRequest) {
  try {
    // 1. IP rate limiting (60 tracking queries per minute)
    const rate = checkRateLimit(req, 60, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many tracking queries. Please wait ${rate.resetInSecs} seconds.` },
        { status: 429, headers: { "Retry-After": String(rate.resetInSecs) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const id = searchParams.get("id");

    if (!token && !id) {
      return NextResponse.json(
        { error: "Collection request not found." },
        { status: 404 }
      );
    }

    let query = supabase
      .from("collection_requests")
      .select(`
        id,
        qr_token,
        status,
        priority,
        pickup_date,
        pickup_slot,
        created_at,
        updated_at,
        address,
        zone_id,
        is_simulated
      `);

    if (token) {
      query = query.eq("qr_token", token.trim());
    } else if (id) {
      query = query.eq("id", id.trim());
    }

    const { data: request, error: reqError } = await query.single();

    // Uniform 404 response to eliminate token enumeration or guessing
    if (reqError || !request) {
      return NextResponse.json(
        { error: "Collection request not found." },
        { status: 404 }
      );
    }

    // Resolve Zone name/code only
    let zoneInfo: { name: string; code: string } | null = null;
    if (request.zone_id) {
      const { data: zone } = await supabase
        .from("collection_zones")
        .select("name, code")
        .eq("id", request.zone_id)
        .single();
      if (zone) zoneInfo = zone;
    }

    // Fetch items (non-PII hardware specs) with circular pathway recommendations if linked
    const { data: items } = await supabase
      .from("items")
      .select("id, item_type, brand, condition, waste_avoided_kg, co2e_saved_est, recommendations(recommended_action, repairability_score)")
      .eq("request_id", request.id);

    // Fetch verified collection records (actual weights and timestamps only)
    const { data: records } = await supabase
      .from("collection_records")
      .select("actual_weight_kg, verified_at, verification_method")
      .eq("request_id", request.id);

    // Address is strictly masked: only broader neighborhood / ward name returned
    const rawAddress = request.address || "";
    const addressParts = rawAddress.split(",").map((s) => s.trim()).filter(Boolean);
    const publicArea =
      addressParts.length >= 2
        ? addressParts.slice(-2).join(", ")
        : (zoneInfo?.name ? `${zoneInfo.name}, Hyderabad` : "Hyderabad Metropolitan Area");

    // Check if token is one of the designated pre-seeded demo tokens
    const isDemoToken = request.is_simulated || isDemoTrackingToken(request.qr_token);

    return NextResponse.json({
      success: true,
      data: {
        id: request.id,
        qrToken: request.qr_token,
        isDemo: Boolean(isDemoToken),
        status: request.status,
        priority: request.priority,
        pickupDate: request.pickup_date,
        pickupSlot: request.pickup_slot,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        area: publicArea,
        zone: zoneInfo,
        items: items || [],
        totalItems: items?.length || 0,
        estimatedWeightKg: (items || []).reduce(
          (sum, i) => sum + (Number(i.waste_avoided_kg) || 0),
          0
        ),
        verifiedRecords: records || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/requests GET error:", message);
    return NextResponse.json({ error: "Collection request not found." }, { status: 404 });
  }
}
