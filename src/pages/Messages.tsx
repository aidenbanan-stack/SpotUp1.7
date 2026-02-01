import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Search, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { fetchMyFriendIds } from '@/lib/socialApi';
import { searchProfiles } from '@/lib/profileApi';
import type { User } from '@/types';
import {
  acceptMessageRequest,
  createConversationWithUser,
  fetchMessages,
  fetchMyConversations,
  fetchMyMessageRequests,
  rejectMessageRequest,
  sendMessage,
  sendMessageRequest,
  type Conversation,
  type Message,
  type MessageRequest,
} from '@/lib/messagesApi';

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);

  const [mode, setMode] = useState<'list' | 'chat'>('list');
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

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
      setConversations(convs);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load messages.';
      toast.error(msg);
    }
  };

  const handleSend = async () => {
    if (!activeConv) return;
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    try {
      await sendMessage(activeConv.id, text);
      const msgs = await fetchMessages(activeConv.id);
      setMessages(msgs);
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
        const convId = await createConversationWithUser(other.id);
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
      toast.error(msg);
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
              <img src={activeConv.otherPhotoUrl} className="w-8 h-8 rounded-full object-cover" />
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
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-2 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary/60')}>
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
        </main>

        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." />
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
                    <img src={u.profilePhotoUrl} className="w-9 h-9 rounded-full object-cover" />
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
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void openConversation(c)}
                  className="w-full text-left p-3 rounded-2xl bg-secondary/40 hover:bg-secondary/60 transition flex items-center gap-3"
                >
                  <img src={c.otherPhotoUrl} className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-semibold">{c.otherUsername}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {c.lastMessage?.body ?? 'Tap to open'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-2">
            {requests.length === 0 ? (
              <div className="glass-card p-6 text-center text-muted-foreground">No pending requests.</div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="p-3 rounded-2xl bg-secondary/40 flex items-center gap-3">
                  <img src={r.fromPhotoUrl} className="w-10 h-10 rounded-full object-cover" />
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
