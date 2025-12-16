
import { create } from 'zustand';
import { User, ThemeMode } from '../types';

interface AppState {
  currentUser: User | null;
  ministryId: string;
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  
  setCurrentUser: (user: User | null) => void;
  setMinistryId: (id: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  ministryId: 'midia',
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,

  setCurrentUser: (user) => set((state) => {
      // Auto-update ministry ID if user changes
      const newMinistryId = user?.ministryId || state.ministryId;
      return { currentUser: user, ministryId: newMinistryId };
  }),
  setMinistryId: (id) => set({ ministryId: id }),
  setThemeMode: (mode) => {
      localStorage.setItem('themeMode', mode);
      set({ themeMode: mode });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
