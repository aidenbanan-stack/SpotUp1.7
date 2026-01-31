import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/AppContext';
import { ArrowLeft } from 'lucide-react';
import { fetchMyFriendIds, fetchMyFriends, sendFriendRequest } from '@/lib/socialApi';
import type { User } from '@/types';
import { searchProfiles } from '@/lib/profileApi';
import { Button } from '@/components/ui/button';
import PlayerProfileDialog from '@/components/PlayerProfileDialog';
import { toast } from 'sonner';

type Tab = 'friends' | 'discover';

function initials(name: string) {
  const s = (name || '').trim();
  if (!s) return 'P';
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'P';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
}

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [tab, setTab] = useState<Tab>('friends');

  const [friends, setFriends] = useState<User[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');

  const [discoverQuery, setDiscoverQuery] = useState<string>('');
  const [discoverLoading, setDiscoverLoading] = useState<boolean>(false);
  const [discoverResults, setDiscoverResults] = useState<User[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const openProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileOpen(true);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setFriends([]);
        setFriendIds([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [ids, f] = await Promise.all([fetchMyFriendIds(), fetchMyFriends()]);
        if (!mounted) return;
        setFriendIds(ids);
        setFriends(f);
      } catch {
        if (!mounted) return;
        setFriendIds([]);
        setFriends([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q));
  }, [friends, query]);

  useEffect(() => {
    if (!user) {
      setDiscoverResults([]);
      setDiscoverLoading(false);
      return;
    }

    const q = discoverQuery.trim();
    if (!q) {
      setDiscoverResults([]);
      setDiscoverLoading(false);
      return;
    }

    let cancelled = false;
    setDiscoverLoading(true);

    const t = window.setTimeout(() => {
      void searchProfiles(q, 20)
        .then((res) => {
          if (cancelled) return;

          const filtered = res.filter((u) => u.id !== user.id && !friendIds.includes(u.id));
          setDiscoverResults(filtered);
        })
        .catch(() => {
          if (!cancelled) setDiscoverResults([]);
        })
        .finally(() => {
          if (!cancelled) setDiscoverLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [discoverQuery, friendIds, user?.id]);

  const sendRequest = async (toUserId: string, username: string) => {
    if (!user) {
      toast.error('Please sign in.');
      return;
    }
    try {
      setSendingTo(toUserId);
      await sendFriendRequest(toUserId);
      toast.success(`Friend request sent to ${username}`);
      setDiscoverResults((prev) => prev.filter((u) => u.id !== toUserId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send friend request.';
      toast.error(msg);
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Friends</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-2xl mx-auto">
        <div className="glass-card p-3 flex gap-2">
          <button
            onClick={() => setTab('friends')}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold ${tab === 'friends' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground'}`}
          >
            My Friends
          </button>
          <button
            onClick={() => setTab('discover')}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold ${tab === 'discover' ? 'bg-primary text-primary-foreground' : 'bg-secondary/60 text-foreground'}`}
          >
            Discover
          </button>
        </div>

        {tab === 'friends' ? (
          <>
            <div className="glass-card p-4">
              <Input
                placeholder="Search friends"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="text-muted-foreground text-sm px-1">Loading friends…</div>
            ) : filteredFriends.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">No friends yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Find players in Discover and send a friend request.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => openProfile(friend.id)}
                    className="glass-card p-4 flex items-center gap-3 w-full text-left hover:border-primary/50 transition-all"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.profilePhotoUrl} alt={friend.username} />
                      <AvatarFallback>{initials(friend.username)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{friend.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="glass-card p-4 space-y-3">
              <Input
                placeholder="Search players by username or email"
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tip: search for their username to find them faster.
              </p>
            </div>

            {discoverLoading ? (
              <div className="text-muted-foreground text-sm px-1">Searching…</div>
            ) : discoverQuery.trim() && discoverResults.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="font-semibold">No results</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different username or email.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {discoverResults.map((p) => (
                  <div key={p.id} className="glass-card p-4 flex items-center gap-3">
                    <button onClick={() => openProfile(p.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={p.profilePhotoUrl} alt={p.username} />
                        <AvatarFallback>{initials(p.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{p.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                    </button>

                    <Button
                      onClick={() => void sendRequest(p.id, p.username)}
                      disabled={sendingTo === p.id}
                      className="shrink-0"
                    >
                      {sendingTo === p.id ? 'Sending...' : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <PlayerProfileDialog open={profileOpen} onOpenChange={setProfileOpen} userId={selectedUserId} />
      </main>
    </div>
  );
}
