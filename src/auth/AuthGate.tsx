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

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("[Supabase] getSession error:", error.message);
        }
        const sessionExists = Boolean(data.session);
        setHasSession(sessionExists);

        if (sessionExists) {
          try {
            const profile = await getOrCreateMyProfile();
            if (mounted) setUser(profile);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[Supabase] profile load failed:', e);
          }
        } else {
          setUser(null);
        }

        setLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[Supabase] getSession threw:", err);
        setUser(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionExists = Boolean(session);
      setHasSession(sessionExists);
      if (!sessionExists) {
        setUser(null);
        return;
      }
      try {
        const profile = await getOrCreateMyProfile();
        setUser(profile);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Supabase] profile load failed:', e);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
