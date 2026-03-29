import { supabase } from "@/integrations/supabase/client";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ConversationRow = {
  id: string;
  created_at: string;
  user1_id: string | null;
  user2_id: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string | null;
  sender_id: string | null;
  body: string;
  created_at: string;
  type: string;
  meta: Json | null;
};

export type ConversationSummary = {
  id: string;
  createdAt: string;
  otherUserId: string;
  username: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
};

function normalizePair(a: string, b: string) {
  return a < b ? { user1: a, user2: b } : { user1: b, user2: a };
}

async function requireMe() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Not authenticated");
  return user;
}

async function bestEffortEnsureConversationMembers(conversationId: string, meId: string, otherUserId: string) {
  try {
    await supabase.from("conversation_members").upsert(
      [
        { conversation_id: conversationId, user_id: meId },
        { conversation_id: conversationId, user_id: otherUserId },
      ],
      { onConflict: "conversation_id,user_id" }
    );
  } catch {
    // Non-fatal. Conversations can still work from conversations.user1_id/user2_id.
  }
}

export async function getOrCreateConversationWithUser(otherUserId: string): Promise<string> {
  const me = await requireMe();
  if (me.id === otherUserId) {
    throw new Error("Cannot start a conversation with yourself");
  }

  const { user1, user2 } = normalizePair(me.id, otherUserId);

  // Never use maybeSingle here because legacy duplicate rows may already exist.
  const { data: existingRows, error: findError } = await supabase
    .from("conversations")
    .select("id, created_at, user1_id, user2_id")
    .eq("user1_id", user1)
    .eq("user2_id", user2)
    .order("created_at", { ascending: true });

  if (findError) {
    throw findError;
  }

  const existingId = existingRows?.[0]?.id;
  if (existingId) {
    await bestEffortEnsureConversationMembers(existingId, me.id, otherUserId);
    return existingId;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("conversations")
    .insert({
      user1_id: user1,
      user2_id: user2,
    })
    .select("id")
    .single();

  if (insertError) {
    // Race condition fallback. Another client may have created it.
    const { data: retryRows, error: retryError } = await supabase
      .from("conversations")
      .select("id, created_at, user1_id, user2_id")
      .eq("user1_id", user1)
      .eq("user2_id", user2)
      .order("created_at", { ascending: true });

    if (retryError) {
      throw insertError;
    }

    const retryId = retryRows?.[0]?.id;
    if (retryId) {
      await bestEffortEnsureConversationMembers(retryId, me.id, otherUserId);
      return retryId;
    }

    throw insertError;
  }

  await bestEffortEnsureConversationMembers(inserted.id, me.id, otherUserId);
  return inserted.id;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const me = await requireMe();

  // Primary source: conversations table
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, created_at, user1_id, user2_id")
    .or(`user1_id.eq.${me.id},user2_id.eq.${me.id}`)
    .order("created_at", { ascending: false });

  if (conversationsError) {
    throw conversationsError;
  }

  const rows = (conversations ?? []) as ConversationRow[];

  const dedupedByOtherUser = new Map<string, ConversationRow>();
  for (const row of rows) {
    const otherUserId = row.user1_id === me.id ? row.user2_id : row.user1_id;
    if (!otherUserId) continue;

    const existing = dedupedByOtherUser.get(otherUserId);
    if (!existing) {
      dedupedByOtherUser.set(otherUserId, row);
      continue;
    }

    // Keep the earliest created row for stability if duplicates exist
    if (new Date(row.created_at).getTime() < new Date(existing.created_at).getTime()) {
      dedupedByOtherUser.set(otherUserId, row);
    }
  }

  const dedupedRows = Array.from(dedupedByOtherUser.values());
  const otherUserIds = dedupedRows
    .map((row) => (row.user1_id === me.id ? row.user2_id : row.user1_id))
    .filter((id): id is string => Boolean(id));

  let profilesById = new Map<string, { username: string | null; profile_photo_url: string | null }>();
  if (otherUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, profile_photo_url")
      .in("id", otherUserIds);

    profilesById = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          username: profile.username,
          profile_photo_url: profile.profile_photo_url,
        },
      ])
    );
  }

  const conversationIds = dedupedRows.map((row) => row.id);
  let latestMessagesByConversation = new Map<
    string,
    { body: string; created_at: string }
  >();

  if (conversationIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, conversation_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    for (const message of messages ?? []) {
      if (!message.conversation_id) continue;
      if (!latestMessagesByConversation.has(message.conversation_id)) {
        latestMessagesByConversation.set(message.conversation_id, {
          body: message.body,
          created_at: message.created_at,
        });
      }
    }
  }

  const summaries: ConversationSummary[] = dedupedRows.map((row) => {
    const otherUserId = row.user1_id === me.id ? row.user2_id : row.user1_id;
    if (!otherUserId) {
      throw new Error("Conversation missing other user");
    }

    const profile = profilesById.get(otherUserId);
    const latestMessage = latestMessagesByConversation.get(row.id);

    return {
      id: row.id,
      createdAt: row.created_at,
      otherUserId,
      username: profile?.username?.trim() || "Unknown user",
      avatarUrl: profile?.profile_photo_url ?? null,
      lastMessage: latestMessage?.body ?? "",
      lastMessageAt: latestMessage?.created_at ?? row.created_at,
    };
  });

  summaries.sort((a, b) => {
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  return summaries;
}

export async function getConversationMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, type, meta")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(
  conversationId: string,
  body: string,
  type: string = "text",
  meta: Json | null = null
): Promise<MessageRow> {
  const me = await requireMe();
  const trimmed = body.trim();

  if (!trimmed && type === "text") {
    throw new Error("Message cannot be empty");
  }

  const payload = {
    conversation_id: conversationId,
    sender_id: me.id,
    body: trimmed,
    type,
    meta,
  };

  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id, conversation_id, sender_id, body, created_at, type, meta")
    .single();

  if (error) throw error;
  return data as MessageRow;
}
