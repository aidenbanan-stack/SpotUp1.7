import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import type { User, Sport, Game, Notification } from '@/types';
import { fetchGames } from '@/lib/gamesApi';
import { fetchMyNotifications } from '@/lib/notificationsApi';
import { supabase } from '@/lib/supabaseClient';

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
  refreshNotifications: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const isAuthenticated = !!user;

  const [selectedSport, setSelectedSport] = useState<Sport | 'all'>('all');

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState<boolean>(false);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const refreshGames = async () => {
    try {
      setGamesLoading(true);
      setGamesError(null);
      const data = await fetchGames();
      setGames(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load games';
      setGamesError(msg);
    } finally {
      setGamesLoading(false);
    }
  };

  const refreshNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await fetchMyNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    void refreshGames();
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [user?.id]);

  // Realtime notifications (best-effort).
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          void refreshNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value: AppContextType = {
    user,
    setUser,
    isAuthenticated,
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
    refreshNotifications,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
