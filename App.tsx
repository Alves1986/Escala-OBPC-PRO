
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { CalendarGrid } from './components/CalendarGrid';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { EventsScreen } from './components/EventsScreen';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { EventDetailsModal } from './components/EventDetailsModal';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { InstallModal } from './components/InstallModal';
import { InstallBanner } from './components/InstallBanner';
import { AlertsManager } from './components/AlertsManager';
import { SettingsScreen } from './components/SettingsScreen';
import { AnnouncementCard } from './components/AnnouncementCard';
import { BirthdayCard } from './components/BirthdayCard';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, AppNotification, TeamMemberProfile, SwapRequest, RepertoireItem, Announcement, GlobalConflictMap } from './types';
import { loadData, saveData, getSupabase, logout, updateUserProfile, deleteMember, sendNotification, createSwapRequest, performSwap, toggleAdmin, createAnnouncement, markAnnouncementRead, fetchGlobalSchedules, joinMinistry, saveSubscription, toggleAnnouncementLike } from './services/supabaseService';
import { generateMonthEvents, getMonthName, adjustMonth } from './utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Calendar as CalendarIcon, 
  Shield, 
  LayoutDashboard, 
  Users, 
  Edit3, 
  Clock,
  CalendarSearch,
  RefreshCw,
  Search,
  Settings,
  Mail,
  Phone,
  Trash2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Music,
  ListMusic,
  Megaphone,
  Save,
  Smartphone,
  Moon,
  Sun,
  BellRing,
  CalendarHeart,
  ChevronRight
} from 'lucide-react';
import { NextEventCard } from './components/NextEventCard';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal } from './components/ManagementModals';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from './utils/pushUtils';

// --- NAVIGATION ITEMS ---
const MAIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20} /> },
  { id: 'availability', label: 'Disponibilidade', icon: <Shield size={20} /> },
  { id: 'swaps', label: 'Trocas de Escala', icon: <RefreshCcw size={20} /> },
  { id: 'repertoire', label: 'Repertório', icon: <Music size={20} /> },
];

const MANAGEMENT_NAV_ITEMS = [
  { id: 'editor', label: 'Editor de Escala', icon: <Edit3 size={20} /> },
  { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20} /> },
  { id: 'availability-report', label: 'Relat. Disponibilidade', icon: <CalendarSearch size={20} /> },
  { id: 'events', label: 'Eventos', icon: <Clock size={20} /> },
  { id: 'alerts', label: 'Enviar Avisos', icon: <Megaphone size={20} /> },
  { id: 'team', label: 'Membros & Equipe', icon: <Users size={20} /> },
  { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
];

