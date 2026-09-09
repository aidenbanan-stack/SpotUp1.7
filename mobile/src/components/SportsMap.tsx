import { useSports } from "../lib/sports";
import React, { useEffect, useRef } from "react";
import MapView, { Marker } from "react-native-maps";
import { Game } from "../lib/types";
import { C, Icon } from "./ui";
export interface MapProps {
  games: Game[];
  center?: { latitude: number; longitude: number };
  onSelect: (game: Game) => void;
}
export default function SportsMap({ games, center, onSelect }: MapProps) {
  const SPORTS = useSports();
  const map = useRef<MapView>(null);
  const region =
    center ??
    (games[0]?.locations
      ? {
          latitude: games[0].locations.latitude,
          longitude: games[0].locations.longitude,
        }
      : null);
  useEffect(() => {
    if (region)
      map.current?.animateToRegion({
        ...region,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });
  }, [region?.latitude, region?.longitude]);
  if (!region) return null;
  return (
    <MapView
      style={{ height: 340, borderRadius: 22 }}
      ref={map}
      initialRegion={{ ...region, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      accessibilityLabel="Nearby sports games"
    >
      {games.map((g) => (
        <Marker
          key={g.id}
          coordinate={{
            latitude: g.locations.latitude,
            longitude: g.locations.longitude,
          }}
          title={g.title}
          description={g.sport_id}
          onPress={() => onSelect(g)}
        >
          <Icon
            name={
              SPORTS.find((s) => s.id === g.sport_id)?.icon ?? "fitness-outline"
            }
            color={C.dark}
            size={36}
          />
        </Marker>
      ))}
    </MapView>
  );
}
