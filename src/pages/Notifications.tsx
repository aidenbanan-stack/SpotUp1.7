import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell, Calendar, Check, MoreVertical, UserPlus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { acceptFriendRequest, rejectFriendRequest } from '@/lib/socialApi';
import { acceptGameInvite, approveJoinRequest, rejectJoinRequest } from '@/lib/gamesApi';
import { fetchProfileById } from '@/lib/profileApi';
import { toast } from 'sonner';
import { createNotification } from '@/lib/notificationsApi';
import { clearMyNotifications, clearMyReadNotifications, deleteNotification, markNotificationRead } from '@/lib/notificationsApi';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Notifications() {
  const navigate = useNavigate();
  const { user, notifications, setNotifications } = useApp();

  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const relatedUserIdsNeedingNames = useMemo(() => {
    return Array.from(
      new Set(
        notifications
          .map(n => n.relatedUserId)
          .filter(Boolean) as string[]
      )
    );
  }, [notifications]);

  useEffect(() => {
    let mounted = true;

    const loadNames = async () => {
      const missing = relatedUserIdsNeedingNames.filter(uid => !nameByUserId[uid]);
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
  }, [relatedUserIdsNeedingNames, nameByUserId]);

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
      case 'message_request':
      case 'new_message':
        return <Bell className="w-5 h-5 text-primary" />;
      case 'game_invite':
        return <Calendar className="w-5 h-5 text-green-500" />;
      case 'join_request':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
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


const handleAcceptGameInvite = async (notificationId: string, inviterUserId: string, gameId: string) => {
  try {
    const updated = await acceptGameInvite(gameId, inviterUserId);

    // If accepting an invite resulted in a private join request (not joined yet), notify host (best-effort).
    if (updated.isPrivate && user && !(updated.playerIds ?? []).includes(user.id) && (updated.pendingRequestIds ?? []).includes(user.id)) {
      // joinGame() already notifies host for pending requests, but keep this as a safeguard.
      try {
        if (updated.hostId) {
          await createNotification({
            userId: updated.hostId,
            type: 'join_request',
            relatedUserId: user.id,
            relatedGameId: updated.id,
            message: 'New join request',
          });
        }
      } catch {
        // ignore
      }
    }

    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    toast.success(updated.isPrivate ? 'Invite accepted.' : 'Joined the game.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to accept invite.';
    toast.error(msg);
  }
};

const handleDecline = async (notificationId: string) => {
  try {
    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    toast.success('Declined.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to decline.';
    toast.error(msg);
  }
};

const handleApproveJoinRequestFromNotif = async (notificationId: string, requesterUserId: string, gameId: string) => {
  try {
    const updated = await approveJoinRequest(gameId, requesterUserId);

    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    toast.success('Approved join request.');

    // Best-effort notify requester
    try {
      await createNotification({
        userId: requesterUserId,
        type: 'game_approved',
        relatedUserId: updated.hostId,
        relatedGameId: updated.id,
        message: 'Your request to join was approved',
      });
    } catch {
      // ignore
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to approve request.';
    toast.error(msg);
  }
};

const handleRejectJoinRequestFromNotif = async (notificationId: string, requesterUserId: string, gameId: string) => {
  try {
    const updated = await rejectJoinRequest(gameId, requesterUserId);

    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    toast.success('Rejected join request.');

    // Best-effort notify requester
    try {
      await createNotification({
        userId: requesterUserId,
        type: 'game_denied',
        relatedUserId: updated.hostId,
        relatedGameId: updated.id,
        message: 'Your request to join was denied',
      });
    } catch {
      // ignore
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reject request.';
    toast.error(msg);
  }
};
  return (
    <div className="min-h-screen bg-background pb-24 safe-top">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-secondary/60"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-bold">Notifications</h1>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 rounded-xl bg-secondary/60"
                aria-label="Notification actions"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={markAllAsRead}>Mark all as read</DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearRead}>Clear read</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleClearAll}>
                Clear all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

              const subtitle = fromId ? `From ${fromName}` : undefined;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'glass-card p-4 cursor-pointer transition-all hover:scale-[1.01]',
                    !notification.read && 'border-primary/30 bg-primary/5'
                  )}
                  onClick={() => {
                    // Friend requests should keep their action buttons visible until accepted/rejected.
                    if (notification.type !== 'friend_request' && notification.type !== 'game_invite' && notification.type !== 'join_request') {
                      markAsReadLocal(notification.id);
                    }

                    if (notification.type === 'game_invite' && notification.relatedGameId) {
                      navigate(`/game/${notification.relatedGameId}`);
                    }
                    if ((notification.type === 'message_request' || notification.type === 'new_message')) {
                      navigate('/messages');
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
                      {notification.type === 'game_invite' && fromId && notification.relatedGameId && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAcceptGameInvite(notification.id, fromId, notification.relatedGameId!);
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDecline(notification.id);
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      )}

                      {notification.type === 'join_request' && fromId && notification.relatedGameId && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleApproveJoinRequestFromNotif(notification.id, fromId, notification.relatedGameId!);
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRejectJoinRequestFromNotif(notification.id, fromId, notification.relatedGameId!);
                            }}
                          >
                            Deny
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
