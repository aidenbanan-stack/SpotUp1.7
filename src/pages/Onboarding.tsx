import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SportGrid } from '@/components/SportSelector';
import { Sport, SkillLevel, SKILL_LEVELS, User } from '@/types';
import spotupLogo from '@/assets/spotup-logo.png';
import { ArrowLeft, ArrowRight, Camera, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'basics' | 'sports' | 'skill' | 'photo';

export default function Onboarding() {
  const navigate = useNavigate();
  const { setUser } = useApp();
  
  const [step, setStep] = useState<Step>('welcome');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [city, setCity] = useState('');
  const [primarySport, setPrimarySport] = useState<Sport[]>([]);
  const [secondarySports, setSecondarySports] = useState<Sport[]>([]);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');

  const steps: Step[] = ['welcome', 'basics', 'sports', 'skill', 'photo'];
  const currentIndex = steps.indexOf(step);

  const nextStep = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const handleComplete = () => {
    if (!username || !age || !city || primarySport.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newUser: User = {
      id: String(Date.now()),
      username,
      email: `${username.toLowerCase()}@spotup.app`,
      age: parseInt(age),
      height: height || 'Not specified',
      city,
      primarySport: primarySport[0],
      secondarySports: secondarySports.filter(s => s !== primarySport[0]),
      skillLevel,
      profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face',
      stats: {
        gamesPlayed: 0,
        gamesHosted: 0,
        reliability: 100,
      },
      xp: 0,
      level: 'rookie',
      badges: [],
      reliabilityStats: {
        showUps: 0,
        cancellations: 0,
        noShows: 0,
        score: 100,
      },
      votesReceived: {
        bestScorer: 0,
        bestDefender: 0,
        bestTeammate: 0,
      },
    };

    setUser(newUser);
    toast.success('Welcome to SpotUp!');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-50">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentIndex) / (steps.length - 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Welcome Screen */}
      {step === 'welcome' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <img 
            src={spotupLogo} 
            alt="SpotUp" 
            className="w-24 h-24 rounded-3xl mb-6 shadow-glow"
          />
          <h1 className="text-4xl font-black text-foreground mb-2">SpotUp</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Find. Host. Play.
          </p>
          <p className="text-muted-foreground max-w-xs mb-12">
            Connect with local players and join pickup games for your favorite sports.
          </p>
          <Button variant="hero" size="xl" onClick={nextStep} className="w-full max-w-xs">
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Basics Screen */}
      {step === 'basics' && (
        <div className="min-h-screen p-6 pt-12 animate-fade-in">
          <button onClick={prevStep} className="p-2 rounded-xl bg-secondary/60 mb-6">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold mb-2">Tell us about yourself</h2>
          <p className="text-muted-foreground mb-8">We'll use this to find the best games for you.</p>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Username *
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="bg-secondary border-border h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Age *
                </label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  className="bg-secondary border-border h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Height
                </label>
                <Input
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder='6&apos;2"'
                  className="bg-secondary border-border h-12"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                City *
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Los Angeles"
                className="bg-secondary border-border h-12"
              />
            </div>
          </div>

          <div className="fixed bottom-6 left-6 right-6">
            <Button 
              variant="hero" 
              size="xl" 
              onClick={nextStep} 
              className="w-full"
              disabled={!username || !age || !city}
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Sports Screen */}
      {step === 'sports' && (
        <div className="min-h-screen p-6 pt-12 pb-32 animate-fade-in">
          <button onClick={prevStep} className="p-2 rounded-xl bg-secondary/60 mb-6">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold mb-2">What's your sport?</h2>
          <p className="text-muted-foreground mb-6">Select your primary sport first, then add any others you play.</p>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">PRIMARY SPORT *</h3>
            <SportGrid 
              selected={primarySport} 
              onChange={(sports) => {
                setPrimarySport(sports);
                // Remove from secondary if selected as primary
                setSecondarySports(secondarySports.filter(s => !sports.includes(s)));
              }} 
              single 
            />
          </div>

          {primarySport.length > 0 && (
            <div className="animate-fade-in">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">ALSO PLAY (OPTIONAL)</h3>
              <SportGrid 
                selected={secondarySports} 
                onChange={(sports) => setSecondarySports(sports.filter(s => !primarySport.includes(s)))} 
              />
            </div>
          )}

          <div className="fixed bottom-6 left-6 right-6">
            <Button 
              variant="hero" 
              size="xl" 
              onClick={nextStep} 
              className="w-full"
              disabled={primarySport.length === 0}
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Skill Level Screen */}
      {step === 'skill' && (
        <div className="min-h-screen p-6 pt-12 animate-fade-in">
          <button onClick={prevStep} className="p-2 rounded-xl bg-secondary/60 mb-6">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold mb-2">What's your skill level?</h2>
          <p className="text-muted-foreground mb-8">Be honest — it helps us match you with the right games.</p>

          <div className="space-y-3">
            {SKILL_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => setSkillLevel(level.id)}
                className={cn(
                  'glass-card w-full p-5 text-left transition-all duration-200 flex items-center justify-between',
                  skillLevel === level.id 
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30' 
                    : 'border-border/50 hover:border-border'
                )}
              >
                <div>
                  <h3 className="font-semibold text-lg">{level.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {level.id === 'beginner' && 'Just getting started, learning the basics'}
                    {level.id === 'intermediate' && 'Know the rules, play regularly'}
                    {level.id === 'advanced' && 'Very competitive, played for years'}
                    {level.id === 'elite' && 'Professional or semi-pro level'}
                  </p>
                </div>
                {skillLevel === level.id && (
                  <Check className="w-6 h-6 text-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="fixed bottom-6 left-6 right-6">
            <Button variant="hero" size="xl" onClick={nextStep} className="w-full">
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Photo Screen */}
      {step === 'photo' && (
        <div className="min-h-screen p-6 pt-12 animate-fade-in">
          <button onClick={prevStep} className="p-2 rounded-xl bg-secondary/60 mb-6">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-2xl font-bold mb-2">Add a profile photo</h2>
          <p className="text-muted-foreground mb-8">Help others recognize you on the court.</p>

          <div className="flex flex-col items-center py-12">
            <button className="relative group">
              <div className="w-32 h-32 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center group-hover:border-primary transition-colors">
                <Camera className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="absolute bottom-0 right-0 p-2 bg-primary rounded-full">
                <Camera className="w-5 h-5 text-primary-foreground" />
              </div>
            </button>
            <p className="text-sm text-muted-foreground mt-4">Tap to upload a photo</p>
          </div>

          <div className="fixed bottom-6 left-6 right-6 space-y-3">
            <Button variant="hero" size="xl" onClick={handleComplete} className="w-full">
              Complete Setup
              <Check className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="ghost" size="lg" onClick={handleComplete} className="w-full">
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
