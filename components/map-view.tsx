"use client";

import { useEffect, useRef, useState } from "react";
import type { Match } from "@/lib/matching";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  matches: Match[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  formatPrice: (usd: number) => string;
  maptilerKey?: string;
};

export function MapView({ matches, selectedId, onSelect, formatPrice, maptilerKey }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const userMarker = useRef<Marker | null>(null);
  const userAccuracy = useRef<Circle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    let active = true;
    setReady(false);
    setFailed(false);
    import("leaflet").then((L) => {
      if (!active || !container.current) return;
      try {
        const instance = L.map(container.current, {
          zoomControl: false,
          scrollWheelZoom: true,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          worldCopyJump: true,
        }).setView([22, 10], 2);
        const tileUrl = maptilerKey
          ? `https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}.png?key=${encodeURIComponent(maptilerKey)}`
          : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
        L.tileLayer(tileUrl, {
          attribution: maptilerKey
            ? '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>'
            : '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
          maxZoom: 19,
          crossOrigin: true,
        }).addTo(instance);
        L.control.zoom({ position: "topright" }).addTo(instance);
        map.current = instance;
        setReady(true);
      } catch (error) { console.error("Map initialization failed", error); setFailed(true); }
    }).catch((error) => { console.error("Map library unavailable", error); setFailed(true); });
    return () => { active = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; map.current?.remove(); map.current = null; };
  }, [maptilerKey]);

  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !map.current) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = matches.map(({ hotel }) => {
        const icon = L.divIcon({
          className: "hotel-pin-wrap", iconSize: [80, 48], iconAnchor: [40, 48],
          html: '<button type="button" class="hotel-pin"><span class="hotel-pin-price"></span><span class="hotel-pin-rating"></span></button>',
        });
        const marker = L.marker([hotel.latitude, hotel.longitude], { icon, keyboard: false }).addTo(map.current!);
        const pin = marker.getElement()?.querySelector("button");
        if (pin) {
          pin.querySelector(".hotel-pin-price")!.textContent = hotel.estimated_price_per_night > 0 ? formatPrice(hotel.estimated_price_per_night) : "See rate";
          pin.querySelector(".hotel-pin-rating")!.textContent = `★ ${hotel.rating.toFixed(1)}`;
          pin.setAttribute("aria-label", `${hotel.name}, ${hotel.estimated_price_per_night > 0 ? `${formatPrice(hotel.estimated_price_per_night)} per night` : "rate not shown"}, rated ${hotel.rating.toFixed(1)}`);
          pin.classList.toggle("hotel-pin-selected", hotel.id === selectedIdRef.current);
          pin.addEventListener("click", () => onSelectRef.current(hotel.id));
        }
        return marker;
      });
      if (matches.length === 1) {
        map.current.setView([matches[0].hotel.latitude, matches[0].hotel.longitude], 11);
      } else if (matches.length > 1) {
        map.current.fitBounds(L.latLngBounds(matches.map(({ hotel }) => [hotel.latitude, hotel.longitude])), { padding: [65, 65], maxZoom: 12, animate: true });
      }
    }).catch((error) => { console.error("Map pins unavailable", error); setFailed(true); });
    return () => { disposed = true; };
  }, [ready, matches, formatPrice]);

  useEffect(() => {
    if (!ready || !map.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    let disposed = false;
    let watchId: number | null = null;
    import("leaflet").then((L) => {
      if (disposed || !map.current) return;
      const icon = L.divIcon({
        className: "user-location-wrap", iconSize: [22, 22], iconAnchor: [11, 11],
        html: '<span class="user-location-dot"><span class="user-location-pulse"></span></span>',
      });
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (disposed || !map.current) return;
          const { latitude, longitude, accuracy } = position.coords;
          if (!userMarker.current) {
            userMarker.current = L.marker([latitude, longitude], { icon, keyboard: false, zIndexOffset: 1000 }).addTo(map.current);
          } else {
            userMarker.current.setLatLng([latitude, longitude]);
          }
          if (!userAccuracy.current) {
            userAccuracy.current = L.circle([latitude, longitude], {
              radius: accuracy, color: "#2f6a82", fillColor: "#2f6a82", fillOpacity: 0.12, weight: 1,
            }).addTo(map.current);
          } else {
            userAccuracy.current.setLatLng([latitude, longitude]);
            userAccuracy.current.setRadius(accuracy);
          }
        },
        (error) => { console.debug("Geolocation unavailable; using default map location."); },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    }).catch((error) => { console.error("Map library unavailable", error); });
    return () => {
      disposed = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      userMarker.current?.remove(); userMarker.current = null;
      userAccuracy.current?.remove(); userAccuracy.current = null;
    };
  }, [ready]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    markers.current.forEach((marker) => {
      marker.getElement()?.querySelector("button")?.classList.toggle("hotel-pin-selected", matches.some(({ hotel }) => hotel.id === selectedId && hotel.latitude === marker.getLatLng().lat && hotel.longitude === marker.getLatLng().lng));
    });
    if (selectedId && matches.length < 5) {
      const selected = matches.find(({ hotel }) => hotel.id === selectedId)?.hotel;

      if (
        selected &&
        Number.isFinite(Number(selected.latitude)) &&
        Number.isFinite(Number(selected.longitude))
      ) {
        map.current?.flyTo(
          [Number(selected.latitude), Number(selected.longitude)],
          Math.max(map.current.getZoom(), 10),
          { duration: 0.6 },
        );
      }
    }
  }, [selectedId, matches]);

  return <div className="map-canvas-wrap">
    <div className="map-canvas" ref={container} role="application" aria-label="Map of matching hotels" />
    {!ready && !failed && <div className="map-loading">Loading the map…</div>}
    {failed && <div className="map-loading">The map could not load. Switch to List to browse the stays.</div>}
    {ready && !failed && matches.length === 0 && <div className="map-empty-state" role="status">No hotels to map yet. Add hotels to your catalog or try another search.</div>}
  </div>;
}
