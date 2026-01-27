import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockUsers } from '@/data/mockData';
import { useApp } from '@/context/AppContext';

type Squad = {
  id: string;
  name: string;
  memberIds: string[];
};

export default function Squads() {
  const navigate = useNavigate();
  const { user } = useApp();
  const me = user ?? mockUsers[0];
  const friends = useMemo(() => mockUsers.filter(u => u.id !== me.id), [me.id]);

  const [squads, setSquads] = useState<Squad[]>([
    { id: 's1', name: 'Sunset Squad', memberIds: [me.id, friends[0]?.id, friends[1]?.id].filter(Boolean) as string[] },
  ]);
  const [name, setName] = useState('');

  const createSquad = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSquads(prev => [{ id: `s${Date.now()}`, name: trimmed, memberIds: [me.id] }, ...prev]);
    setName('');
  };

  const toggleMember = (squadId: string, userId: string) => {
    setSquads(prev =>
      prev.map(s => {
        if (s.id !== squadId) return s;
        const exists = s.memberIds.includes(userId);
        return { ...s, memberIds: exists ? s.memberIds.filter(id => id !== userId) : [...s.memberIds, userId] };
      })
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Squads</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-4">
        <div className="glass-card p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Squads are groups you can invite to pickup games or tournaments. This is a local stub for now.
          </p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Create a squad name" />
            <Button onClick={createSquad} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </div>
        </div>

        {squads.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users2 className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Create your first squad above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {squads.map(squad => {
              const members = [me, ...friends].filter(u => squad.memberIds.includes(u.id));
              return (
                <div key={squad.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{squad.name}</p>
                      <p className="text-xs text-muted-foreground">{members.length} members</p>
                    </div>
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map(m => (
                        <Avatar key={m.id} className="w-8 h-8 border border-background">
                          <AvatarImage src={m.profilePhotoUrl} alt={m.username} />
                          <AvatarFallback>{m.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">INVITE FRIENDS</p>
                    <div className="space-y-2">
                      {friends.slice(0, 6).map(f => {
                        const selected = squad.memberIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => toggleMember(squad.id, f.id)}
                            className={
                              `w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                                selected ? 'bg-primary/15 border border-primary/30' : 'bg-secondary/40 hover:bg-secondary'
                              }`
                            }
                          >
                            <Avatar className="w-9 h-9">
                              <AvatarImage src={f.profilePhotoUrl} alt={f.username} />
                              <AvatarFallback>{f.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                              <p className="font-semibold text-foreground">{f.username}</p>
                              <p className="text-xs text-muted-foreground">{f.primarySport}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{selected ? 'Added' : 'Tap to add'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
