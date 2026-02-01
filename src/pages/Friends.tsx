import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/AppContext';
import { ArrowLeft } from 'lucide-react';
import { fetchMyFriends } from '@/lib/socialApi';
import type { User } from '@/types';

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user) {
        setFriends([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const f = await fetchMyFriends();
        if (!mounted) return;
        setFriends(f);
      } catch {
        if (!mounted) return;
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.username.toLowerCase().includes(q) || f.email.toLowerCase().includes(q));
  }, [friends, query]);

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
        <div className="glass-card p-4">
          <Input
            placeholder="Search friends"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-muted-foreground text-sm px-1">Loading friends…</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">No friends yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When someone accepts a friend request, they will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((friend) => (
              <div key={friend.id} className="glass-card p-4 flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={friend.profilePhotoUrl} alt={friend.username} />
                  <AvatarFallback>{friend.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{friend.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
