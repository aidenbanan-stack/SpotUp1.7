import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Sport, Game, Notification } from '@/types';
import { mockGames, mockNotifications } from '@/data/mockData';
import { fetchGames } from '@/lib/gamesApi';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  selectedSport: Sport | 'all';
  setSelectedSport: (sport: Sport | 'all') => void;
  games: Game[];
  setGames: (games: Game[]) => void;
  refreshGames: () => Promise<void>;
  gamesLoading: boolean;
  gamesError: string | null;
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  unreadCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  // User is loaded from Supabase auth + profiles in AuthGate.
  const [user, setUser] = useState<User | null>(null);
  const [selectedSport, setSelectedSport] = useState<Sport | 'all'>('all');
  const [games, setGames] = useState<Game[]>(mockGames);
  const [gamesLoading, setGamesLoading] = useState<boolean>(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const refreshGames = async () => {
    try {
      setGamesError(null);
      setGamesLoading(true);
      const dbGames = await fetchGames();
      setGames(dbGames);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load games from the database.';
      setGamesError(message);
      // Keep existing games (mock) so the UI is still usable.
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    // Load from Supabase on startup. If env vars are missing, fetchGames will fail and
    // the UI will fall back to mock data.
    void refreshGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthenticated: !!user,
      selectedSport,
      setSelectedSport,
      games,
      setGames,
      refreshGames,
      gamesLoading,
      gamesError,
      notifications,
      setNotifications,
      unreadCount,
    }),
    [user, selectedSport, games, notifications, unreadCount, gamesLoading, gamesError]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
