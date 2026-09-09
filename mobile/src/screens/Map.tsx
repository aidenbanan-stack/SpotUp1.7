import { useSports } from "../lib/sports";
import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import {
  Button,
  Chips,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  Screen,
  Txt,
  C,
} from "../components/ui";
import SportsMap from "../components/SportsMap";
import GameCard from "../components/GameCard";
import { rows } from "../lib/supabase";
import { Game } from "../lib/types";
import { distanceKm } from "../lib/domain";
import { GAME_SELECT } from "./Home";
export default function Map() {
  const SPORTS = useSports();
  const params = useLocalSearchParams<{ sport?: string }>();
  const [sport, setSport] = useState(params.sport ?? "all");
  const [search, setSearch] = useState("");
  const [radius, setRadius] = useState("10");
  const [center, setCenter] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const [selected, setSelected] = useState<Game>();
  const [error, setError] = useState<unknown>();
  const [locating, setLocating] = useState(false);
  const q = useQuery({
    queryKey: ["mapGames"],
    queryFn: () =>
      rows<Game>(
        "games",
        GAME_SELECT,
        { status: "upcoming" },
        "starts_at",
        200,
      ),
  });
  async function locate() {
    setLocating(true);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted)
        throw Error(
          "Search by venue or city instead, or enable location in your device settings.",
        );
      const l = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCenter(l.coords);
      setError(undefined);
    } catch (e) {
      setError(e);
    } finally {
      setLocating(false);
    }
  }
  const games = (q.data ?? [])
    .filter(
      (g) =>
        new Date(g.starts_at) > new Date() &&
        (sport === "all" || sport === g.sport_id) &&
        `${g.title} ${g.locations.name} ${g.locations.address}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!center ||
          distanceKm(
            center.latitude,
            center.longitude,
            g.locations.latitude,
            g.locations.longitude,
          ) <= Number(radius)),
    )
    .sort((a, b) =>
      center
        ? distanceKm(
            center.latitude,
            center.longitude,
            a.locations.latitude,
            a.locations.longitude,
          ) -
          distanceKm(
            center.latitude,
            center.longitude,
            b.locations.latitude,
            b.locations.longitude,
          )
        : Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
  return (
    <Screen>
      <Header eyebrow="FIND YOUR SPOT" title="Where’s the game?" />
      <Field
        label="Search city, neighborhood, or venue"
        placeholder="Where do you want to play?"
        value={search}
        onChangeText={setSearch}
      />
      <Chips
        items={[{ id: "all", name: "All sports" }, ...SPORTS]}
        value={sport}
        onChange={setSport}
      />
      <Button
        title="Games near me"
        icon="navigate-outline"
        kind="secondary"
        loading={locating}
        onPress={locate}
      />
      {center && (
        <Chips
          items={["5", "10", "25", "50", "100"].map((id) => ({
            id,
            name: id + " km",
          }))}
          value={radius}
          onChange={setRadius}
        />
      )}
      <ErrorBox error={error || q.error} retry={() => q.refetch()} />
      {q.isLoading && <Loading />}
      <SportsMap games={games} center={center} onSelect={setSelected} />
      {selected && games.some((g) => g.id === selected.id) && (
        <GameCard game={selected} />
      )}
      <Txt color={C.muted}>{games.length} games match your filters</Txt>
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
      {!games.length && !q.isLoading && !q.error && (
        <Empty
          title="Give your area a reason to play"
          body="Try a wider radius, another sport, or start a game of your own."
          action={
            <Button
              title="Host a game"
              onPress={() => router.push("/create")}
            />
          }
        />
      )}
    </Screen>
  );
}
