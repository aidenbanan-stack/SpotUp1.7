import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { fetchSquadById, fetchSquadMembers, type SquadMemberProfile } from '@/lib/squadsApi';
import { SPORTS } from '@/types';

export default function SquadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState<any>(null);
  const [members, setMembers] = useState<SquadMemberProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id || !user?.id) return;
      setLoading(true);
      try {
        const s = await fetchSquadById(id);
        const m = await fetchSquadMembers(id);
        if (cancelled) return;
        setSquad(s);
        setMembers(m);
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Could not load squad',
          description: e?.message ?? 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  const sportMeta = useMemo(() => {
    const key = (squad?.sport ?? null) as any;
    if (!key) return null;
    return (SPORTS as any)[key] ?? null;
  }, [squad?.sport]);

  const totalXp = useMemo(() => members.reduce((sum, m) => sum + (m.xp ?? 0), 0), [members]);

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

  const inviteCode = squad?.invite_code ?? '';

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast({ title: 'Invite code copied', description: inviteCode });
    } catch {
      toast({ title: 'Copy failed', description: inviteCode });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
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
                    {sportMeta ? (
                      <span>
                        {sportMeta.icon} {sportMeta.name}
                      </span>
                    ) : (
                      <span>All sports</span>
                    )}
                    <span className="mx-2">•</span>
                    <span>{members.length} members</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Squad XP</div>
                  <div className="text-2xl font-bold">{totalXp.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="text-muted-foreground">Invite code</div>
                  <div className="font-mono text-base">{inviteCode || '—'}</div>
                </div>
                <Button onClick={copyInvite} disabled={!inviteCode}>
                  Copy
                </Button>
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
          <button
            key={m.user_id}
            className="w-full text-left"
            onClick={() => navigate(`/profile/${m.user_id}`)}
          >
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 text-sm font-semibold text-muted-foreground">#{idx + 1}</div>
                  <div>
                    <div className="font-semibold leading-tight">
                      {m.username ?? 'Player'}
                      {(m.role ?? '').toLowerCase() === 'owner' ? (
                        <span className="ml-2 text-xs text-amber-600">Owner</span>
                      ) : null}
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

        {!loading && squad && sortedMembers.length === 0 ? (
          <div className="text-sm text-muted-foreground">No members found.</div>
        ) : null}
      </div>
    </div>
  );
}
