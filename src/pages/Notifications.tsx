import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell, Calendar, Check, UserPlus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { acceptFriendRequest, rejectFriendRequest } from '@/lib/socialApi';
import { fetchProfileById } from '@/lib/profileApi';
import { toast } from 'sonner';
import { clearMyNotifications, clearMyReadNotifications, deleteNotification, markNotificationRead } from '@/lib/notificationsApi';

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, setNotifications } = useApp();

  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const friendRequestUserIds = useMemo(() => {
    return Array.from(
      new Set(
        notifications
          .filter(n => n.type === 'friend_request' && n.relatedUserId)
          .map(n => n.relatedUserId as string)
      )
    );
  }, [notifications]);

  useEffect(() => {
    let mounted = true;

    const loadNames = async () => {
      const missing = friendRequestUserIds.filter(uid => !nameByUserId[uid]);
      if (!missing.length) return;

      const entries: Record<string, string> = {};
      for (const uid of missing) {
        try {
          const u = await fetchProfileById(uid);
          if (u) entries[uid] = u.username;
        } catch {
          // ignore
        }
      }
      if (!mounted) return;
      setNameByUserId(prev => ({ ...prev, ...entries }));
    };

    void loadNames();
    return () => {
      mounted = false;
    };
  }, [friendRequestUserIds, nameByUserId]);

  const markAsReadLocal = (id: string) => {
    setNotifications(notifications.map(n => (n.id === id ? { ...n, read: true } : n)));
    // Best-effort sync to DB.
    void markNotificationRead(id).catch(() => undefined);
};


  const handleClearRead = async () => {
    try {
      await clearMyReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.read));
      toast.success('Cleared read notifications.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear notifications.';
      toast.error(msg);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearMyNotifications();
      setNotifications([]);
      toast.success('Cleared all notifications.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear notifications.';
      toast.error(msg);
    }
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'game_invite':
        return <Calendar className="w-5 h-5 text-green-500" />;
      case 'game_approved':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'game_denied':
        return <X className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const handleAccept = async (notifId: string, fromUserId: string) => {
  try {
    await acceptFriendRequest(fromUserId);

    // Remove immediately so it disappears after action
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));

    // Remove from DB too
    await deleteNotification(notifId);

    toast.success('Friend request accepted.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept request.';
    toast.error(msg);
  }
};

  const handleReject = async (notifId: string, fromUserId: string) => {
  try {
    await rejectFriendRequest(fromUserId);

    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    await deleteNotification(notifId);

    toast.success('Friend request rejected.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reject request.';
    toast.error(msg);
  }
};

  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-lg font-bold">Notifications</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleClearRead} className="text-sm">
              Clear read
            </Button>
            <Button variant="ghost" onClick={markAllAsRead} className="text-sm">
              Mark all read
            </Button>
            <Button variant="ghost" onClick={handleClearAll} className="text-sm text-destructive">
              Clear all
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No notifications</h2>
            <p className="text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const fromId = notification.relatedUserId;
              const fromName = fromId ? (nameByUserId[fromId] || 'Someone') : 'Someone';

              const subtitle =
                notification.type === 'friend_request'
                  ? `From ${fromName}`
                  : undefined;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'glass-card p-4 cursor-pointer transition-all hover:scale-[1.01]',
                    !notification.read && 'border-primary/30 bg-primary/5'
                  )}
                  onClick={() => {
                    // Friend requests should keep their action buttons visible until accepted/rejected.
                    if (notification.type !== 'friend_request') {
                      markAsReadLocal(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-background/50">{getNotificationIcon(notification.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{notification.message}</p>
                          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                        </span>
                      </div>

                      {notification.type === 'friend_request' && fromId && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(notification.id, fromId);
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(notification.id, fromId);
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
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
