import { useSports } from "../lib/sports";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import ProfilePhoto from "../components/ProfilePhoto";
import {
  Button,
  Card,
  C,
  Chips,
  ErrorBox,
  Field,
  Header,
  Loading,
  Screen,
  Section,
  Txt,
} from "../components/ui";

import { useMe, useSession } from "../lib/session";
import { useAction } from "../lib/hooks";
import { rows, rpc, supabase } from "../lib/supabase";
export default function Settings({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const SPORTS = useSports();
  const { data: me, isLoading, error } = useMe();
  const { session } = useSession();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [showcase, setShowcase] = useState("members");
  const [comments, setComments] = useState("members");
  const [tags, setTags] = useState("followers");
  const [interactions, setInteractions] = useState("members");
  const [notice, setNotice] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const admin = useQuery({
    queryKey: ["admin"],
    queryFn: () => rpc<boolean>("is_admin"),
  });
  useEffect(() => {
    if (me) {
      setName(me.name);
      setBio(me.bio);
      setCity(me.city);
      setSports(me.sports);
      setShowcase(me.showcase_visibility);
      setComments(me.comments_policy);
      setTags(me.tags_policy);
      setInteractions(me.interactions_policy);
    }
  }, [me]);
  const photo = useAction(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const bytes =
      Platform.OS === "web"
        ? await (await fetch(asset.uri)).arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
    if (bytes.byteLength > 5242880) throw Error("Choose a photo under 5 MB.");
    const path = session!.user.id + "/" + Date.now() + ".jpg";
    const upload = await supabase.storage
      .from("spotup-avatars")
      .upload(path, bytes, {
        contentType:
          asset.mimeType === "image/png" ? "image/png" : "image/jpeg",
      });
    if (upload.error) throw upload.error;
    const update = await supabase
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", session!.user.id);
    if (update.error) throw update.error;
    if (me?.avatar_url)
      await supabase.storage.from("spotup-avatars").remove([me.avatar_url]);
  });
  const save = useAction(async () => {
    if (!name.trim()) throw Error("Add a player name.");
    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        bio,
        city: city.trim(),
        sports,
        showcase_visibility: showcase,
        comments_policy: comments,
        tags_policy: tags,
        interactions_policy: interactions,
      })
      .eq("id", session!.user.id);
    if (error) throw error;
    setNotice("Profile saved.");
  });
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () =>
      rows<{ target_id: string }>(
        "blocks",
        "*",
        { user_id: session!.user.id },
        "target_id",
      ),
  });
  const unblock = useAction((target: string) =>
    rpc("social_action", { action: "unblock", target }),
  );
  const authAction = useAction(async (action: string) => {
    if (action === "signout") {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/auth");
    } else if (action === "delete") {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if (data?.error) throw Error(data.error);
      await supabase.auth.signOut();
      router.replace("/auth");
    } else {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId)
        throw Error(
          "Push requires an EAS project ID and a native development build.",
        );
      const p = await Notifications.requestPermissionsAsync();
      if (p.status !== "granted")
        throw Error("Notification permission was declined.");
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      const { error } = await supabase
        .from("push_tokens")
        .upsert({ user_id: session!.user.id, token: token.data });
      if (error) throw error;
      setNotice("Device registered for game notifications.");
    }
  });
  if (isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <Screen>
      <Button
        title="SpotUp Pro"
        icon="sparkles-outline"
        kind="secondary"
        onPress={() => router.push("/pro")}
      />
      <Header
        eyebrow={onboarding ? "WELCOME TO SPOTUP" : "MAKE IT YOURS"}
        title={onboarding ? "What’s your game?" : "Your settings"}
      />
      <ProfilePhoto
        name={name || "Player"}
        path={me?.avatar_url || me?.legacy_avatar_url}
      />
      <Button
        title="Choose profile photo"
        kind="secondary"
        loading={photo.isPending}
        onPress={() => photo.mutate()}
      />
      <Field
        label="Player name"
        value={name}
        onChangeText={setName}
        maxLength={60}
      />
      <Field
        label="Home city or area"
        placeholder="City, not your exact address"
        value={city}
        onChangeText={setCity}
      />
      <Section title="Your sports" />
      {SPORTS.map((s) => (
        <Button
          key={s.id}
          title={`${sports.includes(s.id) ? "✓ " : ""}${s.name}`}
          kind={sports.includes(s.id) ? "primary" : "secondary"}
          onPress={() =>
            setSports(
              sports.includes(s.id)
                ? sports.filter((x) => x !== s.id)
                : [...sports, s.id],
            )
          }
        />
      ))}
      <Field
        label="Your sports story"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={500}
      />
      {!onboarding && (
        <>
          <Section title="Privacy & interactions" />
          <Txt bold>Who can view Skill Showcase?</Txt>
          <Chips
            items={[
              { id: "members", name: "Members" },
              { id: "followers", name: "Followers" },
              { id: "private", name: "Only me" },
            ]}
            value={showcase}
            onChange={setShowcase}
          />
          {[
            { title: "Who can comment?", value: comments, set: setComments },
            { title: "Who can tag you?", value: tags, set: setTags },
            {
              title: "Who can react?",
              value: interactions,
              set: setInteractions,
            },
          ].map((c) => (
            <Card key={c.title}>
              <Txt bold>{c.title}</Txt>
              <Chips
                items={[
                  { id: "members", name: "Members" },
                  { id: "followers", name: "Followers" },
                  { id: "off", name: "No one" },
                ]}
                value={c.value}
                onChange={c.set}
              />
            </Card>
          ))}
        </>
      )}
      <ErrorBox
        error={
          error ||
          save.error ||
          authAction.error ||
          unblock.error ||
          photo.error
        }
      />
      {notice && <Txt>{notice}</Txt>}
      <Button
        title={onboarding ? "Find my community" : "Save profile"}
        loading={save.isPending}
        onPress={() =>
          save.mutate(undefined, {
            onSuccess: () => {
              if (onboarding) router.replace("/");
            },
          })
        }
      />
      {!onboarding && (
        <>
          <Section title="Notifications" />
          <Button
            title="Enable game notifications on this device"
            icon="notifications-outline"
            kind="secondary"
            loading={authAction.isPending}
            onPress={() => authAction.mutate("push")}
          />
          <Button
            title="Notification preferences"
            kind="ghost"
            onPress={() => router.push("/notification-settings")}
          />
          <Section title="Blocked players" />
          {blocks.data?.length ? (
            blocks.data.map((b) => (
              <Card key={b.target_id}>
                <Txt size={11}>{b.target_id}</Txt>
                <Button
                  title="Unblock player"
                  kind="secondary"
                  onPress={() => unblock.mutate(b.target_id)}
                />
              </Card>
            ))
          ) : (
            <Txt color={C.muted}>You haven’t blocked any players.</Txt>
          )}
          {admin.data && (
            <Button
              title="Community moderation"
              kind="secondary"
              onPress={() => router.push("/admin")}
            />
          )}
          <Button
            title="Community guidelines & help"
            kind="secondary"
            onPress={() => router.push("/help")}
          />
          <Button
            title="Sign out"
            kind="ghost"
            loading={authAction.isPending}
            onPress={() => authAction.mutate("signout")}
          />
          <Button
            title={
              deleteConfirm ? "Confirm account deletion" : "Delete account"
            }
            kind="danger"
            loading={authAction.isPending}
            onPress={() =>
              deleteConfirm
                ? authAction.mutate("delete")
                : setDeleteConfirm(true)
            }
          />
          {deleteConfirm && (
            <Txt size={12} color={C.red}>
              This permanently removes your sign-in and anonymizes retained game
              history. Resolve active hosting and squad ownership first.
            </Txt>
          )}
        </>
      )}
    </Screen>
  );
}
