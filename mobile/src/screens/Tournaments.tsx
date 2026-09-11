import TournamentBudget from "../components/TournamentBudget";
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
  Tag,
  Txt,
} from "../components/ui";
import DateField from "../components/DateField";
import VenuePicker, { VenueInput } from "../components/VenuePicker";
import { Tournament, Match, Squad } from "../lib/types";
import { one, rows, rpc } from "../lib/supabase";
import { useAction, useRealtime } from "../lib/hooks";
import { useSession } from "../lib/session";
import { formatDate } from "../lib/domain";
const SELECT = "*,locations(*),tournament_teams(*,squads(*))";
export default function Tournaments() {
  const SPORTS = useSports();
  const [create, setCreate] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("other");
  const [date, setDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [teams, setTeams] = useState("4");
  const [venue, setVenue] = useState<VenueInput>({
    venue: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const q = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => rows<Tournament>("tournaments", SELECT, {}, "starts_at"),
  });
  const action = useAction(async () => {
    if (
      !date ||
      !deadline ||
      !venue.venue ||
      !venue.latitude ||
      !venue.longitude
    )
      throw Error("Complete the tournament dates and venue.");
    return rpc<string>("create_tournament", {
      payload: {
        name,
        sport_id: sport,
        starts_at: new Date(date).toISOString(),
        registration_deadline: new Date(deadline).toISOString(),
        max_teams: Number(teams),
        ...venue,
      },
    });
  });
  return (
    <Screen>
      <Header eyebrow="BRING YOUR BEST" title="Time to compete." />
      <Card style={{ backgroundColor: C.dark }}>
        <Tag color={C.blue}>SINGLE ELIMINATION</Tag>
        <Txt size={28} color="white" bold>
          One bracket.{"\n"}Everything to play for.
        </Txt>
        <Txt color="#B4C6DD">
          Register your squad. Play your way through. Build a shared history.
        </Txt>
        <Button
          title={create ? "Close creation" : "Organize a tournament"}
          icon="trophy-outline"
          onPress={() => setCreate(!create)}
        />
      </Card>
      {create && (
        <Card>
          <Field label="Tournament name" value={name} onChangeText={setName} />
          <Chips items={SPORTS} value={sport} onChange={setSport} />
          <DateField
            label="Tournament starts"
            value={date}
            onChange={setDate}
          />
          <DateField
            label="Registration closes"
            value={deadline}
            onChange={setDeadline}
          />
          <Chips
            items={["4", "8", "16", "32"].map((id) => ({
              id,
              name: id + " squads",
            }))}
            value={teams}
            onChange={setTeams}
          />
          <VenuePicker value={venue} onChange={setVenue} />
          <TournamentBudget />
          <Button
            title="Create tournament"
            loading={action.isPending}
            onPress={() =>
              action.mutate(undefined, {
                onSuccess: (id) => router.push(`/tournament/${id}`),
              })
            }
          />
        </Card>
      )}
      <ErrorBox error={q.error || action.error} />
      {q.isLoading && <Loading />}
      {q.data?.map((t) => (
        <Card key={t.id}>
          <Tag>{t.status.toUpperCase()}</Tag>
          <Txt size={23} bold>
            {t.name}
          </Txt>
          <Txt color={C.muted}>
            {t.sport_id} · {t.locations.name}
          </Txt>
          <Txt>{formatDate(t.starts_at)}</Txt>
          <Txt size={12}>
            {t.tournament_teams.length}/{t.max_teams} squads · Register by{" "}
            {formatDate(t.registration_deadline)}
          </Txt>
          <Button
            title="View tournament"
            kind="secondary"
            onPress={() => router.push(`/tournament/${t.id}`)}
          />
        </Card>
      ))}
      {!q.data?.length && !q.isLoading && (
        <Empty
          icon="trophy-outline"
          title="Your community’s next big moment"
          body="Organize a tournament and give local squads something to compete for."
        />
      )}
    </Screen>
  );
}
export function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => one<Tournament>("tournaments", id, SELECT),
  });
  const matches = useQuery({
    queryKey: ["matches", id],
    queryFn: () =>
      rows<Match>("tournament_matches", "*", { tournament_id: id }, "round"),
  });
  const squads = useQuery({
    queryKey: ["ownedSquads"],
    queryFn: () => rows<Squad>("squads", "*", { owner_id: session!.user.id }),
  });
  useRealtime("tournament_matches", `tournament_id=eq.${id}`);
  const action = useAction(
    (v: {
      action: string;
      sid?: string;
      mid?: string;
      a?: number;
      b?: number;
    }) => rpc("tournament_action", { tid: id, ...v }),
  );
  if (q.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  const t = q.data;
  if (!t)
    return (
      <Screen>
        <ErrorBox error={q.error} />
      </Screen>
    );
  const host = t.organizer_id === session?.user.id;
  const mySquad = squads.data?.[0];
  const registered = t.tournament_teams.some(
    (team) => team.squad_id === mySquad?.id,
  );
  const name = (tid: string | null) =>
    t.tournament_teams.find((team) => team.id === tid)?.squads.name ??
    "Awaiting winner";
  return (
    <Screen>
      <Tag>
        {t.status.toUpperCase()} · {t.sport_id.toUpperCase()}
      </Tag>
      <Header title={t.name} />
      <Card>
        <Txt bold>{t.locations.name}</Txt>
        <Txt>{formatDate(t.starts_at)}</Txt>
        <Txt color={C.muted}>
          Registration closes {formatDate(t.registration_deadline)}
        </Txt>
        <Txt>
          {t.tournament_teams.length}/{t.max_teams} squads
        </Txt>
      </Card>
      <ErrorBox error={action.error || matches.error || squads.error} />
      {t.status === "registration" && mySquad && (
        <Button
          title={registered ? "Withdraw squad" : `Register ${mySquad.name}`}
          loading={action.isPending}
          onPress={() =>
            action.mutate({
              action: registered ? "withdraw" : "register",
              sid: mySquad.id,
            })
          }
        />
      )}
      {!mySquad && (
        <Button
          title="Find or create a squad"
          kind="secondary"
          onPress={() => router.push("/squads")}
        />
      )}
      <Button
        title="Tournament chat"
        kind="secondary"
        icon="chatbubbles-outline"
        onPress={() =>
          router.push({
            pathname: "/chat",
            params: { kind: "tournament", id, title: t.name },
          })
        }
      />
      {host && t.status === "registration" && (
        <Button
          title="Close registration & generate bracket"
          loading={action.isPending}
          onPress={() => action.mutate({ action: "start" })}
        />
      )}
      <Section title="The bracket" />
      {!matches.data?.length && (
        <Txt color={C.muted}>
          The organizer generates the bracket after registration closes with all
          slots filled.
        </Txt>
      )}
      {[...(matches.data ?? [])]
        .sort((a, b) => a.round - b.round || a.slot - b.slot)
        .map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            name={name}
            host={host && t.status === "live"}
            onScore={(a, b) =>
              action.mutate({ action: "score", mid: m.id, a, b })
            }
            busy={action.isPending}
          />
        ))}
      <Section title="The squads" />
      {t.tournament_teams.map((team) => (
        <Card key={team.id}>
          <Txt bold>{team.squads.name}</Txt>
          <Button
            title="View players & showcases"
            kind="secondary"
            onPress={() => router.push(`/squad/${team.squad_id}`)}
          />
        </Card>
      ))}
    </Screen>
  );
}
function MatchCard({
  match: m,
  name,
  host,
  onScore,
  busy,
}: {
  match: Match;
  name: (id: string | null) => string;
  host: boolean;
  onScore: (a: number, b: number) => void;
  busy: boolean;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <Card>
      <Tag>
        ROUND {m.round} · MATCH {m.slot}
      </Tag>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{name(m.team_a)}</Txt>
        <Txt bold>{m.score_a ?? "–"}</Txt>
      </Row>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt bold>{name(m.team_b)}</Txt>
        <Txt bold>{m.score_b ?? "–"}</Txt>
      </Row>
      {m.winner_id && <Tag color={C.blue}>WINNER · {name(m.winner_id)}</Tag>}
      {host && m.team_a && m.team_b && !m.winner_id && (
        <>
          <Field
            label={`${name(m.team_a)} score`}
            value={a}
            onChangeText={setA}
            keyboardType="number-pad"
          />
          <Field
            label={`${name(m.team_b)} score`}
            value={b}
            onChangeText={setB}
            keyboardType="number-pad"
          />
          <Button
            title="Confirm result & advance winner"
            disabled={!a || !b}
            loading={busy}
            onPress={() => onScore(Number(a), Number(b))}
          />
        </>
      )}
    </Card>
  );
}
