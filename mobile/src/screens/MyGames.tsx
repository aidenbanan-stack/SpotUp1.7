import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  Chips,
  Empty,
  ErrorBox,
  Header,
  Loading,
  Screen,
} from "../components/ui";
import GameCard from "../components/GameCard";
import { Game } from "../lib/types";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { GAME_SELECT } from "./Home";
export default function MyGames() {
  const { session } = useSession();
  const [tab, setTab] = useState("upcoming");
  const query = useQuery({
    queryKey: ["myGames", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select("games(" + GAME_SELECT + ")")
        .eq("user_id", session!.user.id)
        .order("joined_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as { games: Game }[])
        .map((d) => d.games)
        .filter(Boolean) as unknown as Game[];
    },
  });
  const games =
    query.data?.filter((g) =>
      tab === "hosting"
        ? g.host_id === session?.user.id
        : tab === "upcoming"
          ? ["upcoming", "live"].includes(g.status)
          : ["completed", "cancelled"].includes(g.status),
    ) ?? [];
  return (
    <Screen refresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Header eyebrow="SHOWING UP IS YOUR SUPERPOWER" title="My games" />
      <Chips
        items={[
          { id: "upcoming", name: "Upcoming" },
          { id: "hosting", name: "Hosting" },
          { id: "past", name: "Past games" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {query.isLoading && <Loading />}
      <ErrorBox error={query.error} retry={() => query.refetch()} />
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
      {!games.length && !query.isLoading && !query.error && (
        <Empty
          title="Your next game is out there"
          body="Games you join and host will appear here, along with your participation history."
          action={
            <Button title="Find a game" onPress={() => router.push("/map")} />
          }
        />
      )}
    </Screen>
  );
}
