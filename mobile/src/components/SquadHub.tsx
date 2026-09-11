import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Chips, C, ErrorBox, Field, Row, Txt } from "./ui";
import DateField from "./DateField";
import PlayerSearch from "./PlayerSearch";
import { Squad } from "../lib/types";
import { rpc, supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useAction } from "../lib/hooks";
import { formatDate } from "../lib/domain";
export default function SquadHub({ squad: s }: { squad: Squad }) {
  const { session } = useSession();
  const me = s.squad_members.find((m) => m.user_id === session?.user.id);
  const owner = s.owner_id === session?.user.id;
  const leader = owner || ["captain", "officer"].includes(me?.role ?? "");
  const [tab, setTab] = useState("updates");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [policy, setPolicy] = useState(s.join_policy ?? "open");
  const [limit, setLimit] = useState(String(s.member_limit ?? 50));
  const [xp, setXp] = useState(String(s.min_xp ?? 500));
  const action = useAction(
    (v: { action: string; target?: string; payload?: object }) =>
      rpc("squad_manage", { sid: s.id, ...v }),
  );
  const q = useQuery({
    queryKey: ["squadHub", s.id, tab],
    queryFn: async () => {
      const [announcements, events, requests, bans] = await Promise.all([
        supabase
          .from("squad_announcements")
          .select("*")
          .eq("squad_id", s.id)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("squad_events")
          .select("*,squad_event_rsvps(*)")
          .eq("squad_id", s.id)
          .eq("cancelled", false)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(20),
        supabase
          .from("squad_requests")
          .select("*,profiles(name)")
          .eq("squad_id", s.id),
        supabase
          .from("squad_bans")
          .select("*,profiles(name)")
          .eq("squad_id", s.id),
      ]);
      for (const result of [announcements, events, requests, bans])
        if (result.error) throw result.error;
      return {
        announcements: announcements.data ?? [],
        events: events.data ?? [],
        requests: requests.data ?? [],
        bans: bans.data ?? [],
      };
    },
  });
  return (
    <View style={{ gap: 14 }}>
      <Chips
        items={[
          { id: "updates", name: "Updates" },
          { id: "events", name: "Events" },
          ...(leader ? [{ id: "manage", name: "Manage" }] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorBox error={q.error || action.error} />
      {!me &&
        q.data?.requests.some(
          (r) => r.user_id === session?.user.id && r.kind === "invite",
        ) && (
          <Card>
            <Txt bold>You’re invited</Txt>
            <Button
              title="Accept squad invitation"
              loading={action.isPending}
              onPress={() => action.mutate({ action: "accept" })}
            />
            <Button
              title="Decline"
              kind="ghost"
              onPress={() => action.mutate({ action: "decline" })}
            />
          </Card>
        )}
      {tab === "updates" && (
        <>
          {leader && (
            <Card>
              <Field
                label="Post a squad update"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={2000}
              />
              <Button
                title="Post update"
                disabled={!body.trim()}
                loading={action.isPending}
                onPress={() =>
                  action.mutate(
                    { action: "announce", payload: { body } },
                    { onSuccess: () => setBody("") },
                  )
                }
              />
            </Card>
          )}
          {q.data?.announcements.map((a) => (
            <Card key={a.id}>
              <Txt>{a.body}</Txt>
              <Txt color={C.muted} size={12}>
                {formatDate(a.created_at)}
              </Txt>
              {leader && (
                <Button
                  title="Remove update"
                  kind="ghost"
                  onPress={() =>
                    action.mutate({
                      action: "delete_announcement",
                      target: a.id,
                    })
                  }
                />
              )}
            </Card>
          ))}
          {!q.data?.announcements.length && (
            <Txt color={C.muted}>Squad updates will appear here.</Txt>
          )}
        </>
      )}
      {tab === "events" && (
        <>
          {leader && (
            <Card>
              <Field label="Event name" value={title} onChangeText={setTitle} />
              <DateField label="When" value={date} onChange={setDate} />
              <Field
                label="Meeting place or details"
                value={place}
                onChangeText={setPlace}
              />
              <Button
                title="Schedule squad event"
                disabled={title.trim().length < 3 || !date}
                loading={action.isPending}
                onPress={() =>
                  action.mutate(
                    {
                      action: "event",
                      payload: {
                        title,
                        starts_at: new Date(date).toISOString(),
                        place,
                      },
                    },
                    {
                      onSuccess: () => {
                        setTitle("");
                        setDate("");
                        setPlace("");
                      },
                    },
                  )
                }
              />
            </Card>
          )}
          {q.data?.events.map((e) => (
            <Card key={e.id}>
              <Txt bold>{e.title}</Txt>
              <Txt>{formatDate(e.starts_at)}</Txt>
              <Txt color={C.muted}>{e.place}</Txt>
              <Txt size={12}>
                {
                  e.squad_event_rsvps.filter(
                    (r: { status: string }) => r.status === "going",
                  ).length
                }{" "}
                going
              </Txt>
              {me && (
                <Chips
                  items={[
                    { id: "going", name: "Going" },
                    { id: "maybe", name: "Maybe" },
                    { id: "out", name: "Can’t make it" },
                  ]}
                  value={
                    e.squad_event_rsvps.find(
                      (r: { user_id: string }) =>
                        r.user_id === session?.user.id,
                    )?.status ?? ""
                  }
                  onChange={(status) =>
                    action.mutate({
                      action: "rsvp",
                      target: e.id,
                      payload: { status },
                    })
                  }
                />
              )}{" "}
              {leader && (
                <Button
                  title="Cancel event"
                  kind="ghost"
                  onPress={() =>
                    action.mutate({ action: "cancel_event", target: e.id })
                  }
                />
              )}
            </Card>
          ))}
        </>
      )}
      {tab === "manage" && leader && (
        <>
          {owner && (
            <Card>
              <Txt bold>Membership</Txt>
              <Chips
                items={[
                  { id: "open", name: "Open" },
                  { id: "approval", name: "Apply to join" },
                  { id: "invite", name: "Invite only" },
                ]}
                value={policy}
                onChange={setPolicy}
              />
              <Field
                label="Member limit"
                value={limit}
                onChangeText={setLimit}
                keyboardType="number-pad"
              />
              <Field
                label="Minimum XP"
                value={xp}
                onChangeText={setXp}
                keyboardType="number-pad"
              />
              <Button
                title="Save squad settings"
                loading={action.isPending}
                onPress={() =>
                  action.mutate({
                    action: "settings",
                    payload: {
                      join_policy: policy,
                      member_limit: Number(limit),
                      min_xp: Number(xp),
                    },
                  })
                }
              />
            </Card>
          )}
          <Card>
            <PlayerSearch
              label="Invite a teammate"
              button="Invite"
              busy={action.isPending}
              onSelect={(target) => action.mutate({ action: "invite", target })}
            />
          </Card>
          {q.data?.requests.map((r) => (
            <Card key={r.user_id}>
              <Txt bold>
                {r.profiles?.name ?? "Player"} ·{" "}
                {r.kind === "invite" ? "Invited" : "Application"}
              </Txt>
              {!!r.note && <Txt>{r.note}</Txt>}
              <Row>
                {r.kind === "application" && (
                  <Button
                    title="Approve"
                    onPress={() =>
                      action.mutate({ action: "approve", target: r.user_id })
                    }
                  />
                )}
                <Button
                  title={r.kind === "invite" ? "Revoke invitation" : "Decline"}
                  kind="ghost"
                  onPress={() =>
                    action.mutate({ action: "reject", target: r.user_id })
                  }
                />
              </Row>
            </Card>
          ))}
          {s.squad_members
            .filter(
              (m) => m.user_id !== s.owner_id && m.user_id !== session?.user.id,
            )
            .map((m) => (
              <Card key={m.user_id}>
                <Txt bold>{m.profiles?.name ?? "Player"}</Txt>
                {owner && (
                  <Chips
                    items={[
                      { id: "member", name: "Member" },
                      { id: "officer", name: "Officer" },
                      { id: "captain", name: "Captain" },
                    ]}
                    value={m.role ?? "member"}
                    onChange={(role) =>
                      action.mutate({
                        action: "role",
                        target: m.user_id,
                        payload: { role },
                      })
                    }
                  />
                )}
                <Button
                  title="Remove member"
                  kind="ghost"
                  onPress={() =>
                    action.mutate({ action: "remove", target: m.user_id })
                  }
                />
                <Button
                  title="Ban from squad"
                  kind="ghost"
                  onPress={() =>
                    action.mutate({ action: "ban", target: m.user_id })
                  }
                />
              </Card>
            ))}
          {q.data?.bans.map((b) => (
            <Card key={b.user_id}>
              <Txt>{b.profiles?.name ?? "Player"} · Banned</Txt>
              <Button
                title="Lift ban"
                kind="secondary"
                onPress={() =>
                  action.mutate({ action: "unban", target: b.user_id })
                }
              />
            </Card>
          ))}
        </>
      )}
    </View>
  );
}
