import { create } from "zustand";
import type { ChatMessage } from "@g-fund/types";
import { startAnalysisStream } from "@/lib/analysis-sse";

interface ChatState {
  messages: ChatMessage[];
  inputValue: string;
  isStreaming: boolean;
  abortFn: (() => void) | null;
  setInputValue: (value: string) => void;
  sendMessage: (content: string) => void;
  abort: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputValue: "",
  isStreaming: false,
  abortFn: null,

  setInputValue: (value) => set({ inputValue: value }),

  sendMessage: (content) => {
    if (!content.trim() || get().isStreaming) return;

    const ts = Date.now();
    const id = crypto.randomUUID();

    set((s) => ({
      messages: [
        ...s.messages,
        { kind: "user", id, content: content.trim(), timestamp: ts },
      ],
      inputValue: "",
      isStreaming: true,
    }));

    const cleanup = startAnalysisStream(content.trim(), {
      onToolCall: (tool, toolContent) => {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              kind: "tool_call",
              id: crypto.randomUUID(),
              tool,
              content: toolContent,
              timestamp: Date.now(),
            },
          ],
        }));
      },
      onToolResult: (tool, toolContent) => {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              kind: "tool_result",
              id: crypto.randomUUID(),
              tool,
              content: toolContent,
              timestamp: Date.now(),
            },
          ],
        }));
      },
      onResult: (resultContent) => {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              kind: "assistant",
              id: crypto.randomUUID(),
              content: resultContent,
              timestamp: Date.now(),
            },
          ],
          isStreaming: false,
          abortFn: null,
        }));
      },
      onError: (errMsg) => {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              kind: "error",
              id: crypto.randomUUID(),
              content: errMsg,
              timestamp: Date.now(),
            },
          ],
          isStreaming: false,
          abortFn: null,
        }));
      },
    });

    set({ abortFn: cleanup });
  },

  abort: () => {
    const { abortFn } = get();
    if (abortFn) {
      abortFn();
      set({ isStreaming: false, abortFn: null });
    }
  },

  clearMessages: () => {
    get().abort();
    set({ messages: [], inputValue: "" });
  },
}));
