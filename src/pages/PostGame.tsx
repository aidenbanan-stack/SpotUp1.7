import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PostGameVoting } from '@/components/PostGameVoting';
import { reportNoShow, submitPostGameVotes } from '@/lib/gamesApi';
import { fetchProfilesByIds, getOrCreateMyProfile } from '@/lib/profileApi';
import { awardReceivedVotes } from '@/lib/xpApi';
import type { User } from '@/types';

const CORE_CATEGORY_KEYS = [
  'most_dominant',
  'best_teammate',
  'most_clutch',
  'winner',
  'most_energy',
] as const;

const SPORT_CATEGORY_KEYS = {
  basketball: ['bucket_getter', 'lockdown_defender', 'floor_general', 'board_beast', 'sharpshooter'],
  soccer: ['finisher', 'playmaker', 'wall', 'ball_winner', 'engine'],
  pickleball: ['dink_master', 'net_boss', 'rally_king', 'placement_pro', 'unshakeable'],
  football: ['qb1', 'route_runner', 'hands_team', 'lockdown_db', 'big_play_threat'],
  baseball: ['slugger', 'ace', 'gold_glove', 'spark_plug', 'closer'],
  volleyball: ['kill_leader', 'block_party', 'setter_elite', 'dig_machine', 'serve_specialist'],
  frisbee: ['handler', 'deep_threat', 'shutdown_defender', 'layout_legend', 'field_general'],
} as const;

export default function PostGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { games, setGames, user, setUser } = useApp();
  const [busy, setBusy] = useState(false);
  const [noShowBusyId, setNoShowBusyId] = useState<string | null>(null);

  const game = games.find((g) => g.id === id);

  const [players, setPlayers] = useState<User[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPlayers = async () => {
      if (!game) return;

      const ids = (game.checkedInIds?.length ? game.checkedInIds : game.playerIds) ?? [];
      const unique = Array.from(new Set(ids));

      setPlayersLoading(true);
      try {
        const profs = await fetchProfilesByIds(unique);
        if (!mounted) return;
        setPlayers(profs);
      } catch {
        if (!mounted) return;
        setPlayers([]);
      } finally {
        if (mounted) setPlayersLoading(false);
      }
    };

    void loadPlayers();

    return () => {
      mounted = false;
    };
  }, [game?.id, game?.checkedInIds?.join(','), game?.playerIds?.join(',')]);

  const hasVotedAll = useMemo(() => {
    if (!game || !user) return false;
    const rec = (game.postGameVoters && game.postGameVoters[user.id]) ? game.postGameVoters[user.id] : {};
    const allKeys = [...CORE_CATEGORY_KEYS, ...(SPORT_CATEGORY_KEYS[game.sport] ?? [])];
    return allKeys.every((k) => !!rec[k]);
  }, [game, user]);

  const handleVoteComplete = async (votes: { category: string; votedUserId: string }[]) => {
    if (!user || !game) {
      toast.error('Please sign in first.');
      return;
    }
    try {
      setBusy(true);
      const updated = await submitPostGameVotes(game.id, user.id, votes as any);
      setGames(games.map((g) => (g.id === game.id ? { ...g, ...updated } : g)));
      toast.success('Votes submitted.');

      // XP: award vote recipients based on submitted votes
      try {
        await awardReceivedVotes(game.id, votes);
        const refreshed = await getOrCreateMyProfile();
        setUser(refreshed);
      } catch {
        // Non-blocking
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit votes.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const isHost = !!user && !!game && game.hostId === user.id;

  const noShowCandidates = useMemo(() => {
    if (!game) return [] as User[];
    const checked = new Set(game.checkedInIds ?? []);
    const signedUp = new Set(game.playerIds ?? []);
    const missingIds = Array.from(signedUp).filter((pid) => !checked.has(pid));
    const byId = new Map(players.map((p) => [p.id, p] as const));
    return missingIds.map((pid) => byId.get(pid)).filter(Boolean) as User[];
  }, [game, players]);

  const handleReportNoShow = async (reportedUserId: string) => {
    if (!game || !isHost) return;
    try {
      setNoShowBusyId(reportedUserId);
      await reportNoShow(game.id, reportedUserId);
      toast.success('No-show reported. Reliability updated.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to report no-show.';
      toast.error(msg);
    } finally {
      setNoShowBusyId(null);
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background p-6 safe-top">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="mt-2 font-semibold">Game not found</p>
            <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-6 safe-top">
        <div className="max-w-lg mx-auto space-y-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">Sign in required</p>
            <p className="text-sm text-muted-foreground mt-1">You need an account to vote.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-secondary/60" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Postgame Voting</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-4">
        {playersLoading ? (
          <div className="text-sm text-muted-foreground">Loading players…</div>
        ) : players.length < 2 ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">Not enough players</p>
            <p className="text-sm text-muted-foreground mt-1">Need at least 2 players to vote.</p>
          </div>
        ) : hasVotedAll ? (
          <div className="glass-card p-6 text-center">
            <p className="font-semibold">You already voted</p>
            <p className="text-sm text-muted-foreground mt-1">Thanks for submitting your votes.</p>
          </div>
        ) : (
          <PostGameVoting
            game={game}
            players={players}
            currentUserId={user.id}
            onVoteComplete={handleVoteComplete}
          />
        )}

        {isHost && noShowCandidates.length > 0 && (
          <section className="glass-card p-4">
            <h2 className="font-semibold">Report no-shows</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Players who signed up but did not check in. Reporting updates their reliability.
            </p>
            <div className="mt-3 space-y-2">
              {noShowCandidates.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-secondary/40 rounded-xl p-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.city}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={noShowBusyId === p.id}
                    onClick={() => void handleReportNoShow(p.id)}
                  >
                    Report
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <Button variant="secondary" className="w-full" disabled={busy} onClick={() => navigate(`/game/${game.id}`)}>
          Back to game
        </Button>
      </main>
    </div>
  );
}
