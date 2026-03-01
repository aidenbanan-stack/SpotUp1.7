import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Medal, Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PLAYER_LEVELS, type PlayerLevel } from '@/types';

type Row = {
  id: string;
  username: string | null;
  profile_photo_url: string | null;
  xp: number | null;
};

function levelFromXP(xp: number): PlayerLevel {
  let current: PlayerLevel = PLAYER_LEVELS[0].id;
  for (const lvl of PLAYER_LEVELS) {
    if (xp >= lvl.minXP) current = lvl.id;
  }
  return current;
}

function levelIcon(level: PlayerLevel): string {
  return PLAYER_LEVELS.find((l) => l.id === level)?.icon ?? '⭐';
}

export default function Leaderboards() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, profile_photo_url, xp')
          .order('xp', { ascending: false })
          .limit(100);

        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as Row[]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setRows([]);
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
    if (!term) return rows;
    return rows.filter((r) => (r.username ?? '').toLowerCase().includes(term));
  }, [rows, q]);

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Leaderboards</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players..."
            className="bg-secondary/60"
          />
        </div>

        {loading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">No players yet</p>
            <p className="text-sm text-muted-foreground mt-1">Once profiles have XP, rankings will show here.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <p className="font-semibold">Top Players</p>
            </div>

            <div className="divide-y divide-border/50">
              {filtered.map((r, idx) => {
                const xp = Number(r.xp ?? 0);
                const lvl = levelFromXP(xp);
                const icon = levelIcon(lvl);
                const rank = idx + 1;

                const isMe = user?.id === r.id;

                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/profile/${r.id}`)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 flex items-center justify-center">
                        {rank === 1 ? (
                          <Medal className="w-5 h-5" />
                        ) : rank === 2 ? (
                          <span className="text-lg">🥈</span>
                        ) : rank === 3 ? (
                          <span className="text-lg">🥉</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">#{rank}</span>
                        )}
                      </div>

                      <Avatar className="w-10 h-10 border border-border/60">
                        <AvatarImage src={r.profile_photo_url ?? undefined} />
                        <AvatarFallback>{(r.username ?? 'P')[0]?.toUpperCase?.() ?? 'P'}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className={`font-semibold truncate ${isMe ? 'text-primary' : ''}`}>
                            {r.username ?? 'player'}
                          </p>
                          <span className="text-sm text-muted-foreground">{icon}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{xp.toLocaleString()} XP</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold">{xp.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">XP</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
