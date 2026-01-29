import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SportGrid } from '@/components/SportSelector';
import { NumberStepper } from '@/components/NumberStepper';
import { LocationPicker } from '@/components/LocationPicker';
import { ArrowLeft } from 'lucide-react';
import { Sport, SkillLevel, SKILL_LEVELS } from '@/types';
import { toast } from 'sonner';
import { updateGame } from '@/lib/gamesApi';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateToInputs(d: Date) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${mi}`,
  };
}

export default function EditGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, games, setGames } = useApp();

  const game = useMemo(() => games.find(g => g.id === id), [games, id]);

  if (!game) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="glass-card p-5">
            <div className="font-semibold">Game not found</div>
            <div className="text-sm text-muted-foreground">It may have been deleted.</div>
          </div>
        </div>
      </div>
    );
  }

  const isHost = user?.id === game.hostId;
  if (!isHost) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="glass-card p-5">
            <div className="font-semibold">Not allowed</div>
            <div className="text-sm text-muted-foreground">Only the host can edit this game.</div>
          </div>
        </div>
      </div>
    );
  }

  const initialDT = dateToInputs(game.dateTime);

  const [sport, setSport] = useState<Sport[]>([game.sport]);
  const [title, setTitle] = useState(game.title);
  const [description, setDescription] = useState(game.description ?? '');
  const [date, setDate] = useState(initialDT.date);
  const [time, setTime] = useState(initialDT.time);
  const [duration, setDuration] = useState(String(game.duration ?? 90));
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(game.skillRequirement ?? 'intermediate');
  const [maxPlayers, setMaxPlayers] = useState<number>(game.maxPlayers ?? 10);
  const [isPrivate, setIsPrivate] = useState<boolean>(!!game.isPrivate);
  const [location, setLocation] = useState(game.location);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sport.length) {
      toast.error('Please select a sport.');
      return;
    }

    if (!title || !date || !time || !location.areaName) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      const updated = await updateGame(game.id, {
        sport: sport[0],
        title,
        description,
        dateTime: new Date(`${date}T${time}`),
        duration: parseInt(duration, 10),
        skillRequirement: skillLevel,
        maxPlayers,
        isPrivate,
        location,
      });

      setGames(games.map(g => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Game updated.');
      navigate(`/game/${game.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update game.';
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Edit Game</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
          <div className="glass-card p-5 space-y-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">SPORT</div>
              <SportGrid selectedSports={sport} onToggleSport={(s) => setSport([s])} maxSelection={1} />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">TITLE</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning run at the park" />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">DESCRIPTION</div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything players should know"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">DATE</div>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">TIME</div>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">DURATION (MIN)</div>
                <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">SKILL</div>
                <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as SkillLevel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        {lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">MAX PLAYERS</div>
              <NumberStepper value={maxPlayers} onChange={setMaxPlayers} min={2} max={50} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Private game</div>
                <div className="text-xs text-muted-foreground">Players must request to join</div>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">LOCATION</div>
              <LocationPicker value={location} onChange={setLocation} />
            </div>
          </div>

          <Button variant="hero" size="xl" className="w-full" type="submit">
            Save Changes
          </Button>
        </form>
      </main>
    </div>
  );
}
