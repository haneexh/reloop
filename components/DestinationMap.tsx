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
  userLocation?: { lat: number; lng: number; name?: string } | null;
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

    const initialCenter: [number, number] = userLocation
      ? [userLocation.lat, userLocation.lng]
      : partners.length > 0
      ? [partners[0].lat, partners[0].lng]
      : [17.4486, 78.3908];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: false,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // OpenStreetMap standard tile layer with proper attribution and crossOrigin
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      crossOrigin: true,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Trigger immediate & deferred size invalidations to ensure full tile coverage
    map.invalidateSize();
    const t1 = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    const t2 = setTimeout(() => {
      map.invalidateSize();
    }, 450);

    // Observer to re-calculate tiles whenever parent grid/column resizes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (resizeObserver) resizeObserver.disconnect();
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
      userMarkerRef.current = null;
    }

    if (!userLocation) return;

    const userIconHtml = `
      <div style="position: relative; width: 22px; height: 22px;">
        <div style="position: absolute; inset: 0; border-radius: 2px; background-color: rgba(61, 90, 76, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; inset: 2px; border-radius: 2px; background-color: #2e7d57; border: 2px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userIconHtml,
      className: "custom-user-location-marker",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; padding: 2px 0;">
          <strong style="color: #151817; display: block; margin-bottom: 2px;">Your Origin Location</strong>
          <span style="color: #6b746e; font-family: monospace; font-size: 10px;">${userLocation.name || "Approximate center"}</span>
        </div>`
      );

    userMarkerRef.current = userMarker;
  }, [userLocation]);

  // 3. Update Partner Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markerMapRef.current.clear();

    if (partners.length === 0 && !userLocation) return;

    partners.forEach((partner) => {
      const meta = PARTNER_TYPE_META[partner.partner_type];
      const isInformal = meta.classification === "Informal";
      const isSelected = partner.id === selectedPartnerId;

      const markerHtml = `
        <div style="
          width: ${isSelected ? "30px" : "24px"};
          height: ${isSelected ? "30px" : "24px"};
          border-radius: 2px;
          background-color: ${meta.colorHex};
          border: ${isInformal ? "1px dashed #ffffff" : "1px solid #ffffff"};
          box-shadow: ${isSelected ? "0 0 0 2px #151817, 0 3px 6px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.2)"};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: ${isSelected ? "11px" : "9px"};
          font-family: monospace;
          cursor: pointer;
        ">
          ${isInformal ? "INF" : partner.partner_type.slice(0, 3).toUpperCase()}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-partner-marker",
        iconSize: isSelected ? [30, 30] : [24, 24],
        iconAnchor: isSelected ? [15, 15] : [12, 12],
      });

      const popupHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11.5px; min-width: 200px; padding: 2px 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
            <div style="display: flex; items-center; gap: 4px;">
              <span style="font-size: 9px; font-weight: 700; font-family: monospace; text-transform: uppercase; padding: 1px 4px; border-radius: 2px; background-color: ${meta.colorHex}; color: #ffffff;">
                ${meta.label}
              </span>
              <span style="font-size: 9px; font-family: monospace; color: #6b746e; border: 1px solid #d8ddd7; padding: 1px 3px; border-radius: 2px;">
                ${meta.classification}
              </span>
            </div>
            <span style="font-size: 8.5px; font-family: monospace; font-weight: 600; padding: 1px 3px; border-radius: 2px; ${
              partner.isLiveOsm
                ? "background-color: #e6f4ea; color: #137333; border: 1px solid #ceead6;"
                : "background-color: #f4f5f1; color: #2e7d57; border: 1px solid #d8ddd7;"
            }">
              ${partner.isLiveOsm ? "● LIVE OSM" : "[VERIFIED]"}
            </span>
          </div>

          <strong style="color: #151817; font-size: 12px; display: block; margin-bottom: 3px; line-height: 1.3;">
            ${partner.name}
          </strong>

          <div style="color: #6b746e; font-size: 10.5px; margin-bottom: 6px; font-family: monospace;">
            Distance: ${partner.distanceKm !== undefined ? `${partner.distanceKm} km` : "Unsorted"} | ${partner.city}
          </div>

          ${
            partner.contact
              ? `<div style="color: #6b746e; font-size: 10px; margin-bottom: 8px; line-height: 1.3; border-top: 1px solid #e9ede7; padding-top: 4px; font-family: monospace;">
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
              background-color: #2e7d57;
              color: #ffffff;
              text-decoration: none;
              font-weight: 600;
              font-size: 10.5px;
              padding: 4px 6px;
              border-radius: 2px;
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
    });

    // When framing the map view, prioritize local partners in the user's metropolitan area
    // (avoid zooming out to the entire subcontinent when distant fallback partners exist)
    const localPartners = userLocation
      ? partners.filter((p) => (p.distanceKm ?? 999) <= 40)
      : partners;

    const framingTargets = localPartners.length > 0 ? localPartners : partners.slice(0, 5);

    if (framingTargets.length > 0 && !selectedPartnerId) {
      const framingBounds = userLocation
        ? L.latLngBounds([[userLocation.lat, userLocation.lng]])
        : L.latLngBounds([[framingTargets[0].lat, framingTargets[0].lng]]);

      framingTargets.forEach((partner) => {
        framingBounds.extend([partner.lat, partner.lng]);
      });

      if (framingTargets.length <= 1 && userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 12);
      } else {
        map.fitBounds(framingBounds, { padding: [40, 40], maxZoom: 13 });
      }
      setTimeout(() => map.invalidateSize(), 100);
    }
  }, [partners, selectedPartnerId, userLocation, onSelectPartner]);

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
    <div className="relative h-full w-full overflow-hidden rounded-sm border border-[#d8ddd7] bg-[#f2efe9]">
      <div
        ref={mapContainerRef}
        className="h-full w-full z-0 min-h-[440px]"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
