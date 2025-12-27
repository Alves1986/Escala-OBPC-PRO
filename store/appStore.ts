
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

// Recupera a última escolha salva localmente ou deixa vazio para ser preenchido pelo Auth
const storedMinistryId = typeof window !== 'undefined' ? localStorage.getItem('last_ministry_id') : null;

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  ministryId: storedMinistryId || '', // Inicia vazio ou com cache local, nunca hardcoded 'midia'
  organizationId: null,
  availableMinistries: [],
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'system',
  sidebarOpen: false,

  setCurrentUser: (user) => set((state) => {
      // Prioridade: User Profile (DB) > State Atual (Runtime) > LocalStorage
      // A lógica principal de escolha acontece no useAuth, aqui apenas sincronizamos se vier do user
      const newMinistryId = user?.lastMinistryId || user?.ministryId || state.ministryId;
      const newOrgId = user?.organizationId || state.organizationId;
      return { currentUser: user, ministryId: newMinistryId, organizationId: newOrgId };
  }),
  setMinistryId: (id) => {
      if (typeof window !== 'undefined') localStorage.setItem('last_ministry_id', id);
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
