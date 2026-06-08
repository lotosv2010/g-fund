import { create } from "zustand";

interface AppState {
  chatDrawerOpen: boolean;
  openChatDrawer: () => void;
  closeChatDrawer: () => void;
  toggleChatDrawer: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  chatDrawerOpen: false,
  openChatDrawer: () => set({ chatDrawerOpen: true }),
  closeChatDrawer: () => set({ chatDrawerOpen: false }),
  toggleChatDrawer: () => set((s) => ({ chatDrawerOpen: !s.chatDrawerOpen })),
}));
