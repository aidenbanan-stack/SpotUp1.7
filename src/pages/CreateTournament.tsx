import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { createTournament } from '@/lib/tournamentsApi';

import {
  TournamentFormat,
  SeriesType,
  TeamCount,
  PointsStyle,
  TOURNAMENT_FORMATS,
  TEAM_COUNTS,
  Sport,
  canCreateTournament,
} from '@/types';
import { ArrowLeft, Trophy, MapPin, Calendar, Target, Info, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NumberStepper } from '@/components/NumberStepper';
import { LocationPicker } from '@/components/LocationPicker';
import { SportSelector } from '@/components/SportSelector';
import { toast } from 'sonner';

export default function CreateTournament() {
  const navigate = useNavigate();
  const { user } = useApp();

  // Check if user can create tournaments
  const canCreate = user
    ? canCreateTournament(user)
    : { allowed: false, requirements: { reliability: false, hostRating: false, gamesHosted: false } };

  useEffect(() => {
    if (!canCreate.allowed) {
      navigate('/tournaments');
    }
  }, [canCreate.allowed, navigate]);

  const [name, setName] = useState('');
  const [sport, setSport] = useState<Sport>('basketball');
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('3v3');
  const [seriesType, setSeriesType] = useState<SeriesType>('single_elimination');
  const [teamCount, setTeamCount] = useState<TeamCount>(8);

  const [playToScore, setPlayToScore] = useState(21);
  const [pointsStyle, setPointsStyle] = useState<PointsStyle>('1s_and_2s');
  const [makeItTakeIt, setMakeItTakeIt] = useState(false);

  // Fix: define isPrivate (you were referencing it but it didn't exist)
  const [isPrivate, setIsPrivate] = useState(false);

  const [location, setLocation] = useState({
    latitude: 34.0195,
    longitude: -118.4912,
    areaName: '',
  });
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!canCreate.allowed) {
    return null;
  }

  const handleSubmit = async () => {
    console.log('[CreateTournament] clicked');

    if (!user?.id) {
      toast.error('Please sign in first');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter a tournament name');
      return;
    }
    if (!location.areaName) {
      toast.error('Please select a location');
      return;
    }
    if (!dateTime) {
      toast.error('Please select a date and time');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        hostId: user.id,
        name: name.trim(),
        sport,
        format: tournamentFormat, // Fix: was "format" (undefined)
        seriesType,
        teamCount,
        pointsStyle,
        isPrivate,
        location,
        startsAtISO: new Date(dateTime).toISOString(),
        notes: notes.trim() ? notes.trim() : null,
      };

      console.log('[CreateTournament] payload', payload);

      await createTournament(payload);

      toast.success('Tournament created!');
      navigate('/tournaments');
    } catch (e: any) {
      console.error('[CreateTournament] create failed:', e);
      toast.error(e?.message ? `Failed: ${e.message}` : 'Failed to create tournament. Check Supabase / RLS.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-secondary/60"
            type="button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Create Tournament</h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Tournament Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Tournament Name</Label>
          <Input
            id="name"
            placeholder="e.g., Venice Beach 3v3 Championship"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Sport Selection */}
        <div className="space-y-2">
          <Label>Sport</Label>
          <SportSelector
            selected={sport}
            onChange={(s) => s !== 'all' && setSport(s)}
            showAll={false}
          />
        </div>

        {/* Format */}
        <div className="space-y-2">
          <Label>Format</Label>
          <div className="grid grid-cols-5 gap-2">
            {TOURNAMENT_FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTournamentFormat(f.id)}
                className={cn(
                  'px-3 py-2 rounded-xl text-sm font-medium transition-all',
                  tournamentFormat === f.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
                )}
                type="button"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Series Type */}
        <div className="space-y-2">
          <Label>Series Type</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSeriesType('single_elimination')}
              className={cn(
                'p-4 rounded-xl text-left transition-all',
                seriesType === 'single_elimination'
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-secondary/60 border-2 border-transparent'
              )}
              type="button"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Single Elimination</span>
                {seriesType === 'single_elimination' && <Check className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">One loss and you&apos;re out</p>
            </button>

            <button
              onClick={() => setSeriesType('best_of_3')}
              className={cn(
                'p-4 rounded-xl text-left transition-all',
                seriesType === 'best_of_3'
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-secondary/60 border-2 border-transparent'
              )}
              type="button"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">Best of 3</span>
                {seriesType === 'best_of_3' && <Check className="w-4 h-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">Win 2 games per match</p>
            </button>
          </div>

          {seriesType === 'best_of_3' && (
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg mt-2">
              <Info className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Each match is a best-of-3 series. Teams must win 2 games to advance.
              </p>
            </div>
          )}
        </div>

        {/* Team Count */}
        <div className="space-y-2">
          <Label>Number of Teams</Label>
          <Select value={String(teamCount)} onValueChange={(v) => setTeamCount(Number(v) as TeamCount)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEAM_COUNTS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} teams
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Game Rules */}
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Game Rules</h3>
          </div>

          <div className="flex items-center justify-between">
            <Label>Play to</Label>
            <NumberStepper value={playToScore} onChange={setPlayToScore} min={5} max={50} step={1} />
          </div>

          <div className="space-y-2">
            <Label>Points Style</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPointsStyle('1s_and_2s')}
                className={cn(
                  'px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  pointsStyle === '1s_and_2s'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground'
                )}
                type="button"
              >
                1s and 2s
              </button>
              <button
                onClick={() => setPointsStyle('2s_and_3s')}
                className={cn(
                  'px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  pointsStyle === '2s_and_3s'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground'
                )}
                type="button"
              >
                2s and 3s
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Make-it take-it</Label>
              <p className="text-xs text-muted-foreground">Winner keeps possession after scoring</p>
            </div>
            <Switch checked={makeItTakeIt} onCheckedChange={setMakeItTakeIt} />
          </div>
        </div>

        {/* Private */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <Label>Private tournament</Label>
              <p className="text-xs text-muted-foreground">Only invited players can view or join</p>
            </div>
          </div>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </Label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        {/* Date & Time */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Date & Time
          </Label>
          <Input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="bg-secondary/60"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            placeholder="Any additional info for players..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        {/* Submit */}
        <Button
          type="button"
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          <Trophy className="w-5 h-5 mr-2" />
          {isSubmitting ? 'Creating...' : 'Create Tournament'}
        </Button>
      </main>
    </div>
  );
}
