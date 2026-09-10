import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, configured } from "./supabase";
import { useQuery } from "@tanstack/react-query";
import { Profile } from "./types";
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}>({ session: null, loading: true, error: null, retry: () => {} });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    let active = true;
    let receivedEvent = false;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => {
      if (active && !receivedEvent) {
        setLoading(false);
        setError("We couldn’t finish connecting to SpotUp. Please try again.");
      }
    }, 20000);
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !receivedEvent) {
          clearTimeout(timeout);
          setSession(data.session);
          setError(error?.message ?? null);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active && !receivedEvent) {
          clearTimeout(timeout);
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      receivedEvent = true;
      clearTimeout(timeout);
      setError(null);
      setSession(s);
      setLoading(false);
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, [attempt]);
  return (
    <Context.Provider
      value={{ session, loading, error, retry: () => setAttempt((n) => n + 1) }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  return useContext(Context);
}
export function useMe() {
  const { session } = useSession();
  return useQuery({
    queryKey: ["me", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}
