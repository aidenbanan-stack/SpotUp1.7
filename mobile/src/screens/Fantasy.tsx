import React, { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Avatar,
  Button,
  Card,
  C,
  Chips,
  Empty,
  ErrorBox,
  Field,
  Header,
  Row,
  Screen,
  Tag,
  Txt,
} from "../components/ui";
import { rpc, supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useAction } from "../lib/hooks";
type Candidate = {
  user_id: string;
  enabled: boolean;
  profiles: { name: string; city: string; sports: string[] };
};
type Standing = {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  points: number;
  week_start: string;
};
export default function Fantasy() {
  const { session } = useSession();
  const [week, setWeek] = useState("0");
  const [draft, setDraft] = useState(false);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setFilter(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const optState = useQuery({
    queryKey: ["fantasyOpt", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fantasy_players")
        .select("enabled")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const pool = useQuery({
    queryKey: ["fantasyPlayers", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fantasy_players")
        .select("user_id,enabled,profiles!inner(name,city,sports)")
        .eq("enabled", true)
        .ilike("profiles.name", `%${filter.replace(/[%_]/g, "")}%`)
        .limit(50);
      if (error) throw error;
      return data as unknown as Candidate[];
    },
  });
  const board = useQuery({
    queryKey: ["fantasyBoard", week],
    queryFn: () =>
      rpc<Standing[]>("fantasy_board", { week_offset: Number(week) }),
  });
  const entry = useQuery({
    queryKey: ["fantasyDraft", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fantasy_entries")
        .select("name,week_start,fantasy_roster(player_id)")
        .eq("owner_id", session!.user.id)
        .order("week_start", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0];
    },
  });
  const opt = useAction((v: boolean) => rpc("fantasy_opt_in", { opted_in: v }));
  const save = useAction(() =>
    rpc("save_fantasy_team", { team_name: name, players: chosen }),
  );
  const enrolled = optState.data?.enabled;
  const candidates = (pool.data ?? []).filter(
    (p) =>
      p.enabled &&
      p.user_id !== session?.user.id &&
      p.profiles?.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Screen>
      <Header eyebrow="FANTASY · REAL PEOPLE" title="Draft your community." />
      <Txt color={C.muted}>
        Back the players who show up. Build a three-player lineup for next week
        and compete for bragging rights.
      </Txt>
      <Row>
        <Tag>FREE TO PLAY</Tag>
        <Tag color={C.blue}>3 PLAYERS</Tag>
      </Row>
      <Card>
        <Txt bold>Get drafted by your community</Txt>
        <Txt size={13} color={C.muted}>
          Opt in to appear in the player pool. You can leave at any time; your
          participation will stop contributing to fantasy scores.
        </Txt>
        <Button
          title={enrolled ? "Leave the player pool" : "Join the player pool"}
          kind="secondary"
          loading={opt.isPending}
          onPress={() => opt.mutate(!enrolled)}
        />
      </Card>
      <Button
        title={
          draft
            ? "Close lineup builder"
            : entry.data
              ? "Manage next week’s lineup"
              : "Build next week’s lineup"
        }
        icon="people-outline"
        onPress={() => {
          if (!draft) {
            const next = new Date();
            const days = (8 - next.getUTCDay()) % 7 || 7;
            next.setUTCDate(next.getUTCDate() + days);
            const same =
              entry.data?.week_start === next.toISOString().slice(0, 10);
            setName(same ? entry.data!.name : "");
            setChosen(
              same
                ? entry.data!.fantasy_roster.map(
                    (p: { player_id: string }) => p.player_id,
                  )
                : [],
            );
          }
          setDraft(!draft);
        }}
      />
      {draft && (
        <Card>
          <Field
            label="Team name"
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
          <Txt bold>Your lineup · {chosen.length}/3</Txt>
          <Field
            label="Find a player"
            value={search}
            onChangeText={setSearch}
          />
          {candidates.map((p) => (
            <Pressable
              key={p.user_id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen.includes(p.user_id) }}
              onPress={() =>
                setChosen((prev) =>
                  prev.includes(p.user_id)
                    ? prev.filter((id) => id !== p.user_id)
                    : prev.length < 3
                      ? [...prev, p.user_id]
                      : prev,
                )
              }
              style={{ paddingVertical: 10 }}
            >
              <Row>
                <Avatar name={p.profiles.name} />
                <View style={{ flex: 1 }}>
                  <Txt bold>{p.profiles.name}</Txt>
                  <Txt size={12} color={C.muted}>
                    {p.profiles.city || p.profiles.sports.join(" · ")}
                  </Txt>
                </View>
                <Txt color={C.blue}>
                  {chosen.includes(p.user_id) ? "Selected" : "Add"}
                </Txt>
              </Row>
            </Pressable>
          ))}
          {!candidates.length && (
            <Txt color={C.muted}>
              No matching opted-in players yet. Players can join the pool from
              this page.
            </Txt>
          )}
          <Txt size={12} color={C.muted}>
            Lineups lock Monday at 00:00 UTC. Changes apply to next week only.
          </Txt>
          <Button
            title="Save lineup"
            disabled={chosen.length !== 3 || name.trim().length < 3}
            loading={save.isPending}
            onPress={() =>
              save.mutate(undefined, {
                onSuccess: () => {
                  setNotice("Your lineup is ready for next week.");
                  setDraft(false);
                  setWeek("1");
                },
              })
            }
          />
        </Card>
      )}
      {!!notice && <Txt color={C.blue}>{notice}</Txt>}
      <Chips
        items={[
          { id: "-1", name: "Last week" },
          { id: "0", name: "This week" },
          { id: "1", name: "Next week" },
        ]}
        value={week}
        onChange={setWeek}
      />
      {(board.data ?? []).map((e, i) => (
        <Card key={e.id}>
          <Row>
            <Txt color={C.blue} bold size={22}>
              {i + 1}
            </Txt>
            <View style={{ flex: 1 }}>
              <Txt bold>{e.name}</Txt>
              <Pressable
                onPress={() => router.push(`/player/${e.owner_id}`)}
                accessibilityRole="button"
              >
                <Txt color={C.muted} size={12}>
                  {e.owner_name}
                </Txt>
              </Pressable>
            </View>
            <Txt bold size={22}>
              {e.points}
            </Txt>
          </Row>
        </Card>
      ))}
      {!board.isLoading && !board.data?.length && (
        <Empty
          icon="trophy-outline"
          title="The board is wide open"
          body="Build a lineup for next week. Rankings start when the games do."
        />
      )}
      <Card>
        <Txt bold>Simple scoring. Real participation.</Txt>
        <Txt size={13} color={C.muted}>
          10 points for a drafted player’s host-confirmed attendance in a
          completed game. Up to three games per player per week. Games they host
          do not count. No money, wagers, or cash prizes.
        </Txt>
      </Card>
      <ErrorBox
        error={
          pool.error || board.error || entry.error || opt.error || save.error
        }
      />
    </Screen>
  );
}
