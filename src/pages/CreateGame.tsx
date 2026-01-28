import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SportGrid } from '@/components/SportSelector';
import { NumberStepper } from '@/components/NumberStepper';
import { LocationPicker } from '@/components/LocationPicker';
import { ArrowLeft, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { Sport, SkillLevel, SKILL_LEVELS, Game } from '@/types';
import { toast } from 'sonner';
import { createGame } from '@/lib/gamesApi';

export default function CreateGame() {
  const navigate = useNavigate();
  const { user, games, setGames } = useApp();

  const [sport, setSport] = useState<Sport[]>(user?.primarySport ? [user.primarySport] : []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('90');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [location, setLocation] = useState({
    latitude: 34.0522,
    longitude: -118.2437,
    areaName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Profile still loading. Try again in a moment.');
      return;
    }

    if (sport.length === 0) {
      toast.error('Please select a sport');
      return;
    }

    if (!title || !date || !time || !location.areaName) {
      toast.error('Please fill in all required fields');
      return;
    }

    const prevGames = games;

    const optimisticGame: Game = {
      id: String(Date.now()),
      hostId: user.id,
      host: user,
      sport: sport[0],
      title,
      description,
      dateTime: new Date(`${date}T${time}`),
      duration: parseInt(duration, 10),
      skillRequirement: skillLevel,
      maxPlayers,
      playerIds: [user.id],
      players: [user],
      pendingRequestIds: [],
      isPrivate,
      status: 'scheduled',
      checkedInIds: [],
      runsStarted: false,
      location,
      createdAt: new Date(),
    };

    setGames([optimisticGame, ...prevGames]);

    try {
      const saved = await createGame({
        hostId: optimisticGame.hostId,
        sport: optimisticGame.sport,
        title: optimisticGame.title,
        description: optimisticGame.description,
        dateTime: optimisticGame.dateTime,
        duration: optimisticGame.duration,
        skillRequirement: optimisticGame.skillRequirement,
        maxPlayers: optimisticGame.maxPlayers,
        playerIds: optimisticGame.playerIds,
        pendingRequestIds: optimisticGame.pendingRequestIds,
        isPrivate: optimisticGame.isPrivate,
        location: optimisticGame.location,
        status: optimisticGame.status,
        checkedInIds: optimisticGame.checkedInIds,
        runsStarted: optimisticGame.runsStarted,
      });

      setGames([saved, ...prevGames.filter((g) => g.id !== optimisticGame.id)]);
      toast.success('Game created successfully!');
      navigate(`/game/${saved.id}`);
    } catch (err: any) {
      setGames(prevGames);

      // This is the important part: see the real error
      // eslint-disable-next-line no-console
      console.error('[createGame] failed:', err);

      const message =
        err?.message ||
        err?.error_description ||
        err?.details ||
        err?.hint ||
        'Failed to create game.';

      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Host a Game</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
        <section className="animate-fade-in">
          <label className="text-sm font-semibold text-muted-foreground mb-3 block">
            SELECT SPORT *
          </label>
          <SportGrid selected={sport} onChange={setSport} single />
        </section>

        <section className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Game Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sunset Run at Venice Beach"
              className="bg-secondary border-border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell players what to expect..."
              className="bg-secondary border-border min-h-[100px]"
            />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date *
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time *
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </section>

        <section className="space-y-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Duration (min)
            </label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 120, 180].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Max Players
            </label>
            <NumberStepper value={maxPlayers} onChange={setMaxPlayers} min={2} max={30} step={1} />
          </div>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Skill Level Required
          </label>
          <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as SkillLevel)}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_LEVELS.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location *
          </label>
          <LocationPicker value={location} onChange={setLocation} />
        </section>

        <section className="glass-card p-4 flex items-center justify-between animate-fade-in" style={{ animationDelay: '350ms' }}>
          <div>
            <h3 className="font-semibold text-foreground">Private Game</h3>
            <p className="text-sm text-muted-foreground">Players must request to join</p>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </section>

        <Button type="submit" variant="hero" size="xl" className="w-full">
          Create Game
        </Button>
      </form>
    </div>
  );
}
