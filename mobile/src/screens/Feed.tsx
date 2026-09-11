import { useSports } from "../lib/sports";
import React, { useState, useRef } from "react";
import {
  View,
  FlatList,
  Pressable,
  Share,
  useWindowDimensions,
  ViewToken,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
  const [more, setMore] = useState(false);
  const cache = useQueryClient();
  const action = useMutation({
    mutationFn: (v: { action: string }) =>
      rpc("social_action", { ...v, target: clip.id }),
    onSuccess: (_data, v) => {
      const update = (item: Clip) => {
        if (item.id !== clip.id) return item;
        const field = v.action === "react" ? "reactions" : "saved_posts";
        const existing = item[field] ?? [];
        const uid = session!.user.id;
        return {
          ...item,
          [field]: existing.some((r) => r.user_id === uid)
            ? existing.filter((r) => r.user_id !== uid)
            : [...existing, { user_id: uid }],
        };
      };
      cache.setQueriesData<{ pages: { clips: Clip[] }[] }>(
        { queryKey: ["feed"] },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  clips: p.clips.map(update),
                })),
              }
            : old,
      );
      cache.setQueryData<Clip>(["clip", clip.id, undefined], (old) =>
        old ? update(old) : old,
      );
    },
  });
  const url = useQuery({
    queryKey: ["videoUrl", clip.media_id],
    enabled: active,
    staleTime: 60000,
    refetchInterval: 90000,
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
    <View style={{ height, backgroundColor: "#000" }}>
      <View style={{ position: "absolute", inset: 0 }}>
        {url.data && active ? (
          <Video uri={url.data} active={active} controls={false} immersive />
        ) : url.isLoading ? (
          <Loading />
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Icon name="play-circle-outline" color={C.blue} size={50} />
          </View>
        )}
      </View>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 10,
          bottom: 150,
          gap: 17,
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${clip.profiles.name}`}
          onPress={() => router.push(`/player/${clip.creator_id}`)}
        >
          <Avatar name={clip.profiles.name} />
        </Pressable>
        <Control
          icon={liked ? "heart" : "heart-outline"}
          label={`Like · ${clip.reactions?.length ?? 0}`}
          text={String(clip.reactions?.length ?? 0)}
          selected={liked}
          disabled={action.isPending}
          onPress={() => action.mutate({ action: "react" })}
        />
        <Control
          icon="chatbubble-outline"
          label="Comments"
          text={String(clip.comments?.length ?? 0)}
          onPress={() =>
            router.push({ pathname: "/comments", params: { id: clip.id } })
          }
        />
        <Control
          icon={saved ? "bookmark" : "bookmark-outline"}
          label={saved ? "Unsave video" : "Save video"}
          text={saved ? "Saved" : "Save"}
          selected={saved}
          disabled={action.isPending}
          onPress={() => action.mutate({ action: "save" })}
        />
        <Control
          icon="share-outline"
          label="Share video"
          text="Share"
          onPress={() => {
            void Share.share({
              message: Linking.createURL("/clip/" + clip.id),
            });
            void track("post_shared", clip.id);
          }}
        />
        <Control
          icon="ellipsis-horizontal"
          label="More video options"
          onPress={() => setMore(true)}
        />
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 75,
          padding: 18,
          gap: 8,
          backgroundColor: "rgba(0,0,0,0.48)",
          borderTopRightRadius: 18,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/player/${clip.creator_id}`)}
        >
          <Txt color="white" bold size={17}>
            @{clip.profiles.name}
          </Txt>
        </Pressable>
        <Txt
          color="white"
          size={14}
          style={{ maxHeight: 62, overflow: "hidden" }}
        >
          {clip.caption}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Find ${clip.sport_id} games`}
          onPress={() =>
            router.push({ pathname: "/map", params: { sport: clip.sport_id } })
          }
        >
          <Txt color="#BFDFFF" size={12}>
            {clip.sport_id} · {clip.category} ›
          </Txt>
        </Pressable>
        {clip.game_id && (
          <Button
            title="Play in this game"
            kind="secondary"
            onPress={() => {
              void track("content_to_game", clip.id);
              router.push(`/game/${clip.game_id}`);
            }}
          />
        )}
        <ErrorBox error={action.error || url.error} />
      </View>
      <Modal
        visible={more}
        transparent
        animationType="slide"
        onRequestClose={() => setMore(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,.6)",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel="Close video options"
            onPress={() => setMore(false)}
          />
          <View
            style={{
              backgroundColor: C.card,
              padding: 24,
              gap: 12,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <Txt bold size={20}>
              From this moment to your next game
            </Txt>
            <Button
              title="Creator profile"
              kind="secondary"
              onPress={() => {
                setMore(false);
                router.push(`/player/${clip.creator_id}`);
              }}
            />
            {clip.squad_id && (
              <Button
                title="Meet the squad"
                kind="secondary"
                onPress={() => {
                  setMore(false);
                  router.push(`/squad/${clip.squad_id}`);
                }}
              />
            )}
            {clip.tournament_id && (
              <Button
                title="View tournament"
                kind="secondary"
                onPress={() => {
                  setMore(false);
                  router.push(`/tournament/${clip.tournament_id}`);
                }}
              />
            )}
            {clip.location_id && (
              <Button
                title="Explore this venue"
                kind="secondary"
                onPress={() => {
                  setMore(false);
                  router.push(`/venue/${clip.location_id}`);
                }}
              />
            )}
            <Button
              title="Report video"
              kind="ghost"
              onPress={() => {
                setMore(false);
                router.push({
                  pathname: "/report",
                  params: { kind: "post", id: clip.id },
                });
              }}
            />
            <Button title="Done" onPress={() => setMore(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Control({
  icon,
  label,
  text,
  onPress,
  selected = false,
  disabled = false,
}: {
  icon: string;
  label: string;
  text?: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        gap: 3,
        minWidth: 48,
        minHeight: 44,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} color={selected ? C.blue : "white"} size={29} />
      {text && (
        <Txt color="white" size={11} bold>
          {text}
        </Txt>
      )}
    </Pressable>
  );
}
export default function Feed() {
  const SPORTS = useSports();
  const [filters, setFilters] = useState(false);
  const [mode, setMode] = useState("recommended");
  const [sport, setSport] = useState("all");
  const [active, setActive] = useState(0);
  const { data: me } = useMe();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const [itemHeight, setItemHeight] = useState(Math.max(400, height - 260));
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
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onView = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActive(viewableItems[0].index ?? 0);
  }).current;
  const clips = q.data?.pages.flatMap((p) => p.clips) ?? [];
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.dark }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Feed filters"
            onPress={() => setFilters(true)}
            style={{ padding: 10 }}
          >
            <Icon name="options-outline" color="white" />
          </Pressable>
          <Row>
            {[
              { id: "following", name: "Following" },
              { id: "recommended", name: "For you" },
            ].map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === t.id }}
                onPress={() => {
                  setMode(t.id);
                  setActive(0);
                }}
                style={{
                  padding: 10,
                  borderBottomWidth: 2,
                  borderBottomColor: mode === t.id ? C.blue : "transparent",
                }}
              >
                <Txt color={mode === t.id ? "white" : C.muted} bold size={14}>
                  {t.name}
                </Txt>
              </Pressable>
            ))}
          </Row>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post a moment"
            onPress={() => router.push("/upload")}
            style={{ padding: 10 }}
          >
            <Icon name="add-circle-outline" color="white" size={28} />
          </Pressable>
        </Row>
        {(sport !== "all" || !["following", "recommended"].includes(mode)) && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setFilters(true)}
          >
            <Txt color={C.blue} size={11} style={{ textAlign: "center" }}>
              {mode === "recommended" ? "For you" : mode} ·{" "}
              {SPORTS.find((s) => s.id === sport)?.name ?? "All sports"} ▾
            </Txt>
          </Pressable>
        )}
      </View>
      <Modal
        visible={filters}
        transparent
        animationType="slide"
        onRequestClose={() => setFilters(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,.6)",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            onPress={() => setFilters(false)}
          />
          <View
            style={{
              maxHeight: "75%",
              backgroundColor: C.card,
              padding: 20,
              gap: 16,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <Txt size={22} bold>
              Your kind of Moments
            </Txt>
            <ScrollView>
              <View style={{ gap: 16 }}>
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
                    setMode(v);
                    setActive(0);
                  }}
                />
                <Txt bold>Sports</Txt>
                <Chips
                  items={[{ id: "all", name: "All sports" }, ...SPORTS]}
                  value={sport}
                  onChange={(v) => {
                    setSport(v);
                    setActive(0);
                  }}
                />
              </View>
            </ScrollView>
            <Button title="Show moments" onPress={() => setFilters(false)} />
          </View>
        </View>
      </Modal>
      <ErrorBox error={q.error} retry={() => q.refetch()} />
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          onLayout={(e) =>
            setItemHeight(Math.max(300, e.nativeEvent.layout.height))
          }
          key={mode + sport}
          data={clips}
          keyExtractor={(c) => c.id}
          renderItem={({ item, index }) => (
            <FeedItem
              clip={item}
              height={itemHeight}
              active={index === active && focused && !filters}
            />
          )}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          snapToInterval={itemHeight}
          decelerationRate="fast"
          onViewableItemsChanged={onView}
          viewabilityConfig={viewability}
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
    staleTime: 60000,
    refetchInterval: 90000,
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
      <Tag color={C.blue}>SKILL SHOWCASE · {clip.category.toUpperCase()}</Tag>
      {q.data && <Video uri={q.data} active={active} />}
      <ErrorBox error={q.error} />
      <Txt color="white" bold>
        {clip.profiles.name}
      </Txt>
      <Txt color="white">{clip.caption}</Txt>
      <Txt size={12} color="#B4C6DD">
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
