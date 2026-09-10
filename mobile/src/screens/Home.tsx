import { useSports } from "../lib/sports";
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  C,
  Chips,
  Empty,
  ErrorBox,
  Header,
  Icon,
  IconButton,
  Loading,
  Row,
  Screen,
  Section,
  Tag,
  Txt,
} from "../components/ui";
import GameCard from "../components/GameCard";
import { rows, rpc } from "../lib/supabase";
import { useMe, useSession } from "../lib/session";
import { Game, Summary } from "../lib/types";
import { useRealtime } from "../lib/hooks";
export const GAME_SELECT =
  "*,locations(*),profiles!games_host_id_fkey(*),game_players(*)";
export default function Home() {
  const SPORTS = useSports();
  const { data: me } = useMe();
  const { session } = useSession();
  const [sport, setSport] = useState("all");
  useRealtime("games");
  const games = useQuery({
    queryKey: ["games", sport],
    queryFn: () =>
      rows<Game>(
        "games",
        GAME_SELECT,
        { status: "upcoming", ...(sport === "all" ? {} : { sport_id: sport }) },
        "starts_at",
      ),
  });
  const summary = useQuery({
    queryKey: ["summary", session?.user.id],
    queryFn: () => rpc<Summary>("player_summary", { uid: session!.user.id }),
  });
  const upcoming = (games.data ?? [])
    .filter((g) => new Date(g.starts_at) > new Date())
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return (
    <Screen
      refresh={() => {
        games.refetch();
        summary.refetch();
      }}
      refreshing={games.isRefetching}
    >
      <Header
        eyebrow={me?.city || "YOUR SPORTS COMMUNITY"}
        title={`Let’s play${me?.name ? ", " + me.name.split(" ")[0] : ""}.`}
        right={
          <Row>
            <IconButton
              name="chatbubbles-outline"
              label="Friends and messages"
              onPress={() => router.push("/friends")}
            />
            <IconButton
              name="notifications-outline"
              label="Notifications"
              onPress={() => router.push("/notifications")}
            />
          </Row>
        }
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            title="Find a game"
            icon="location-outline"
            onPress={() => router.push("/map")}
          />
        </View>
        <Button
          title="Host"
          kind="secondary"
          icon="add"
          onPress={() => router.push("/create")}
        />
      </Row>
      {summary.data && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>
              Level {summary.data.level} · {summary.data.xp} XP
            </Txt>
            <Button
              title="Progress"
              kind="ghost"
              onPress={() => router.push("/progress")}
            />
          </Row>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 250,
              now: summary.data.xp % 250,
            }}
            style={{ height: 6, backgroundColor: C.soft, borderRadius: 4 }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 4,
                backgroundColor: C.blue,
                width: `${((summary.data.xp % 250) / 250) * 100}%`,
              }}
            />
          </View>
          <Txt size={12} color={C.muted}>
            {250 - (summary.data.xp % 250)} XP to level {summary.data.level + 1}{" "}
            · {summary.data.games} games played
          </Txt>
          <Txt size={12} color={C.muted}>
            Earn XP by showing up and playing. Confirmed games build your
            reliability.
          </Txt>
        </Card>
      )}
      <ErrorBox error={summary.error} />
      <Section title="Games near you" />
      <Chips
        items={[{ id: "all", name: "All sports" }, ...SPORTS]}
        value={sport}
        onChange={setSport}
      />
      {games.isLoading ? (
        <Loading />
      ) : (
        <ErrorBox error={games.error} retry={() => games.refetch()} />
      )}
      {upcoming.length
        ? upcoming.slice(0, 12).map((g) => <GameCard key={g.id} game={g} />)
        : !games.isLoading &&
          !games.error && (
            <Empty
              title="Be the first to get a game going"
              body="Your area starts with you. Host a game, invite a few friends, and build a regular run."
              action={
                <Button
                  title="Create a game"
                  icon="add"
                  onPress={() => router.push("/create")}
                />
              }
            />
          )}
    </Screen>
  );
}
