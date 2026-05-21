// 30-day localStorage persistence for Medhā chats.

export type StoredMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: string;
  ts: number;
};
export type StoredChat = {
  id: string;
  title: string;
  messages: StoredMsg[];
  lastInteractionAt: number;
  createdAt: number;
  topic?: string; // short topic summary for next-chat context
};

const KEY = 'vyan.medha.chats';
const CURRENT_KEY = 'vyan.medha.currentChatId';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function safeRead(): StoredChat[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list: StoredChat[] = JSON.parse(raw);
    const now = Date.now();
    const pruned = list.filter(c => now - c.lastInteractionAt < MAX_AGE_MS);
    if (pruned.length !== list.length) localStorage.setItem(KEY, JSON.stringify(pruned));
    return pruned;
  } catch { return []; }
}

function safeWrite(list: StoredChat[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function listChats(): StoredChat[] {
  return safeRead().sort((a, b) => b.lastInteractionAt - a.lastInteractionAt);
}

export function getChat(id: string): StoredChat | null {
  return safeRead().find(c => c.id === id) ?? null;
}

export function upsertChat(chat: StoredChat) {
  const list = safeRead();
  const idx = list.findIndex(c => c.id === chat.id);
  if (idx >= 0) list[idx] = chat; else list.unshift(chat);
  safeWrite(list);
}

export function deleteChat(id: string) {
  safeWrite(safeRead().filter(c => c.id !== id));
}

export function setCurrentChatId(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {}
}
export function getCurrentChatId(): string | null {
  try { return localStorage.getItem(CURRENT_KEY); } catch { return null; }
}

export function newChatId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
