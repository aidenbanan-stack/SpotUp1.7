import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronRight, Lock, MapPin, Plus, Search, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SPORTS } from '@/types';
import {
  fetchMyTournaments,
  fetchPublicTournaments,
  isTournamentRegistrationLocked,
  joinPrivateTournamentWithCode,
  type TournamentRow,
  type TournamentStatus,
} from '@/lib/tournamentsApi';
import { cn } from '@/lib/utils';
import { fetchMySquads, type SquadWithMeta } from '@/lib/squadsApi';
import { toast } from 'sonner';

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

function sortBySoonest(items: TournamentRow[]) {
  return [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
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
  const registrationLocked = isTournamentRegistrationLocked(t);
  const startsSoon = new Date(t.starts_at).getTime() - Date.now() < 1000 * 60 * 60 * 24;

  return (
    <button
      onClick={onClick}
      className="glass-card p-4 w-full text-left hover:bg-secondary/20 transition-colors"
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg shrink-0">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold truncate">{t.name}</p>
              <span className="px-2 py-0.5 rounded-lg bg-secondary/60 text-[11px]">{statusLabel(t.status)}</span>
              {t.is_private ? <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-[11px] text-primary">Private</span> : null}
              {startsSoon && t.status === 'scheduled' ? <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-[11px] text-orange-500">Soon</span> : null}
            </div>

            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatWhen(t.starts_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {loc}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-lg bg-secondary/60 text-foreground">{t.team_count} teams</span>
              <span className="px-2 py-0.5 rounded-lg bg-secondary/60 text-foreground">
                {t.join_mode === 'solo' ? 'Solo' : t.join_mode === 'squad' ? 'Squads' : 'Solo or squads'}
              </span>
              <span className={cn('px-2 py-0.5 rounded-lg', registrationLocked ? 'bg-secondary/60 text-muted-foreground' : 'bg-primary/10 text-primary')}>
                {registrationLocked ? 'Closed' : 'Open'}
              </span>
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground mt-1 shrink-0" />
      </div>
    </button>
  );
}

export default function Tournaments() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [tab, setTab] = useState<'my' | 'discover'>('my');
  const [loading, setLoading] = useState(true);
  const [myItems, setMyItems] = useState<TournamentRow[]>([]);
  const [discoverItems, setDiscoverItems] = useState<TournamentRow[]>([]);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [qMy, setQMy] = useState('');
  const [qDiscover, setQDiscover] = useState('');
  const [privateCode, setPrivateCode] = useState('');
  const [busyJoinCode, setBusyJoinCode] = useState(false);

  async function refreshMy() {
    if (!user?.id) {
      setMyItems([]);
      return;
    }
    try {
      const [tournaments, squads] = await Promise.all([fetchMyTournaments(user.id), fetchMySquads(user.id)]);
      setMyItems(sortBySoonest(tournaments));
      setMySquads(squads);
    } catch (e) {
      console.error(e);
      setMyItems([]);
      setMySquads([]);
    }
  }

  async function refreshDiscover() {
    try {
      const data = await fetchPublicTournaments();
      setDiscoverItems(sortBySoonest(data));
    } catch (e) {
      console.error(e);
      setDiscoverItems([]);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        await Promise.all([refreshMy(), refreshDiscover()]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const myFiltered = useMemo(() => {
    const term = qMy.trim().toLowerCase();
    if (!term) return myItems;
    return myItems.filter((t) => t.name.toLowerCase().includes(term));
  }, [myItems, qMy]);

  const discoverFiltered = useMemo(() => {
    const term = qDiscover.trim().toLowerCase();
    if (!term) return discoverItems;
    return discoverItems.filter((t) => {
      const loc = String((t.location as any)?.areaName ?? (t.location as any)?.name ?? '').toLowerCase();
      return t.name.toLowerCase().includes(term) || loc.includes(term) || String(t.sport).toLowerCase().includes(term);
    });
  }, [discoverItems, qDiscover]);

  const now = Date.now();

  const myBuckets = useMemo(() => {
    const upcoming: TournamentRow[] = [];
    const active: TournamentRow[] = [];
    const completed: TournamentRow[] = [];

    for (const t of myFiltered) {
      const start = new Date(t.starts_at).getTime();
      const isCompleted = t.status === 'completed' || t.status === 'cancelled';
      if (isCompleted) {
        completed.push(t);
      } else if (t.status === 'active' || (!Number.isNaN(start) && start <= now && t.status !== 'scheduled')) {
        active.push(t);
      } else {
        upcoming.push(t);
      }
    }

    return { upcoming, active, completed };
  }, [myFiltered, now]);

  const discoverBuckets = useMemo(() => {
    const open: TournamentRow[] = [];
    const active: TournamentRow[] = [];
    const ending: TournamentRow[] = [];

    for (const t of discoverFiltered) {
      if (t.status === 'active') {
        active.push(t);
      } else if (t.status === 'scheduled' && !isTournamentRegistrationLocked(t)) {
        open.push(t);
      } else {
        ending.push(t);
      }
    }

    return { open, active, ending };
  }, [discoverFiltered]);

  async function handleJoinPrivateByCode() {
    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }
    const code = privateCode.trim().toUpperCase();
    if (!code) {
      toast.error('Enter a private tournament code');
      return;
    }

    try {
      setBusyJoinCode(true);
      const squadId = mySquads[0]?.id ?? null;
      const result = await joinPrivateTournamentWithCode({ accessCode: code, squadId });
      toast.success('Private tournament joined');
      setPrivateCode('');
      await Promise.all([refreshMy(), refreshDiscover()]);
      navigate(`/tournament/${result.tournament_id}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ? `Could not join: ${e.message}` : 'Could not join private tournament.');
    } finally {
      setBusyJoinCode(false);
    }
  }

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back" type="button">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Tournaments</h1>
          <button
            onClick={() => navigate('/create-tournament')}
            className="p-2 rounded-xl bg-secondary/60"
            aria-label="Create tournament"
            title="Create tournament"
            type="button"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <div className="flex gap-2 bg-secondary/40 p-1 rounded-2xl">
          <button
            className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'my' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')}
            onClick={() => setTab('my')}
            type="button"
          >
            My Tournaments
          </button>
          <button
            className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'discover' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')}
            onClick={() => setTab('discover')}
            type="button"
          >
            Discover
          </button>
        </div>

        {tab === 'my' ? (
          <>
            <div className="glass-card p-4 space-y-2">
              <p className="font-semibold">Your tournament hub</p>
              <p className="text-sm text-muted-foreground">
                Keep track of tournaments you created or joined. Upcoming ones stay at the top, and completed ones drop into history.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={qMy} onChange={(e) => setQMy(e.target.value)} placeholder="Search my tournaments..." className="bg-secondary/60 pl-9" />
            </div>

            {!user?.id ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">Sign in to see your tournaments</p>
                <p className="text-sm text-muted-foreground mt-1">Your upcoming, active, and completed tournaments will appear here.</p>
              </div>
            ) : loading ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Loading tournaments...</p>
              </div>
            ) : myFiltered.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">No tournaments yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create one to kick off a bracket or join one from Discover.</p>
                <div className="mt-4">
                  <Button onClick={() => navigate('/create-tournament')}>
                    <Trophy className="w-4 h-4 mr-2" />
                    Create tournament
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Upcoming</h2>
                  {myBuckets.upcoming.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No upcoming tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {myBuckets.upcoming.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>

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

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">History</h2>
                  {myBuckets.completed.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No completed tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {myBuckets.completed.map((t) => (
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
            <div className="glass-card p-4 space-y-3">
              <div>
                <p className="font-semibold">Join a private tournament</p>
                <p className="text-sm text-muted-foreground">Got an invite code from a host? Enter it here to register instantly.</p>
              </div>
              <div className="flex gap-2">
                <Input value={privateCode} onChange={(e) => setPrivateCode(e.target.value.toUpperCase())} placeholder="Enter code" className="bg-secondary/60 uppercase" maxLength={8} />
                <Button onClick={handleJoinPrivateByCode} disabled={busyJoinCode}>{busyJoinCode ? 'Joining...' : 'Join'}</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mySquads.length > 0 ? `If the code is for a squad tournament, SpotUp will try your first squad entry first.` : 'If the code is for a squad tournament, join or create a squad first.'}
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input value={qDiscover} onChange={(e) => setQDiscover(e.target.value)} placeholder="Search by name, area, or sport..." className="bg-secondary/60 pl-9" />
            </div>

            {loading ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Loading tournaments...</p>
              </div>
            ) : discoverFiltered.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">No tournaments found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search or use a private code.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Open for registration</h2>
                  {discoverBuckets.open.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No open tournaments right now.</div>
                  ) : (
                    <div className="space-y-3">
                      {discoverBuckets.open.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Currently active</h2>
                  {discoverBuckets.active.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No active public tournaments.</div>
                  ) : (
                    <div className="space-y-3">
                      {discoverBuckets.active.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground">Closed or completed</h2>
                  {discoverBuckets.ending.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nothing here yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {discoverBuckets.ending.map((t) => (
                        <TournamentCard key={t.id} t={t} onClick={() => navigate(`/tournament/${t.id}`)} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
