import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { enforceOperatorRole } from "@/lib/operator-auth";
import type { Json } from "@/types/database";
import {
  isAuthorizedCollector,
  calculateRouteProgress,
  maskAddressForCollector,
  RouteStopDetail,
} from "@/lib/collector-engine";

interface RawStop {
  sequence?: number;
  request_id?: string | null;
  stop_type: "COLLECTION_STOP" | "DEPOT_DEPARTURE" | "DEPOT_RETURN" | string;
  lat?: number;
  lng?: number;
  estimated_weight_kg?: number;
  priority?: string;
  pickup_slot?: string | null;
}

interface RequestSummary {
  id: string;
  qr_token: string | null;
  status: string;
  priority: string;
  pickup_slot: string | null;
  address: string;
  notes: string | null;
  is_simulated: boolean;
}

interface CollectionRecordSummary {
  id: string;
  request_id: string;
  actual_weight_kg: number;
  verified_at: string;
  verification_method: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get("id");
    const role = req.headers.get("x-user-role") || searchParams.get("role") || "COLLECTOR";

    if (!isAuthorizedCollector(role)) {
      return NextResponse.json(
        { error: "Forbidden: Citizen role is not authorized for collector dispatch access." },
        { status: 403 }
      );
    }

    if (routeId) {
      // Fetch specific route details
      const { data: route, error: routeErr } = await supabase
        .from("collection_routes")
        .select(`
          id,
          vehicle_id,
          zone_id,
          route_date,
          status,
          total_distance_km,
          total_load_kg,
          estimated_duration_minutes,
          stops_json,
          created_at
        `)
        .eq("id", routeId)
        .single();

      if (routeErr || !route) {
        return NextResponse.json(
          { error: "Specified collection route not found." },
          { status: 404 }
        );
      }

      // Fetch vehicle details
      let vehicle = null;
      if (route.vehicle_id) {
        const { data: v } = await supabase
          .from("vehicles")
          .select("id, vehicle_code, capacity_kg, vehicle_type, status, depot_name")
          .eq("id", route.vehicle_id)
          .single();
        vehicle = v;
      }

      // Fetch zone details
      let zone = null;
      if (route.zone_id) {
        const { data: z } = await supabase
          .from("collection_zones")
          .select("id, name, code")
          .eq("id", route.zone_id)
          .single();
        zone = z;
      }

      const stops = Array.isArray(route.stops_json) ? (route.stops_json as unknown as RawStop[]) : [];
      const requestIds = stops
        .filter((s) => s.stop_type === "COLLECTION_STOP" && s.request_id)
        .map((s) => s.request_id as string);

      // Fetch collection requests details
      const requestsMap = new Map<string, RequestSummary>();
      if (requestIds.length > 0) {
        const { data: reqs } = await supabase
          .from("collection_requests")
          .select("id, qr_token, status, priority, pickup_slot, address, notes, is_simulated")
          .in("id", requestIds);

        if (reqs) {
          reqs.forEach((r) => requestsMap.set(r.id, r));
        }
      }

      // Fetch items summary for each request
      const itemsMap = new Map<string, string>();
      const aiItemsMap = new Map<
        string,
        { item_type: string; brand: string | null; pathway: string; confidence: number }
      >();

      if (requestIds.length > 0) {
        const { data: items } = await supabase
          .from("items")
          .select("request_id, item_type, brand, waste_avoided_kg, recommendations(recommended_action, confidence)")
          .in("request_id", requestIds);

        if (items) {
          const grouped = new Map<string, string[]>();
          items.forEach((it) => {
            if (it.request_id) {
              const list = grouped.get(it.request_id) || [];
              list.push(it.item_type || "E-Waste");
              grouped.set(it.request_id, list);

              if (it.recommendations) {
                const recList = Array.isArray(it.recommendations)
                  ? it.recommendations
                  : [it.recommendations];
                const rec = recList[0];
                if (rec && rec.recommended_action && !aiItemsMap.has(it.request_id)) {
                  aiItemsMap.set(it.request_id, {
                    item_type: it.item_type
                      ? it.item_type.charAt(0).toUpperCase() + it.item_type.slice(1)
                      : "Electronic Item",
                    brand: it.brand || null,
                    pathway: rec.recommended_action.toUpperCase(),
                    confidence: Number(rec.confidence) || 0.94,
                  });
                }
              }
            }
          });
          grouped.forEach((types, reqId) => {
            itemsMap.set(reqId, types.slice(0, 3).join(", ") + (types.length > 3 ? ` +${types.length - 3} more` : ""));
          });
        }
      }

      // Fetch existing collection records for these requests
      const recordsMap = new Map<string, CollectionRecordSummary>();
      const actualWeights = new Map<string, number>();
      const completedRequestIds = new Set<string>();

      if (requestIds.length > 0) {
        const { data: records } = await supabase
          .from("collection_records")
          .select("id, request_id, actual_weight_kg, verified_at, verification_method")
          .in("request_id", requestIds);

        if (records) {
          records.forEach((rec) => {
            recordsMap.set(rec.request_id, rec as CollectionRecordSummary);
            actualWeights.set(rec.request_id, Number(rec.actual_weight_kg) || 0);
            completedRequestIds.add(rec.request_id);
          });
        }
      }

      // Also consider requests with status 'collected' or 'weighed' as completed
      requestsMap.forEach((req, reqId) => {
        if (req.status === "collected" || req.status === "weighed") {
          completedRequestIds.add(reqId);
        }
      });

      // Construct enriched stop list
      const enrichedStops: RouteStopDetail[] = stops.map((s, idx) => {
        const req = s.request_id ? requestsMap.get(s.request_id) : null;
        const rec = s.request_id ? recordsMap.get(s.request_id) : null;
        const isCollected = s.request_id ? completedRequestIds.has(s.request_id) : false;
        const aiInfo = s.request_id ? aiItemsMap.get(s.request_id) : null;

        return {
          sequence: s.sequence || idx + 1,
          request_id: s.request_id || null,
          stop_type: (s.stop_type === "DEPOT_DEPARTURE" || s.stop_type === "DEPOT_RETURN"
            ? s.stop_type
            : "COLLECTION_STOP") as "COLLECTION_STOP" | "DEPOT_DEPARTURE" | "DEPOT_RETURN",
          lat: Number(s.lat),
          lng: Number(s.lng),
          estimated_weight_kg: Number(s.estimated_weight_kg) || 0,
          priority: req?.priority || s.priority || "normal",
          pickup_slot: req?.pickup_slot || s.pickup_slot || null,
          status: req?.status || (s.stop_type === "COLLECTION_STOP" ? "assigned" : "depot"),
          qr_token: req?.qr_token || null,
          locality: maskAddressForCollector(req?.address, zone?.name),
          items_summary: s.request_id ? itemsMap.get(s.request_id) || "E-Waste Parcel" : undefined,
          is_collected: isCollected,
          actual_weight_kg: rec ? Number(rec.actual_weight_kg) : null,
          collected_at: rec?.verified_at || null,
          ai_item_type: aiInfo?.item_type || null,
          ai_brand: aiInfo?.brand || null,
          ai_pathway: aiInfo?.pathway || null,
          ai_confidence: aiInfo?.confidence || null,
        };
      });

      const vehicleCapacity = Number(vehicle?.capacity_kg) || 100;
      const progress = calculateRouteProgress(
        stops,
        completedRequestIds,
        vehicleCapacity,
        actualWeights
      );

      return NextResponse.json({
        success: true,
        data: {
          route: {
            ...route,
            vehicle_code: vehicle?.vehicle_code || "UNASSIGNED",
            vehicle_capacity_kg: vehicleCapacity,
            vehicle_type: vehicle?.vehicle_type || "VAN",
            depot_name: vehicle?.depot_name || "Central Depot",
            zone_name: zone?.name || "Hyderabad",
            zone_code: zone?.code || "HYD",
          },
          stops: enrichedStops,
          progress,
        },
      });
    }

