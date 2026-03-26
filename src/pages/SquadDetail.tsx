import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, ShieldCheck, Sword, Trophy, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { SPORTS } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { fetchMySquads, fetchSquadById, fetchSquadMembers, leaveSquadById, type SquadRow, type SquadMemberProfile } from '@/lib/squadsApi';

export default function SquadDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [squad, setSquad] = useState<SquadRow | null>(null);
  const [members, setMembers] = useState<SquadMemberProfile[]>([]);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id || !user?.id) return;
      setLoading(true);
      try {
        const [s, m, mine] = await Promise.all([
          fetchSquadById(id),
          fetchSquadMembers(id),
          fetchMySquads(user.id),
        ]);
        if (cancelled) return;
        setSquad(s);
        setMembers(m);
        setIsMember(mine.some((row) => row.id === id));
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Could not load squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, toast]);

  const sportMeta = useMemo(() => {
    const key = (squad?.sport ?? null) as any;
    if (!key) return null;
    return SPORTS.find((s) => s.id === key) ?? null;
  }, [squad?.sport]);

  const totalXp = useMemo(() => members.reduce((sum, m) => sum + (m.xp ?? 0), 0), [members]);
  const record = `${Number(squad?.wins ?? 0)}-${Number(squad?.losses ?? 0)}`;

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    copy.sort((a, b) => {
      const ar = (a.role ?? '').toLowerCase();
      const br = (b.role ?? '').toLowerCase();
      if (ar === 'owner' && br !== 'owner') return -1;
      if (br === 'owner' && ar !== 'owner') return 1;
      return (b.xp ?? 0) - (a.xp ?? 0);
    });
    return copy;
  }, [members]);

  async function onLeave() {
    if (!id) return;
    const ownerId = squad?.owner_id ?? null;
    if (ownerId && user?.id === ownerId) {
      toast({ title: 'Owner cannot leave', description: 'Transfer or delete the squad first.', variant: 'destructive' });
      return;
    }
    setLeaving(true);
    try {
      await leaveSquadById({ squadId: id });
      toast({ title: 'Left squad' });
      navigate('/squads');
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Could not leave squad', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
        <div className="text-sm text-muted-foreground">Squad</div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : squad ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold leading-tight">{squad.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {sportMeta ? <span>{sportMeta.icon} {sportMeta.name}</span> : <span>All sports</span>}
                    <span className="mx-2">•</span>
                    <span>{members.length} members</span>
                  </div>
                  {squad.home_area ? (
                    <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {squad.home_area}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Squad XP</div>
                  <div className="text-2xl font-bold">{totalXp.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Trophy className="w-4 h-4" /> Points</div>
                  <div className="text-lg font-bold mt-1">{Number(squad.points ?? 0)}</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Sword className="w-4 h-4" /> Record</div>
                  <div className="text-lg font-bold mt-1">{record}</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Rating</div>
                  <div className="text-lg font-bold mt-1">{Number(squad.rating ?? 1000)}</div>
                </div>
                <div className="rounded-xl bg-secondary/40 p-3">
                  <div className="text-muted-foreground inline-flex items-center gap-1"><Users className="w-4 h-4" /> Join req</div>
                  <div className="text-lg font-bold mt-1">{Number(squad.min_join_xp ?? 0)} XP</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="text-muted-foreground">Invite code</div>
                  <div className="font-mono text-base">{squad.invite_code || '—'}</div>
                </div>
                {isMember ? (
                  <Button variant="secondary" onClick={onLeave} disabled={leaving}>
                    {leaving ? 'Leaving...' : 'Leave Squad'}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Squad not found.</div>
          )}
        </CardContent>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="text-xs text-muted-foreground">Tap profile to view</div>
      </div>

      <div className="space-y-2">
        {sortedMembers.map((m, idx) => (
          <button key={m.user_id} className="w-full text-left" onClick={() => navigate(`/profile/${m.user_id}`)}>
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 text-sm font-semibold text-muted-foreground">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold leading-tight">
                      {m.username ?? 'Player'}
                      {(m.role ?? '').toLowerCase() === 'owner' ? <span className="ml-2 text-xs text-amber-600">Owner</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">Level {m.level ?? 1}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{(m.xp ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">XP</div>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}

        {!loading && squad && sortedMembers.length === 0 ? <div className="text-sm text-muted-foreground">No members found.</div> : null}
      </div>
    </div>
  );
}
