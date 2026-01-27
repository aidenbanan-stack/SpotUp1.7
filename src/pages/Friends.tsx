import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockUsers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';
import { UserPlus, ArrowLeft } from 'lucide-react';

export default function Friends() {
  const navigate = useNavigate();
  const { user } = useApp();
  const me = user ?? mockUsers[0];
  const friends = useMemo(() => mockUsers.filter(u => u.id !== me.id), [me.id]);

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

      <main className="px-4 py-6 space-y-4">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Mock friends for now so you can test ranking, invites, and squads. Later this will come from real users.
          </p>
          <Input placeholder="Search friends (mock)" />
        </div>

        <div className="space-y-3">
          {friends.map(friend => (
            <div key={friend.id} className="glass-card p-4 flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={friend.profilePhotoUrl} alt={friend.username} />
                <AvatarFallback>{friend.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{friend.username}</p>
                <p className="text-xs text-muted-foreground">{friend.city} • {friend.primarySport}</p>
              </div>
              <Button variant="secondary" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