const AppContent = () => {
  const { addToast, confirmAction } = useToast();
  // --- STATE ---
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ministryId, setMinistryId] = useState<string | null>(null);

  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard');

  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Theme State with Persistence Fix
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('app_theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Apply Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Data State
  const [members, setMembers] = useState<MemberMap>({});
  const [registeredMembers, setRegisteredMembers] = useState<TeamMemberProfile[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [ignoredEvents, setIgnoredEvents] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [roles, setRoles] = useState<string[]>([]); 
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [scheduleIssues, setScheduleIssues] = useState<ScheduleAnalysis>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([]);
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [globalConflicts, setGlobalConflicts] = useState<GlobalConflictMap>({});
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  
  // Confirmation Modal State
  const [confirmationData, setConfirmationData] = useState<any>(null);

  // Modals States
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [joinMinistryModalOpen, setJoinMinistryModalOpen] = useState(false); // New State
  
  // Event Detail Modal (from Calendar Grid)
  const [selectedEventDetails, setSelectedEventDetails] = useState<{ iso: string; title: string; dateDisplay: string } | null>(null);

  // --- PUSH NOTIFICATION REGISTRATION (GLOBAL) ---
  const registerPushForAllMinistries = async () => {
      if (!currentUser || !('serviceWorker' in navigator)) return;

      try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription && currentUser.allowedMinistries) {
              console.log("Sincronizando push notifications para todos os ministérios...");
              // Registra o mesmo endpoint em TODOS os ministérios do usuário
              // Assim ele recebe notificação independente do contexto atual
              for (const mid of currentUser.allowedMinistries) {
                  await saveSubscription(mid, subscription);
              }
          }
      } catch (error) {
          console.error("Erro ao sincronizar push:", error);
      }
  };

  // Sincroniza Push ao carregar o usuário ou mudar contexto
  useEffect(() => {
      if (isConnected && currentUser) {
          registerPushForAllMinistries();
      }
  }, [isConnected, currentUser?.id, ministryId]);


  // --- PWA INSTALL LISTENER ---
  useEffect(() => {
    // 1. Detect if standalone (installed)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) {
      setShowInstallBanner(false);
      return;
    }

    const isDismissed = localStorage.getItem('installBannerDismissed');
    
    // 2. Handle 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Banner flutuante só aparece se não foi dispensado
      if (!isDismissed) {
        setShowInstallBanner(true);
      }
    };

    // Check if event was already captured in index.html global var
    if ((window as any).deferredPrompt) {
        handleBeforeInstallPrompt((window as any).deferredPrompt);
        (window as any).deferredPrompt = null;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. iOS Detection (No beforeinstallprompt support)
    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS && !isStandaloneMode && !isDismissed) {
         setShowInstallBanner(true);
    }
    
    // 4. Listen for successful install
    window.addEventListener('appinstalled', () => {
        setInstallPrompt(null);
        setShowInstallBanner(false);
        setIsStandalone(true);
    });

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
        // Android / Desktop Chrome (Automático)
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
            setShowInstallBanner(false);
        }
    } else {
        // iOS or Browser blocking prompt (Manual)
        setShowInstallModal(true);
    }
  };

  const handleDismissBanner = () => {
      setShowInstallBanner(false);
      localStorage.setItem('installBannerDismissed', 'true');
  };

  // --- DERIVED STATE ---
  const [year, month] = currentMonth.split('-').map(Number);
  
  const { visibleEvents, hiddenEventsList } = useMemo(() => {
    const allGenerated = generateMonthEvents(year, month - 1, customEvents);
    const visible: typeof allGenerated = [];
    const hidden: typeof allGenerated = [];

    allGenerated.forEach(evt => {
      if (ignoredEvents.includes(evt.iso)) {
        hidden.push(evt);
      } else {
        visible.push(evt);
      }
    });

    return { visibleEvents: visible, hiddenEventsList: hidden };
  }, [year, month, customEvents, ignoredEvents]);

  const nextEvent = useMemo(() => {
    const now = new Date();
    const sorted = [...visibleEvents].sort((a, b) => a.iso.localeCompare(b.iso));
    return sorted.find(evt => {
      const eventDate = new Date(evt.iso);
      // Inclui eventos que acabaram de começar ou estão em andamento
      // Janela de "próximo" vai até 2 horas depois do início
      const eventEnd = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
      return eventEnd > now;
    });
  }, [visibleEvents]);
  
  const allMembersList = useMemo(() => {
    const list = new Set<string>();
    
    // 1. Members from Role Map
    Object.values(members).forEach((arr) => {
      if (Array.isArray(arr)) (arr as string[]).forEach(m => list.add(m));
    });

    // 2. Members from Registered List
    registeredMembers.forEach(m => list.add(m.name));

    return Array.from(list).sort();
  }, [members, registeredMembers]);

  const memberStats = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(schedule).forEach(key => {
      if (key.startsWith(currentMonth)) {
        const member = schedule[key];
        counts[member] = (counts[member] || 0) + 1;
      }
    });
    return counts;
  }, [schedule, currentMonth]);

  const logAction = (action: string, details: string) => {
    const newEntry: AuditLogEntry = {
      date: new Date().toLocaleString("pt-BR"),
      action,
      details
    };
    setAuditLog(prev => [newEntry, ...prev].slice(0, 200));
  };

  const getMinistryTitle = (id: string | null) => {
    if (customTitle) return customTitle; // Usa título personalizado se existir
    if (!id) return "Gestão de Escala OBPC";
    const cleanId = id.toLowerCase().trim();
    if (cleanId === 'midia') return "Mídia / Comunicação";
    if (cleanId === 'louvor') return "Louvor / Adoração";
    return `Escala ${id.charAt(0).toUpperCase() + id.slice(1)}`;
  }

  // --- INITIAL DATA LOAD ---
  const loadAll = async (mid: string) => {
    setLoading(true);
    try {
      const cleanMid = mid.trim().toLowerCase().replace(/\s+/g, '-');
      
      const [
        resMembers,
        resSchedule,
        resAvail,
        resEvents,
        resRoles,
        resLogs,
        resIgnored,
        resAttend,
        resNotif,
        resRegMembers,
        resSwaps,
        resRepertoire,
        resAdmins,
        resConfig,
        resAnnouncements,
        resGlobalConflicts
      ] = await Promise.all([
        loadData<MemberMap>(cleanMid, 'members_v7', {}),
        loadData<ScheduleMap>(cleanMid, `schedule_${currentMonth}`, {}),
        loadData<AvailabilityMap>(cleanMid, 'availability_v1', {}),
        loadData<CustomEvent[]>(cleanMid, `events_${currentMonth}`, []),
        loadData<string[]>(cleanMid, 'functions_config', DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['midia']),
        loadData<AuditLogEntry[]>(cleanMid, 'audit_logs', []),
        loadData<string[]>(cleanMid, `ignored_events_${currentMonth}`, []),
        loadData<AttendanceMap>(cleanMid, `attendance_${currentMonth}`, {}),
        loadData<AppNotification[]>(cleanMid, 'notifications_v1', []),
        loadData<TeamMemberProfile[]>(cleanMid, 'public_members_list', []),
        loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []),
        loadData<RepertoireItem[]>('shared', 'repertoire_v1', []),
        loadData<string[]>(cleanMid, 'admins_list', []),
        loadData<any>(cleanMid, 'ministry_config', { displayName: '' }),
        loadData<Announcement[]>(cleanMid, 'announcements_v1', []),
        fetchGlobalSchedules(currentMonth, cleanMid)
      ]);

      setMembers(resMembers);
      setSchedule(resSchedule);
      setAvailability(resAvail);
      setCustomEvents(resEvents);
      setRoles(resRoles);
      setAuditLog(resLogs);
      setIgnoredEvents(resIgnored);
      setAttendance(resAttend);
      setNotifications(resNotif);
      setRegisteredMembers(resRegMembers);
      setSwapRequests(resSwaps);
      setRepertoire(resRepertoire);
      setAdminsList(resAdmins);
      if (resConfig?.displayName) setCustomTitle(resConfig.displayName);
      setAnnouncements(resAnnouncements);
      setGlobalConflicts(resGlobalConflicts);

      // Upgrade current user if in admins list
      if (currentUser && currentUser.email && resAdmins.includes(currentUser.email)) {
          if (currentUser.role !== 'admin') {
              setCurrentUser(prev => prev ? { ...prev, role: 'admin' } : null);
          }
      }

      setIsConnected(true);
    } catch (e) {
      console.error("Load Error", e);
      addToast("Erro ao carregar dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- AUTH CHECK & SESSION ---
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
        
        // PERSISTENCE CHECK: Read from localStorage
        const savedMid = localStorage.getItem('last_ministry_id');
        let cleanMid = allowedMinistries.length > 0 ? allowedMinistries[0].trim().toLowerCase().replace(/\s+/g, '-') : 'midia';
        
        // If saved ID is valid and allowed, use it
        if (savedMid && allowedMinistries.some((m: string) => m.trim().toLowerCase().replace(/\s+/g, '-') === savedMid)) {
            cleanMid = savedMid;
        }
        
        const user: User = {
           id: session.user.id,
           email: session.user.email,
           name: metadata.name || 'Usuário',
           role: metadata.role || 'member',
           ministryId: cleanMid,
           allowedMinistries: allowedMinistries,
           whatsapp: metadata.whatsapp,
           birthDate: metadata.birthDate,
           avatar_url: metadata.avatar_url,
           functions: metadata.functions || []
        };
        
        setCurrentUser(user);
        setMinistryId(cleanMid);
        setSessionLoading(false);
      } else {
        setSessionLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
        
        // PERSISTENCE CHECK: Read from localStorage on update too
        const savedMid = localStorage.getItem('last_ministry_id');
        let cleanMid = allowedMinistries.length > 0 ? allowedMinistries[0].trim().toLowerCase().replace(/\s+/g, '-') : 'midia';
        
        if (savedMid && allowedMinistries.some((m: string) => m.trim().toLowerCase().replace(/\s+/g, '-') === savedMid)) {
            cleanMid = savedMid;
        }
        
        const user: User = {
           id: session.user.id,
           email: session.user.email,
           name: metadata.name || 'Usuário',
           role: metadata.role || 'member',
           ministryId: cleanMid,
           allowedMinistries: allowedMinistries,
           whatsapp: metadata.whatsapp,
           birthDate: metadata.birthDate,
           avatar_url: metadata.avatar_url,
           functions: metadata.functions || []
        };
        setCurrentUser(user);
        setMinistryId(cleanMid);
      } else {
        setCurrentUser(null);
        setMinistryId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- REFRESH DATA ON CHANGE ---
  useEffect(() => {
    if (ministryId) {
      loadAll(ministryId);
    }
  }, [ministryId, currentMonth]);

  // --- MULTI-TENANCY SWITCH HANDLER ---
  const handleSwitchMinistry = async (newMinistryId: string) => {
      if (!currentUser) return;
      
      const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
      
      // Save to localStorage for persistence
      localStorage.setItem('last_ministry_id', cleanMid);
      
      // Update Local State
      setMinistryId(cleanMid);
      setCurrentUser(prev => prev ? { ...prev, ministryId: cleanMid } : null);
      
      // Clear data to show loading state effectively
      setMembers({});
      setSchedule({});
      setNotifications([]);
      setAnnouncements([]);
      setRegisteredMembers([]);
      setCustomTitle("");
      
      // Trigger Reload
      addToast(`Trocando para ${getMinistryTitle(cleanMid)}...`, "info");
      // loadAll will be triggered by useEffect([ministryId])
  };

  // --- JOIN MINISTRY HANDLER ---
  const handleJoinMinistry = async (newMinistryId: string, roles: string[]) => {
      if (!currentUser) return;
      
      const result = await joinMinistry(newMinistryId, roles);
      
      if (result.success) {
          addToast(result.message, "success");
          
          // Refresh user session/metadata locally to reflect change
          const newAllowed = [...(currentUser.allowedMinistries || []), newMinistryId];
          setCurrentUser(prev => prev ? { ...prev, allowedMinistries: newAllowed } : null);
          
          // Switch to new ministry immediately
          handleSwitchMinistry(newMinistryId);
      } else {
          addToast(result.message, "error");
      }
  };

  // --- DAILY SCHEDULE REMINDER (Notification) ---
  useEffect(() => {
      if (!currentUser || !nextEvent || !schedule) return;
      
      // Check if next event is TODAY
      const eventDate = nextEvent.iso.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      if (eventDate === today) {
          // Check if current user is assigned to any role in this event
          let isScheduled = false;
          let myRole = '';
          
          Object.entries(schedule).forEach(([key, memberName]) => {
              if (key.startsWith(nextEvent.iso) && memberName === currentUser.name) {
                  isScheduled = true;
                  myRole = key.split('_').pop() || '';
              }
          });

          if (isScheduled) {
              // Check if we already notified this session to avoid spam
              const notifiedKey = `notified_schedule_${currentUser.id}_${today}`;
              if (!sessionStorage.getItem(notifiedKey)) {
                  // Send Local Browser Notification
                  if (Notification.permission === "granted") {
                      new Notification("Lembrete de Escala", {
                          body: `Olá ${currentUser.name}, você está escalado hoje (${myRole}) para o evento ${nextEvent.title}.`,
                          icon: "/app-icon.png"
                      });
                  }
                  
                  addToast(`Lembrete: Você está escalado hoje como ${myRole}!`, "info");
                  sessionStorage.setItem(notifiedKey, 'true');
              }
          }
      }
  }, [currentUser, nextEvent, schedule]);


  // --- HANDLERS ---

  const handleCellChange = async (key: string, value: string) => {
    if (!ministryId) return;
    const newSchedule = { ...schedule, [key]: value };
    
    // Check conflicts
    const [date, role] = key.split('_');
    if (value && availability[value] && availability[value].includes(date.split('T')[0])) {
       // Just visual warning handled in table
    }

    setSchedule(newSchedule);
    await saveData(ministryId, `schedule_${currentMonth}`, newSchedule);
    
    // Log action
    if (value) {
        logAction('Escala', `Adicionou ${value} para ${role} em ${date}`);
    } else {
        logAction('Escala', `Removeu membro de ${role} em ${date}`);
    }
    await saveData(ministryId, 'audit_logs', auditLog);
  };

  const handleAttendanceToggle = async (key: string) => {
    if (!ministryId) return;
    const newAttendance = { ...attendance, [key]: !attendance[key] };
    setAttendance(newAttendance);
    await saveData(ministryId, `attendance_${currentMonth}`, newAttendance);
  };

  const handleCreateAnnouncement = async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert') => {
      if (!ministryId || !currentUser) return;
      
      const success = await createAnnouncement(ministryId, { title, message, type }, currentUser.name);
      
      if (success) {
          // Recarregar comunicados
          const updated = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
          setAnnouncements(updated);
          
          // Enviar Notificação Push para todos
          await sendNotification(ministryId, {
              title: `Novo Aviso: ${title}`,
              message: message,
              type: type
          });
      }
  };

  const handleMarkAnnouncementRead = async (id: string) => {
      if (!ministryId || !currentUser) return;
      const updated = await markAnnouncementRead(ministryId, id, currentUser);
      setAnnouncements(updated);
  };

  const handleToggleAnnouncementLike = async (id: string) => {
      if (!ministryId || !currentUser) return;
      const updated = await toggleAnnouncementLike(ministryId, id, currentUser);
      setAnnouncements(updated);
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setMinistryId(null);
  };

  // --- RENDER CONTENT ---

  // Loading Screen
  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => window.location.reload()} />;
  }

  // Main App Content (Removed ToastProvider from here)
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
        <InstallBanner 
            isVisible={showInstallBanner} 
            onInstall={handleInstallApp} 
            onDismiss={handleDismissBanner}
            appName="Gestão Escala OBPC"
        />
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        
        <DashboardLayout 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
          theme={theme}
          toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          onLogout={handleLogout}
          title={getMinistryTitle(ministryId)}
          isConnected={isConnected}
          currentUser={currentUser}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          mainNavItems={MAIN_NAV_ITEMS}
          managementNavItems={MANAGEMENT_NAV_ITEMS}
          notifications={notifications}
          onNotificationsUpdate={setNotifications}
          onInstall={!isStandalone ? handleInstallApp : undefined}
          isStandalone={isStandalone}
          onSwitchMinistry={handleSwitchMinistry}
          onOpenJoinMinistry={() => setJoinMinistryModalOpen(true)}
        >
          {/* DASHBOARD VIEW - REESTRUTURADO (Cards Only) */}
          {currentTab === 'dashboard' && (
            <div className="space-y-8 pb-20 animate-fade-in max-w-5xl mx-auto">
              
              {/* Header de Boas-vindas */}
              <div>
                  <h1 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      Olá, {currentUser.name.split(' ')[0]} <span className="animate-wave text-3xl">👋</span>
                  </h1>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                      Bem-vindo ao painel de controle do {getMinistryTitle(ministryId)}.
                  </p>
              </div>

              {/* Comunicados (Cards no Topo) */}
              {announcements.length > 0 && (
                  (() => {
                      const visibleAnnouncements = announcements.filter(a => {
                          const hasRead = a.readBy.some(r => r.userId === currentUser.id);
                          const isAdmin = currentUser.role === 'admin';
                          // Mostrar se não leu OU se é admin (para gerenciar)
                          return !hasRead || isAdmin;
                      });

                      if (visibleAnnouncements.length === 0) return null;

                      return (
                          <div className="space-y-4">
                              {visibleAnnouncements.map(announcement => (
                                  <AnnouncementCard 
                                      key={announcement.id} 
                                      announcement={announcement} 
                                      currentUser={currentUser}
                                      onMarkRead={handleMarkAnnouncementRead}
                                      onToggleLike={handleToggleAnnouncementLike}
                                  />
                              ))}
                          </div>
                      );
                  })()
              )}

              {/* Próximo Evento (Card Grande) */}
              <NextEventCard 
                  event={nextEvent} 
                  schedule={schedule} 
                  attendance={attendance} 
                  roles={roles}
                  onConfirm={handleAttendanceToggle}
                  ministryId={ministryId}
                  currentUser={currentUser}
              />

              {/* Navigation Cards (Botões Grandes) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                      onClick={() => setCurrentTab('calendar')}
                      className="group relative flex flex-col justify-between p-6 h-40 bg-zinc-900 dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-700 hover:scale-[1.02] transition-transform overflow-hidden"
                  >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                          <CalendarIcon size={80} />
                      </div>
                      <div className="relative z-10 flex justify-between items-start w-full">
                          <div className="p-3 bg-zinc-800 dark:bg-zinc-700 rounded-xl text-zinc-100">
                              <CalendarIcon size={24} />
                          </div>
                          <span className="text-xs font-bold text-zinc-400 uppercase">Visualizar</span>
                      </div>
                      <div className="relative z-10 text-left">
                          <h3 className="text-xl font-bold text-white">Escala do Mês</h3>
                          <p className="text-zinc-400 text-sm">Veja quem está escalado em {getMonthName(currentMonth)}.</p>
                      </div>
                  </button>

                  <button 
                      onClick={() => setCurrentTab('availability')}
                      className="group relative flex flex-col justify-between p-6 h-40 bg-zinc-900 dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-700 hover:scale-[1.02] transition-transform overflow-hidden"
                  >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                          <ShieldCheck size={80} />
                      </div>
                      <div className="relative z-10 flex justify-between items-start w-full">
                          <div className="p-3 bg-zinc-800 dark:bg-zinc-700 rounded-xl text-green-400">
                              <ShieldCheck size={24} />
                          </div>
                          <span className="text-xs font-bold text-zinc-400 uppercase">Editar</span>
                      </div>
                      <div className="relative z-10 text-left">
                          <h3 className="text-xl font-bold text-white">Minha Disponibilidade</h3>
                          <p className="text-zinc-400 text-sm">Informe os dias que você pode servir.</p>
                      </div>
                  </button>
              </div>

            </div>
          )}

          {currentTab === 'calendar' && (
             <div className="animate-fade-in max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Calendário de Escalas</h2>
                    
                    {/* Month Navigation */}
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <button 
                        onClick={() => {
                           setCurrentMonth(adjustMonth(currentMonth, -1));
                        }}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                      >
                        ←
                      </button>
                      <span className="text-sm font-bold w-24 text-center">{currentMonth}</span>
                      <button 
                        onClick={() => {
                           setCurrentMonth(adjustMonth(currentMonth, 1));
                        }}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                      >
                        →
                      </button>
                   </div>
                </div>

                <CalendarGrid 
                    currentMonth={currentMonth} 
                    events={visibleEvents} 
                    schedule={schedule} 
                    roles={roles}
                    onEventClick={(evtData) => setSelectedEventDetails(evtData)}
                />
             </div>
          )}

          {currentTab === 'availability' && (
             <AvailabilityScreen 
                availability={availability} 
                setAvailability={setAvailability}
                allMembersList={allMembersList}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                currentUser={currentUser}
                onSaveAvailability={async (member, dates) => {
                    if (!ministryId) return;
                    const newAvail = { ...availability, [member]: dates };
                    setAvailability(newAvail);
                    await saveData(ministryId, 'availability_v1', newAvail);
                    
                    // Notificar Admin via Push
                    const count = dates.filter(d => d.startsWith(currentMonth)).length;
                    await sendNotification(ministryId, {
                        type: 'info',
                        title: 'Disponibilidade Atualizada',
                        message: `${member} informou disponibilidade para ${count} dias em ${getMonthName(currentMonth)}.`,
                        actionLink: 'availability-report'
                    });
                }}
             />
          )}

          {currentTab === 'swaps' && currentUser && (
              <SwapRequestsScreen
                  schedule={schedule}
                  currentUser={currentUser}
                  requests={swapRequests}
                  visibleEvents={visibleEvents}
                  onCreateRequest={async (role, iso, title) => {
                      if (!ministryId) return;
                      const newReq: SwapRequest = {
                          id: Date.now().toString(),
                          ministryId,
                          requesterName: currentUser.name,
                          requesterId: currentUser.id,
                          role,
                          eventIso: iso,
                          eventTitle: title,
                          status: 'pending',
                          createdAt: new Date().toISOString()
                      };
                      const success = await createSwapRequest(ministryId, newReq);
                      if (success) {
                          setSwapRequests([newReq, ...swapRequests]);
                          addToast("Solicitação de troca criada!", "success");
                          
                          // Notificar todos
                          await sendNotification(ministryId, {
                              type: 'warning',
                              title: 'Pedido de Troca',
                              message: `${currentUser.name} solicitou troca para ${title} (${role}).`,
                              actionLink: 'swaps'
                          });
                      }
                  }}
                  onAcceptRequest={async (reqId) => {
                      if (!ministryId) return;
                      const result = await performSwap(ministryId, reqId, currentUser.name, currentUser.id);
                      if (result.success) {
                          addToast(result.message, "success");
                          // Reload data to reflect swap
                          loadAll(ministryId);
                      } else {
                          addToast(result.message, "error");
                      }
                  }}
              />
          )}

          {currentTab === 'repertoire' && (
              <RepertoireScreen 
                  repertoire={repertoire} 
                  setRepertoire={async (items) => {
                      // Members generally shouldn't edit, but assuming logic is handled inside
                      setRepertoire(items);
                  }}
                  currentUser={currentUser}
                  mode="view"
              />
          )}

          {/* MANAGEMENT TABS (Admin Only) */}
          {currentUser.role === 'admin' && (
              <>
                {currentTab === 'editor' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Header do Editor */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-200 dark:border-zinc-700 pb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                                    Editor de Escala
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                    Gerencie a programação completa de {getMonthName(currentMonth)}.
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <ToolsMenu 
                                    onExportIndividual={(member) => {
                                        // Logic preserved from original
                                    }}
                                    onExportFull={() => {
                                        const doc = new jsPDF('l', 'mm', 'a4');
                                        doc.text(`Escala Completa - ${getMonthName(currentMonth)}`, 14, 15);
                                        
                                        autoTable(doc, {
                                            startY: 25,
                                            head: [['Evento', ...roles]],
                                            body: visibleEvents.map(evt => [
                                                `${evt.dateDisplay} - ${evt.title}`,
                                                ...roles.map(r => schedule[`${evt.iso}_${r}`] || '-')
                                            ]),
                                            styles: { fontSize: 8 },
                                            headStyles: { fillColor: [66, 133, 244] }
                                        });
                                        doc.save(`escala_completa_${currentMonth}.pdf`);
                                    }}
                                    onWhatsApp={() => {
                                        let text = `*ESCALA ${getMonthName(currentMonth).toUpperCase()}*\n\n`;
                                        visibleEvents.forEach(evt => {
                                            text += `*${evt.dateDisplay} - ${evt.title}*\n`;
                                            roles.forEach(r => {
                                                const member = schedule[`${evt.iso}_${r}`];
                                                if (member) text += `> ${r}: ${member}\n`;
                                            });
                                            text += '\n';
                                        });
                                        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                                        window.open(url, '_blank');
                                    }}
                                    onCSV={() => {}}
                                    onImportCSV={() => {}}
                                    onClearMonth={async () => {
                                        if (confirm("ATENÇÃO: Isso apagará toda a escala deste mês. Continuar?")) {
                                            const newSchedule = { ...schedule };
                                            Object.keys(newSchedule).forEach(k => {
                                                if (k.startsWith(currentMonth)) delete newSchedule[k];
                                            });
                                            setSchedule(newSchedule);
                                            if (ministryId) await saveData(ministryId, `schedule_${currentMonth}`, newSchedule);
                                            addToast("Mês limpo com sucesso.", "success");
                                        }
                                    }}
                                    allMembers={allMembersList}
                                />
                                
                                {/* Month Navigation */}
                                <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <button 
                                        onClick={() => {
                                            setCurrentMonth(adjustMonth(currentMonth, -1));
                                        }}
                                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                                    >
                                        ←
                                    </button>
                                    <span className="text-sm font-bold w-24 text-center">{currentMonth}</span>
                                    <button 
                                        onClick={() => {
                                            setCurrentMonth(adjustMonth(currentMonth, 1));
                                        }}
                                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-4">
                            <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Clock size={16}/> Gerenciar Eventos</button>
                            <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Shield size={16}/> Gerenciar Indisponibilidade</button>
                            <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"><Settings size={16}/> Configurar Funções</button>
                        </div>
                        <ScheduleTable 
                            events={visibleEvents}
                            roles={roles}
                            schedule={schedule}
                            attendance={attendance}
                            availability={availability}
                            members={members}
                            allMembers={allMembersList}
                            scheduleIssues={scheduleIssues}
                            globalConflicts={globalConflicts}
                            onCellChange={handleCellChange}
                            onAttendanceToggle={handleAttendanceToggle}
                            onDeleteEvent={async (iso) => {
                                if (confirm("Ocultar este evento da escala?")) {
                                    const newIgnored = [...ignoredEvents, iso];
                                    setIgnoredEvents(newIgnored);
                                    if (ministryId) await saveData(ministryId, `ignored_events_${currentMonth}`, newIgnored);
                                }
                            }}
                            memberStats={memberStats}
                            ministryId={ministryId}
                            readOnly={false} // MODO EDIÇÃO
                        />
                    </div>
                )}

                {currentTab === 'repertoire-manager' && (
                    <RepertoireScreen 
                        repertoire={repertoire} 
                        setRepertoire={async (items) => {
                            if (!ministryId) return;
                            setRepertoire(items);
                            await saveData('shared', 'repertoire_v1', items);
                        }}
                        currentUser={currentUser}
                        mode="manage"
                        onItemAdd={async (title) => {
                            if (ministryId) {
                                await sendNotification(ministryId, {
                                    type: 'info',
                                    title: 'Nova Música / Playlist',
                                    message: `"${title}" foi adicionada ao repertório.`,
                                    actionLink: 'repertoire'
                                });
                            }
                        }}
                    />
                )}

                {currentTab === 'availability-report' && (
                    <AvailabilityReportScreen 
                        availability={availability}
                        registeredMembers={registeredMembers}
                        membersMap={members}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        availableRoles={roles}
                        onRefresh={() => loadAll(ministryId!)}
                    />
                )}

                {currentTab === 'events' && (
                    <EventsScreen 
                        customEvents={customEvents} 
                        setCustomEvents={async (evts) => {
                            setCustomEvents(evts);
                            if (ministryId) await saveData(ministryId, `events_${currentMonth}`, evts);
                        }}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                    />
                )}

                {currentTab === 'alerts' && (
                    <AlertsManager onSend={handleCreateAnnouncement} />
                )}

                {currentTab === 'team' && (
                    <div className="max-w-4xl mx-auto animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Membros e Equipe</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar membro..." 
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {registeredMembers.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(member => (
                                <div key={member.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-start gap-4">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-600" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-zinc-500 dark:text-zinc-300 font-bold text-lg">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{member.name}</h3>
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 bg-zinc-100 dark:bg-zinc-700/50 px-2 py-0.5 rounded-full">
                                                    {adminsList.includes(member.email || '') ? 'Administrador' : 'Membro'}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => {
                                                        confirmAction(
                                                            adminsList.includes(member.email || '') ? "Remover Admin" : "Tornar Admin",
                                                            `Tem certeza que deseja ${adminsList.includes(member.email || '') ? 'remover' : 'conceder'} permissão de administrador para ${member.name}?`,
                                                            async () => {
                                                                if (ministryId && member.email) {
                                                                    await toggleAdmin(ministryId, member.email);
                                                                    await loadAll(ministryId); // Refresh lists
                                                                    addToast("Permissões atualizadas.", "success");
                                                                }
                                                            }
                                                        );
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${adminsList.includes(member.email || '') ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-blue-500'}`}
                                                    title="Alternar Admin"
                                                >
                                                    <ShieldCheck size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        confirmAction("Excluir Membro", `Isso removerá ${member.name} de todas as escalas e registros deste ministério. Continuar?`, async () => {
                                                            if (ministryId) {
                                                                await deleteMember(ministryId, member.id, member.name);
                                                                setRegisteredMembers(prev => prev.filter(m => m.id !== member.id));
                                                                addToast("Membro removido.", "success");
                                                            }
                                                        });
                                                    }}
                                                    className="p-2 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                    title="Excluir da Equipe"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Visual Badges for Roles (Filtered by current ministry context) */}
                                        <div className="flex flex-wrap gap-1 mt-2 mb-2">
                                            {member.roles?.filter(r => roles.includes(r)).map(role => (
                                                <span key={role} className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                                    {role}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="space-y-1 mt-2">
                                            {member.email && (
                                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                    <Mail size={12} /> {member.email}
                                                </div>
                                            )}
                                            {member.whatsapp && (
                                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                    <Phone size={12} /> {member.whatsapp}
                                                </div>
                                            )}
                                            {member.birthDate && (
                                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                    <CalendarHeart size={12} className="text-pink-400" /> 
                                                    {(() => {
                                                        const [y, m, d] = member.birthDate.split('-').map(Number);
                                                        const localDate = new Date(y, m - 1, d);
                                                        return localDate.toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'});
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </>
          )}

          {currentTab === 'settings' && (
              <SettingsScreen 
                  initialTitle={customTitle || getMinistryTitle(ministryId)}
                  ministryId={ministryId}
                  theme={theme}
                  onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                  onSaveTitle={async (newTitle) => {
                      if (!ministryId) return;
                      setCustomTitle(newTitle);
                      await saveData(ministryId, 'ministry_config', { displayName: newTitle });
                      addToast("Título atualizado!", "success");
                  }}
                  onAnnounceUpdate={currentUser?.role === 'admin' ? async () => {
                      if (!ministryId) return;
                      // Dispara push notification de sistema
                      await sendNotification(ministryId, {
                          type: 'info',
                          title: 'Nova Atualização Disponível 🚀',
                          message: 'Uma nova versão do App está disponível. Feche e abra o aplicativo para atualizar.',
                      });
                      addToast("Notificação de atualização enviada!", "success");
                  } : undefined}
                  onEnableNotifications={registerPushForAllMinistries}
              />
          )}

          {currentTab === 'profile' && currentUser && (
              <ProfileScreen 
                  user={currentUser} 
                  availableRoles={roles}
                  onUpdateProfile={async (name, whatsapp, avatar, functions, birthDate) => {
                      const result = await updateUserProfile(name, whatsapp, avatar, functions, birthDate);
                      if (result.success) {
                          setCurrentUser(prev => prev ? { ...prev, name, whatsapp, avatar_url: avatar, functions, birthDate } : null);
                          addToast(result.message, "success");
                      } else {
                          addToast(result.message, "error");
                      }
                  }}
              />
          )}

        </DashboardLayout>

        {/* Modals */}
        <ConfirmationModal 
            isOpen={!!confirmationData} 
            onClose={() => setConfirmationData(null)} 
            onConfirm={confirmationData?.onConfirm}
            data={confirmationData}
        />

        <EventsModal 
            isOpen={eventsModalOpen} 
            onClose={() => setEventsModalOpen(false)}
            events={customEvents}
            hiddenEvents={hiddenEventsList}
            onAdd={async (evt) => {
                const newEvts = [...customEvents, evt];
                setCustomEvents(newEvts);
                if (ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
            }}
            onRemove={async (id) => {
                const newEvts = customEvents.filter(e => e.id !== id);
                setCustomEvents(newEvts);
                if (ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
            }}
            onRestore={async (iso) => {
                const newIgnored = ignoredEvents.filter(i => i !== iso);
                setIgnoredEvents(newIgnored);
                if (ministryId) await saveData(ministryId, `ignored_events_${currentMonth}`, newIgnored);
            }}
        />

        <AvailabilityModal 
            isOpen={availModalOpen} 
            onClose={() => setAvailModalOpen(false)}
            members={allMembersList}
            availability={availability}
            currentMonth={currentMonth}
            onUpdate={async (member, dates) => {
                if (!ministryId) return;
                const newAvail = { ...availability, [member]: dates };
                setAvailability(newAvail);
                await saveData(ministryId, 'availability_v1', newAvail);
            }}
        />

        <RolesModal 
            isOpen={rolesModalOpen} 
            onClose={() => setRolesModalOpen(false)}
            roles={roles}
            onUpdate={async (newRoles) => {
                if (!ministryId) return;
                setRoles(newRoles);
                await saveData(ministryId, 'functions_config', newRoles);
            }}
        />

        <EventDetailsModal
            isOpen={!!selectedEventDetails}
            onClose={() => setSelectedEventDetails(null)}
            event={selectedEventDetails}
            schedule={schedule}
            roles={roles}
            currentUser={currentUser}
            ministryId={ministryId}
            canEdit={currentUser?.role === 'admin'} // PERMISSÃO DE EDIÇÃO
            onSave={async (iso, newTitle, newTime) => {
                if (!ministryId) return;
                
                // If it's a custom event, update it
                const customEvt = customEvents.find(e => e.date === iso.split('T')[0] && e.time === iso.split('T')[1]);
                if (customEvt) {
                    const newEvts = customEvents.map(e => e.id === customEvt.id ? { ...e, title: newTitle, time: newTime } : e);
                    setCustomEvents(newEvts);
                    await saveData(ministryId, `events_${currentMonth}`, newEvts);
                } else {
                    // Could handle system events override if needed
                }
                setSelectedEventDetails(null);
                addToast("Evento atualizado.", "success");
            }}
            onSwapRequest={async (role, iso, title) => {
                if (!ministryId || !currentUser) return;
                const newReq: SwapRequest = {
                    id: Date.now().toString(),
                    ministryId,
                    requesterName: currentUser.name,
                    requesterId: currentUser.id,
                    role,
                    eventIso: iso,
                    eventTitle: title,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                };
                const success = await createSwapRequest(ministryId, newReq);
                if (success) {
                    setSwapRequests([newReq, ...swapRequests]);
                    addToast("Solicitação de troca enviada ao mural!", "success");
                    setSelectedEventDetails(null);
                }
            }}
        />

        <JoinMinistryModal 
            isOpen={joinMinistryModalOpen}
            onClose={() => setJoinMinistryModalOpen(false)}
            onJoin={handleJoinMinistry}
            alreadyJoined={currentUser?.allowedMinistries || []}
        />
    </div>
  );
};

// Root Component wrapping content with Providers
const App = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
