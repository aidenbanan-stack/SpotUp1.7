import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const origin = useMemo(() => window.location.origin, []);

  const signInWithGoogle = async () => {
    setBusy(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin },
    });

    if (error) setMessage(error.message);
    setBusy(false);
  };

  const signInWithEmailLink = async () => {
    setBusy(true);
    setMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("Enter an email address.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: origin },
    });

    if (error) setMessage(error.message);
    else setMessage("Check your email for a sign-in link.");
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to SpotUp</CardTitle>
          <CardDescription>
            Use Google or an email sign-in link. Your account and session are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={signInWithGoogle} disabled={busy}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-muted-foreground">or</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
            />
            <Button className="w-full" onClick={signInWithEmailLink} disabled={busy || !email.trim()}>
              Email me a sign-in link
            </Button>
          </div>

          {message ? <div className="text-sm text-muted-foreground">{message}</div> : null}

          <div className="text-xs text-muted-foreground leading-relaxed">
            Note: Supabase environment variables must be set in Vercel for auth to work:
            <span className="font-mono"> VITE_SUPABASE_URL</span> and
            <span className="font-mono"> VITE_SUPABASE_ANON_KEY</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
