import { useMemo, useState } from 'react';
import type { User, Game, PostGameVoteCategory, Sport } from '@/types';
import { Button } from '@/components/ui/button';
import { Trophy, Users as UsersIcon, Check, Zap, Medal, Flame, Shield, Star, Target, CircleDot, Crown, Goal, Hand, Activity, Brain, Sparkles, Gauge, Route, Volleyball, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type VoteConfig = {
  id: PostGameVoteCategory;
  name: string;
  description: string;
  icon: any;
  bucket: 'core' | 'sport';
};

interface PostGameVotingProps {
  game: Game;
  players: User[];
  currentUserId: string;
  onVoteComplete: (votes: { category: PostGameVoteCategory; votedUserId: string }[]) => void;
}

const CORE_VOTES: VoteConfig[] = [
  { id: 'most_dominant', name: 'Most Dominant', icon: Trophy, description: 'Best overall presence in the session', bucket: 'core' },
  { id: 'best_teammate', name: 'Best Teammate', icon: UsersIcon, description: 'Most supportive and easiest to play with', bucket: 'core' },
  { id: 'most_clutch', name: 'Most Clutch', icon: Medal, description: 'Came through when it mattered', bucket: 'core' },
  { id: 'winner', name: 'Winner', icon: Crown, description: 'Felt like they were winning all session', bucket: 'core' },
  { id: 'most_energy', name: 'Most Energy', icon: Zap, description: 'Brought the hustle and intensity', bucket: 'core' },
];

const SPORT_VOTES: Record<Sport, VoteConfig[]> = {
  basketball: [
    { id: 'bucket_getter', name: 'Bucket Getter', icon: Flame, description: 'Scored at will', bucket: 'sport' },
    { id: 'lockdown_defender', name: 'Lockdown Defender', icon: Shield, description: 'Shut people down', bucket: 'sport' },
    { id: 'floor_general', name: 'Floor General', icon: Target, description: 'Controlled the game', bucket: 'sport' },
    { id: 'board_beast', name: 'Board Beast', icon: Activity, description: 'Owned the glass', bucket: 'sport' },
    { id: 'sharpshooter', name: 'Sharpshooter', icon: Star, description: 'Knocked down shots', bucket: 'sport' },
  ],
  soccer: [
    { id: 'finisher', name: 'Finisher', icon: Goal, description: 'Clinical around goal', bucket: 'sport' },
    { id: 'playmaker', name: 'Playmaker', icon: Sparkles, description: 'Created chances all game', bucket: 'sport' },
    { id: 'wall', name: 'Wall', icon: Shield, description: 'Impossible to get past', bucket: 'sport' },
    { id: 'ball_winner', name: 'Ball Winner', icon: CircleDot, description: 'Won the ball back constantly', bucket: 'sport' },
    { id: 'engine', name: 'Engine', icon: Gauge, description: 'Covered every inch of the field', bucket: 'sport' },
  ],
  pickleball: [
    { id: 'dink_master', name: 'Dink Master', icon: Hand, description: 'Owned the soft game', bucket: 'sport' },
    { id: 'net_boss', name: 'Net Boss', icon: Crown, description: 'Controlled the kitchen', bucket: 'sport' },
    { id: 'rally_king', name: 'Rally King', icon: Activity, description: 'Thrived in long points', bucket: 'sport' },
    { id: 'placement_pro', name: 'Placement Pro', icon: Target, description: 'Put the ball exactly where needed', bucket: 'sport' },
    { id: 'unshakeable', name: 'Unshakeable', icon: Shield, description: 'Stayed composed under pressure', bucket: 'sport' },
  ],
  football: [
    { id: 'qb1', name: 'QB1', icon: Trophy, description: 'Commanded the offense', bucket: 'sport' },
    { id: 'route_runner', name: 'Route Runner', icon: Route, description: 'Created separation all game', bucket: 'sport' },
    { id: 'hands_team', name: 'Hands Team', icon: Hand, description: 'Caught everything', bucket: 'sport' },
    { id: 'lockdown_db', name: 'Lockdown DB', icon: Shield, description: 'Erased matchups', bucket: 'sport' },
    { id: 'big_play_threat', name: 'Big Play Threat', icon: Flame, description: 'Could break the game open anytime', bucket: 'sport' },
  ],
  baseball: [
    { id: 'slugger', name: 'Slugger', icon: Trophy, description: 'Drove the ball all over', bucket: 'sport' },
    { id: 'ace', name: 'Ace', icon: Star, description: 'Dominated from the mound', bucket: 'sport' },
    { id: 'gold_glove', name: 'Gold Glove', icon: Shield, description: 'Made every play cleanly', bucket: 'sport' },
    { id: 'spark_plug', name: 'Spark Plug', icon: Zap, description: 'Brought life to the team', bucket: 'sport' },
    { id: 'closer', name: 'Closer', icon: Target, description: 'Finished the job', bucket: 'sport' },
  ],
  volleyball: [
    { id: 'kill_leader', name: 'Kill Leader', icon: Trophy, description: 'Put points away', bucket: 'sport' },
    { id: 'block_party', name: 'Block Party', icon: Shield, description: 'Owned the net defensively', bucket: 'sport' },
    { id: 'setter_elite', name: 'Setter Elite', icon: Brain, description: 'Set up everyone perfectly', bucket: 'sport' },
    { id: 'dig_machine', name: 'Dig Machine', icon: Activity, description: 'Kept impossible balls alive', bucket: 'sport' },
    { id: 'serve_specialist', name: 'Serve Specialist', icon: Volleyball, description: 'Applied constant pressure from the line', bucket: 'sport' },
  ],
  frisbee: [
    { id: 'handler', name: 'Handler', icon: Disc3, description: 'Controlled possession', bucket: 'sport' },
    { id: 'deep_threat', name: 'Deep Threat', icon: Flame, description: 'Dangerous downfield', bucket: 'sport' },
    { id: 'shutdown_defender', name: 'Shutdown Defender', icon: Shield, description: 'Locked down their matchup', bucket: 'sport' },
    { id: 'layout_legend', name: 'Layout Legend', icon: Star, description: 'Made the highlight plays', bucket: 'sport' },
    { id: 'field_general', name: 'Field General', icon: Target, description: 'Directed the flow of the game', bucket: 'sport' },
  ],
};

export function PostGameVoting({ game, players, currentUserId, onVoteComplete }: PostGameVotingProps) {
  const voteConfigs = useMemo(() => [...CORE_VOTES, ...(SPORT_VOTES[game.sport] ?? [])], [game.sport]);

  const [votes, setVotes] = useState<Partial<Record<PostGameVoteCategory, string | null>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligiblePlayers = players.filter((p) => p.id !== currentUserId);

  const handleVote = (category: PostGameVoteCategory, userId: string) => {
    setVotes((prev) => ({
      ...prev,
      [category]: prev[category] === userId ? null : userId,
    }));
  };

  const handleSubmit = () => {
    const submittedVotes = (Object.entries(votes) as [PostGameVoteCategory, string | null][])
      .filter(([, userId]) => userId !== null)
      .map(([category, votedUserId]) => ({ category, votedUserId: votedUserId! }));

    if (submittedVotes.length === 0) {
      toast.error('Please vote for at least one player');
      return;
    }

    setIsSubmitting(true);
    onVoteComplete(submittedVotes);
  };

  const renderSection = (bucket: 'core' | 'sport', title: string, subtitle: string) => {
    const sectionVotes = voteConfigs.filter((v) => v.bucket === bucket);
    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>

        {sectionVotes.map(({ id, name, icon: Icon, description }) => (
          <div key={id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground">- {description}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {eligiblePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
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
    );
  };

  return (
    <div className="glass-card p-5 space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground mb-1">Post-Game Voting</h3>
        <p className="text-sm text-muted-foreground">Vote for the players who stood out this session.</p>
      </div>

      {renderSection('core', 'Core votes', 'These are always available for every sport.')}
      {renderSection('sport', 'Sport-specific votes', 'These change based on the sport for this session.')}

      <div className="pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          variant="hero"
          className="w-full"
        >
          Submit votes
        </Button>
      </div>
    </div>
  );
}
