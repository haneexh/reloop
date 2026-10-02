"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  type PartnerLocation,
  PARTNER_TYPE_META,
} from "@/lib/partners-data";

interface DestinationMapProps {
  partners: PartnerLocation[];
  userLocation: { lat: number; lng: number; name?: string };
  selectedPartnerId: string | null;
  onSelectPartner: (partner: PartnerLocation) => void;
}

export default function DestinationMap({
  partners,
  userLocation,
  selectedPartnerId,
  onSelectPartner,
}: DestinationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // 1. Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [userLocation.lat, userLocation.lng],
      zoom: 12,
      zoomControl: false,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // OpenStreetMap standard tile layer with proper attribution
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIconHtml = `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: rgba(59, 130, 246, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 3px; border-radius: 9999px; background-color: #2563eb; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.25);"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userIconHtml,
      className: "custom-user-location-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; padding: 2px 0;">
          <strong style="color: #09090b; display: block; margin-bottom: 2px;">Your Location</strong>
          <span style="color: #71717a; font-size: 11px;">${userLocation.name || "Approximate center"}</span>
        </div>`
      );

    userMarkerRef.current = userMarker;
  }, [userLocation.lat, userLocation.lng, userLocation.name]);

  // 3. Update Partner Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerMapRef.current.clear();

    const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);

    partners.forEach((partner) => {
      const meta = PARTNER_TYPE_META[partner.partner_type];
      const isInformal = meta.classification === "Informal";
      const isSelected = partner.id === selectedPartnerId;

      // Color-coded custom pin icon
      const markerHtml = `
        <div style="
          width: ${isSelected ? "32px" : "26px"};
          height: ${isSelected ? "32px" : "26px"};
          border-radius: 9999px;
          background-color: ${meta.colorHex};
          border: ${isInformal ? "2px dashed #ffffff" : "2px solid #ffffff"};
          box-shadow: ${isSelected ? "0 0 0 3px #09090b, 0 4px 6px rgba(0,0,0,0.3)" : "0 2px 4px rgba(0,0,0,0.25)"};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: ${isSelected ? "12px" : "10px"};
          font-family: sans-serif;
          cursor: pointer;
          transition: transform 0.15s ease;
        ">
          ${isInformal ? "★" : partner.partner_type[0].toUpperCase()}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-partner-marker",
        iconSize: isSelected ? [32, 32] : [26, 26],
        iconAnchor: isSelected ? [16, 16] : [13, 13],
      });

      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; min-width: 190px; padding: 2px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 1px 5px; border-radius: 3px; background-color: ${meta.colorHex}; color: #ffffff;">
              ${meta.label}
            </span>
            <span style="font-size: 10px; font-family: monospace; color: #71717a; border: 1px solid #e4e4e7; padding: 1px 4px; border-radius: 3px;">
              ${meta.classification}
            </span>
          </div>

          <strong style="color: #09090b; font-size: 13px; display: block; margin-bottom: 3px; line-height: 1.3;">
            ${partner.name}
          </strong>

          <div style="color: #52525b; font-size: 11px; margin-bottom: 6px; font-family: monospace;">
            📍 ${partner.distanceKm !== undefined ? `${partner.distanceKm} km away` : partner.city}
          </div>

          ${
            partner.contact
              ? `<div style="color: #71717a; font-size: 10.5px; margin-bottom: 8px; line-height: 1.3; border-top: 1px solid #f4f4f5; padding-top: 4px;">
                  ${partner.contact}
                </div>`
              : ""
          }

          <a 
            href="https://www.google.com/maps/dir/?api=1&destination=${partner.lat},${partner.lng}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-block;
              width: 100%;
              text-align: center;
              background-color: #09090b;
              color: #ffffff;
              text-decoration: none;
              font-weight: 600;
              font-size: 11px;
              padding: 5px 8px;
              border-radius: 4px;
              box-sizing: border-box;
            "
          >
            Get Directions &rarr;
          </a>
        </div>
      `;

      const marker = L.marker([partner.lat, partner.lng], { icon: customIcon })
        .addTo(layerGroup)
        .bindPopup(popupHtml, { closeButton: true, offset: [0, -8] });

      marker.on("click", () => {
        onSelectPartner(partner);
      });

      markerMapRef.current.set(partner.id, marker);
      bounds.extend([partner.lat, partner.lng]);
    });

    // If there are partners and user hasn't selected a specific one, fit bounds with padding
    if (partners.length > 0 && !selectedPartnerId) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [partners, selectedPartnerId, userLocation.lat, userLocation.lng, onSelectPartner]);

  // 4. Fly to selected partner
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPartnerId) return;

    const marker = markerMapRef.current.get(selectedPartnerId);
    const partner = partners.find((p) => p.id === selectedPartnerId);

    if (partner && marker) {
      map.flyTo([partner.lat, partner.lng], 14, { duration: 0.8 });
      marker.openPopup();
    }
  }, [selectedPartnerId, partners]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
      <div ref={mapContainerRef} className="h-full w-full z-0 min-h-[420px]" />
    </div>
  );
}
