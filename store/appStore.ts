
import { create } from 'zustand';
import { User, ThemeMode, MinistryDef } from '../types';

interface AppState {
  currentUser: User | null;
  ministryId: string;
  organizationId: string | null;
  availableMinistries: MinistryDef[]; // Lista carregada do banco
  themeMode: ThemeMode;
  sidebarOpen: boolean;
  
  setCurrentUser: (user: User | null) => void;
  setMinistryId: (id: string) => void;
  setOrganizationId: (id: string | null) => void;
  setAvailableMinistries: (ministries: MinistryDef[]) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

// 1. Tenta recuperar do storage IMEDIATAMENTE para evitar flicker
const storedMinistryId = typeof window !== 'undefined' ? localStorage.getItem('ministry_id') : null;

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  // 2. Inicializa com valor do storage ou vazio (evita fallback prematuro para 'midia')
  ministryId: storedMinistryId || '', 
  organizationId: null,
  availableMinistries: [],
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,

  setCurrentUser: (user) => set((state) => {
      // Mantém o ID atual se já estiver carregado corretamente
      const currentId = state.ministryId || user?.ministryId;
      return { 
          currentUser: user, 
          ministryId: currentId, // Prioriza o estado atual da sessão
          organizationId: user?.organizationId || state.organizationId 
      };
  }),
  setMinistryId: (id) => {
      // 3. Persiste a escolha sempre que for alterada
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
}));
