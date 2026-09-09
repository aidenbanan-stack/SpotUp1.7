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
          <IconButton
            name="notifications-outline"
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />
        }
      />
      <View
        style={{
          backgroundColor: C.dark,
          borderWidth: 1, borderColor: C.line,
          borderRadius: 25,
          padding: 25,
          gap: 18,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -50,
            top: -35,
            width: 230,
            height: 230,
            borderWidth: 2,
            borderColor: "#28433A",
            borderRadius: 120,
          }}
        />
        <Tag color={C.lime}>REAL PLAYERS. REAL GAMES.</Tag>
        <Txt
          size={32}
          color="white"
          bold
          style={{ maxWidth: 260, letterSpacing: -1 }}
        >
          Less watching.{"\n"}More playing.
        </Txt>
        <Txt color="#C2D0BE" size={14}>
          A place, a few players, a reason to show up.
        </Txt>
        <Row>
          <Button
            title="Find a game"
            icon="location-outline"
            onPress={() => router.push("/map")}
          />
          <Button
            title="Host"
            kind="secondary"
            icon="add"
            onPress={() => router.push("/create")}
          />
        </Row>
      </View>
      <Row>
        {[
          ["Games played", summary.data?.games ?? 0],
          ["Participation XP", summary.data?.xp ?? 0],
          [
            "Reliability",
            summary.data?.reliability == null
              ? "New"
              : summary.data.reliability + "%",
          ],
        ].map(([label, value]) => (
          <Card key={label} style={{ flex: 1, padding: 12 }}>
            <Txt size={23} bold>
              {value}
            </Txt>
            <Txt size={10} color={C.muted}>
              {label}
            </Txt>
          </Card>
        ))}
      </Row>
      <Row style={{ flexWrap: "wrap" }}>
        <Button
          title="Squads"
          kind="secondary"
          icon="people-outline"
          onPress={() => router.push("/squads")}
        />
        <Button
          title="Compete"
          kind="secondary"
          icon="trophy-outline"
          onPress={() => router.push("/tournaments")}
        />
        <Button
          title="Clips"
          kind="secondary"
          icon="play-circle-outline"
          onPress={() => router.push("/feed")}
        />
        <Button
          title="Search"
          kind="ghost"
          icon="search"
          onPress={() => router.push("/search")}
        />
      </Row>
      <Section title="The next game is yours" />
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
      <Card>
        <Row>
          <Icon name="videocam-outline" />
          <Txt size={19} bold>
            More than a highlight
          </Txt>
        </Row>
        <Txt color={C.muted}>
          Meet the players behind the moments. Discover sports clips, then find
          somewhere to play together.
        </Txt>
        <Button
          title="Explore the community"
          kind="secondary"
          onPress={() => router.push("/feed")}
        />
      </Card>
    </Screen>
  );
}
