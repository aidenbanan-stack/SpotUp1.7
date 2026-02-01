import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useApp } from "@/context/AppContext";
import { getOrCreateMyProfile } from "@/lib/profileApi";
import SignIn from "./SignIn";

/**
 * AuthGate
 * - If a user is signed in (Supabase session exists), render the app.
 * - Otherwise, render the SignIn screen.
 * - If signed in but onboarding is incomplete, force /onboarding first.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const [loadingSession, setLoadingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const { user, setUser } = useApp();

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profile = await getOrCreateMyProfile();
        if (mounted) setUser(profile);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Supabase] profile load failed:", e);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setProfileLoading(false);
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
        setLoadingSession(false);

        if (!sessionExists) {
          setUser(null);
          return;
        }

        void loadProfile();
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[Supabase] getSession threw:", err);
        setUser(null);
        setHasSession(false);
        setLoadingSession(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const sessionExists = Boolean(session);
      setHasSession(sessionExists);

      if (!sessionExists) {
        setUser(null);
        return;
      }

      void loadProfile();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [setUser]);

  if (loadingSession || (hasSession && (profileLoading || !user))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!hasSession) return <SignIn />;

  // Force onboarding (but allow staying on onboarding route)
  if (user && user.onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
