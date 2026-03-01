import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users, Link as LinkIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Sport } from '@/types';
import { SPORTS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { createSquad, fetchMySquads, joinSquadByCode, type SquadWithMeta } from '@/lib/squadsApi';

export default function Squads() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [squads, setSquads] = useState<SquadWithMeta[]>([]);
  const [q, setQ] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState<Sport | 'none'>('none');

  const [code, setCode] = useState('');

  async function refresh() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchMySquads(user.id);
      setSquads(data);
    } catch (e) {
      console.error(e);
      setSquads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return squads;
    return squads.filter((s) => s.name.toLowerCase().includes(term));
  }, [squads, q]);

  const sportIcon = (sport: Sport | null) => {
    if (!sport) return '👥';
    return (SPORTS as any)[sport]?.icon ?? '🏀';
  };

  const sportLabel = (sport: Sport | null) => {
    if (!sport) return 'Any sport';
    return (SPORTS as any)[sport]?.label ?? sport;
  };

  async function onCreate() {
    if (!user?.id) return;
    const name = newName.trim();
    if (!name) return;

    try {
      const created = await createSquad({
        userId: user.id,
        name,
        sport: newSport === 'none' ? null : (newSport as Sport),
      });

      setCreateOpen(false);
      setNewName('');
      setNewSport('none');

      // Re-fetch to include member counts
      await refresh();

      // Copy invite code to clipboard as a helpful UX
      try {
        await navigator.clipboard.writeText(created.invite_code);
      } catch {}
    } catch (e) {
      console.error(e);
      alert('Could not create squad. Check your Supabase tables / RLS.');
    }
  }

  async function onJoin() {
    if (!user?.id) return;
    const c = code.trim();
    if (!c) return;

    try {
      await joinSquadByCode({ userId: user.id, code: c });
      setJoinOpen(false);
      setCode('');
      await refresh();
    } catch (e) {
      console.error(e);
      alert('Could not join squad. Double-check the invite code and RLS.');
    }
  }

  return (
    <div className="min-h-screen bg-background safe-top pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-bold">Squads</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setJoinOpen(true)}
              className="p-2 rounded-xl bg-secondary/60"
              aria-label="Join squad"
              title="Join"
            >
              <LinkIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="p-2 rounded-xl bg-secondary/60"
              aria-label="Create squad"
              title="Create"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search squads..."
          className="bg-secondary/60"
        />

        {loading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Loading squads...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">No squads yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create one to play with friends, or join with an invite code.
            </p>

            <div className="mt-4 flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => setJoinOpen(true)}>
                Join
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Create</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center text-lg">
                      {sportIcon(s.sport)}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{sportLabel(s.sport)}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{s.member_count} member{s.member_count === 1 ? '' : 's'}</span>
                        {s.is_owner ? (
                          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary">Owner</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="secondary"
                      className="h-9"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(s.invite_code);
                          alert('Invite code copied!');
                        } catch {
                          alert(`Invite code: ${s.invite_code}`);
                        }
                      }}
                    >
                      Copy code
                    </Button>

                    <p className="text-xs text-muted-foreground">Code: {s.invite_code}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-background border-border/60 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create squad</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Squad name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: RSM Night Hoopers"
                className="bg-secondary/60"
              />
            </div>

            <div className="space-y-2">
              <Label>Primary sport (optional)</Label>
              <Select value={newSport} onValueChange={(v) => setNewSport(v as any)}>
                <SelectTrigger className="bg-secondary/60">
                  <SelectValue placeholder="Pick a sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any sport</SelectItem>
                  {Object.entries(SPORTS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {(value as any).icon} {(value as any).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full h-12" onClick={onCreate} disabled={!newName.trim()}>
              Create squad
            </Button>

            <p className="text-xs text-muted-foreground">
              After creating, your invite code is copied to clipboard so you can share it.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="bg-background border-border/60 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Join squad</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Invite code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: K7P2QJ"
                className="bg-secondary/60"
                autoCapitalize="characters"
              />
            </div>

            <Button className="w-full h-12" onClick={onJoin} disabled={!code.trim()}>
              Join
            </Button>

            <p className="text-xs text-muted-foreground">Invite codes are case-insensitive.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
