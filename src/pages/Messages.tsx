import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { format } from 'date-fns';
import { fetchMyFriendIds } from '@/lib/socialApi';
import { searchProfiles } from '@/lib/profileApi';
import type { User } from '@/types';
import { fetchGameById, joinGame } from '@/lib/gamesApi';
import {
  acceptMessageRequest,
  fetchMessages,
  fetchMyConversations,
  fetchMyMessageRequests,
  rejectMessageRequest,
  sendMessage,
  sendGameInvite,
  sendMessageRequest,
  getOrCreateConversationWithUser,
  type Conversation,
  type Message,
  type MessageRequest,
} from '@/lib/messagesApi';
import { supabase } from '@/lib/supabaseClient';
import { isConversationUnread, setConversationLastRead } from '@/lib/messageReadState';
import { createNotification } from '@/lib/notificationsApi';

export default function Messages() {
  const navigate = useNavigate();
  const { user, games } = useApp();

  const [loading, setLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);

  const [mode, setMode] = useState<'list' | 'chat'>('list');
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const convIdsRef = useRef<string[]>([]);

  const [draft, setDraft] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteGameId, setInviteGameId] = useState<string>('');
  const [inviteNote, setInviteNote] = useState('');

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<User[]>([]);

  const isFriend = useMemo(() => {
    const set = new Set(friendIds);
    return (id: string) => set.has(id);
  }, [friendIds]);

  const load = async () => {
    try {
      setLoading(true);
      const [fids, convs, reqs] = await Promise.all([
        fetchMyFriendIds().catch(() => []),
        fetchMyConversations().catch(() => []),
        fetchMyMessageRequests().catch(() => []),
      ]);
      setFriendIds(fids);
      // Sort by most recent last message.
      const sorted = [...convs].sort((a, b) => {
        const ta = a.lastMessage?.createdAt ? +new Date(a.lastMessage.createdAt) : 0;
        const tb = b.lastMessage?.createdAt ? +new Date(b.lastMessage.createdAt) : 0;
        return tb - ta;
      });
      setConversations(sorted);
      setRequests(reqs.filter(r => r.status === 'pending'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openConversation = async (conv: Conversation) => {
    try {
      setMode('chat');
      setActiveConv(conv);
      const msgs = await fetchMessages(conv.id);
      setMessages(msgs);

      // Mark as read locally.
      setConversationLastRead(conv.id, Date.now());
      setConversations((prev) =>
        [...prev].map((c) => (c.id === conv.id ? { ...c } : c))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages.';
      toast.error(msg);
    }
  };

  // Realtime: keep conversation list fresh + unread dots.
  useEffect(() => {
    if (!user) return;
    convIdsRef.current = conversations.map((c) => c.id);
  }, [conversations, user?.id]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-inbox')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row: any = payload.new;
          const convId = String(row.conversation_id ?? '');
          if (!convId) return;

          // If we have a list, update last message + reorder.
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === convId);
            if (idx === -1) return prev;
            const next = [...prev];
            const current = next[idx];
            const updated: Conversation = {
              ...current,
              lastMessage: {
                body: String(row.body ?? ''),
                createdAt: new Date(row.created_at),
                senderId: String(row.sender_id ?? ''),
              },
            };
            next.splice(idx, 1);
            return [updated, ...next];
          });

          // If we are currently in this chat, append message and mark read.
          setMessages((prevMsgs) => {
            if (mode !== 'chat') return prevMsgs;
            if (!activeConv || activeConv.id !== convId) return prevMsgs;

            const m: Message = {
              id: String(row.id),
              conversationId: convId,
              senderId: String(row.sender_id),
              body: String(row.body ?? ''),
              type: (row.type ?? 'text') as any,
              meta: row.meta ?? undefined,
              createdAt: new Date(row.created_at),
            };
            // Avoid duplicates (sometimes we refetch).
            if (prevMsgs.some((x) => x.id === m.id)) return prevMsgs;
            setConversationLastRead(convId, Date.now());
            return [...prevMsgs, m];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, mode, activeConv?.id]);

  const handleSend = async () => {
    if (!activeConv) return;
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    try {
      await sendMessage(activeConv.id, text);

      // Best-effort notification for the recipient.
      try {
        if (activeConv.otherUserId) {
          await createNotification({
            userId: activeConv.otherUserId,
            type: 'new_message',
            relatedUserId: user?.id ?? undefined,
            message: 'New message',
          });
        }
      } catch {
        // ignore
      }

      const msgs = await fetchMessages(activeConv.id);
      setMessages(msgs);

      // Update conversation preview + keep it at the top.
      const last = msgs[msgs.length - 1];
      if (last) {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === activeConv.id);
          if (idx === -1) return prev;
          const next = [...prev];
          const current = next[idx];
          const updated: Conversation = {
            ...current,
            lastMessage: { body: last.body, createdAt: last.createdAt, senderId: last.senderId },
          };
          next.splice(idx, 1);
          return [updated, ...next];
        });
        setConversationLastRead(activeConv.id, Date.now());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message.';
      toast.error(msg);
    }
  };

  const runSearch = async () => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const users = await searchProfiles(q, 20);
      setResults(users.filter(u => u.id !== user?.id));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const startChatOrRequest = async (other: User) => {
    if (!user) return;

    if (isFriend(other.id)) {
      try {
        const convId = await getOrCreateConversationWithUser(other.id);
        const conv: Conversation = {
          id: convId,
          createdAt: new Date(),
          otherUserId: other.id,
          otherUsername: other.username,
          otherPhotoUrl: other.profilePhotoUrl,
        };
        setConversations((prev) => [conv, ...prev]);
        await openConversation(conv);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start chat.';
        toast.error(msg);
      }
      return;
    }

    try {
      await sendMessageRequest(other.id, `Hey ${other.username}!`);
      toast.success('Message request sent.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send request.';
      // Some deployments insert successfully but still return a client-side error.
      toast.error(`${msg} If they still receive it, you're good.`);
    }
  };

  const acceptReq = async (req: MessageRequest) => {
    try {
      const convId = await acceptMessageRequest(req.id);
      toast.success('Request accepted.');

      setRequests((prev) => prev.filter(r => r.id !== req.id));

      // Reload conversations (simple)
      const convs = await fetchMyConversations().catch(() => []);
      setConversations(convs);

      // Open the new conversation
      const just = convs.find(c => c.id === convId);
      if (just) await openConversation(just);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to accept request.';
      toast.error(msg);
    }
  };

  const rejectReq = async (req: MessageRequest) => {
    try {
      await rejectMessageRequest(req.id);
      setRequests((prev) => prev.filter(r => r.id !== req.id));
      toast.success('Request rejected.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reject request.';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  if (mode === 'chat' && activeConv) {
    const myUpcomingHosted = (games ?? [])
      .filter((g) => g.hostId === user?.id)
      .filter((g) => g.status === 'scheduled')
      .filter((g) => +new Date(g.dateTime) > Date.now())
      .sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));

    const handleSendInvite = async () => {
      if (!activeConv) return;
      if (!inviteGameId) {
        toast.error('Pick a game first.');
        return;
      }
      try {
        await sendGameInvite(activeConv.id, inviteGameId, inviteNote);
        setInviteOpen(false);
        setInviteGameId('');
        setInviteNote('');
        const msgs = await fetchMessages(activeConv.id);
        setMessages(msgs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send invite.';
        toast.error(msg);
      }
    };

    const handleJoinInvite = async (gameId: string) => {
      if (!user) return;
      try {
        const g = await fetchGameById(gameId);
        await joinGame(gameId, user.id, g.isPrivate);
        toast.success('Joined (or requested) successfully.');
        navigate(`/game/${gameId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to join.';
        toast.error(msg);
      }
    };

    return (
      <div className="min-h-screen bg-background pb-24 safe-top">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => {
                setMode('list');
                setActiveConv(null);
                setMessages([]);
              }}
              className="p-2 rounded-xl bg-secondary/60"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={activeConv.otherPhotoUrl} />
              <AvatarFallback>{(activeConv.otherUsername ?? 'P').slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
              <h1 className="text-lg font-bold">{activeConv.otherUsername}</h1>
            </div>

            <div className="w-10" />
          </div>
        </header>

        <main className="px-4 py-4 max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              No messages yet.
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user?.id;
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[80%]')}
                  >
                    {m.type === 'game_invite' ? (
                      <div className={cn('rounded-2xl px-4 py-3 text-sm border border-border/50', mine ? 'bg-primary/10' : 'bg-secondary/60')}>
                        <div className="font-semibold text-foreground">Game invite</div>
                        {m.body ? <div className="text-muted-foreground mt-1">{m.body}</div> : null}
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => navigate(`/game/${m.meta?.game_id}`)}>
                            View
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleJoinInvite(String(m.meta?.game_id))}>
                            Join
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={cn('rounded-2xl px-4 py-2 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary/60')}>
                        {m.body}
                      </div>
                    )}
                    <div className={cn('mt-1 text-[11px] text-muted-foreground', mine ? 'text-right' : 'text-left')}>
                      {format(m.createdAt, 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>

        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Invite</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send a game invite</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <Select value={inviteGameId} onValueChange={setInviteGameId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick one of your upcoming games" />
                    </SelectTrigger>
                    <SelectContent>
                      {myUpcomingHosted.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No upcoming hosted games
                        </SelectItem>
                      ) : (
                        myUpcomingHosted.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.title} ({format(new Date(g.dateTime), 'MMM d, h:mm a')})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Input value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="Optional note" />
                </div>

                <DialogFooter>
                  <Button onClick={handleSendInvite}>Send invite</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleSend} className="gap-2">
              <Send className="w-4 h-4" />
              Send
            </Button>
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
          <h1 className="text-xl font-bold">Messages</h1>
          <Button variant="ghost" onClick={load} className="text-sm">
            Refresh
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <section className="glass-card p-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users to message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch();
              }}
            />
            <Button onClick={runSearch} disabled={searching}>
              Search
            </Button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-secondary/40">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={u.profilePhotoUrl} />
                      <AvatarFallback>{(u.username ?? 'P').slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold leading-tight">{u.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {isFriend(u.id) ? 'Friend' : 'Not a friend (sends request)'}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => void startChatOrRequest(u)} className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    {isFriend(u.id) ? 'Chat' : 'Request'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Tabs defaultValue="conversations">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="conversations" className="mt-4 space-y-2">
            {conversations.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">No conversations yet.</p>
              </div>
            ) : (
              conversations.map((c) => {
                const unread = isConversationUnread({
                  conversationId: c.id,
                  lastMessageAt: c.lastMessage?.createdAt,
                  lastMessageSenderId: c.lastMessage?.senderId,
                  meId: user?.id,
                });
                const ts = c.lastMessage?.createdAt ? format(new Date(c.lastMessage.createdAt), 'h:mm a') : '';

                return (
                <button
                  key={c.id}
                  onClick={() => void openConversation(c)}
                  className="w-full text-left p-3 rounded-2xl bg-secondary/40 hover:bg-secondary/60 transition flex items-center gap-3"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={c.otherPhotoUrl} />
                    <AvatarFallback>{(c.otherUsername ?? 'P').slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{c.otherUsername}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {c.lastMessage?.body ?? 'Tap to open'}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {ts ? <span className="text-xs text-muted-foreground">{ts}</span> : null}
                    {unread ? <span className="w-2 h-2 rounded-full bg-red-500" /> : null}
                  </div>
                </button>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <div className="glass-card p-6 text-center text-muted-foreground">No pending requests.</div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl bg-secondary/40 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={r.fromPhotoUrl} />
                    <AvatarFallback>{(r.fromUsername ?? 'P').slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{r.fromUsername}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.initialMessage || 'Wants to message you.'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => void acceptReq(r)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => void rejectReq(r)}>Reject</Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
