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
  const [tab, setTab] = useState<'players' | 'squads_xp' | 'squads_record'>('players');

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

    void loadPlayers();
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
    void loadSquads();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPlayers = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.username ?? '').toLowerCase().includes(term));
  }, [rows, q]);

  const filteredSquads = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = !term
      ? squadRows
      : squadRows.filter((s) => (s.name ?? '').toLowerCase().includes(term));

    if (tab === 'squads_record') {
      return [...base].sort((a, b) => {
        const aGames = a.wins + a.losses;
        const bGames = b.wins + b.losses;
        return (b.points - a.points) || (b.wins - a.wins) || (bGames - aGames) || (b.rating - a.rating) || (b.total_xp - a.total_xp);
      });
    }

    return [...base].sort((a, b) => (b.total_xp - a.total_xp) || (b.points - a.points) || (b.rating - a.rating));
  }, [q, squadRows, tab]);

  const currentCount = tab === 'players' ? filteredPlayers.length : filteredSquads.length;

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

      <main className="px-4 py-5 max-w-3xl mx-auto space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['players', 'Players'],
            ['squads_xp', 'Squad XP'],
            ['squads_record', 'Squad Record'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={cn(
                'h-11 rounded-xl text-sm font-semibold transition',
                tab === key ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground',
              )}
              onClick={() => setTab(key as any)}
            >
              {label}
            </button>
          ))}
        </div>

        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === 'players' ? 'Search players...' : 'Search squads...'}
          className="bg-secondary/60"
        />

        {loading && tab === 'players' ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
          </div>
        ) : currentCount === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">Nothing to show yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tab === 'players'
                ? 'Once profiles have XP, rankings will show here.'
                : 'Create squads and record results to climb the squad standings.'}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <p className="font-semibold">
                {tab === 'players' ? 'Top Players' : tab === 'squads_xp' ? 'Top Squads by XP' : 'Top Squads by Competitive Record'}
              </p>
            </div>

            <div className="divide-y divide-border/50">
              {tab === 'players'
                ? filteredPlayers.map((r, idx) => {
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
                            {rank === 1 ? <Medal className="w-5 h-5" /> : rank === 2 ? <span className="text-lg">🥈</span> : rank === 3 ? <span className="text-lg">🥉</span> : <span className="text-sm text-muted-foreground">#{rank}</span>}
                          </div>

                          <Avatar className="w-10 h-10 border border-border/60">
                            <AvatarImage src={r.profile_photo_url ?? undefined} />
                            <AvatarFallback>{(r.username ?? 'P')[0]?.toUpperCase?.() ?? 'P'}</AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className={`font-semibold truncate ${isMe ? 'text-primary' : ''}`}>{r.username ?? 'player'}</p>
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
                : filteredSquads.map((s, idx) => {
                    const rank = idx + 1;
                    const sport = (s.sport ?? null) as any;
                    const sportMeta = sport ? SPORTS.find((item) => item.id === sport) : null;
                    const icon = sportMeta?.icon ?? '👥';
                    const totalGames = s.wins + s.losses;

                    return (
                      <button
                        key={s.squad_id}
                        onClick={() => navigate(`/squad/${s.squad_id}`)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 flex items-center justify-center">
                            {rank === 1 ? <Medal className="w-5 h-5" /> : rank === 2 ? <span className="text-lg">🥈</span> : rank === 3 ? <span className="text-lg">🥉</span> : <span className="text-sm text-muted-foreground">#{rank}</span>}
                          </div>

                          <div className="w-10 h-10 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg border border-border/60">
                            {icon}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.member_count} members
                              {sportMeta ? <span className="ml-2">• {sportMeta.name}</span> : null}
                              {s.home_area ? <span className="ml-2">• {s.home_area}</span> : null}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              Record {s.wins}-{s.losses}
                              {totalGames > 0 ? <span className="ml-2">• {(s.win_pct * 100).toFixed(0)}%</span> : null}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {tab === 'squads_xp' ? (
                            <>
                              <p className="text-sm font-semibold">{Number(s.total_xp ?? 0).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">Squad XP</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-semibold">{Number(s.points ?? 0).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">Pts • Rtg {s.rating}</p>
                            </>
                          )}
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
