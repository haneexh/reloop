"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OptimizedRoute, RouteStop } from "@/lib/route-optimizer";
import { ZoneSpatialDemand } from "@/lib/demand-engine";

interface DispatchRouteMapProps {
  routes: OptimizedRoute[];
  zones?: ZoneSpatialDemand[];
  selectedVehicleId?: string | null;
  onSelectRoute?: (vehicleId: string) => void;
}

const ROUTE_PALETTE = [
  "#2e7d57", // Emerald
  "#2563eb", // Blue
  "#d97706", // Amber
  "#7c3aed", // Purple
  "#db2777", // Pink
  "#0d9488", // Teal
];

export default function DispatchRouteMap({
  routes,
  zones = [],
  selectedVehicleId,
  onSelectRoute,
}: DispatchRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [17.4486, 78.3908]; // Central Hyderabad

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      crossOrigin: true,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    layersGroupRef.current = group;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Layers when routes or zones change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Draw Municipal Zone Boundaries
    for (const z of zones) {
      if (!z.center_lat || !z.center_lng) continue;

      const circle = L.circle([z.center_lat, z.center_lng], {
        radius: (z.radius_km || 4.5) * 1000,
        color: "#94a3b8",
        weight: 1,
        dashArray: "4, 6",
        fillColor: "#e2e8f0",
        fillOpacity: 0.12,
      });

      circle.bindTooltip(
        `<strong>${z.zone_code}</strong>: ${z.zone_name}<br/>Active Requests: ${z.request_count} (${z.total_estimated_weight_kg} kg)`,
        { permanent: false, direction: "center" }
      );

      group.addLayer(circle);
    }

    const allLatLngs: L.LatLngExpression[] = [];

    // 2. Draw Routes & Stops
    routes.forEach((route, rIdx) => {
      const color = ROUTE_PALETTE[rIdx % ROUTE_PALETTE.length];
      const isSelected = !selectedVehicleId || selectedVehicleId === route.vehicle_id;
      const opacity = isSelected ? 1.0 : 0.35;
      const weight = isSelected ? 4 : 2;

      const routePoints: [number, number][] = [];

      route.stops.forEach((stop: RouteStop) => {
        routePoints.push([stop.lat, stop.lng]);
        allLatLngs.push([stop.lat, stop.lng]);

        if (stop.stop_type === "DEPOT_DEPARTURE" || stop.stop_type === "DEPOT_RETURN") {
          // Depot Marker (rendered once on departure)
          if (stop.stop_type === "DEPOT_DEPARTURE") {
            const depotIcon = L.divIcon({
              className: "custom-depot-marker",
              html: `
                <div style="
                  background-color: #151817;
                  color: #ffffff;
                  padding: 3px 6px;
                  font-family: monospace;
                  font-size: 10px;
                  font-weight: bold;
                  border-radius: 2px;
                  border: 2px solid ${color};
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                  white-space: nowrap;
                ">
                  DEPOT [${route.vehicle_code}]
                </div>
              `,
              iconAnchor: [30, 12],
            });

            const marker = L.marker([stop.lat, stop.lng], { icon: depotIcon });
            marker.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px;">
                <strong>${route.depot_name}</strong><br/>
                Vehicle: <b>${route.vehicle_code}</b> (${route.vehicle_type})<br/>
                Fleet Capacity: ${route.capacity_kg} kg
              </div>
            `);
            group.addLayer(marker);
          }
        } else {
          // Numbered Collection Stop
          const stopIcon = L.divIcon({
            className: "custom-stop-marker",
            html: `
              <div style="
                background-color: ${color};
                color: #ffffff;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                border-radius: 50%;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">
                ${stop.sequence}
              </div>
            `,
            iconAnchor: [11, 11],
          });

          const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon });
          marker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <div style="font-weight: bold; font-family: monospace; color: ${color};">
                STOP #${stop.sequence} — ${route.vehicle_code}
              </div>
              <div style="margin-top: 4px;">
                <b>Est. Load:</b> ${stop.estimated_weight_kg} kg<br/>
                <b>Priority:</b> <span style="text-transform: uppercase;">${stop.priority || "normal"}</span><br/>
                <b>Time Window:</b> ${stop.pickup_slot || "Regular Route"}<br/>
                <b>Route Progress:</b> ${stop.cumulative_distance_km} km / ${stop.cumulative_load_kg} kg
              </div>
            </div>
          `);
          group.addLayer(marker);
        }
      });

      // Polyline for route traversal
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color,
          weight,
          opacity,
          dashArray: isSelected ? undefined : "6, 6",
        });

        polyline.bindTooltip(
          `<strong>${route.vehicle_code}</strong>: ${route.total_distance_km} km · ${route.stops_count} stops (${route.total_load_kg} kg)`,
          { sticky: true }
        );

        if (onSelectRoute) {
          polyline.on("click", () => onSelectRoute(route.vehicle_id));
        }

        group.addLayer(polyline);
      }
    });

    // Fit map bounds if stops exist
    if (allLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 });
    }
  }, [routes, zones, selectedVehicleId, onSelectRoute]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-sm border border-[#d8ddd7] overflow-hidden bg-[#e9ede7]">
      <div ref={mapContainerRef} className="w-full h-full min-h-[420px] z-0" />
      <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-sm border border-[#d8ddd7] text-[10px] font-mono text-[#6b746e]">
        HAWAIIAN/HAVERSINE ESTIMATED DISTANCE · DISPATCH OPS VIEW
      </div>
    </div>
  );
}
