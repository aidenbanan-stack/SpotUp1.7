import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, MapPin, Plus, Search, ShieldCheck, Sparkles, Swords, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Sport } from '@/types';
import { SPORTS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  createSquad,
  fetchMySquads,
  joinSquadById,
  searchSquads,
  type SquadDiscoverRow,
  type SquadWithMeta,
} from '@/lib/squadsApi';

export default function Squads() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [mySquads, setMySquads] = useState<SquadWithMeta[]>([]);
  const [discoverSquads, setDiscoverSquads] = useState<SquadDiscoverRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'discover'>('my');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState<Sport | 'none'>('none');
  const [minJoinXp, setMinJoinXp] = useState('500');
  const [busyJoinId, setBusyJoinId] = useState<string | null>(null);

  const joinUnlocked = (user?.xp ?? 0) >= 500;
  const createUnlocked = (user?.xp ?? 0) >= 500;
  const cityLabel = user?.city?.trim() || 'your area';

  const sportIcon = (sport: Sport | null) => {
    if (!sport) return '👥';
    return (SPORTS.find((s) => s.id === sport)?.icon) ?? '🏀';
  };

  const sportLabel = (sport: Sport | null) => {
    if (!sport) return 'Any sport';
    return (SPORTS.find((s) => s.id === sport)?.name) ?? sport;
  };

  async function refreshMySquads() {
    if (!user?.id) return;
    setLoadingMy(true);
    try {
      setMySquads(await fetchMySquads(user.id));
    } catch (e) {
      console.error(e);
      setMySquads([]);
    } finally {
      setLoadingMy(false);
    }
  }

  async function refreshDiscover(query?: string) {
    if (!user?.id) return;
    setLoadingDiscover(true);
    try {
      const data = await searchSquads({
        userId: user.id,
        query: query ?? search,
        limit: 30,
      });
      setDiscoverSquads(data);
    } catch (e) {
      console.error(e);
      setDiscoverSquads([]);
    } finally {
      setLoadingDiscover(false);
    }
  }

  useEffect(() => {
    void refreshMySquads();
    void refreshDiscover('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (tab === 'discover') {
        void refreshDiscover();
      }
    }, 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab, user?.city]);

  const areaSquads = useMemo(() => {
    return discoverSquads.filter((s) => s.is_nearby);
  }, [discoverSquads]);

  const otherSquads = useMemo(() => {
    const areaIds = new Set(areaSquads.map((s) => s.id));
    return discoverSquads.filter((s) => !areaIds.has(s.id));
  }, [areaSquads, discoverSquads]);

  async function onCreate() {
    if (!user?.id) return;
    try {
      const created = await createSquad({
        userId: user.id,
        name: newName.trim(),
        sport: newSport === 'none' ? null : (newSport as Sport),
        homeArea: user.city,
        minXpRequired: Number(minJoinXp || '500'),
      });
      setCreateOpen(false);
      setNewName('');
      setNewSport('none');
      setMinJoinXp('500');
      await refreshMySquads();
      await refreshDiscover('');
      navigate(`/squad/${created.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not create squad.');
    }
  }

  async function onJoin(squadId: string) {
    if (!user?.id) return;
    setBusyJoinId(squadId);
    try {
      await joinSquadById({ squadId });
      await refreshMySquads();
      await refreshDiscover(search);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Could not join squad.');
    } finally {
      setBusyJoinId(null);
    }
  }

  const SquadCard = ({ squad, showJoin }: { squad: SquadDiscoverRow | SquadWithMeta; showJoin?: boolean }) => {
    const record = `${Number(squad.wins ?? 0)}-${Number(squad.losses ?? 0)}`;
    const membersLabel = `${squad.member_count}/${Number(squad.member_limit ?? 10)}`;
    const discover = squad as SquadDiscoverRow;
    return (
      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3">
          <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/squad/${squad.id}`)}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary/70 flex items-center justify-center text-lg border border-border/60">
                {sportIcon(squad.sport ?? null)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold truncate">{squad.name}</p>
                  {'is_owner' in squad && squad.is_owner ? (
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">Owner</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground truncate">{sportLabel(squad.sport ?? null)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {membersLabel}</span>
                  <span className="inline-flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {record}</span>
                  <span>{Number(squad.points ?? 0)} pts</span>
                  <span>Rtg {Number(squad.rating ?? 1000)}</span>
                </div>
                {squad.home_area ? (
                  <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {squad.home_area}
                  </div>
                ) : null}
              </div>
            </div>
          </button>
          {showJoin ? (
            discover.is_member ? (
              <Button variant="secondary" disabled>Joined</Button>
            ) : (
              <Button
                onClick={() => onJoin(squad.id)}
                disabled={busyJoinId === squad.id || !discover.can_join || !joinUnlocked}
              >
                {busyJoinId === squad.id ? 'Joining...' : 'Join'}
              </Button>
            )
          ) : null}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Minimum XP to join: {Number(squad.min_xp_required ?? 500).toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Squads</h1>
          <button
            onClick={() => {
              if (!createUnlocked) {
                alert('You need 500 XP to create a squad.');
                return;
              }
              setCreateOpen(true);
            }}
            className="p-2 rounded-xl bg-secondary/60"
            aria-label="Create squad"
            title="Create"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-5 max-w-3xl mx-auto space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card p-5 text-center">
            <p className="font-semibold">Squad requirements</p>
            <p className="text-sm text-muted-foreground mt-1">
              Join at 500 XP. Create at 500 XP. Squads cap at 10 members. Competitive rankings favor points, rating, and long-term consistency.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              You currently have {(user?.xp ?? 0).toLocaleString()} XP{user?.city ? ` • Area: ${user.city}` : ''}.
            </p>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4 text-primary" /> What squads now include</div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>Identity, ranking, and local discovery</div>
              <div>Role-based membership structure</div>
              <div>Match history, rivalries, and squad feed</div>
            </div>
          </div>
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 font-semibold"><Flag className="w-4 h-4 text-primary" /> Best use for squads</div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div>Local crews</div>
              <div>Competitive friend groups</div>
              <div>Tournament-ready teams</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'my' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')}
            onClick={() => setTab('my')}
          >
            My Squads
          </button>
          <button
            className={cn('flex-1 h-11 rounded-xl text-sm font-semibold transition', tab === 'discover' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground')}
            onClick={() => setTab('discover')}
          >
            Discover Squads
          </button>
        </div>

        {tab === 'my' ? (
          loadingMy ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">Loading squads...</div>
          ) : mySquads.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="font-semibold">No squads yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create one or discover squads in your area.</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => setTab('discover')}>Discover</Button>
                <Button onClick={() => setCreateOpen(true)} disabled={!createUnlocked}>Create</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mySquads.map((s) => <SquadCard key={s.id} squad={s} />)}
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search squad name or code..."
                className="pl-9 bg-secondary/60"
              />
            </div>

            {loadingDiscover ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">Loading squads...</div>
            ) : (
              <>
                {areaSquads.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="w-4 h-4" /> Squads in {cityLabel}
                    </div>
                    {areaSquads.map((s) => <SquadCard key={s.id} squad={s} showJoin />)}
                  </section>
                ) : null}

                {otherSquads.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="w-4 h-4" /> {search.trim() ? 'Search results' : 'More squads'}
                    </div>
                    {otherSquads.map((s) => <SquadCard key={s.id} squad={s} showJoin />)}
                  </section>
                ) : null}

                {discoverSquads.length === 0 ? (
                  <div className="glass-card p-6 text-center">
                    <p className="font-semibold">No squads found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try another name or code, or create a squad in your area.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Squad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Squad name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: South County Strikers" />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={newSport} onValueChange={(v) => setNewSport(v as Sport | 'none')}>
                <SelectTrigger>
                  <SelectValue placeholder="Any sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any sport</SelectItem>
                  {SPORTS.map((meta) => (
                    <SelectItem key={meta.id} value={meta.id}>{meta.icon} {meta.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Minimum XP to join</Label>
              <Input value={minJoinXp} onChange={(e) => setMinJoinXp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="500" />
              <p className="text-xs text-muted-foreground">Pro-created squads can set this above 500. Free-created squads use 500 automatically.</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
              This build is now structured so each squad can grow into a full team hub with members, rivalries, feed, season progress, events, and competitive history.
            </div>
            <Button onClick={onCreate} disabled={!newName.trim() || !createUnlocked} className="w-full">
              Create squad
            </Button>
            {!createUnlocked ? (
              <p className="text-xs text-center text-muted-foreground">You need 500 XP to create a squad.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
