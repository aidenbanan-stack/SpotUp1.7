import { useSports } from "../lib/sports";
import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  C,
  Chips,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  Row,
  Screen,
  Section,
  Txt,
} from "../components/ui";
import { Squad } from "../lib/types";
import { one, rows, rpc } from "../lib/supabase";
import { useAction } from "../lib/hooks";
import { useSession } from "../lib/session";
export default function Squads() {
  const SPORTS = useSports();
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("other");
  const [description, setDescription] = useState("");
  const q = useQuery({
    queryKey: ["squads"],
    queryFn: () => rows<Squad>("squads", "*,squad_members(*)"),
  });
  const action = useAction(() =>
    rpc<string>("squad_action", {
      action: "create",
      payload: { name, sport_id: sport, description },
    }),
  );
  return (
    <Screen>
      <Header eyebrow="FIND YOUR PEOPLE" title="Better together." />
      <Card style={{ backgroundColor: C.dark }}>
        <Txt size={25} color="white" bold>
          A game is a moment.{"\n"}A squad is your people.
        </Txt>
        <Txt color="#BECDB9">
          Join at 500 XP. Create at 1,000 XP. Your free plan includes one squad.
        </Txt>
        <Button
          title={create ? "Close creation" : "Create a squad"}
          icon="add"
          onPress={() => setCreate(!create)}
        />
      </Card>
      {create && (
        <Card>
          <Field label="Squad name" value={name} onChangeText={setName} />
          <Chips items={SPORTS} value={sport} onChange={setSport} />
          <Field
            label="What brings your squad together?"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Button
            title="Create squad"
            loading={action.isPending}
            onPress={() =>
              action.mutate(undefined, {
                onSuccess: (id) => router.push(`/squad/${id}`),
              })
            }
          />
        </Card>
      )}
      <ErrorBox error={q.error || action.error} />
      {q.isLoading && <Loading />}
      {q.data?.map((s) => (
        <Card key={s.id}>
          <Txt size={22} bold>
            {s.name}
          </Txt>
          <Txt color={C.muted}>
            {s.sport_id} · {s.squad_members.length} players
          </Txt>
          <Txt>{s.description}</Txt>
          <Button
            title="Meet the squad"
            kind="secondary"
            onPress={() => router.push(`/squad/${s.id}`)}
          />
        </Card>
      ))}
      {!q.isLoading && !q.data?.length && (
        <Empty
          icon="people-outline"
          title="Build something that lasts"
          body="Play together, earn participation XP, and turn a good run into a regular squad."
        />
      )}
    </Screen>
  );
}
export function SquadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const q = useQuery({
    queryKey: ["squad", id],
    queryFn: () => one<Squad>("squads", id, "*,squad_members(*,profiles(*))"),
  });
  const action = useAction((action: string) =>
    rpc("squad_action", { action, sid: id }),
  );
  const ownership = useAction((target: string | null) =>
    rpc("transfer_squad", { sid: id, target }),
  );
  if (q.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  const s = q.data;
  if (!s)
    return (
      <Screen>
        <ErrorBox error={q.error || Error("Squad unavailable")} />
      </Screen>
    );
  const member = s.squad_members.some((m) => m.user_id === session?.user.id);
  return (
    <Screen>
      <Header eyebrow={s.sport_id} title={s.name} />
      <Txt>{s.description}</Txt>
      <ErrorBox error={action.error || ownership.error} />
      <Button
        title={member ? "Leave squad" : "Join squad · 500 XP required"}
        kind={member ? "ghost" : "primary"}
        loading={action.isPending}
        onPress={() => action.mutate(member ? "leave" : "join")}
      />
      {member && (
        <>
          <Button
            title="Squad chat"
            icon="chatbubbles-outline"
            onPress={() =>
              router.push({
                pathname: "/chat",
                params: { kind: "squad", id, title: s.name },
              })
            }
          />
          <Button
            title="Organize a game"
            kind="secondary"
            onPress={() => router.push("/create")}
          />
        </>
      )}
      <Section title={`${s.squad_members.length} teammates`} />
      {s.squad_members.map((m) => (
        <Card key={m.user_id}>
          <Txt bold>
            {m.profiles?.name ?? "Player"}
            {m.user_id === s.owner_id ? " · Owner" : ""}
          </Txt>
          <Button
            title="View sports identity & showcase"
            kind="secondary"
            onPress={() => router.push(`/player/${m.user_id}`)}
          />
        </Card>
      ))}
      {s.owner_id === session?.user.id && (
        <Card>
          <Txt bold>Squad ownership</Txt>
          <Chips
            items={[
              { id: "", name: "Choose a teammate" },
              ...s.squad_members
                .filter((m) => m.user_id !== s.owner_id)
                .map((m) => ({
                  id: m.user_id,
                  name: m.profiles?.name ?? "Player",
                })),
            ]}
            value={newOwner}
            onChange={setNewOwner}
          />
          <Button
            title="Transfer ownership to selected teammate"
            disabled={!newOwner}
            loading={ownership.isPending}
            kind="secondary"
            onPress={() => ownership.mutate(newOwner)}
          />
          <Button
            title={
              closeConfirmed ? "Confirm closing this squad" : "Close squad"
            }
            kind="danger"
            loading={ownership.isPending}
            onPress={() =>
              closeConfirmed
                ? ownership.mutate(null, {
                    onSuccess: () => router.replace("/squads"),
                  })
                : setCloseConfirmed(true)
            }
          />
        </Card>
      )}
    </Screen>
  );
}
