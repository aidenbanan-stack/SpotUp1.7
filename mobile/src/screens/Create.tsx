import { useSports } from "../lib/sports";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Chips,
  ErrorBox,
  Field,
  Header,
  Screen,
  Section,
  Txt,
  C,
} from "../components/ui";
import DateField from "../components/DateField";
import VenuePicker, { VenueInput } from "../components/VenuePicker";
import { Game } from "../lib/types";
import { one, rpc, track } from "../lib/supabase";
import { useAction } from "../lib/hooks";
export default function Create() {
  const SPORTS = useSports();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [title, setTitle] = useState("");
  const [sport, setSport] = useState("other");
  const [date, setDate] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [skill, setSkill] = useState("All levels");
  const [format, setFormat] = useState("Open play");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [duration, setDuration] = useState("90");
  const [advanced, setAdvanced] = useState(false);
  const [venue, setVenue] = useState<VenueInput>({
    venue: "",
    address: "",
    latitude: "",
    longitude: "",
  });
  const q = useQuery({
    queryKey: ["game", edit, "edit"],
    enabled: !!edit,
    queryFn: () => one<Game>("games", edit!, "*,locations(*)"),
  });
  useEffect(() => {
    if (q.data) {
      const g = q.data;
      setTitle(g.title);
      const d = new Date(g.starts_at);
      setDate(
        new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      );
      setCapacity(String(g.capacity));
      setDescription(g.description);
      setSport(g.sport_id);
    }
  }, [q.data]);
  const action = useAction(async () => {
    const starts = new Date(date);
    if (!title.trim() || !date || !Number.isFinite(starts.getTime()))
      throw Error("Add a title and valid local start date/time.");
    if (starts <= new Date()) throw Error("Choose a future start time.");
    const payload = {
      title: title.trim(),
      sport_id: sport,
      starts_at: starts.toISOString(),
      capacity: Number(capacity),
      skill,
      format,
      description,
      visibility,
      duration_minutes: Number(duration),
      ...venue,
    };
    if (edit) {
      await rpc("edit_game", { gid: edit, payload });
      return edit;
    }
    if (!venue.venue || !venue.address || !venue.latitude || !venue.longitude)
      throw Error("Choose a venue with coordinates.");
    const id = await rpc<string>("create_game", { payload });
    await track("game_created", id);
    return id;
  });
  return (
    <Screen>
      <Header
        eyebrow="MAKE THE FIRST MOVE"
        title={edit ? "Edit your game" : "Get a game going"}
      />
      <Txt color={C.muted}>A few details. A few good people. A great game.</Txt>
      <Field
        label="Give your game a name"
        placeholder="Sunday pickup session"
        value={title}
        onChangeText={setTitle}
      />
      {!edit && (
        <>
          <Section title="Pick your sport" />
          <Chips items={SPORTS} value={sport} onChange={setSport} />
        </>
      )}
      <DateField label="When are we playing?" value={date} onChange={setDate} />
      <Field
        label="Player capacity (including you)"
        value={capacity}
        onChangeText={setCapacity}
        keyboardType="number-pad"
      />
      {!edit && (
        <>
          <Section title="Where are we playing?" />
          <VenuePicker value={venue} onChange={setVenue} />
          <Section title="The vibe" />
          <Chips
            items={["All levels", "Casual", "Intermediate", "Competitive"].map(
              (id) => ({ id, name: id }),
            )}
            value={skill}
            onChange={setSkill}
          />
          <Button
            title={advanced ? "Fewer options" : "Format, privacy & duration"}
            kind="ghost"
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced && (
            <>
              <Field label="Format" value={format} onChangeText={setFormat} />
              <Field
                label="Duration in minutes"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
              />
              <Chips
                items={[
                  { id: "public", name: "Public game" },
                  { id: "private", name: "Invited players only" },
                ]}
                value={visibility}
                onChange={setVisibility}
              />
            </>
          )}
        </>
      )}
      <Field
        label="Anything players should know?"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Bring a light and a dark shirt. Meet at the main entrance."
      />
      <ErrorBox error={action.error || q.error} />
      <Button
        title={edit ? "Save changes" : "Create game"}
        icon="arrow-forward"
        loading={action.isPending}
        onPress={() =>
          action.mutate(undefined, {
            onSuccess: (id) => router.replace(`/game/${id}`),
          })
        }
      />
    </Screen>
  );
}
