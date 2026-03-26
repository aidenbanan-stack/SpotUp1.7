import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { setUser } = useApp();

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

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
