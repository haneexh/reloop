import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database";
import {
  isAuthorizedRecoveryOperator,
  validateTransferBatch,
  validateRecoveryBreakdown,
  mapPartnerToFacility,
} from "@/lib/recovery-engine";

export async function GET() {
  try {
    const { data: transfers, error } = await supabase
      .from("recovery_transfers")
      .select(`
        id,
        facility_id,
        route_id,
        total_weight_kg,
        refurbished_pct,
        recycled_pct,
        residual_pct,
        transferred_at,
        notes
      `)
      .order("transferred_at", { ascending: false });

    if (error) {
      console.error("Error listing recovery transfers:", error);
      return NextResponse.json(
        { error: "Failed to list recovery transfers." },
        { status: 500 }
      );
    }

    // Join facility details from partners
    const { data: partners } = await supabase
      .from("partners")
      .select("id, name, partner_type, city, verified");

    const partnerMap = new Map((partners || []).map((p) => [p.id, p]));

    const enriched = (transfers || []).map((t) => {
      const p = t.facility_id ? partnerMap.get(t.facility_id) : null;
      const breakdown = validateRecoveryBreakdown(
        Number(t.total_weight_kg),
        Number(t.refurbished_pct),
        Number(t.recycled_pct),
        Number(t.residual_pct)
      );

      return {
        ...t,
        facility_name: p?.name || "Accredited Recovery Facility",
        facility_type: p?.partner_type || "recycler",
        city: p?.city || "Hyderabad",
        breakdown: breakdown.breakdown,
      };
    });

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const role = req.headers.get("x-user-role") || body.actor_role || "DISPATCHER";

    // 1. Authorization boundary
    if (!isAuthorizedRecoveryOperator(role)) {
      return NextResponse.json(
        { error: "Forbidden: Citizen role is not authorized to create recovery transfers." },
        { status: 403 }
      );
    }

    const {
      facility_id,
      collection_record_ids,
      route_id = null,
      transferred_weight_kg,
      refurbished_pct = 0,
      recycled_pct = 0,
      residual_pct = 0,
      notes,
    } = body;

    if (!facility_id) {
      return NextResponse.json(
        { error: "facility_id is required." },
        { status: 400 }
      );
    }

    if (!collection_record_ids || !Array.isArray(collection_record_ids) || collection_record_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one collection_record_id must be selected for the transfer batch." },
        { status: 400 }
      );
    }

    // 2. Fetch destination facility
    const { data: partner, error: partnerErr } = await supabase
      .from("partners")
      .select("id, name, partner_type, city, lat, lng, contact, verified")
      .eq("id", facility_id)
      .single();

    if (partnerErr || !partner) {
      return NextResponse.json(
        { error: "Selected recovery facility not found in municipal registry." },
        { status: 404 }
      );
    }

    const facility = mapPartnerToFacility(partner);

    // 3. Fetch candidate collection records
    const { data: dbRecords, error: recordsErr } = await supabase
      .from("collection_records")
      .select(`
        id,
        actual_weight_kg,
        request_id,
        route_id
      `)
      .in("id", collection_record_ids);

    if (recordsErr || !dbRecords || dbRecords.length === 0) {
      return NextResponse.json(
        { error: "No matching collection records found for the provided IDs." },
        { status: 404 }
      );
    }

    // Check parent request statuses
    const requestIds = dbRecords.map((r) => r.request_id);
    const { data: dbRequests } = await supabase
      .from("collection_requests")
      .select("id, status")
      .in("id", requestIds);

    const reqStatusMap = new Map((dbRequests || []).map((r) => [r.id, r.status]));

    const candidateRecords = dbRecords.map((r) => ({
      id: r.id,
      actual_weight_kg: Number(r.actual_weight_kg),
      request_id: r.request_id,
      request_status: reqStatusMap.get(r.request_id) || "collected",
    }));

    // 4. Validate transfer batch total weight
    const batchValidation = validateTransferBatch({
      facility,
      collectionRecords: candidateRecords,
      specifiedWeightKg: typeof transferred_weight_kg === "number" ? transferred_weight_kg : undefined,
    });

    if (!batchValidation.valid || typeof batchValidation.total_weight_kg !== "number") {
      return NextResponse.json(
        { error: batchValidation.error || "Invalid transfer batch configuration." },
        { status: 400 }
      );
    }

    const totalBatchWeight = batchValidation.total_weight_kg;

    // 5. Validate recovery breakdown
    const breakdownValidation = validateRecoveryBreakdown(
      totalBatchWeight,
      refurbished_pct,
      recycled_pct,
      residual_pct
    );

    if (!breakdownValidation.valid || !breakdownValidation.breakdown) {
      return NextResponse.json(
        { error: breakdownValidation.error || "Invalid material recovery breakdown." },
        { status: 400 }
      );
    }

    const breakdown = breakdownValidation.breakdown;
    const nowIso = new Date().toISOString();

    // 6. Embed batch metadata in notes
    const batchMetadata = JSON.stringify({
      batch_record_ids: collection_record_ids,
      records_count: collection_record_ids.length,
    });
    const finalNotes = notes
      ? `${notes.trim()} | ${batchMetadata}`
      : `Batch transfer of ${collection_record_ids.length} collection records | ${batchMetadata}`;

    // 7. Insert recovery_transfers record
    const { data: createdTransfer, error: insertErr } = await supabase
      .from("recovery_transfers")
      .insert({
        facility_id: facility.id,
        route_id: route_id || dbRecords[0]?.route_id || null,
        total_weight_kg: totalBatchWeight,
        refurbished_pct: breakdown.refurbished_pct,
        recycled_pct: breakdown.recycled_pct,
        residual_pct: breakdown.residual_pct,
        transferred_at: nowIso,
        notes: finalNotes,
      })
      .select("id, facility_id, total_weight_kg, refurbished_pct, recycled_pct, residual_pct, transferred_at")
      .single();

    if (insertErr || !createdTransfer) {
      console.error("Failed to insert recovery transfer:", insertErr);
      return NextResponse.json(
        { error: "Database error committing recovery transfer record." },
        { status: 500 }
      );
    }

    // 8. Update request lifecycle status: 'recovered' if breakdown complete, else 'sent_to_facility'
    const newRequestStatus = breakdown.is_complete ? "recovered" : "sent_to_facility";
    if (requestIds.length > 0) {
      await supabase
        .from("collection_requests")
        .update({
          status: newRequestStatus,
          updated_at: nowIso,
        })
        .in("id", requestIds);
    }

    // 9. Append immutable audit entries to event_log
    const auditEvents: Array<{
      event_type: string;
      entity_type: string;
      entity_id: string;
      actor_role: string;
      payload_json: Json;
    }> = [
      {
        event_type: "SENT_TO_FACILITY",
        entity_type: "recovery_transfers",
        entity_id: createdTransfer.id,
        actor_role: role,
        payload_json: {
          transfer_id: createdTransfer.id,
          facility_id: facility.id,
          facility_name: facility.name,
          transferred_weight_kg: totalBatchWeight,
          records_count: collection_record_ids.length,
          transferred_at: nowIso,
        },
      },
    ];

    if (breakdown.refurbished_pct > 0 || breakdown.recycled_pct > 0 || breakdown.residual_pct > 0) {
      auditEvents.push({
        event_type: "RECOVERY_RECORDED",
        entity_type: "recovery_transfers",
        entity_id: createdTransfer.id,
        actor_role: role,
        payload_json: {
          transfer_id: createdTransfer.id,
          facility_id: facility.id,
          facility_name: facility.name,
          transferred_weight_kg: totalBatchWeight,
          refurbished_kg: breakdown.refurbished_kg,
          recycled_kg: breakdown.recycled_kg,
          residual_kg: breakdown.residual_kg,
          recovery_rate_percent: breakdown.recovery_rate_percent,
          is_complete: breakdown.is_complete,
          recorded_at: nowIso,
        },
      });
    }

    await supabase.from("event_log").insert(auditEvents);

    return NextResponse.json({
      success: true,
      data: {
        transfer_id: createdTransfer.id,
        facility_name: facility.name,
        facility_type: facility.facility_type,
        total_weight_kg: totalBatchWeight,
        breakdown,
        new_request_status: newRequestStatus,
        records_transferred_count: collection_record_ids.length,
        transferred_at: nowIso,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("API /api/recovery/transfers error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
