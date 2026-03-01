import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trophy, Calendar, MapPin, Lock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SPORTS } from '@/data/mockData';
import { fetchTournaments, type TournamentRow } from '@/lib/tournamentsApi';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TournamentRow[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchTournaments();
        if (!cancelled) setItems(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) => t.name.toLowerCase().includes(term));
  }, [items, q]);

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Tournaments</h1>
          <button
            onClick={() => navigate('/create-tournament')}
            className="p-2 rounded-xl bg-secondary/60"
            aria-label="Create tournament"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tournaments..."
          className="bg-secondary/60"
        />

        {loading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading tournaments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">No tournaments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create one to kick off a bracket or league.</p>
            <div className="mt-4">
              <Button onClick={() => navigate('/create-tournament')}>
                <Trophy className="w-4 h-4 mr-2" />
                Create tournament
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const sportMeta = (SPORTS as any)[t.sport];
              const icon = sportMeta?.icon ?? '🏆';
              const loc = (t.location as any)?.areaName ?? (t.location as any)?.name ?? 'Location TBD';

              return (
                <button
                  key={t.id}
                  onClick={() => navigate(`/tournament/${t.id}`)}
                  className="glass-card p-4 w-full text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg">
                        {icon}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold truncate">{t.name}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatWhen(t.starts_at)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {loc}
                          </span>
                          {t.is_private ? (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              Private
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Teams</p>
                      <p className="font-semibold">{t.team_count}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
