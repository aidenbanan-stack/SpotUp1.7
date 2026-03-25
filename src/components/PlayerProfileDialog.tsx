import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Badge, User } from '@/types';
import { fetchProfileById } from '@/lib/profileApi';
import { sendFriendRequest } from '@/lib/socialApi';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';


const VOTE_LABELS: Record<string, string> = {
  most_dominant: 'Most Dominant',
  best_teammate: 'Best Teammate',
  most_clutch: 'Most Clutch',
  winner: 'Winner',
  most_energy: 'Most Energy',
  bucket_getter: 'Bucket Getter',
  lockdown_defender: 'Lockdown Defender',
  floor_general: 'Floor General',
  board_beast: 'Board Beast',
  sharpshooter: 'Sharpshooter',
  finisher: 'Finisher',
  playmaker: 'Playmaker',
  wall: 'Wall',
  ball_winner: 'Ball Winner',
  engine: 'Engine',
  dink_master: 'Dink Master',
  net_boss: 'Net Boss',
  rally_king: 'Rally King',
  placement_pro: 'Placement Pro',
  unshakeable: 'Unshakeable',
  qb1: 'QB1',
  route_runner: 'Route Runner',
  hands_team: 'Hands Team',
  lockdown_db: 'Lockdown DB',
  big_play_threat: 'Big Play Threat',
  slugger: 'Slugger',
  ace: 'Ace',
  gold_glove: 'Gold Glove',
  spark_plug: 'Spark Plug',
  closer: 'Closer',
  kill_leader: 'Kill Leader',
  block_party: 'Block Party',
  setter_elite: 'Setter Elite',
  dig_machine: 'Dig Machine',
  serve_specialist: 'Serve Specialist',
  handler: 'Handler',
  deep_threat: 'Deep Threat',
  shutdown_defender: 'Shutdown Defender',
  layout_legend: 'Layout Legend',
  field_general: 'Field General',
};

function getVoteEntries(votes: Record<string, number> | undefined) {
  return Object.entries(votes ?? {})
    .filter(([key, value]) => !['mostDominant', 'bestTeammate'].includes(key) && Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
}
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
};

function initials(name: string) {
  const s = (name || '').trim();
  if (!s) return 'P';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'P';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function BadgeChip({ b }: { b: Badge }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
      <span className="text-base leading-none">{b.icon || '🏅'}</span>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{b.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{b.description}</div>
      </div>
    </div>
  );
}

export default function PlayerProfileDialog({ open, onOpenChange, userId }: Props) {
  const { user: me } = useApp();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const isMe = useMemo(() => {
    if (!me || !profile) return false;
    return me.id === profile.id;
  }, [me, profile]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!open || !userId) return;
      try {
        setLoading(true);
        const u = await fetchProfileById(userId);
        if (mounted) setProfile(u);
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [open, userId]);

  const handleAddFriend = async () => {
    if (!me) {
      toast.error('Please sign in.');
      return;
    }
    if (!profile) return;
    if (me.id === profile.id) return;

    try {
      setSending(true);
      await sendFriendRequest(profile.id);
      toast.success(`Friend request sent to ${profile.username}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send friend request.';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const badges = (profile?.badges ?? []).slice(0, 6);
  const voteEntries = getVoteEntries(profile?.votesReceived as Record<string, number> | undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Player Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : !profile ? (
          <div className="text-sm text-muted-foreground">Profile not found.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarImage src={profile.profilePhotoUrl} alt={profile.username} />
                <AvatarFallback>{initials(profile.username)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{profile.username}</div>
                <div className="text-xs text-muted-foreground truncate">{profile.city}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {profile.primarySport} • {profile.skillLevel}
                </div>
              </div>

              <Button onClick={handleAddFriend} disabled={!me || isMe || sending}>
                {isMe ? 'You' : sending ? 'Sending...' : 'Add Friend'}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatPill label="XP" value={profile.xp ?? 0} />
              <StatPill label="Level" value={(profile.level ?? 'rookie').replace('_', ' ')} />
              <StatPill label="Reliability" value={`${profile.stats?.reliability ?? 100}%`} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <StatPill label="Games Played" value={profile.stats?.gamesPlayed ?? 0} />
              <StatPill label="Games Hosted" value={profile.stats?.gamesHosted ?? 0} />
              <StatPill label="Courts" value={profile.uniqueCourtsPlayed ?? 0} />
            </div>


            <div className="glass-card p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">About</div>
              {profile.bio ? (
                <div className="text-sm text-foreground whitespace-pre-line">{profile.bio}</div>
              ) : (
                <div className="text-sm text-muted-foreground">No bio yet.</div>
              )}
            </div>

            <div className="glass-card p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Post-game votes</div>
              {voteEntries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No post-game votes yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {voteEntries.map(([key, value]) => (
                    <StatPill key={key} label={VOTE_LABELS[key] ?? key} value={value} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Badges</div>
              {badges.length ? (
                <div className="grid gap-2">
                  {badges.map((b) => (
                    <BadgeChip key={b.id} b={b} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No badges yet.</div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
