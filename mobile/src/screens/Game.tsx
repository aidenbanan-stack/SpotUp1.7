import PlayerSearch from "../components/PlayerSearch";
import React, { useState } from "react";
import { View, Share, Linking, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  C,
  ErrorBox,
  Field,
  Header,
  Loading,
  Row,
  Screen,
  Section,
  Tag,
  Txt,
} from "../components/ui";
import { Game as GameType, Summary } from "../lib/types";
import { one, rpc, track, supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useAction, useRealtime } from "../lib/hooks";
import { formatDate } from "../lib/domain";
export default function Game() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const q = useQuery({
    queryKey: ["game", id],
    queryFn: () =>
      one<GameType>(
        "games",
        id,
        "*,locations(*),profiles!games_host_id_fkey(*),game_players(*,profiles(*))",
      ),
  });
  useRealtime("game_players", `game_id=eq.${id}`);
  useRealtime("games", `id=eq.${id}`);
  const action = useAction((v: { action: string; target?: string }) =>
    rpc("game_action", { gid: id, action: v.action, target: v.target ?? null }),
  );
  const vote = useAction((target: string) =>
    rpc("vote_player", { gid: id, target, category: "Sportsmanship" }),
  );
  const g = q.data;
  const host = g?.host_id === session?.user.id;
  const player = g?.game_players.find((p) => p.user_id === session?.user.id);
  if (q.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!g)
    return (
      <Screen>
        <ErrorBox
          error={q.error || Error("Game unavailable")}
          retry={() => q.refetch()}
        />
      </Screen>
    );
  return (
    <Screen refresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Tag>
        {g.sport_id.toUpperCase()} · {g.status.toUpperCase()}
      </Tag>
      <Header title={g.title} />
      <Card style={{ backgroundColor: C.dark }}>
        <Txt size={23} bold color="white">
          {g.locations.name}
        </Txt>
        <Txt color="#C6D3C4">{g.locations.address}</Txt>
        <Txt color="white">
          {formatDate(g.starts_at)} · {g.duration_minutes} min
        </Txt>
        <Row>
          <Tag color={C.blue}>{g.skill}</Tag>
          <Tag>{g.format}</Tag>
        </Row>
      </Card>
      <Row>
        <Button
          title="Directions"
          kind="secondary"
          onPress={() =>
            Linking.openURL(
              `https://www.google.com/maps/dir/?api=1&destination=${g.locations.latitude},${g.locations.longitude}`,
            )
          }
        />
        <Button
          title="Share game"
          kind="secondary"
          onPress={() => {
            Share.share({
              message: `Play ${g.title} with me on SpotUp: ${ExpoLinking.createURL("/game/" + id)}`,
            });
            track("game_shared", id);
          }}
        />
      </Row>
      <Txt color={C.muted}>
        {g.description ||
          "Bring good energy, respect the players, and check in when you arrive."}
      </Txt>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/player/${g.host_id}`)}
      >
        <Row>
          <Avatar name={g.profiles.name} />
          <View>
            <Txt bold>Hosted by {g.profiles.name}</Txt>
            <Txt size={12} color={C.muted}>
              View player identity and Skill Showcase →
            </Txt>
          </View>
        </Row>
      </Pressable>
      <ErrorBox error={action.error || vote.error} />
      {!player && g.status === "upcoming" && (
        <Button
          title={
            g.game_players.length >= g.capacity
              ? "Game is full"
              : "Join this game"
          }
          disabled={g.game_players.length >= g.capacity}
          loading={action.isPending}
          onPress={() => action.mutate({ action: "join" })}
        />
      )}
      {player && ["upcoming", "live"].includes(g.status) && (
        <Card>
          <Txt bold>
            {player.confirmed_at
              ? "Attendance confirmed ✓"
              : player.checked_in_at
                ? "Checked in · waiting for host"
                : "You’re on the roster"}
          </Txt>
          {!player.checked_in_at && (
            <Button
              title="I’m here · Check in"
              loading={action.isPending}
              onPress={() => action.mutate({ action: "checkin" })}
            />
          )}
          {player.confirmed_at && !player.checked_out_at && (
            <Button
              title="Check out"
              kind="secondary"
              loading={action.isPending}
              onPress={() => action.mutate({ action: "checkout" })}
            />
          )}
          {!host && (
            <Button
              title="Leave game"
              kind="ghost"
              loading={action.isPending}
              onPress={() => action.mutate({ action: "leave" })}
            />
          )}
        </Card>
      )}
      {player && (
        <Button
          title="Open game chat"
          icon="chatbubbles-outline"
          kind="secondary"
          onPress={() =>
            router.push({
              pathname: "/chat",
              params: { kind: "game", id, title: g.title },
            })
          }
        />
      )}
      <Section title={`The lineup · ${g.game_players.length}/${g.capacity}`} />
      {g.game_players.map((p) => (
        <Card key={p.user_id}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/player/${p.user_id}`)}
          >
            <Row>
              <Avatar name={p.profiles?.name ?? "Player"} />
              <View style={{ flex: 1 }}>
                <Txt bold>{p.profiles?.name ?? "Player"}</Txt>
                <Txt size={12} color={C.muted}>
                  {p.confirmed_at
                    ? "Host-confirmed"
                    : p.checked_in_at
                      ? "Checked in"
                      : "Joined"}{" "}
                  · View showcase →
                </Txt>
              </View>
            </Row>
          </Pressable>
          {host &&
            p.checked_in_at &&
            !p.confirmed_at &&
            ["upcoming", "live"].includes(g.status) && (
              <Button
                title="Confirm attendance · +20 XP"
                kind="secondary"
                loading={action.isPending}
                onPress={() =>
                  action.mutate({ action: "confirm", target: p.user_id })
                }
              />
            )}
          {host &&
            p.user_id !== session?.user.id &&
            g.status === "upcoming" && (
              <Button
                title="Remove from roster"
                kind="ghost"
                loading={action.isPending}
                onPress={() =>
                  action.mutate({ action: "remove", target: p.user_id })
                }
              />
            )}
          {g.status === "completed" &&
            player?.confirmed_at &&
            p.confirmed_at &&
            p.user_id !== session?.user.id && (
              <Button
                title="Recognize sportsmanship"
                kind="secondary"
                loading={vote.isPending}
                onPress={() => vote.mutate(p.user_id)}
              />
            )}
        </Card>
      ))}
      {host && ["upcoming", "live"].includes(g.status) && (
        <Card>
          <Txt bold>Host controls</Txt>
          {g.status === "upcoming" && (
            <>
              <Button
                title="Edit game"
                kind="secondary"
                onPress={() =>
                  router.push({ pathname: "/create", params: { edit: id } })
                }
              />
              <Button
                title="Start game"
                loading={action.isPending}
                onPress={() => action.mutate({ action: "start" })}
              />
            </>
          )}
          {g.status === "live" && (
            <Button
              title="Complete game & finalize attendance"
              loading={action.isPending}
              onPress={() => action.mutate({ action: "complete" })}
            />
          )}
          <Button
            title={confirmCancel ? "Confirm cancellation" : "Cancel game"}
            kind="danger"
            loading={action.isPending}
            onPress={() =>
              confirmCancel
                ? action.mutate({ action: "cancel" })
                : setConfirmCancel(true)
            }
          />
          <PlayerSearch
            label="Invite players"
            button="Invite"
            busy={action.isPending}
            onSelect={(target) => action.mutate({ action: "invite", target })}
          />
        </Card>
      )}
      {g.status === "completed" && (
        <Button
          title="Capture the memory · Post a clip"
          icon="videocam-outline"
          onPress={() =>
            router.push({
              pathname: "/upload",
              params: { kind: "post", game: id, sport: g.sport_id },
            })
          }
        />
      )}
      <Button
        title="Report this game"
        kind="ghost"
        onPress={() =>
          router.push({ pathname: "/report", params: { kind: "game", id } })
        }
      />
    </Screen>
  );
}
