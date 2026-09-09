import React, { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import {
  Button,
  ErrorBox,
  Field,
  Header,
  Screen,
  Txt,
} from "../../src/components/ui";
export default function Callback() {
  const url = Linking.useURL();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!url) return;
    (async () => {
      try {
        const parsed = new URL(url);
        const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const code = parsed.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (params.get("access_token")) {
          const { error } = await supabase.auth.setSession({
            access_token: params.get("access_token")!,
            refresh_token: params.get("refresh_token")!,
          });
          if (error) throw error;
        }
        if (params.get("error_description"))
          throw Error(params.get("error_description")!);
        const r =
          params.get("type") === "recovery" ||
          parsed.searchParams.get("type") === "recovery";
        setRecovery(r);
        setReady(true);
      } catch (e) {
        setError(e);
      }
    })();
  }, [url]);
  async function change() {
    setBusy(true);
    try {
      if (password.length < 12) throw Error("Use at least 12 characters.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header title={recovery ? "Reset your password" : "Welcome to SpotUp"} />
      <ErrorBox error={error} />
      {ready && recovery ? (
        <>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button title="Save new password" loading={busy} onPress={change} />
        </>
      ) : ready ? (
        <Button
          title="Continue to my profile"
          onPress={() => router.replace("/onboarding")}
        />
      ) : (
        <Txt>Confirming your account…</Txt>
      )}
    </Screen>
  );
}
