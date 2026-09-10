import React, { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable } from "react-native";
import {
  Avatar,
  Button,
  Card,
  C,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  Row,
  Screen,
  Txt,
} from "../components/ui";
import { Message } from "../lib/types";
import { rows, rpc, supabase } from "../lib/supabase";
import { useAction, useRealtime } from "../lib/hooks";
import { useSession } from "../lib/session";
import { formatDate } from "../lib/domain";
export default function Chat() {
  const { kind, id, title } = useLocalSearchParams<{
    kind: "game" | "squad" | "tournament" | "direct";
    id: string;
    title: string;
  }>();
  const column = {
    direct: "recipient_id",
    game: "game_id",
    squad: "squad_id",
    tournament: "tournament_id",
  }[kind];
  const { session } = useSession();
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["messages", kind, id],
    enabled: !!column,
    refetchInterval: kind === "direct" ? 10000 : false,
    queryFn: async () => {
      if (kind !== "direct")
        return rows<Message>("messages", "*,profiles!user_id(*)", {
          [column]: id,
        });
      const uid = session!.user.id;
      const { data, error } = await supabase
        .from("messages")
        .select("*,profiles!user_id(*)")
        .or(
          `and(user_id.eq.${uid},recipient_id.eq.${id}),and(user_id.eq.${id},recipient_id.eq.${uid})`,
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as Message[];
    },
  });
  useRealtime("messages", `${column}=eq.${id}`);
  const action = useAction(() =>
    kind === "direct"
      ? rpc("send_direct_message", { target: id, body: text })
      : rpc("send_message", {
          body: text,
          gid: kind === "game" ? id : null,
          sid: kind === "squad" ? id : null,
          tid: kind === "tournament" ? id : null,
        }),
  );
  const del = useAction((target: string) =>
    rpc("social_action", { action: "delete_message", target }),
  );
  return (
    <Screen refresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Header
        eyebrow={`${kind} CHAT`}
        title={title || (kind === "direct" ? "Friend chat" : "Team talk")}
      />
      <Txt size={12} color={C.muted}>
        Coordinate the game. Be helpful. Keep it respectful.
      </Txt>
      {q.isLoading && <Loading />}
      <ErrorBox error={q.error || action.error || del.error} />
      {!q.data?.length && !q.isLoading && (
        <Empty
          icon="chatbubbles-outline"
          title="Get the conversation started"
          body="Meeting spot, parking, equipment, or a quick heads-up — this is the place."
        />
      )}
      {[...(q.data ?? [])].reverse().map((m) => (
        <Card
          key={m.id}
          style={{
            backgroundColor: m.user_id === session?.user.id ? C.soft : C.card,
          }}
        >
          <Pressable onPress={() => router.push(`/player/${m.user_id}`)}>
            <Row>
              <Avatar name={m.profiles.name} size={32} />
              <Txt bold size={13}>
                {m.profiles.name}
              </Txt>
              <Txt size={10} color={C.muted}>
                {formatDate(m.created_at)}
              </Txt>
            </Row>
          </Pressable>
          <Txt>{m.body}</Txt>
          {m.user_id === session?.user.id ? (
            <Button
              title="Delete"
              kind="ghost"
              onPress={() => del.mutate(m.id)}
            />
          ) : (
            <Button
              title="Report message"
              kind="ghost"
              onPress={() =>
                router.push({
                  pathname: "/report",
                  params: { kind: "message", id: m.id },
                })
              }
            />
          )}
        </Card>
      ))}
      <Field
        label="Message"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        placeholder="Plan your next game…"
      />
      <Button
        title="Send message"
        icon="send-outline"
        disabled={!text.trim()}
        loading={action.isPending}
        onPress={() =>
          action.mutate(undefined, { onSuccess: () => setText("") })
        }
      />
    </Screen>
  );
}
export function Comments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["comments", id],
    queryFn: () =>
      rows<Message>("comments", "*,profiles!user_id(*)", { post_id: id }),
  });
  const action = useAction(
    (v: { action: string; target: string; value?: string }) =>
      rpc("social_action", v),
  );
  return (
    <Screen>
      <Header title="SpotUp Moments conversation" />
      <ErrorBox error={q.error || action.error} />
      {q.isLoading && <Loading />}
      {[...(q.data ?? [])].reverse().map((m) => (
        <Card key={m.id}>
          <Pressable onPress={() => router.push(`/player/${m.user_id}`)}>
            <Txt bold>{m.profiles.name}</Txt>
          </Pressable>
          <Txt>{m.body}</Txt>
          {m.user_id === session?.user.id ? (
            <Button
              title="Delete comment"
              kind="ghost"
              onPress={() =>
                action.mutate({ action: "delete_comment", target: m.id })
              }
            />
          ) : (
            <Button
              title="Report comment"
              kind="ghost"
              onPress={() =>
                router.push({
                  pathname: "/report",
                  params: { kind: "comment", id: m.id },
                })
              }
            />
          )}
        </Card>
      ))}
      <Field
        label="Add a comment"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
      />
      <Button
        title="Post comment"
        disabled={!text.trim()}
        loading={action.isPending}
        onPress={() =>
          action.mutate(
            { action: "comment", target: id, value: text },
            { onSuccess: () => setText("") },
          )
        }
      />
    </Screen>
  );
}
