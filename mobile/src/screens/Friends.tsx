import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  C,
  Empty,
  ErrorBox,
  Field,
  Header,
  Row,
  Screen,
  Section,
  Txt,
} from "../components/ui";
import { supabase, rpc } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useAction, useRealtime } from "../lib/hooks";
import { Profile } from "../lib/types";
export type Friendship = {
  id: string;
  requester_id: string;
  recipient_id: string;
  state: string;
  requester: Profile;
  recipient: Profile;
};
export default function Friends() {
  const { session } = useSession();
  const uid = session!.user.id;
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useRealtime("friendships");
  const q = useQuery({
    queryKey: ["friends", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "*,requester:profiles!requester_id(*),recipient:profiles!recipient_id(*)",
        )
        .neq("state", "declined")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Friendship[];
    },
  });
  const results = useQuery({
    queryKey: ["friendSearch", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("name", `%${term.replace(/[%_]/g, "")}%`)
        .neq("id", uid)
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
  });
  const action = useAction((v: { action: string; target: string }) =>
    rpc("friend_action", v),
  );
  const incoming =
    q.data?.filter((f) => f.state === "pending" && f.recipient_id === uid) ??
    [];
  const friends = q.data?.filter((f) => f.state === "accepted") ?? [];
  const outgoing =
    q.data?.filter((f) => f.state === "pending" && f.requester_id === uid) ??
    [];
  const player = (p: Profile | null, controls: React.ReactNode) =>
    p && (
      <Card key={p.id}>
        <Row>
          <Avatar name={p.name} />
          <View style={{ flex: 1 }}>
            <Txt bold>{p.name}</Txt>
            <Txt color={C.muted} size={12}>
              {p.city || p.sports.join(" · ")}
            </Txt>
          </View>
          <Button
            title="Profile"
            kind="ghost"
            onPress={() => router.push(`/player/${p.id}`)}
          />
        </Row>
        <Row style={{ flexWrap: "wrap" }}>{controls}</Row>
      </Card>
    );
  return (
    <Screen refresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header title="Your people" eyebrow="FRIENDS & MESSAGES" />
      <Txt color={C.muted}>
        Plan the next game together. Private messages open when both players
        accept a friend request.
      </Txt>
      <Field
        label="Find a player"
        value={search}
        onChangeText={setSearch}
        placeholder="Search by player name"
        onSubmitEditing={() => setTerm(search.trim())}
      />
      <Button
        title="Search players"
        icon="search"
        disabled={search.trim().length < 2}
        onPress={() => setTerm(search.trim())}
      />
      <ErrorBox error={q.error || results.error || action.error} />
      {term.length >= 2 && (
        <>
          <Section title="Search results" />
          {results.data?.map((p) =>
            player(p, <FriendButton playerId={p.id} />),
          )}
          {!results.isLoading && !results.data?.length && (
            <Txt color={C.muted}>No matching players.</Txt>
          )}
        </>
      )}
      {!!incoming.length && <Section title={`Requests · ${incoming.length}`} />}
      {incoming.map((f) =>
        player(
          f.requester,
          <>
            <Button
              title="Accept"
              loading={action.isPending}
              onPress={() =>
                action.mutate({ action: "accept", target: f.requester_id })
              }
            />
            <Button
              title="Decline"
              kind="ghost"
              onPress={() =>
                action.mutate({ action: "decline", target: f.requester_id })
              }
            />
          </>,
        ),
      )}
      <Section title={`Friends · ${friends.length}`} />
      {friends.map((f) => {
        const p = f.requester_id === uid ? f.recipient : f.requester;
        return player(
          p,
          <>
            <Button
              title="Message"
              icon="chatbubble-outline"
              onPress={() =>
                router.push({
                  pathname: "/chat",
                  params: { kind: "direct", id: p.id, title: p.name },
                })
              }
            />
            <Button
              title="Invite to play"
              kind="secondary"
              onPress={() =>
                router.push({ pathname: "/invite", params: { player: p.id } })
              }
            />
          </>,
        );
      })}
      {!q.isLoading && !friends.length && (
        <Empty
          title="Make your next game a regular thing"
          body="Find players you enjoy playing with, send a request, and keep the conversation going."
        />
      )}
      {!!outgoing.length && <Section title="Requests sent" />}
      {outgoing.map((f) =>
        player(
          f.recipient,
          <Button
            title="Cancel request"
            kind="ghost"
            onPress={() =>
              action.mutate({ action: "cancel", target: f.recipient_id })
            }
          />,
        ),
      )}
    </Screen>
  );
}
export function FriendButton({ playerId }: { playerId: string }) {
  const { session } = useSession();
  const uid = session!.user.id;
  const q = useQuery({
    queryKey: ["friendship", uid, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${uid},recipient_id.eq.${playerId}),and(requester_id.eq.${playerId},recipient_id.eq.${uid})`,
        )
        .maybeSingle();
      if (error) throw error;
      return data as Friendship | null;
    },
  });
  const action = useAction((name: string) =>
    rpc("friend_action", { action: name, target: playerId }),
  );
  const f = q.data;
  const accepted = f?.state === "accepted",
    pending = f?.state === "pending",
    incoming = pending && f.recipient_id === uid;
  return (
    <View style={{ gap: 8 }}>
      <Row style={{ flexWrap: "wrap" }}>
        <Button
          title={
            accepted
              ? "Message friend"
              : incoming
                ? "Accept friend request"
                : pending
                  ? "Cancel request"
                  : "Add friend"
          }
          kind="secondary"
          disabled={q.isLoading || !!q.error}
          loading={action.isPending}
          onPress={() =>
            accepted
              ? router.push({
                  pathname: "/chat",
                  params: { kind: "direct", id: playerId },
                })
              : action.mutate(
                  incoming ? "accept" : pending ? "cancel" : "request",
                )
          }
        />
        {accepted && (
          <Button
            title="Remove friend"
            kind="ghost"
            onPress={() => action.mutate("remove")}
          />
        )}
      </Row>
      <ErrorBox error={q.error || action.error} />
    </View>
  );
}
