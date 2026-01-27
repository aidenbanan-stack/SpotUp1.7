import { useState } from 'react';
import { User, Game } from '@/types';
import { Button } from '@/components/ui/button';
import { Trophy, Shield, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PostGameVotingProps {
  game: Game;
  players: User[];
  currentUserId: string;
  onVoteComplete: (votes: { category: string; votedUserId: string }[]) => void;
}

type VoteCategory = 'best_scorer' | 'best_defender' | 'best_passer';

const VOTE_CATEGORIES: { id: VoteCategory; name: string; icon: typeof Trophy; description: string }[] = [
  { id: 'best_shooter', name: 'Best Shooter', icon: Trophy, description: 'Knocked down the most shots' },
  { id: 'best_passer', name: 'Best Passer', icon: Users, description: 'Created the most looks for others' },
  { id: 'best_all_around', name: 'Best All-Around', icon: Trophy, description: 'Impact on both ends' },
  { id: 'best_scorer', name: 'Best Scorer', icon: Trophy, description: 'Got buckets all game' },
  { id: 'best_defender', name: 'Best Defender', icon: Shield, description: 'Lockdown defense' },
];

export function PostGameVoting({ game, players, currentUserId, onVoteComplete }: PostGameVotingProps) {
  const [votes, setVotes] = useState<Record<VoteCategory, string | null>>({
    best_shooter: null,
    best_passer: null,
    best_all_around: null,
    best_scorer: null,
    best_defender: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligiblePlayers = players.filter(p => p.id !== currentUserId);

  const handleVote = (category: VoteCategory, userId: string) => {
    setVotes(prev => ({
      ...prev,
      [category]: prev[category] === userId ? null : userId,
    }));
  };

  const handleSubmit = () => {
    const submittedVotes = Object.entries(votes)
      .filter(([_, userId]) => userId !== null)
      .map(([category, votedUserId]) => ({ category, votedUserId: votedUserId! }));

    if (submittedVotes.length === 0) {
      toast.error('Please vote for at least one player');
      return;
    }

    setIsSubmitting(true);
    onVoteComplete(submittedVotes);
    toast.success('Votes submitted! +10 XP earned');
  };

  const allVotesComplete = Object.values(votes).every(v => v !== null);

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground mb-1">Post-Game Voting</h3>
        <p className="text-sm text-muted-foreground">
          Who stood out in today's game?
        </p>
      </div>

      <div className="space-y-4">
        {VOTE_CATEGORIES.map(({ id, name, icon: Icon, description }) => (
          <div key={id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground">- {description}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {eligiblePlayers.map(player => (
                <button
                  key={player.id}
                  onClick={() => handleVote(id, player.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-all',
                    votes[id] === player.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80 text-foreground'
                  )}
                >
                  <img
                    src={player.profilePhotoUrl}
                    alt={player.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                  <span className="text-sm font-medium">{player.username}</span>
                  {votes[id] === player.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          variant="hero"
          className="w-full"
        >
          {allVotesComplete ? 'Submit All Votes (+15 XP)' : 'Submit Votes (+10 XP)'}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Voting helps players earn XP and badges!
        </p>
      </div>
    </div>
  );
}
