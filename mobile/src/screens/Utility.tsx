import React, { useState, useEffect } from "react";
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
  Screen,
  Section,
  Tag,
  Txt,
} from "../components/ui";
import { useSession, useMe } from "../lib/session";
import { rows, rpc, supabase } from "../lib/supabase";
import { useAction, useRealtime } from "../lib/hooks";
import { achievements, formatDate } from "../lib/domain";
import { Game, Profile, Summary } from "../lib/types";
export function Notifications() {
  const { session } = useSession();
  useRealtime("notifications", `user_id=eq.${session?.user.id}`);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      rows<{
        id: string;
        title: string;
        body: string;
        path: string | null;
        read_at: string | null;
      }>("notifications"),
  });
  const action = useAction(async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  });
  return (
    <Screen>
      <Header title="Your sideline" />
      <ErrorBox error={q.error || action.error} />
      {q.isLoading && <Loading />}
      {q.data?.map((n) => (
        <Card key={n.id}>
          {!n.read_at && <Tag color={C.blue}>NEW</Tag>}
          <Txt bold>{n.title}</Txt>
          <Txt>{n.body}</Txt>
          <Button
            title={n.path ? "View update" : "Mark as read"}
            kind="secondary"
            onPress={() =>
              action.mutate(n.id, {
                onSuccess: () => {
                  if (n.path) router.push(n.path as never);
                },
              })
            }
          />
        </Card>
      ))}
      {!q.isLoading && !q.data?.length && (
        <Empty
          icon="notifications-outline"
          title="You’re all caught up"
          body="Game updates and invitations will appear here."
        />
      )}
    </Screen>
  );
}
export function NotificationSettings() {
  const { session } = useSession();
  const [game, setGame] = useState("on");
  const [social, setSocial] = useState("on");
  const q = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (q.data) {
      setGame(q.data.game_updates ? "on" : "off");
      setSocial(q.data.social ? "on" : "off");
    }
  }, [q.data]);
  const action = useAction(async () => {
    const { error } = await supabase
      .from("notification_preferences")
      .update({ game_updates: game === "on", social: social === "on" })
      .eq("user_id", session!.user.id);
    if (error) throw error;
  });
  return (
    <Screen>
      <Header title="Notifications" />
      {[
        { label: "Game updates", value: game, set: setGame },
        { label: "Social activity", value: social, set: setSocial },
      ].map((x) => (
        <Card key={x.label}>
          <Txt bold>{x.label}</Txt>
          <Chips
            items={[
              { id: "on", name: "On" },
              { id: "off", name: "Off" },
            ]}
            value={x.value}
            onChange={x.set}
          />
        </Card>
      ))}
      <Txt color={C.muted}>
        In-app history stays available. Push delivery respects these preferences
        and quiet hours (10 PM–8 AM Pacific in this release).
      </Txt>
      <ErrorBox error={q.error || action.error} />
      <Button
        title={action.isSuccess ? "Saved" : "Save preferences"}
        loading={action.isPending}
        onPress={() => action.mutate()}
      />
    </Screen>
  );
}
export function Report() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const [reason, setReason] = useState("");
  const action = useAction(() =>
    rpc("report_content", { kind, target: id, reason }),
  );
  return (
    <Screen>
      <Header
        title={action.isSuccess ? "Report received" : "Help keep SpotUp safe"}
      />
      {action.isSuccess ? (
        <Card>
          <Txt>
            A moderator can now review this report. Thank you for looking out
            for the community.
          </Txt>
          <Button title="Back" onPress={() => router.back()} />
        </Card>
      ) : (
        <>
          <Txt color={C.muted}>
            Tell us what happened. Reports are not shown to the person you
            report.
          </Txt>
          <Field
            label="Reason for reporting"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
          />
          <ErrorBox error={action.error} />
          <Button
            title="Submit report"
            disabled={reason.trim().length < 3}
            loading={action.isPending}
            onPress={() => action.mutate()}
          />
        </>
      )}
    </Screen>
  );
}
export function Progress() {
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["xp"],
    queryFn: () =>
      rows<{ id: string; amount: number; reason: string; created_at: string }>(
        "xp_transactions",
      ),
  });
  const summary = useQuery({
    queryKey: ["summary", session?.user.id],
    queryFn: () => rpc<Summary>("player_summary", { uid: session!.user.id }),
  });
  const action = useAction(() => rpc("claim_daily"));
  return (
    <Screen>
      <Header eyebrow="EARNED BY SHOWING UP" title="Your progress" />
      <Card style={{ backgroundColor: C.dark }}>
        <Txt size={42} bold color={C.blue}>
          {summary.data?.xp ?? 0} XP
        </Txt>
        <Txt color="white">
          Level {summary.data?.level ?? 1} · {summary.data?.games ?? 0}{" "}
          confirmed games
        </Txt>
      </Card>
      <Card>
        <Txt bold>Your next level</Txt>
        <Txt color={C.muted}>
          {250 - ((summary.data?.xp ?? 0) % 250)} XP to level{" "}
          {(summary.data?.level ?? 1) + 1}. Each level takes 250 participation
          XP.
        </Txt>
        <Txt size={13}>Play a confirmed game · +20 XP</Txt>
        <Txt size={13}>Verified playing time · +5 XP per 30 minutes</Txt>
        <Txt size={13}>
          Recognize another player · +15 XP (up to 40 per game)
        </Txt>
      </Card>
      <Section title="Your milestones" />
      {achievements(
        summary.data?.games ?? 0,
        summary.data?.reliability ?? null,
        summary.data?.xp ?? 0,
      ).map((a) => (
        <Card key={a.name}>
          <Tag color={a.earned ? C.blue : C.soft}>
            {a.earned ? "EARNED" : "NEXT UP"}
          </Tag>
          <Txt bold>{a.name}</Txt>
          <Txt size={12} color={C.muted}>
            {a.detail}
          </Txt>
        </Card>
      ))}
      <Card>
        <Txt bold>Daily consistency bonus · +5 XP</Txt>
        <Txt color={C.muted}>
          Reliability above 90% unlocks your bonus. Resets at 3 AM Pacific.
        </Txt>
        <Button
          title={action.isSuccess ? "Bonus claimed" : "Claim daily bonus"}
          disabled={(summary.data?.reliability ?? 0) <= 90 || action.isSuccess}
          loading={action.isPending}
          onPress={() => action.mutate()}
        />
      </Card>
      <ErrorBox error={q.error || summary.error || action.error} />
      <Button
        title="Community leaderboard"
        kind="secondary"
        onPress={() => router.push("/leaderboard")}
      />
      <Section title="Your XP ledger" />
      {q.data?.map((x) => (
        <Card key={x.id}>
          <Txt bold>
            +{x.amount} · {x.reason}
          </Txt>
          <Txt size={12} color={C.muted}>
            {formatDate(x.created_at)}
          </Txt>
        </Card>
      ))}
      {!q.data?.length && !q.isLoading && (
        <Txt color={C.muted}>
          Your first host-confirmed game earns 20 XP. Content views and likes do
          not earn participation XP.
        </Txt>
      )}
    </Screen>
  );
}
export function Leaderboard() {
  const { data: me } = useMe();
  const [mode, setMode] = useState("global");
  const q = useQuery({
    queryKey: ["leaderboard", mode, me?.city],
    queryFn: () =>
      rpc<
        {
          id: string;
          name: string;
          xp: number;
          reliability: number | null;
          games: number;
        }[]
      >("leaderboard", {
        area: mode === "local" ? me?.city || "__unset__" : null,
      }),
  });
  return (
    <Screen>
      <Header
        eyebrow="PARTICIPATION, NOT POPULARITY"
        title="Community leaders"
      />
      <Chips
        items={[
          { id: "global", name: "All players" },
          { id: "local", name: "My area" },
        ]}
        value={mode}
        onChange={setMode}
      />
      <ErrorBox error={q.error} />
      {q.data?.map((p, i) => (
        <Card key={p.id}>
          <Txt size={20} bold>
            {i + 1}. {p.name}
          </Txt>
          <Txt color={C.muted}>
            {p.xp} XP · {p.games} games ·{" "}
            {p.reliability == null
              ? "New player"
              : p.reliability + "% reliability"}
          </Txt>
          <Button
            title="View player"
            kind="ghost"
            onPress={() => router.push(`/player/${p.id}`)}
          />
        </Card>
      ))}
    </Screen>
  );
}
export function Search() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("profiles");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const column = kind === "games" ? "title" : "name";
  const q = useQuery({
    queryKey: ["search", kind, term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const safe = term.replace(/[%_]/g, "");
      const { data, error } = await supabase
        .from(kind)
        .select("*")
        .ilike(column, `%${safe}%`)
        .limit(30);
      if (error) throw error;
      return data as {
        id: string;
        name?: string;
        title?: string;
        city?: string;
        address?: string;
      }[];
    },
  });
  const path: Record<string, string> = {
    profiles: "player",
    games: "game",
    squads: "squad",
    tournaments: "tournament",
    locations: "venue",
  };
  return (
    <Screen>
      <Header title="Find your community" />
      <Field
        label="Search"
        value={text}
        onChangeText={setText}
        placeholder="Players, games, squads, places…"
      />
      <Chips
        items={[
          { id: "profiles", name: "Players" },
          { id: "games", name: "Games" },
          { id: "squads", name: "Squads" },
          { id: "tournaments", name: "Tournaments" },
          { id: "locations", name: "Venues" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <ErrorBox error={q.error} />
      {q.isFetching && <Loading />}
      {q.data?.map((r) => (
        <Card key={r.id}>
          <Txt bold>{r.name || r.title}</Txt>
          <Txt color={C.muted}>{r.city || r.address}</Txt>
          <Button
            title="View"
            kind="secondary"
            onPress={() => router.push(`/${path[kind]}/${r.id}` as never)}
          />
        </Card>
      ))}
      {term.length >= 2 && !q.isFetching && !q.data?.length && (
        <Txt color={C.muted}>No matches. Try another name or category.</Txt>
      )}
    </Screen>
  );
}
export function Invite() {
  const { player } = useLocalSearchParams<{ player: string }>();
  const { session } = useSession();
  const q = useQuery({
    queryKey: ["hostGames"],
    queryFn: () =>
      rows<Game>(
        "games",
        "*",
        { host_id: session!.user.id, status: "upcoming" },
        "starts_at",
      ),
  });
  const action = useAction((gid: string) =>
    rpc("game_action", { gid, action: "invite", target: player }),
  );
  return (
    <Screen>
      <Header title="Invite a player to play" />
      <ErrorBox error={q.error || action.error} />
      {action.isSuccess && <Txt>Invitation sent.</Txt>}
      {q.data?.map((g) => (
        <Card key={g.id}>
          <Txt bold>{g.title}</Txt>
          <Button
            title="Send invitation"
            loading={action.isPending}
            onPress={() => action.mutate(g.id)}
          />
        </Card>
      ))}
      {!q.data?.length && (
        <Empty
          title="Host something worth joining"
          body="Create a game, then invite this player."
          action={
            <Button
              title="Create game"
              onPress={() => router.push("/create")}
            />
          }
        />
      )}
    </Screen>
  );
}
export function Help() {
  return (
    <Screen>
      <Header title="A better game for everyone" />
      <Card>
        <Txt bold>Show up. Play fair. Respect people.</Txt>
        <Txt>
          Respect personal space, consent, and venue rules. No harassment,
          threats, hate, sexual content, or dangerous challenges. Film only
          where appropriate and respect requests not to be included.
        </Txt>
        <Txt>
          Report a post, showcase, comment, message, game, or player using its
          Report control. Block players from their profile. You can remove your
          own clips and messages.
        </Txt>
      </Card>
      <Card>
        <Txt bold>Your location stays yours</Txt>
        <Txt>
          SpotUp stores your chosen home area and game venues. It does not
          publish your live personal location. You choose your showcase audience
          and who can comment, react, or tag you.
        </Txt>
      </Card>
      <Card>
        <Txt bold>Having trouble?</Txt>
        <Txt>
          Pull to refresh for updated games and messages. Check network
          connectivity and use the retry action on an error. Contact the game
          host in game chat for coordination issues.
        </Txt>
      </Card>
    </Screen>
  );
}
