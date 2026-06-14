import { create } from "zustand";

interface ChatContext {
  type: 'fund' | 'position' | 'general';
  fundCode?: string;
  fundName?: string;
  message?: string;
}

interface AppState {
  chatDrawerOpen: boolean;
  chatContext: ChatContext | null;
  openChatDrawer: (context?: ChatContext) => void;
  closeChatDrawer: () => void;
  toggleChatDrawer: () => void;
  setChatContext: (context: ChatContext | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  chatDrawerOpen: false,
  chatContext: null,
  openChatDrawer: (context) => set({ chatDrawerOpen: true, chatContext: context ?? null }),
  closeChatDrawer: () => set({ chatDrawerOpen: false, chatContext: null }),
  toggleChatDrawer: () => set((s) => ({
    chatDrawerOpen: !s.chatDrawerOpen,
    chatContext: s.chatDrawerOpen ? null : s.chatContext,
  })),
  setChatContext: (context) => set({ chatContext: context }),
}));
