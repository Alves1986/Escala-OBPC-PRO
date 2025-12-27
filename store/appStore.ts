
import { create } from 'zustand';
import { User, ThemeMode } from '../types';

interface AppState {
  currentUser: User | null;
  ministryId: string;
  organizationId: string | null; // New
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  
  setCurrentUser: (user: User | null) => void;
  setMinistryId: (id: string) => void;
  setOrganizationId: (id: string | null) => void; // New
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  ministryId: 'midia',
  organizationId: null,
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,

  setCurrentUser: (user) => set((state) => {
      // Auto-update context if user changes
      const newMinistryId = user?.ministryId || state.ministryId;
      const newOrgId = user?.organizationId || state.organizationId;
      return { currentUser: user, ministryId: newMinistryId, organizationId: newOrgId };
  }),
  setMinistryId: (id) => set({ ministryId: id }),
  setOrganizationId: (id) => set({ organizationId: id }),
  setThemeMode: (mode) => {
      localStorage.setItem('themeMode', mode);
      set({ themeMode: mode });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
