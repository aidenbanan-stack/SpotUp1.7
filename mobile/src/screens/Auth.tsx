import React, { useState, useEffect } from "react";
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
import { useSession } from "../lib/session";
export default function Auth() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination =
    next && /^\/(game|player|clip|squad|tournament)\/[0-9a-f-]+$/i.test(next)
      ? next
      : "/";
  const { session } = useSession();
  useEffect(() => {
    if (session) router.replace(destination as never);
  }, [session, destination]);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState("");
  async function google() {
    setBusy(true);
    setError(undefined);
    try {
      const redirectTo = Platform.OS === "web" ? window.location.origin : Linking.createURL("/auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      if (!data.url)
        throw Error("Google sign-in could not start. Please try again.");
      if (Platform.OS === "web") window.location.assign(data.url);
      else await Linking.openURL(data.url);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
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
            style={{ backgroundColor: C.blue, padding: 10, borderRadius: 14 }}
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
      <View style={{ paddingVertical: 12, gap: 8 }}>
        <Txt size={34} bold>
          Find your people. Play your game.
        </Txt>
        <Txt color={C.muted}>
          Your games, your squad, your sports community.
        </Txt>
      </View>
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
      {mode !== "reset" && (
        <>
          <Button
            title="Continue with Google"
            icon="logo-google"
            kind="secondary"
            loading={busy}
            onPress={google}
          />
          <Txt size={12} color={C.muted} style={{ textAlign: "center" }}>
            or continue with email
          </Txt>
        </>
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
