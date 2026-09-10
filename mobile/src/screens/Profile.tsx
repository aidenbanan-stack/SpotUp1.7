import { FriendButton } from "./Friends";
import React, { useState } from "react";
import { View, Pressable, Share } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  C,
  Chips,
  Empty,
  ErrorBox,
  Header,
  Icon,
  Loading,
  Row,
  Screen,
  Section,
  Tag,
  Txt,
} from "../components/ui";
import {
  Clip,
  Game,
  Profile as PlayerProfile,
  Squad,
  Summary,
} from "../lib/types";
import { one, rows, rpc, supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useAction } from "../lib/hooks";
import { achievements, formatDate } from "../lib/domain";
import GameCard from "../components/GameCard";
import ProfilePhoto from "../components/ProfilePhoto";
import { GAME_SELECT } from "./Home";
export default function Profile() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const id = params.id ?? session!.user.id;
  const own = id === session?.user.id;
  const [tab, setTab] = useState("overview");
  const q = useQuery({
    queryKey: ["profile", id],
    queryFn: () => one<PlayerProfile>("profiles", id),
  });
  const stats = useQuery({
    queryKey: ["summary", id],
    queryFn: () => rpc<Summary>("player_summary", { uid: id }),
  });
  const showcases = useQuery({
    queryKey: ["showcases", id],
    queryFn: () =>
      rows<Clip>("showcases", "*,media_assets(*),profiles!creator_id(*)", {
        creator_id: id,
        removed: false,
      }),
  });
  const posts = useQuery({
    queryKey: ["profilePosts", id],
    queryFn: () =>
      rows<Clip>("posts", "*,media_assets(*),profiles!creator_id(*)", {
        creator_id: id,
        removed: false,
      }),
  });
  const squads = useQuery({
    queryKey: ["profileSquads", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squad_members")
        .select("squads(*)")
        .eq("user_id", id);
      if (error) throw error;
      return data.map((r) => r.squads) as unknown as Squad[];
    },
  });
  const games = useQuery({
    queryKey: ["profileGames", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select("games(" + GAME_SELECT + ")")
        .eq("user_id", id)
        .not("confirmed_at", "is", null)
        .order("joined_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown as { games: Game }[])
        .map((r) => r.games)
        .filter(Boolean) as unknown as Game[];
    },
  });
  const follow = useQuery({
    queryKey: ["following", id],
    enabled: !own,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("user_id")
        .eq("user_id", session!.user.id)
        .eq("target_id", id);
      if (error) throw error;
      return !!data.length;
    },
  });
  const action = useAction((v: { action: string; target: string }) =>
    rpc("social_action", v),
  );
  if (q.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!q.data)
    return (
      <Screen>
        <ErrorBox
          error={q.error || Error("Player unavailable")}
          retry={() => q.refetch()}
        />
      </Screen>
    );
  const p = q.data;
  const st = stats.data;
  return (
    <Screen>
      <Header
        eyebrow="PLAYER IDENTITY"
        title={own ? "Your game. Your story." : p.name}
        right={
          own ? (
            <Button
              title="Settings"
              kind="ghost"
              icon="settings-outline"
              onPress={() => router.push("/settings")}
            />
          ) : undefined
        }
      />
      <Card style={{ backgroundColor: C.dark, padding: 25 }}>
        <Row>
          <ProfilePhoto
            name={p.name}
            path={p.avatar_url || p.legacy_avatar_url}
            size={72}
          />
          <View style={{ flex: 1 }}>
            <Txt size={25} bold color="white">
              {p.name}
            </Txt>
            <Txt color="#B4C6DD">{p.city || "Finding their community"}</Txt>
            <Txt size={12} color={C.blue}>
              LEVEL {st?.level ?? 1} · {st?.followers ?? 0} followers
            </Txt>
          </View>
        </Row>
        <Txt color="white">
          {p.bio || "The best way to get to know a player is to share a game."}
        </Txt>
        <Row style={{ flexWrap: "wrap" }}>
          {p.sports.map((s) => (
            <Tag key={s} color={C.blue}>
              {s.toUpperCase()}
            </Tag>
          ))}
        </Row>
        <View
          style={{ height: 5, backgroundColor: "#253B55", borderRadius: 3 }}
        >
          <View
            style={{
              height: 5,
              backgroundColor: C.blue,
              width: `${(((st?.xp ?? 0) % 250) / 250) * 100}%`,
            }}
          />
        </View>
        <Txt size={11} color="#B4C6DD">
          {st?.xp ?? 0} XP · {250 - ((st?.xp ?? 0) % 250)} to the next level
        </Txt>
      </Card>
      <Row>
        {[
          ["Games", st?.games ?? 0],
          [
            "Reliability",
            st?.reliability == null ? "New" : st.reliability + "%",
          ],
          ["XP", st?.xp ?? 0],
        ].map(([name, value]) => (
          <Card key={name} style={{ flex: 1, padding: 12 }}>
            <Txt size={25} bold>
              {value}
            </Txt>
            <Txt size={11} color={C.muted}>
              {name}
            </Txt>
          </Card>
        ))}
      </Row>
      <ErrorBox error={stats.error || action.error} />
      {!own && (
        <Row>
          <Button
            title={follow.data ? "Following" : "Follow player"}
            loading={action.isPending}
            onPress={() => action.mutate({ action: "follow", target: id })}
          />
          <Button
            title="Invite to play"
            kind="secondary"
            onPress={() =>
              router.push({ pathname: "/invite", params: { player: id } })
            }
          />
        </Row>
      )}
      {!own && <FriendButton playerId={id} />}
      {own && (
        <Button
          title="Friends & messages"
          kind="secondary"
          icon="chatbubbles-outline"
          onPress={() => router.push("/friends")}
        />
      )}
      <Button
        title="Share player profile"
        kind="ghost"
        icon="share-outline"
        onPress={() =>
          Share.share({
            message: `Find me on SpotUp: ${Linking.createURL("/player/" + id)}\nPlayer ID: ${id}`,
          })
        }
      />
      <Chips
        items={[
          { id: "overview", name: "Overview" },
          { id: "showcase", name: "Skill Showcase" },
          { id: "games", name: "Recent games" },
          { id: "squads", name: "Squads" },
          { id: "achievements", name: "Achievements" },
          { id: "posts", name: "Social clips" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {(tab === "overview" || tab === "showcase") && (
        <>
          <Section title="Skill Showcase" />
          <Card style={{ backgroundColor: "#13283F" }}>
            <Row>
              <Icon name="ribbon-outline" />
              <Txt bold>Let your game speak</Txt>
            </Row>
            <Txt size={13} color={C.muted}>
              Player-selected videos of skills, training, and game performance.
              Visual context, not an objective skill rating.
            </Txt>
            {own && (
              <Button
                title="Add a showcase video"
                icon="add"
                onPress={() =>
                  router.push({
                    pathname: "/upload",
                    params: { kind: "showcase" },
                  })
                }
              />
            )}
          </Card>
          <ErrorBox error={showcases.error} />
          {showcases.data?.map((c) => (
            <ClipCard key={c.id} clip={c} kind="showcase" own={own} />
          ))}
          {!showcases.isLoading && !showcases.data?.length && (
            <Txt color={C.muted}>
              {own
                ? "Add your first showcase to show what you bring to a game."
                : "No showcase videos are visible to you."}
            </Txt>
          )}
        </>
      )}
      {(tab === "games" || tab === "overview") && (
        <>
          <Section title="Recent games" />
          <ErrorBox error={games.error} />
          {games.data?.length ? (
            games.data
              .slice(0, tab === "overview" ? 3 : 10)
              .map((g) => <GameCard key={g.id} game={g} />)
          ) : (
            <Txt color={C.muted}>Confirmed participation will appear here.</Txt>
          )}
        </>
      )}
      {tab === "squads" && (
        <>
          <ErrorBox error={squads.error} />
          {squads.data?.length ? (
            squads.data.map((s) => (
              <Card key={s.id}>
                <Txt size={20} bold>
                  {s.name}
                </Txt>
                <Txt color={C.muted}>{s.sport_id}</Txt>
                <Button
                  title="Meet the squad"
                  kind="secondary"
                  onPress={() => router.push(`/squad/${s.id}`)}
                />
              </Card>
            ))
          ) : (
            <Empty
              title="A squad starts with shared games"
              body="Earn 500 XP to join a squad, or 1,000 XP to create one."
              action={
                <Button
                  title="Discover squads"
                  onPress={() => router.push("/squads")}
                />
              }
            />
          )}
        </>
      )}
      {tab === "achievements" &&
        achievements(st?.games ?? 0, st?.reliability ?? null, st?.xp ?? 0).map(
          (a) => (
            <Card key={a.name}>
              <Row>
                <Icon
                  name={a.earned ? "ribbon" : "lock-closed-outline"}
                  color={a.earned ? C.orange : C.muted}
                />
                <View>
                  <Txt bold>{a.name}</Txt>
                  <Txt color={C.muted} size={12}>
                    {a.detail}
                  </Txt>
                </View>
                <Tag>{a.earned ? "EARNED" : "LOCKED"}</Tag>
              </Row>
            </Card>
          ),
        )}
      {tab === "posts" && (
        <>
          <Section title="Social clips" />
          {own && (
            <Button
              title="Post a moment"
              icon="videocam-outline"
              onPress={() => router.push("/upload")}
            />
          )}
          <ErrorBox error={posts.error} />
          {posts.data?.map((c) => (
            <ClipCard key={c.id} clip={c} kind="post" own={own} />
          ))}
          {!posts.isLoading && !posts.data?.length && (
            <Txt color={C.muted}>No visible sports clips yet.</Txt>
          )}
        </>
      )}
      {own && (
        <Button
          title="View XP history & daily bonus"
          kind="secondary"
          icon="flash-outline"
          onPress={() => router.push("/progress")}
        />
      )}
      {!own && (
        <>
          <Button
            title="Report player"
            kind="ghost"
            onPress={() =>
              router.push({ pathname: "/report", params: { kind: "user", id } })
            }
          />
          <Button
            title="Block player"
            kind="danger"
            loading={action.isPending}
            onPress={() =>
              action.mutate(
                { action: "block", target: id },
                { onSuccess: () => router.replace("/") },
              )
            }
          />
        </>
      )}
    </Screen>
  );
}
function ClipCard({
  clip,
  kind,
  own,
}: {
  clip: Clip;
  kind: string;
  own: boolean;
}) {
  const action = useAction(() =>
    rpc("social_action", {
      action: kind === "showcase" ? "delete_showcase" : "delete_post",
      target: clip.id,
    }),
  );
  const [confirm, setConfirm] = useState(false);
  return (
    <Card>
      <Row>
        <View
          style={{
            width: 58,
            height: 74,
            borderRadius: 10,
            backgroundColor: kind === "showcase" ? C.dark : C.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={kind === "showcase" ? "ribbon-outline" : "play-outline"}
            color={kind === "showcase" ? C.blue : C.dark}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Txt bold>
            {clip.category} · {clip.sport_id}
          </Txt>
          <Txt size={12} color={C.muted}>
            {clip.caption || "A moment from the game"}
          </Txt>
          <Txt size={10} color={C.muted}>
            {formatDate(clip.created_at)}
          </Txt>
          <Tag>
            {clip.media_assets?.state === "ready"
              ? "PUBLISHED"
              : clip.media_assets?.state === "pending"
                ? "IN REVIEW · VISIBLE TO YOU"
                : (clip.media_assets?.state || "unavailable").toUpperCase()}
          </Tag>
        </View>
      </Row>
      <Button
        title={kind === "showcase" ? "Watch showcase" : "Watch clip"}
        kind="secondary"
        onPress={() =>
          router.push({ pathname: "/clip/[id]", params: { id: clip.id, kind } })
        }
      />
      {own && (
        <Button
          title={confirm ? "Confirm deletion" : "Delete video"}
          kind="ghost"
          loading={action.isPending}
          onPress={() => (confirm ? action.mutate() : setConfirm(true))}
        />
      )}
      <ErrorBox error={action.error} />
    </Card>
  );
}
