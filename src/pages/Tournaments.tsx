import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trophy, Calendar, MapPin, Lock, Users, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SPORTS } from '@/types';
import {
  fetchMyTournaments,
  fetchPublicTournaments,
  type TournamentRow,
  type TournamentStatus,
} from '@/lib/tournamentsApi';
import { cn } from '@/lib/utils';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusLabel(status: TournamentStatus): string {
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Concluded';
  if (status === 'cancelled') return 'Cancelled';
  return status;
}

function TournamentCard({
  t,
  onClick,
}: {
  t: TournamentRow;
  onClick: () => void;
}) {
  const sportMeta = (SPORTS as any)[t.sport];
  const icon = sportMeta?.icon ?? '🏆';
  const loc = (t.location as any)?.areaName ?? (t.location as any)?.name ?? 'Location TBD';

  return (
    <button
      onClick={onClick}
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
              {t.join_mode !== 'solo' ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {t.join_mode === 'squad' ? 'Squads' : 'Squads or solo'}
                </span>
              ) : null}
            </div>

            <div className="mt-2 inline-flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-lg bg-secondary/60 text-foreground">
                {statusLabel(t.status)}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{t.team_count} teams</span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
      </div>
    </button>
  );
}

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [tab, setTab] = useState<'my' | 'join'>('my');

  const [loading, setLoading] = useState(true);

  const [myItems, setMyItems] = useState<TournamentRow[]>([]);
  const [joinItems, setJoinItems] = useState<TournamentRow[]>([]);

  const [qMy, setQMy] = useState('');
  const [qJoin, setQJoin] = useState('');

  async function refreshMy() {
    if (!user?.id) {
      setMyItems([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMyTournaments(user.id);
      setMyItems(data);
    } catch (e) {
      console.error(e);
      setMyItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshJoin() {
    setLoading(true);
    try {
      const data = await fetchPublicTournaments();
      setJoinItems(data);
    } catch (e) {
      console.error(e);
      setJoinItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Load both so switching tabs feels instant
    refreshMy();
    refreshJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myFiltered = useMemo(() => {
    const term = qMy.trim().toLowerCase();
    if (!term) return myItems;
    return myItems.filter((t) => t.name.toLowerCase().includes(term));
  }, [myItems, qMy]);

  const joinFiltered = useMemo(() => {
    const term = qJoin.trim().toLowerCase();
    if (!term) return joinItems;
    return joinItems.filter((t) => t.name.toLowerCase().includes(term));
  }, [joinItems, qJoin]);

  const now = Date.now();

  const myBuckets = useMemo(() => {
    const scheduled: TournamentRow[] = [];
    const active: TournamentRow[] = [];
    const concluded: TournamentRow[] = [];

    for (const t of myFiltered) {
      const start = new Date(t.starts_at).getTime();
      const end = t.ends_at ? new Date(t.ends_at).getTime() : null;

      const isConcluded = t.status === 'completed' || t.status === 'cancelled' || (end !== null && end <= now);
      if (isConcluded) {
        concluded.push(t);
        continue;
      }

      if (!Number.isNaN(start) && start > now) {
        scheduled.push(t);
      } else {
        active.push(t);
      }
    }

    return { scheduled, active, concluded };
  }, [myFiltered, now]);

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
            title="Create tournament"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Tabs (mirrors Squads UI) */}
        <div className="flex gap-2 bg-secondary/40 p-1 rounded-2xl">
          <button
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition',
              tab === 'my' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground',
            )}
            onClick={() => setTab('my')}
            type="button"
          >
            My Tournaments
          </button>
          <button
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition',
              tab === 'join' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground',
            )}
            onClick={() => setTab('join')}
            type="button"
          >
            Join Tournament
          </button>
        </div>

        {tab === 'my' ? (
          <>
            <Input
              value={qMy}
              onChange={(e) => setQMy(e.target.value)}
              placeholder="Search my tournaments..."
              className="bg-secondary/60"
            />

            {!user?.id ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">Sign in to see your tournaments</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your scheduled, active, and concluded tournaments will appear here.
                </p>
              </div>
            ) : loading ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Loading tournaments...</p>
              </div>
            ) : myFiltered.length === 0 ? (
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
              <div className="space-y-5">
                {/* Scheduled */}
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Scheduled</h2>
                  {myBuckets.scheduled.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No scheduled tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {myBuckets.scheduled.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Active */}
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Active</h2>
                  {myBuckets.active.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No active tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {myBuckets.active.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Concluded */}
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Concluded</h2>
                  {myBuckets.concluded.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No concluded tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {myBuckets.concluded.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        ) : (
          <>
            <Input
              value={qJoin}
              onChange={(e) => setQJoin(e.target.value)}
              placeholder="Search tournaments..."
              className="bg-secondary/60"
            />

            {loading ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Loading tournaments...</p>
              </div>
            ) : joinFiltered.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">No tournaments found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {joinFiltered.map((t) => (
                  <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
