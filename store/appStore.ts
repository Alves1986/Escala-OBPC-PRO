import { create } from 'zustand';
import { User, ThemeMode, MinistryDef } from '../types';

interface AppState {
  currentUser: User | null;
  ministryId: string;
  organizationId: string | null;
  availableMinistries: MinistryDef[]; 
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  isAppReady: boolean;
  
  setCurrentUser: (user: User | null) => void;
  setMinistryId: (id: string) => void;
  setOrganizationId: (id: string | null) => void;
  setAvailableMinistries: (ministries: MinistryDef[]) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAppReady: (ready: boolean) => void;
}

const storedMinistryId = typeof window !== 'undefined' ? localStorage.getItem('ministry_id') : null;

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  ministryId: storedMinistryId || '', 
  organizationId: null,
  availableMinistries: [],
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,
  isAppReady: false,

  setCurrentUser: (user) => set((state) => {
      // Se deslogar, limpa tudo
      if (!user) {
          return { currentUser: null, organizationId: null, isAppReady: false };
      }

      // CORREÇÃO: Removemos o bloqueio de organizationId.
      // Aceitamos o usuário como ele vier para permitir o Bootstrap/Onboarding.
      
      const currentId = state.ministryId || user.ministryId;
      return { 
          currentUser: user, 
          ministryId: currentId,
          organizationId: user.organizationId || state.organizationId // Mantém o que tiver ou usa o do estado
      };
  }),
  setMinistryId: (id) => {
      if (typeof window !== 'undefined') localStorage.setItem('ministry_id', id);
      set({ ministryId: id });
  },
  setOrganizationId: (id) => set({ organizationId: id }),
  setAvailableMinistries: (ministries) => set({ availableMinistries: ministries }),
  setThemeMode: (mode) => {
      localStorage.setItem('themeMode', mode);
      set({ themeMode: mode });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setAppReady: (ready) => set({ isAppReady: ready }),
}));