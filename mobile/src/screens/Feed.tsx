import { useSports } from "../lib/sports";
import React, { useState, useRef } from "react";
import {
  View,
  FlatList,
  Pressable,
  Share,
  useWindowDimensions,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import {
  Avatar,
  Button,
  C,
  Chips,
  Empty,
  ErrorBox,
  Icon,
  Loading,
  Row,
  Tag,
  Txt,
} from "../components/ui";
import Video from "../components/Video";
import { Clip } from "../lib/types";
import { rows, rpc, supabase, track } from "../lib/supabase";
import { useMe, useSession } from "../lib/session";
import { useAction } from "../lib/hooks";
import { rankClips } from "../lib/domain";
export const CLIP_SELECT =
  "*,profiles!creator_id(*),media_assets(*),reactions(user_id),saved_posts(user_id),comments(id)";
function FeedItem({
  clip,
  height,
  active,
}: {
  clip: Clip;
  height: number;
  active: boolean;
}) {
  const { session } = useSession();
  const action = useAction((v: { action: string; value?: string }) =>
    rpc("social_action", { ...v, target: clip.id }),
  );
  const url = useQuery({
    queryKey: ["videoUrl", clip.media_id],
    enabled: active,
    staleTime: 90000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(clip.media_assets.object_path, 120);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const liked = clip.reactions?.some((r) => r.user_id === session?.user.id);
  const saved = clip.saved_posts?.some((r) => r.user_id === session?.user.id);
  return (
    <View style={{ height, padding: 12, gap: 10, backgroundColor: C.dark }}>
      <View style={{ flex: 1 }}>
        {url.data && active ? (
          <Video uri={url.data} active={active} />
        ) : url.isLoading ? (
          <Loading />
        ) : (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="play-circle-outline" color={C.lime} size={50} />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            bottom: 16,
            left: 14,
            right: 14,
            gap: 8,
          }}
        >
          <Tag color={C.lime}>
            {clip.category.toUpperCase()} · {clip.sport_id.toUpperCase()}
          </Tag>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/player/${clip.creator_id}`)}
      >
        <Row>
          <Avatar name={clip.profiles.name} />
          <View style={{ flex: 1 }}>
            <Txt color="white" bold>
              {clip.profiles.name} →
            </Txt>
            <Txt color="#B8CAB7" size={11}>
              {clip.reason || "From your sports community"}
            </Txt>
          </View>
        </Row>
      </Pressable>
      <Txt color="white" size={14}>
        {clip.caption}
      </Txt>
      <Row style={{ justifyContent: "space-between" }}>
        <Control
          icon={liked ? "heart" : "heart-outline"}
          label={`Like · ${clip.reactions?.length ?? 0}`}
          onPress={() => action.mutate({ action: "react" })}
        />
        <Control
          icon="chatbubble-outline"
          label={`Comment · ${clip.comments?.length ?? 0}`}
          onPress={() =>
            router.push({ pathname: "/comments", params: { id: clip.id } })
          }
        />
        <Control
          icon={saved ? "bookmark" : "bookmark-outline"}
          label={saved ? "Saved" : "Save"}
          onPress={() => action.mutate({ action: "save" })}
        />
        <Control
          icon="share-outline"
          label="Share"
          onPress={() => {
            Share.share({ message: Linking.createURL("/clip/" + clip.id) });
            track("post_shared", clip.id);
          }}
        />
        <Control
          icon="flag-outline"
          label="Report"
          onPress={() =>
            router.push({
              pathname: "/report",
              params: { kind: "post", id: clip.id },
            })
          }
        />
      </Row>
      <Row style={{ flexWrap: "wrap" }}>
        {clip.game_id && (
          <Button
            title="View the game"
            onPress={() => {
              track("content_to_game", clip.id);
              router.push(`/game/${clip.game_id}`);
            }}
          />
        )}
        {clip.squad_id && (
          <Button
            title="Meet the squad"
            kind="secondary"
            onPress={() => router.push(`/squad/${clip.squad_id}`)}
          />
        )}{" "}
        {clip.tournament_id && (
          <Button
            title="Tournament"
            kind="secondary"
            onPress={() => router.push(`/tournament/${clip.tournament_id}`)}
          />
        )}
        {clip.location_id && (
          <Button
            title="Explore this venue"
            kind="secondary"
            onPress={() => router.push(`/venue/${clip.location_id}`)}
          />
        )}
        <Button
          title={`Find ${clip.sport_id} games`}
          kind="secondary"
          onPress={() =>
            router.push({ pathname: "/map", params: { sport: clip.sport_id } })
          }
        />
      </Row>
      <ErrorBox error={action.error || url.error} />
    </View>
  );
}
function Control({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ alignItems: "center", gap: 5, minWidth: 48, minHeight: 48 }}
    >
      <Icon name={icon} color="white" size={24} />
      <Txt color="white" size={10}>
        {label}
      </Txt>
    </Pressable>
  );
}
export default function Feed() {
  const SPORTS = useSports();
  const [mode, setMode] = useState("recommended");
  const [sport, setSport] = useState("all");
  const [active, setActive] = useState(0);
  const { data: me } = useMe();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const itemHeight = Math.max(550, height - 190);
  const q = useInfiniteQuery({
    queryKey: ["feed", mode, sport, me?.city],
    initialPageParam: {
      time: new Date().toISOString(),
      id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    },
    queryFn: async ({ pageParam }) => {
      const page = await rpc<Clip[]>("content_feed", {
        mode,
        sport: sport === "all" ? null : sport,
        area: me?.city || null,
        before_time: pageParam.time,
        before_id: pageParam.id,
      });
      if (!page.length) return { clips: [] as Clip[], cursor: null };
      const { data, error } = await supabase
        .from("posts")
        .select(CLIP_SELECT)
        .in(
          "id",
          page.map((p) => p.id),
        );
      if (error) throw error;
      const signals = await rpc<
        { post_id: string; score: number; reason: string }[]
      >("content_signals", { pids: page.map((p) => p.id) });
      const clips = (data as unknown as Clip[]).map((c) => ({
        ...c,
        reason: signals.find((s) => s.post_id === c.id)?.reason,
      }));
      const sorted =
        mode === "recommended"
          ? rankClips(
              clips,
              Object.fromEntries(signals.map((s) => [s.post_id, s.score])),
            )
          : mode === "trending"
            ? clips.sort(
                (a, b) =>
                  (b.reactions?.length ?? 0) - (a.reactions?.length ?? 0),
              )
            : clips.sort(
                (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
              );
      const last = page[page.length - 1];
      return {
        clips: sorted,
        cursor:
          page.length === 15 ? { time: last.created_at, id: last.id } : null,
      };
    },
    getNextPageParam: (last) => last.cursor ?? undefined,
  });
  const onView = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActive(viewableItems[0].index ?? 0);
  }).current;
  const clips = q.data?.pages.flatMap((p) => p.clips) ?? [];
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: C.dark }}
    >
      <View style={{ padding: 12, gap: 8 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={24} bold color="white">
            SpotUp Moments
          </Txt>
          <Button
            title="Post"
            icon="add"
            onPress={() => router.push("/upload")}
          />
        </Row>
        <Chips
          items={[
            { id: "recommended", name: "For you" },
            { id: "following", name: "Following" },
            { id: "local", name: "Local" },
            { id: "trending", name: "Trending" },
            { id: "saved", name: "Saved" },
          ]}
          value={mode}
          onChange={(v) => {
            setActive(0);
            setMode(v);
          }}
        />
        <Chips
          items={[{ id: "all", name: "All sports" }, ...SPORTS]}
          value={sport}
          onChange={setSport}
        />
      </View>
      <ErrorBox error={q.error} retry={() => q.refetch()} />
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          key={mode + sport}
          data={clips}
          keyExtractor={(c) => c.id}
          renderItem={({ item, index }) => (
            <FeedItem
              clip={item}
              height={itemHeight}
              active={index === active && focused}
            />
          )}
          pagingEnabled
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onView}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          ListFooterComponent={q.isFetchingNextPage ? <Loading /> : null}
          ListEmptyComponent={
            <View style={{ padding: 20 }}>
              <Empty
                icon="videocam-outline"
                title={
                  mode === "local" && !me?.city
                    ? "Set your home area"
                    : "The next moment could be yours"
                }
                body={
                  mode === "local" && !me?.city
                    ? "Add your city in profile settings to discover local sports clips."
                    : "No approved clips match this feed yet. Capture a sports moment or find a game to join."
                }
                action={
                  <Button
                    title="Find a game"
                    onPress={() => router.push("/map")}
                  />
                }
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
export function ClipDetail() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const showcase = kind === "showcase";
  const q = useQuery({
    queryKey: ["clip", id, kind],
    queryFn: async () => {
      const data = await rows<Clip>(
        showcase ? "showcases" : "posts",
        showcase ? "*,profiles!creator_id(*),media_assets(*)" : CLIP_SELECT,
        { id },
      );
      if (!data[0])
        throw Error("This video is private, removed, or unavailable.");
      return data[0];
    },
  });
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.dark }}>
      {q.isLoading ? (
        <Loading />
      ) : q.data ? (
        showcase ? (
          <ShowcaseViewer clip={q.data} active={focused} />
        ) : (
          <FeedItem clip={q.data} height={height - 120} active={focused} />
        )
      ) : (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      )}
    </SafeAreaView>
  );
}
function ShowcaseViewer({ clip, active }: { clip: Clip; active: boolean }) {
  const q = useQuery({
    queryKey: ["showcaseUrl", clip.media_id],
    staleTime: 90000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(clip.media_assets.object_path, 120);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return (
    <View style={{ flex: 1, padding: 20, gap: 16 }}>
      <Tag color={C.lime}>SKILL SHOWCASE · {clip.category.toUpperCase()}</Tag>
      {q.data && <Video uri={q.data} active={active} />}
      <ErrorBox error={q.error} />
      <Txt color="white" bold>
        {clip.profiles.name}
      </Txt>
      <Txt color="white">{clip.caption}</Txt>
      <Txt size={12} color="#C2D0BE">
        Player-selected evidence. This clip does not determine a skill rating.
      </Txt>
      <Button
        title="View player profile"
        onPress={() => router.push(`/player/${clip.creator_id}`)}
      />
      <Button
        title="Report showcase"
        kind="secondary"
        onPress={() =>
          router.push({
            pathname: "/report",
            params: { kind: "showcase", id: clip.id },
          })
        }
      />
    </View>
  );
}
