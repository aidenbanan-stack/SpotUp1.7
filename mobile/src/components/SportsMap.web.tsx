import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "./leaflet.web.css";
import { Txt, C } from "./ui";
import type { MapProps } from "./SportsMap";

export default function SportsMap({ games, center, onSelect }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        map.current = L.map(container.current).setView([20, 0], 2);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => setFailed(true))
          .addTo(map.current);
        markers.current = L.layerGroup().addTo(map.current);
        observer = new ResizeObserver(() => map.current?.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !markers.current) return;
      markers.current.clearLayers();
      games.forEach((game) => {
        const venue = game.locations;
        if (!venue) return;
        const label = document.createElement("span");
        label.textContent = `${game.title} · ${game.sport_id.replaceAll("-", " ")}`;
        L.circleMarker([venue.latitude, venue.longitude], {
          radius: 12,
          color: "#152E22",
          fillColor: "#D5F45B",
          fillOpacity: 1,
          weight: 3,
        })
          .bindTooltip(label)
          .on("click", () => select.current(game))
          .addTo(markers.current!);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [games, ready]);
  const latitude = center?.latitude ?? games[0]?.locations?.latitude;
  const longitude = center?.longitude ?? games[0]?.locations?.longitude;
  useEffect(() => {
    if (ready && latitude != null && longitude != null)
      map.current?.setView([latitude, longitude], 12);
  }, [ready, latitude, longitude]);
  return (
    <>
      <div
        ref={container}
        role="region"
        aria-label="Interactive map of pickup sports games"
        style={{ height: 340, width: "100%", borderRadius: 22, zIndex: 0 }}
      />
      {failed && (
        <Txt color={C.muted}>
          Map tiles could not load. Check your connection; the game list and
          directions remain available below.
        </Txt>
      )}
    </>
  );
}
