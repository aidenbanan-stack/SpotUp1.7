const keyFor = (conversationId: string) => `spotup_conv_last_read_${conversationId}`;

export function getConversationLastRead(conversationId: string): number {
  try {
    const raw = localStorage.getItem(keyFor(conversationId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setConversationLastRead(conversationId: string, ts: number = Date.now()): void {
  try {
    localStorage.setItem(keyFor(conversationId), String(ts));
  } catch {
    // ignore
  }
}

export function isConversationUnread(args: {
  conversationId: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  meId?: string;
}): boolean {
  const { conversationId, lastMessageAt, lastMessageSenderId, meId } = args;
  if (!lastMessageAt) return false;
  if (!meId) return false;
  if (!lastMessageSenderId) return false;
  if (lastMessageSenderId === meId) return false;
  const lastRead = getConversationLastRead(conversationId);
  return lastMessageAt.getTime() > lastRead;
}
