import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { adminGrantPro, adminRevokePro } from '@/lib/entitlementsApi';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [targetUserId, setTargetUserId] = useState('');
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  async function handleGrant() {
    try {
      setBusy(true);
      await adminGrantPro(targetUserId.trim());
      toast.success('Pro granted');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to grant Pro');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    try {
      setBusy(true);
      await adminRevokePro(targetUserId.trim());
      toast.success('Pro revoked');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to revoke Pro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-4">
        <div className="glass-card p-4">
          <div className="font-semibold">Plan</div>
          <div className="text-sm text-muted-foreground mt-1">
            {user?.isPro ? 'SpotUp Pro active' : 'Free plan'}
            {user?.isAdmin ? ' • Admin tools enabled' : ''}
          </div>
        </div>

        {user?.isAdmin ? (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <div className="font-semibold">Admin Pro tools</div>
            </div>
            <Input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="Enter user UUID"
              className="bg-secondary/60"
            />
            <div className="flex gap-2">
              <Button onClick={handleGrant} disabled={busy || !targetUserId.trim()}>Grant Pro</Button>
              <Button variant="secondary" onClick={handleRevoke} disabled={busy || !targetUserId.trim()}>Revoke Pro</Button>
            </div>
          </div>
        ) : null}

        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Sign out</div>
              <div className="text-sm text-muted-foreground">Log out of your SpotUp account.</div>
            </div>
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
