import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from '@/types';
import { fetchProfileById } from '@/lib/profileApi';
import { sendFriendRequest } from '@/lib/socialApi';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
};

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
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14">
              <AvatarImage src={profile.profilePhotoUrl} alt={profile.username} />
              <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
