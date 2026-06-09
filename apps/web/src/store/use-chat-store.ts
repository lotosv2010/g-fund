import { create } from "zustand";
import type { ChatMessage, ChatSessionSummary, PersistChatMessageDto } from "@g-fund/types";
import { startAnalysisStream, type HistoryTurn } from "@/lib/analysis-sse";
import { chatApi } from "@/lib/api-client";

interface ChatState {
  sessions: ChatSessionSummary[];
  activeSessionId: number | null;
  messages: ChatMessage[];
  inputValue: string;
  isStreaming: boolean;
  isLoadingSessions: boolean;
  reconnectInfo: { attempt: number; delayMs: number } | null;
  abortFn: (() => void) | null;

  setInputValue: (value: string) => void;
  loadSessions: () => Promise<void>;
  newSession: () => Promise<void>;
  selectSession: (id: number) => Promise<void>;
  renameSession: (id: number, title: string) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abort: () => void;
}

const HISTORY_LIMIT = 20;

function appendThinking(messages: ChatMessage[], content: string): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (last?.kind === "thinking") {
    const merged: ChatMessage = { ...last, content: `${last.content}\n${content}` };
    return [...messages.slice(0, -1), merged];
  }
  return [
    ...messages,
    {
      kind: "thinking",
      id: crypto.randomUUID(),
      content,
      timestamp: Date.now(),
    },
  ];
}

function buildHistory(messages: ChatMessage[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  for (const msg of messages) {
    if (msg.kind === "user") turns.push({ role: "user", content: msg.content });
    else if (msg.kind === "assistant") turns.push({ role: "assistant", content: msg.content });
  }
  return turns.slice(-HISTORY_LIMIT);
}

async function persistSafely(sessionId: number, dto: PersistChatMessageDto): Promise<void> {
  try {
    await chatApi.appendMessage(sessionId, dto);
  } catch (err) {
    console.warn("persist chat message failed:", err);
  }
}

async function ensureSession(get: () => ChatState, set: (s: Partial<ChatState>) => void): Promise<number> {
  const current = get().activeSessionId;
  if (current != null) return current;
  const session = await chatApi.create();
  set({
    sessions: [session, ...get().sessions],
    activeSessionId: session.id,
  });
  return session.id;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  inputValue: "",
  isStreaming: false,
  isLoadingSessions: false,
  reconnectInfo: null,
  abortFn: null,

  setInputValue: (value) => set({ inputValue: value }),

  loadSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const sessions = await chatApi.list();
      set({ sessions, isLoadingSessions: false });
    } catch (err) {
      console.warn("load sessions failed:", err);
      set({ isLoadingSessions: false });
    }
  },

  newSession: async () => {
    get().abort();
    const session = await chatApi.create();
    set({
      sessions: [session, ...get().sessions],
      activeSessionId: session.id,
      messages: [],
      inputValue: "",
      reconnectInfo: null,
    });
  },

  selectSession: async (id) => {
    if (get().activeSessionId === id) return;
    get().abort();
    set({ messages: [], activeSessionId: id, inputValue: "", reconnectInfo: null });
    try {
      const detail = await chatApi.detail(id);
      if (get().activeSessionId === id) set({ messages: detail.messages });
    } catch (err) {
      console.warn("load session detail failed:", err);
    }
  },

  renameSession: async (id, title) => {
    const session = await chatApi.rename(id, title);
    set({
      sessions: get().sessions.map((s) => (s.id === id ? session : s)),
    });
  },

  deleteSession: async (id) => {
    await chatApi.remove(id);
    const remaining = get().sessions.filter((s) => s.id !== id);
    const wasActive = get().activeSessionId === id;
    set({
      sessions: remaining,
      activeSessionId: wasActive ? null : get().activeSessionId,
      messages: wasActive ? [] : get().messages,
    });
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    let sessionId: number;
    try {
      sessionId = await ensureSession(get, set);
    } catch (err) {
      console.warn("ensure session failed:", err);
      return;
    }

    const history = buildHistory(get().messages);
    const userMsg: ChatMessage = {
      kind: "user",
      id: crypto.randomUUID(),
      content: trimmed,
      timestamp: Date.now(),
    };

    set({
      messages: [...get().messages, userMsg],
      inputValue: "",
      isStreaming: true,
      reconnectInfo: null,
    });

    void persistSafely(sessionId, { role: "user", kind: "user", content: trimmed }).then(async () => {
      const fresh = await chatApi.list().catch(() => null);
      if (fresh) set({ sessions: fresh });
    });

    let pendingThinkingId: string | null = null;

    const flushThinking = async () => {
      if (!pendingThinkingId) return;
      const target = get().messages.find((m) => m.id === pendingThinkingId);
      pendingThinkingId = null;
      if (target?.kind === "thinking" && target.content.trim()) {
        await persistSafely(sessionId, {
          role: "assistant",
          kind: "thinking",
          content: target.content,
        });
      }
    };

    const cleanup = startAnalysisStream(
      { query: trimmed, history },
      {
        onThinking: (text) => {
          const next = appendThinking(get().messages, text);
          const last = next[next.length - 1];
          if (last?.kind === "thinking") pendingThinkingId = last.id;
          set({ messages: next, reconnectInfo: null });
        },
        onToolCall: (tool, toolContent) => {
          void flushThinking();
          set({
            messages: [
              ...get().messages,
              {
                kind: "tool_call",
                id: crypto.randomUUID(),
                tool,
                content: toolContent,
                timestamp: Date.now(),
              },
            ],
            reconnectInfo: null,
          });
          void persistSafely(sessionId, {
            role: "assistant",
            kind: "tool_call",
            content: toolContent,
            tool,
          });
        },
        onToolResult: (tool, toolContent) => {
          set({
            messages: [
              ...get().messages,
              {
                kind: "tool_result",
                id: crypto.randomUUID(),
                tool,
                content: toolContent,
                timestamp: Date.now(),
              },
            ],
            reconnectInfo: null,
          });
          void persistSafely(sessionId, {
            role: "tool",
            kind: "tool_result",
            content: toolContent,
            tool,
          });
        },
        onResult: (resultContent, truncated) => {
          void flushThinking();
          set({
            messages: [
              ...get().messages,
              {
                kind: "assistant",
                id: crypto.randomUUID(),
                content: resultContent,
                timestamp: Date.now(),
                truncated,
              },
            ],
            isStreaming: false,
            abortFn: null,
            reconnectInfo: null,
          });
          void persistSafely(sessionId, {
            role: "assistant",
            kind: "assistant",
            content: resultContent,
            truncated,
          });
        },
        onError: (errMsg) => {
          void flushThinking();
          set({
            messages: [
              ...get().messages,
              {
                kind: "error",
                id: crypto.randomUUID(),
                content: errMsg,
                timestamp: Date.now(),
              },
            ],
            isStreaming: false,
            abortFn: null,
            reconnectInfo: null,
          });
          void persistSafely(sessionId, { role: "system", kind: "error", content: errMsg });
        },
        onReconnect: (attempt, delayMs) => {
          set({ reconnectInfo: { attempt, delayMs } });
        },
      },
    );

    set({ abortFn: cleanup });
  },

  abort: () => {
    const { abortFn } = get();
    if (abortFn) {
      abortFn();
      set({ isStreaming: false, abortFn: null, reconnectInfo: null });
    }
  },
}));
