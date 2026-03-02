import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Medal, Trophy } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PLAYER_LEVELS, SPORTS, type PlayerLevel } from '@/types';
import { fetchSquadLeaderboard, type SquadLeaderboardRow } from '@/lib/squadsApi';
import { cn } from '@/lib/utils';

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
  const [squadRows, setSquadRows] = useState<SquadLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'players' | 'squads'>('players');

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
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

    loadPlayers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSquads() {
      try {
        const data = await fetchSquadLeaderboard(100);
        if (!cancelled) setSquadRows(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSquadRows([]);
      }
    }
    loadSquads();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (tab === 'players') {
      if (!term) return rows;
      return rows.filter((r) => (r.username ?? '').toLowerCase().includes(term));
    }
    if (!term) return squadRows;
    return squadRows.filter((s) => (s.name ?? '').toLowerCase().includes(term));
  }, [rows, squadRows, q, tab]);

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
        <div className="flex gap-2">
          <button
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition',
              tab === 'players' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground',
            )}
            onClick={() => setTab('players')}
          >
            Players
          </button>
          <button
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition',
              tab === 'squads' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground',
            )}
            onClick={() => setTab('squads')}
          >
            Squads
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'players' ? 'Search players...' : 'Search squads...'}
            className="bg-secondary/60"
          />
        </div>

        {loading && tab === 'players' ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
          </div>
        ) : (filtered as any[]).length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">Nothing to show yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === 'players'
                ? 'Once profiles have XP, rankings will show here.'
                : 'Create squads and play games to climb the squad leaderboard.'}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <p className="font-semibold">{tab === 'players' ? 'Top Players' : 'Top Squads'}</p>
            </div>

            <div className="divide-y divide-border/50">
              {tab === 'players'
                ? (filtered as Row[]).map((r, idx) => {
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
              })
                : (filtered as SquadLeaderboardRow[]).map((s, idx) => {
                    const rank = idx + 1;
                    const sport = (s.sport ?? null) as any;
                    const sportMeta = sport ? (SPORTS as any)[sport] : null;
                    const icon = sportMeta?.icon ?? '👥';

                    return (
                      <button
                        key={s.squad_id}
                        onClick={() => navigate(`/squad/${s.squad_id}`)}
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

                          <div className="w-10 h-10 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg border border-border/60">
                            {icon}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.member_count} member{s.member_count === 1 ? '' : 's'}
                              {sportMeta ? <span className="ml-2">• {sportMeta.label}</span> : null}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold">{Number(s.total_xp ?? 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Squad XP</p>
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
