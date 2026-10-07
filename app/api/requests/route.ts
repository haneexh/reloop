import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveZoneByCoordinates, getCollectionZones } from "@/lib/zone-resolver";
import { calculateImpact } from "@/lib/impact-calculator";
import crypto from "crypto";

export interface CreateRequestItemInput {
  item_type: string;
  brand?: string | null;
  condition?: string | null;
  estimated_age_years?: number | null;
  weight_kg?: number | null;
  image_url?: string | null;
  quantity?: number;
}

export interface CreateRequestBody {
  citizen_name?: string | null;
  citizen_phone: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  zone_id?: string | null;
  pickup_date: string;
  pickup_slot: string;
  notes?: string | null;
  items: CreateRequestItemInput[];
}

function generateQrToken(): string {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `RLP-HYD-${hex}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateRequestBody = await req.json();

    // 1. Validation
    if (!body.citizen_phone || body.citizen_phone.trim().length < 7) {
      return NextResponse.json(
        { error: "A valid contact phone number is required." },
        { status: 400 }
      );
    }

    if (!body.address || body.address.trim().length < 5) {
      return NextResponse.json(
        { error: "A valid pickup address (minimum 5 characters) is required." },
        { status: 400 }
      );
    }

    if (!body.pickup_date) {
      return NextResponse.json(
        { error: "Pickup date is required." },
        { status: 400 }
      );
    }

    // Verify date is not in the past
    const today = new Date().toISOString().split("T")[0];
    if (body.pickup_date < today) {
      return NextResponse.json(
        { error: "Pickup date cannot be in the past." },
        { status: 400 }
      );
    }

    const validSlots = ["09:00 - 12:00", "12:00 - 15:00", "15:00 - 18:00"];
    const slot = body.pickup_slot && validSlots.includes(body.pickup_slot)
      ? body.pickup_slot
      : "09:00 - 12:00";

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one e-waste item must be added to the request." },
        { status: 400 }
      );
    }

    // 2. Zone resolution if not explicitly provided
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

    // 3. Generate secure tracking QR token
    const qrToken = generateQrToken();

    // 4. Insert into collection_requests
    const requestInsertPayload = {
      citizen_name: body.citizen_name ? body.citizen_name.trim() : null,
      citizen_phone: body.citizen_phone.trim(),
      address: body.address.trim(),
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
      zone_id: zoneId,
      pickup_date: body.pickup_date,
      pickup_slot: slot,
      status: "pending" as const,
      priority: "normal" as const,
      notes: body.notes ? body.notes.trim() : null,
      qr_token: qrToken,
      is_simulated: false,
    };

    const { data: requestData, error: requestError } = await supabase
      .from("collection_requests")
      .insert(requestInsertPayload)
      .select("id, qr_token, status, pickup_date, pickup_slot, created_at")
      .single();

    if (requestError || !requestData) {
      console.error("Failed to insert collection request:", requestError);
      return NextResponse.json(
        { error: "Failed to schedule collection request in database." },
        { status: 500 }
      );
    }

    const requestId = requestData.id;

    // 5. Insert child items linking request_id
    let totalWeightEst = 0;
    const itemsToInsert: Array<{
      request_id: string;
      item_type: string;
      brand: string | null;
      condition: string | null;
      estimated_age_years: number | null;
      co2e_saved_est: number;
      waste_avoided_kg: number;
      image_url: string | null;
    }> = [];

    for (const item of body.items) {
      const quantity = Math.max(1, Math.min(20, item.quantity || 1));
      const impact = calculateImpact(
        item.item_type,
        item.condition || "functional",
        item.estimated_age_years || 3,
        item.weight_kg || undefined
      );

      const singleWeight = item.weight_kg && item.weight_kg > 0
        ? item.weight_kg
        : impact.wasteAvoidedKg;

      totalWeightEst += singleWeight * quantity;

      for (let q = 0; q < quantity; q++) {
        itemsToInsert.push({
          request_id: requestId,
          item_type: item.item_type.trim(),
          brand: item.brand ? item.brand.trim() : null,
          condition: item.condition || "functional",
          estimated_age_years: item.estimated_age_years || 3,
          co2e_saved_est: Math.round(impact.co2eSavedKg * 10) / 10,
          waste_avoided_kg: Math.round(singleWeight * 10) / 10,
          image_url: item.image_url || null,
        });
      }
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from("items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Warning: child items insert error:", itemsError);
      }
    }

    // 6. Append audit log in event_log (WITHOUT PII)
    const { error: eventError } = await supabase.from("event_log").insert({
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

    if (eventError) {
      console.warn("Event log insert notice:", eventError);
    }

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
 * Public tracking retrieval by QR token or ID (Masks sensitive citizen PII).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const id = searchParams.get("id");

    if (!token && !id) {
      return NextResponse.json(
        { error: "Either token or id query parameter is required." },
        { status: 400 }
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
        zone_id
      `);

    if (token) {
      query = query.eq("qr_token", token.trim());
    } else if (id) {
      query = query.eq("id", id.trim());
    }

    const { data: request, error: reqError } = await query.single();

    if (reqError || !request) {
      return NextResponse.json(
        { error: "Collection request not found." },
        { status: 404 }
      );
    }

    // Resolve Zone info
    let zoneInfo: { name: string; code: string } | null = null;
    if (request.zone_id) {
      const { data: zone } = await supabase
        .from("collection_zones")
        .select("name, code")
        .eq("id", request.zone_id)
        .single();
      if (zone) zoneInfo = zone;
    }

    // Fetch items
    const { data: items } = await supabase
      .from("items")
      .select("id, item_type, brand, condition, waste_avoided_kg, co2e_saved_est")
      .eq("request_id", request.id);

    // Fetch collection records if any verified
    const { data: records } = await supabase
      .from("collection_records")
      .select("actual_weight_kg, verified_at, verification_method")
      .eq("request_id", request.id);

    // Mask address for public safety (keep only locality/city/zone)
    const rawAddress = request.address || "";
    const addressParts = rawAddress.split(",").map((s) => s.trim()).filter(Boolean);
    const publicArea =
      addressParts.length >= 2
        ? addressParts.slice(-2).join(", ")
        : (zoneInfo?.name ? `${zoneInfo.name}, Hyderabad` : "Hyderabad Metropolitan Area");

    return NextResponse.json({
      success: true,
      data: {
        id: request.id,
        qrToken: request.qr_token,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
