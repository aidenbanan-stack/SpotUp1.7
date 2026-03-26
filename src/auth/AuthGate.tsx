import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useApp } from "@/context/AppContext";
import { getOrCreateMyProfile } from "@/lib/profileApi";
import { showDailyLoginToast } from "@/components/XPGainToast";
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

  const didBootstrapRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const clearToastTimer = () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profile = await getOrCreateMyProfile();
        if (!mounted) return;
        setUser(profile);

        const { data: bonusClaimed, error: bonusError } = await supabase.rpc('claim_daily_login_bonus');
        if (bonusError) {
          const message = (bonusError as any)?.message ?? '';
          const missingFn = message.toLowerCase().includes('function') && message.toLowerCase().includes('does not exist');
          if (!missingFn) {
            console.warn('[Supabase] daily bonus claim failed:', bonusError.message);
          }
        } else {
          const refreshed = await getOrCreateMyProfile();
          if (!mounted) return;

          const claimed = Boolean(bonusClaimed);
          const gained = claimed
            ? Math.max(5, (refreshed.xp ?? 0) - (profile.xp ?? 0))
            : Math.max(0, (refreshed.xp ?? 0) - (profile.xp ?? 0));

          setUser(refreshed);

          if (claimed && gained > 0) {
            clearToastTimer();
            toastTimerRef.current = window.setTimeout(() => {
              if (!mounted) return;
              showDailyLoginToast(gained, refreshed.xp ?? 0);
            }, 450);
          }
        }
      } catch (e) {
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
          console.warn("[Supabase] getSession error:", error.message);
        }

        const sessionExists = Boolean(data.session);
        setHasSession(sessionExists);
        setLoadingSession(false);

        if (!sessionExists) {
          setUser(null);
          didBootstrapRef.current = false;
          return;
        }

        if (!didBootstrapRef.current) {
          didBootstrapRef.current = true;
          void loadProfile();
        }
      })
      .catch((err) => {
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
        didBootstrapRef.current = false;
        clearToastTimer();
        return;
      }

      if (!didBootstrapRef.current) {
        didBootstrapRef.current = true;
        void loadProfile();
      }
    });

    return () => {
      mounted = false;
      clearToastTimer();
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

  if (user && user.onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
