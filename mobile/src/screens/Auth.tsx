import React, { useState } from "react";
import { View, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import {
  Button,
  Card,
  C,
  ErrorBox,
  Field,
  Icon,
  Row,
  Screen,
  Tag,
  Txt,
} from "../components/ui";
import { configured, supabase } from "../lib/supabase";
export default function Auth() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination =
    next && /^\/(game|player|clip|squad|tournament)\/[0-9a-f-]+$/i.test(next)
      ? next
      : "/";
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  async function submit() {
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      if (!configured)
        throw Error(
          "Connect Supabase using the included setup guide to enable accounts and live games.",
        );
      const redirect = Linking.createURL("/auth/callback");
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirect },
        );
        if (error) throw error;
        setNotice(
          "If this email has an account, a recovery link is on its way.",
        );
      } else if (mode === "signup") {
        if (!name.trim()) throw Error("Enter your player name.");
        if (password.length < 12)
          throw Error("Use a password with at least 12 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (data.session) router.replace("/onboarding");
        else
          setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace(destination as never);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <Row>
          <View
            style={{ backgroundColor: C.lime, padding: 10, borderRadius: 14 }}
          >
            <Icon name="locate" size={25} />
          </View>
          <Txt size={25} bold>
            spotup
            <TextDot />
          </Txt>
        </Row>
        <Tag>FIND YOUR GAME</Tag>
      </Row>
      <View
        style={{
          backgroundColor: C.dark,
          borderRadius: 28,
          padding: 28,
          gap: 20,
          overflow: "hidden",
          minHeight: 275,
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -75,
            top: 25,
            width: 260,
            height: 260,
            borderWidth: 2,
            borderColor: "#28433A",
            borderRadius: 130,
          }}
        />
        <View
          style={{
            position: "absolute",
            right: -30,
            top: 92,
            width: 180,
            height: 120,
            borderWidth: 2,
            borderColor: "#28433A",
            borderRadius: 8,
          }}
        />
        <Tag color={C.lime}>LESS SCROLLING. MORE PLAYING.</Tag>
        <Txt
          size={46}
          color="white"
          bold
          style={{ letterSpacing: -2, maxWidth: 320 }}
        >
          Find your people.{"\n"}Play your game.
        </Txt>
        <Txt color="#BECDBC" size={14} style={{ maxWidth: 310 }}>
          Find pickup games, build your squad, and make showing up your thing.
        </Txt>
      </View>
      <Row style={{ justifyContent: "space-between" }}>
        {[
          ["people-outline", "Find games"],
          ["people-outline", "Build a squad"],
          ["flash-outline", "Earn your rep"],
        ].map(([icon, label]) => (
          <View key={label} style={{ alignItems: "center", gap: 8 }}>
            <Icon name={icon} />
            <Txt size={11} bold>
              {label}
            </Txt>
          </View>
        ))}
      </Row>
      {!configured && (
        <Card>
          <Txt bold>Ready for your community</Txt>
          <Txt size={13} color={C.muted}>
            The app is installed. Connect your Supabase project to activate real
            accounts, games, chat, and video uploads. Follow README.md in the
            source package.
          </Txt>
        </Card>
      )}
      <Txt size={23} bold>
        {mode === "signup"
          ? "Make your player profile"
          : mode === "reset"
            ? "Back in the game"
            : "Welcome to the squad"}
      </Txt>
      {mode === "signup" && (
        <Field
          label="Player name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
      )}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="you@example.com"
      />
      {mode !== "reset" && (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={
            mode === "signup" ? "At least 12 characters" : "Your password"
          }
        />
      )}
      <ErrorBox error={error} />
      {notice && (
        <Card>
          <Txt>{notice}</Txt>
        </Card>
      )}
      <Button
        title={
          mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Send recovery link"
              : "Let’s play"
        }
        icon="arrow-forward"
        loading={busy}
        disabled={!configured}
        onPress={submit}
      />
      <Button
        kind="ghost"
        title={
          mode === "signin"
            ? "New here? Create an account"
            : "Already a player? Sign in"
        }
        onPress={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(undefined);
          setNotice("");
        }}
      />
      {mode === "signin" && (
        <Button
          kind="ghost"
          title="Forgot password?"
          onPress={() => setMode("reset")}
        />
      )}
      <Txt size={11} color={C.muted} style={{ textAlign: "center" }}>
        Show up. Play fair. Respect your community.
      </Txt>
    </Screen>
  );
}
function TextDot() {
  return (
    <Txt color={C.orange} size={28} bold>
      .
    </Txt>
  );
}