    // List active routes available for collector
    const { data: routes, error: listErr } = await supabase
      .from("collection_routes")
      .select(`
        id,
        vehicle_id,
        zone_id,
        route_date,
        status,
        total_distance_km,
        total_load_kg,
        estimated_duration_minutes,
        stops_json,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(20);

    if (listErr || !routes) {
      return NextResponse.json(
        { error: "Failed to list collection routes." },
        { status: 500 }
      );
    }

    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, vehicle_code, capacity_kg, vehicle_type, depot_name");
    const { data: zones } = await supabase
      .from("collection_zones")
      .select("id, name, code");

    const vehicleMap = new Map((vehicles || []).map((v) => [v.id, v]));
    const zoneMap = new Map((zones || []).map((z) => [z.id, z]));

    const routeList = routes.map((r) => {
      const v = r.vehicle_id ? vehicleMap.get(r.vehicle_id) : null;
      const z = r.zone_id ? zoneMap.get(r.zone_id) : null;
      const stops = Array.isArray(r.stops_json) ? (r.stops_json as unknown as RawStop[]) : [];
      const collectionStopsCount = stops.filter((s) => s.stop_type === "COLLECTION_STOP").length;

      return {
        id: r.id,
        route_date: r.route_date,
        status: r.status,
        stops_count: collectionStopsCount,
        total_load_kg: Number(r.total_load_kg) || 0,
        total_distance_km: Number(r.total_distance_km) || 0,
        vehicle_id: r.vehicle_id,
        vehicle_code: v?.vehicle_code || "UNASSIGNED",
        vehicle_capacity_kg: Number(v?.capacity_kg) || 0,
        depot_name: v?.depot_name || "Depot",
        zone_name: z?.name || null,
        zone_code: z?.code || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: routeList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CollectorRoutePatchSchema = z
  .object({
    route_id: z.string().uuid("route_id must be a valid UUID"),
    action: z.enum(["start_route", "complete_route", "skip_stop", "assign_stop"]),
    notes: z.string().optional(),
    actor_role: z.string().optional(),
    request_id: z.string().uuid().optional(),
    reason: z.string().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  try {
    // Enforce COLLECTOR or DISPATCHER role
    const authResult = enforceOperatorRole(req, ["COLLECTOR", "DISPATCHER"]);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    const rawJson = await req.json().catch(() => ({}));
    const parseResult = CollectorRoutePatchSchema.safeParse(rawJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload or unknown fields detected.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;
    const { route_id, action, notes } = body;
    const role = authResult.session.role;

    if (action === "start_route") {
      const { data: updatedRoute, error } = await supabase
        .from("collection_routes")
        .update({ status: "in_progress" })
        .eq("id", route_id)
        .select("id, status")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabase.from("event_log").insert({
        event_type: "ROUTE_STARTED",
        entity_type: "collection_routes",
        entity_id: route_id,
        actor_role: role,
        payload_json: { action: "start_route", timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, data: updatedRoute });
    }

    if (action === "assign_stop" && body.request_id) {
      const { data: routeData, error: routeErr } = await supabase
        .from("collection_routes")
        .select("id, stops_json")
        .eq("id", route_id)
        .single();

      if (routeErr || !routeData || !Array.isArray(routeData.stops_json)) {
        return NextResponse.json({ error: "Route not found or has no stops." }, { status: 404 });
      }

      const stops = [...routeData.stops_json] as Array<Record<string, unknown>>;
      const targetIdx = stops.findIndex(
        (s) => s.stop_type === "COLLECTION_STOP" && s.sequence === 1
      );

      if (targetIdx !== -1) {
        stops[targetIdx].request_id = body.request_id;
        const { error: updErr } = await supabase
          .from("collection_routes")
          .update({ stops_json: stops as unknown as Json })
          .eq("id", route_id);

        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }

        await supabase
          .from("collection_requests")
          .update({ status: "assigned" })
          .eq("id", body.request_id);

        await supabase.from("event_log").insert({
          event_type: "PICKUP_ASSIGNED",
          entity_type: "collection_requests",
          entity_id: body.request_id,
          actor_role: role,
          payload_json: { route_id, sequence: Number(stops[targetIdx].sequence) || 1 },
        });

        return NextResponse.json({ success: true, updated_stop: stops[targetIdx] });
      }
    }

    if (action === "complete_route") {
      const { data: updatedRoute, error } = await supabase
        .from("collection_routes")
        .update({ status: "completed" })
        .eq("id", route_id)
        .select("id, status")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabase.from("event_log").insert({
        event_type: "ROUTE_COMPLETED",
        entity_type: "collection_routes",
        entity_id: route_id,
        actor_role: role,
        payload_json: { action: "complete_route", timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true, data: updatedRoute });
    }

    if (action === "skip_stop") {
      const { request_id, reason } = body;
      if (!request_id || !reason) {
        return NextResponse.json(
          { error: "request_id and reason are required to skip stop." },
          { status: 400 }
        );
      }

      await supabase.from("event_log").insert({
        event_type: "STOP_DEFERRED",
        entity_type: "collection_requests",
        entity_id: request_id,
        actor_role: role,
        payload_json: {
          route_id,
          reason,
          notes: notes || null,
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Stop ${request_id} deferred with reason: ${reason}`,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
