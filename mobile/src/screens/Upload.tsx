import { useSports } from "../lib/sports";
import React, { useState } from "react";
import { Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  C,
  Chips,
  ErrorBox,
  Field,
  Header,
  Screen,
  Section,
  Txt,
} from "../components/ui";
import { CATEGORIES, Media, Game, Squad, Tournament } from "../lib/types";
import { rpc, rows, supabase, track } from "../lib/supabase";
import { useAction } from "../lib/hooks";
import { useSession } from "../lib/session";
import { validateVideo } from "../lib/domain";
export default function Upload() {
  const SPORTS = useSports();
  const params = useLocalSearchParams<{
    kind?: string;
    game?: string;
    sport?: string;
  }>();
  const kind = params.kind === "showcase" ? "showcase" : "post";
  const { session } = useSession();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset>();
  const [caption, setCaption] = useState("");
  const [sport, setSport] = useState(params.sport ?? "other");
  const [category, setCategory] = useState(
    kind === "showcase" ? "Skills" : "Highlights",
  );
  const [visibility, setVisibility] = useState("members");
  const [game, setGame] = useState(params.game ?? "");
  const [squad, setSquad] = useState("");
  const [tournament, setTournament] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<unknown>();
  const [stage, setStage] = useState("");
  const [sent, setSent] = useState(false);
  const [includeVenue, setIncludeVenue] = useState(false);
  const [upload, setUpload] = useState<Media>();
  const games = useQuery({
    queryKey: ["uploadGames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_players")
        .select("games(*,locations(*))")
        .eq("user_id", session!.user.id)
        .limit(50);
      if (error) throw error;
      return data.map((r) => r.games) as unknown as Game[];
    },
  });
  const squads = useQuery({
    queryKey: ["uploadSquads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squad_members")
        .select("squads(*)")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return data.map((r) => r.squads) as unknown as Squad[];
    },
  });
  const tournaments = useQuery({
    queryKey: ["uploadTournaments"],
    queryFn: () => rows<Tournament>("tournaments", "*", {}, "starts_at", 30),
  });
  async function pick(camera: boolean) {
    try {
      setError(undefined);
      let result: ImagePicker.ImagePickerResult;
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted)
          throw Error("Camera permission is needed to record a clip.");
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["videos"],
          videoMaxDuration: 90,
          quality: 0.7,
        });
      } else
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["videos"],
          videoMaxDuration: 90,
          quality: 0.7,
        });
      if (!result.canceled) {
        validateVideo(result.assets[0].fileSize, result.assets[0].duration);
        setAsset(result.assets[0]);
        setUpload(undefined);
      }
    } catch (e) {
      setError(e);
    }
  }
  const action = useAction(async () => {
    if (!asset) throw Error("Record or choose a video first.");
    validateVideo(asset.fileSize, asset.duration);
    setStage("Preparing your video…");
    let m = upload;
    if (!m) {
      m = await rpc<Media>("begin_upload");
      setUpload(m);
    }
    const bytes =
      Platform.OS === "web"
        ? await (await fetch(asset.uri)).arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
    validateVideo(bytes.byteLength, asset.duration);
    setStage("Uploading video…");
    const { error } = await supabase.storage
      .from("videos")
      .upload(m.object_path, bytes, {
        contentType:
          asset.mimeType === "video/quicktime"
            ? "video/quicktime"
            : "video/mp4",
        upsert: false,
      });
    if (error && !error.message.toLowerCase().includes("already exists"))
      throw error;
    setStage("Submitting for review…");
    const id = await rpc<string>("publish_video", {
      mid: m.id,
      kind,
      payload: {
        caption,
        sport_id: sport,
        category,
        visibility,
        game_id: game || null,
        squad_id: squad || null,
        tournament_id: tournament || null,
        location_id: includeVenue
          ? (games.data?.find((g) => g.id === game)?.locations?.id ?? null)
          : null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
    });
    await track(kind === "post" ? "post_submitted" : "showcase_submitted", id);
    setSent(true);
  });
  if (sent)
    return (
      <Screen>
        <Header title="Your video is in review" />
        <Card>
          <Txt>
            Your {kind === "showcase" ? "Skill Showcase" : "sports clip"} has
            been uploaded. It will become visible to its audience after review.
          </Txt>
          <Txt color={C.muted}>You can see its status on your profile.</Txt>
          <Button
            title="View my profile"
            onPress={() => router.replace("/profile")}
          />
        </Card>
      </Screen>
    );
  return (
    <Screen>
      <Header
        eyebrow={
          kind === "showcase"
            ? "YOUR ABILITY, IN CONTEXT"
            : "CAPTURE THE MOMENT"
        }
        title={
          kind === "showcase" ? "Build your showcase" : "Post a sports clip"
        }
      />
      <Txt color={C.muted}>
        {kind === "showcase"
          ? "A dedicated part of your player identity. These videos provide context, never an automatic skill rating."
          : "Share the highlights, the hard work, and the moments that make playing worth it."}
      </Txt>
      <Card>
        <Button
          title="Record a video"
          icon="videocam-outline"
          kind="secondary"
          onPress={() => pick(true)}
          disabled={action.isPending}
        />
        <Button
          title="Choose from device"
          icon="cloud-upload-outline"
          onPress={() => pick(false)}
          disabled={action.isPending}
        />
        <Txt size={12} color={C.muted}>
          Up to 90 seconds · 100 MB · MP4 or MOV
        </Txt>
        {asset && (
          <Txt bold>
            {asset.fileName || "Video selected"}
            {asset.duration
              ? ` · ${Math.round(asset.duration / 1000)} seconds`
              : ""}
          </Txt>
        )}
      </Card>
      <Chips items={SPORTS} value={sport} onChange={setSport} />
      <Chips
        items={CATEGORIES.map((id) => ({ id, name: id }))}
        value={category}
        onChange={setCategory}
      />
      <Field
        label="Caption"
        value={caption}
        onChangeText={setCaption}
        maxLength={1500}
        multiline
        placeholder={
          kind === "showcase"
            ? "What skill are you demonstrating?"
            : "Tell the story behind this moment."
        }
      />
      {kind === "post" && (
        <>
          <Section title="Connect it to the game" />
          <Chips
            items={[
              { id: "", name: "No related game" },
              ...(games.data ?? []).map((g) => ({ id: g.id, name: g.title })),
            ]}
            value={game}
            onChange={setGame}
          />
          {game && (
            <Button
              title={
                includeVenue
                  ? "Venue tag on · remove"
                  : "Tag the game’s public venue"
              }
              kind="secondary"
              onPress={() => setIncludeVenue(!includeVenue)}
            />
          )}
          <Chips
            items={[
              { id: "", name: "No squad" },
              ...(squads.data ?? []).map((s) => ({ id: s.id, name: s.name })),
            ]}
            value={squad}
            onChange={setSquad}
          />
          <Chips
            items={[
              { id: "", name: "No tournament" },
              ...(tournaments.data ?? []).map((t) => ({
                id: t.id,
                name: t.name,
              })),
            ]}
            value={tournament}
            onChange={setTournament}
          />
          <Field
            label="Tag player profile IDs (comma separated, optional)"
            value={tags}
            onChangeText={setTags}
            autoCapitalize="none"
          />
          <Txt size={12} color={C.muted}>
            Tagging respects each player’s privacy settings.
          </Txt>
          <Section title="Who can view this?" />
          <Chips
            items={[
              { id: "members", name: "SpotUp members" },
              { id: "followers", name: "Followers" },
              { id: "private", name: "Only me" },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        </>
      )}
      <ErrorBox error={error || action.error} />
      {action.isPending && <Txt>{stage}</Txt>}
      <Button
        title={
          kind === "showcase"
            ? "Submit showcase for review"
            : "Submit clip for review"
        }
        loading={action.isPending}
        disabled={!asset}
        onPress={() => action.mutate()}
      />
      <Txt size={12} color={C.muted}>
        Share content you have permission to post. Avoid exposing private
        locations or people who don’t want to be filmed.
      </Txt>
    </Screen>
  );
}
