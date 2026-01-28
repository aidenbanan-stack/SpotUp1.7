import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useApp } from "@/context/AppContext";
import { getOrCreateMyProfile } from "@/lib/profileApi";
import SignIn from "./SignIn";

/**
 * AuthGate
 * - If a user is signed in (Supabase session exists), render the app.
 * - Otherwise, render the SignIn screen.
 *
 * This ensures the site prompts sign-in on first load and persists sessions automatically.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const { setUser } = useApp();

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const profile = await getOrCreateMyProfile();
        if (mounted) setUser(profile);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Supabase] profile load failed:", e);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          // eslint-disable-next-line no-console
          console.warn("[Supabase] getSession error:", error.message);
        }

        const sessionExists = Boolean(data.session);
        setHasSession(sessionExists);

        // Key change: do NOT block the UI on profile load
        setLoading(false);

        if (!sessionExists) {
          setUser(null);
          return;
        }

        // Load profile in background
        void loadProfile();
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[Supabase] getSession threw:", err);
        setUser(null);
        setHasSession(false);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const sessionExists = Boolean(session);
      setHasSession(sessionExists);

      if (!sessionExists) {
        setUser(null);
        return;
      }

      // Profile load should not block UI
      void loadProfile();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!hasSession) return <SignIn />;

  return <>{children}</>;
}
