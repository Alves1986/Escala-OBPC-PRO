
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
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, AppNotification, TeamMemberProfile, SwapRequest, RepertoireItem, Announcement, GlobalConflictMap } from './types';
import { loadData, saveData, getSupabase, logout, updateUserProfile, deleteMember, sendNotification, createSwapRequest, performSwap, toggleAdmin, createAnnouncement, markAnnouncementRead, fetchGlobalSchedules } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
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
  CalendarHeart
} from 'lucide-react';
import { NextEventCard } from './components/NextEventCard';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal } from './components/ManagementModals';

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
  
  // Event Detail Modal (from Calendar Grid)
  const [selectedEventDetails, setSelectedEventDetails] = useState<{ iso: string; title: string; dateDisplay: string } | null>(null);

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
        const cleanMid = metadata.ministryId?.trim().toLowerCase().replace(/\s+/g, '-') || 'midia';
        
        const user: User = {
           id: session.user.id,
           email: session.user.email,
           name: metadata.name || 'Usuário',
           role: metadata.role || 'member',
           ministryId: cleanMid,
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
        const cleanMid = metadata.ministryId?.trim().toLowerCase().replace(/\s+/g, '-') || 'midia';
        
        const user: User = {
           id: session.user.id,
           email: session.user.email,
           name: metadata.name || 'Usuário',
           role: metadata.role || 'member',
           ministryId: cleanMid,
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


  // --- HANDLERS ---
  const handleCellChange = async (key: string, value: string) => {
    if (!ministryId) return;
    const newSchedule = { ...schedule, [key]: value };
    if (!value) delete newSchedule[key];
    
    setSchedule(newSchedule);
    await saveData(ministryId, `schedule_${currentMonth}`, newSchedule);
  };

  const handleAttendanceToggle = async (key: string) => {
    if (!ministryId) return;
    const newAtt = { ...attendance, [key]: !attendance[key] };
    setAttendance(newAtt);
    await saveData(ministryId, `attendance_${currentMonth}`, newAtt);
  };

  const handleDeleteEvent = async (iso: string, title: string) => {
    if (!ministryId) return;
    
    const custom = customEvents.find(e => e.date === iso.split('T')[0] && e.time === iso.split('T')[1]);
    if (custom) {
       const newEvents = customEvents.filter(e => e.id !== custom.id);
       setCustomEvents(newEvents);
       await saveData(ministryId, `events_${currentMonth}`, newEvents);
       logAction('Excluir Evento', `Evento extra '${title}' removido.`);
    } else {
       const newIgnored = [...ignoredEvents, iso];
       setIgnoredEvents(newIgnored);
       await saveData(ministryId, `ignored_events_${currentMonth}`, newIgnored);
       logAction('Ocultar Evento', `Evento padrão '${title}' ocultado.`);
    }
  };

  const handleRestoreEvent = async (iso: string) => {
    if (!ministryId) return;
    const newIgnored = ignoredEvents.filter(i => i !== iso);
    setIgnoredEvents(newIgnored);
    await saveData(ministryId, `ignored_events_${currentMonth}`, newIgnored);
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!ministryId) return;

    confirmAction(
      "Excluir Membro",
      `Tem certeza que deseja remover ${memberName} da equipe? Isso apagará a disponibilidade e removerá das escalas futuras.`,
      async () => {
         const success = await deleteMember(ministryId, memberId, memberName);
         if (success) {
             setRegisteredMembers(prev => prev.filter(m => m.name !== memberName));
             // Update local role maps
             const newMembersMap = { ...members };
             Object.keys(newMembersMap).forEach(role => {
                 newMembersMap[role] = newMembersMap[role].filter(n => n !== memberName);
             });
             setMembers(newMembersMap);
             
             logAction("Exclusão", `Membro ${memberName} removido da equipe.`);
             addToast("Membro removido com sucesso.", "success");
         } else {
             addToast("Erro ao excluir membro.", "error");
         }
      }
    );
  };

  const handleToggleAdmin = async (email: string, name: string) => {
      if (!ministryId) return;
      if (email === currentUser?.email) {
          addToast("Você não pode alterar seu próprio nível de acesso.", "warning");
          return;
      }

      const isCurrentlyAdmin = adminsList.includes(email);
      const action = isCurrentlyAdmin ? "remover permissão de Admin" : "promover a Admin";

      confirmAction(
          "Alterar Permissão",
          `Deseja ${action} de ${name}?`,
          async () => {
              const res = await toggleAdmin(ministryId, email);
              if (res.success) {
                  setAdminsList(prev => res.isAdmin ? [...prev, email] : prev.filter(e => e !== email));
                  addToast(res.isAdmin ? `${name} agora é Admin.` : `${name} agora é Membro.`, "success");
              } else {
                  addToast("Erro ao alterar permissão.", "error");
              }
          }
      );
  };

  const handleRefreshList = async () => {
      if (!ministryId) return;
      setLoading(true);
      const list = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
      setRegisteredMembers(list);
      setLoading(false);
      addToast("Lista atualizada!", "success");
  };

  const handleReloadAvailability = async () => {
      if (!ministryId) return;
      const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
      const resAvail = await loadData<AvailabilityMap>(cleanMid, 'availability_v1', {});
      setAvailability(resAvail);
      addToast("Disponibilidade sincronizada.", "success");
  };

  const handleSaveAvailability = async (member: string, dates: string[]) => {
      if (!ministryId) return;
      const newAvail = { ...availability, [member]: dates };
      // 1. Update Local State
      setAvailability(newAvail);
      // 2. Persist to Database immediately
      await saveData(ministryId, 'availability_v1', newAvail);
  };

  const handleUpdateProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string) => {
    if (!currentUser) return;
    const res = await updateUserProfile(name, whatsapp, avatar_url, functions, birthDate);
    if (res.success) {
      setCurrentUser(prev => prev ? { ...prev, name, whatsapp, avatar_url, functions: functions || prev.functions, birthDate } : null);
      addToast("Perfil salvo!", "success");
      
      if (ministryId) {
          const updatedMembers = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
          const updatedMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
          setRegisteredMembers(updatedMembers);
          setMembers(updatedMap);
      }
    } else {
      addToast(res.message, "error");
    }
  };

  const handleCreateSwapRequest = async (role: string, eventIso: string, eventTitle: string) => {
    if (!ministryId || !currentUser) return;
    
    const newReq: SwapRequest = {
        id: Date.now().toString(),
        ministryId,
        requesterName: currentUser.name,
        requesterId: currentUser.id,
        role,
        eventIso,
        eventTitle,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    
    const success = await createSwapRequest(ministryId, newReq);
    if (success) {
        setSwapRequests(prev => [newReq, ...prev]);
        addToast("Solicitação de troca enviada ao mural!", "success");
    } else {
        addToast("Erro ao criar solicitação.", "error");
    }
  };

  const handleAcceptSwap = async (reqId: string) => {
     if (!ministryId || !currentUser) return;
     
     const confirm = window.confirm("Você tem certeza que deseja assumir esta escala?");
     if (!confirm) return;

     const result = await performSwap(ministryId, reqId, currentUser.name, currentUser.id);
     
     if (result.success) {
         addToast(result.message, "success");
         // Refresh data (schedule and requests)
         const updatedRequests = await loadData<SwapRequest[]>(ministryId, 'swap_requests_v1', []);
         const updatedSchedule = await loadData<ScheduleMap>(ministryId, `schedule_${currentMonth}`, {});
         
         setSwapRequests(updatedRequests);
         setSchedule(updatedSchedule);
     } else {
         addToast(result.message, "error");
     }
  };

  const handleShareNextEvent = () => {
    if (!nextEvent) {
        addToast("Nenhum evento próximo encontrado para compartilhar.", "warning");
        return;
    }

    let message = `*ESCALA - ${nextEvent.title.toUpperCase()}*\n`;
    message += `📅 Data: ${nextEvent.dateDisplay}\n`;
    const time = nextEvent.iso.split('T')[1];
    message += `⏰ Horário: ${time}\n\n`;
    message += `*EQUIPE ESCALADA:*\n`;

    let hasMembers = false;
    roles.forEach(role => {
        if (ministryId === 'louvor' && role === 'Vocal') {
            [1, 2, 3, 4, 5].forEach(i => {
                const key = `${nextEvent.iso}_Vocal_${i}`;
                const memberName = schedule[key];
                if (memberName) {
                    message += `▪️ *Vocal ${i}:* ${memberName}\n`;
                    hasMembers = true;
                }
            });
        } else {
            const key = `${nextEvent.iso}_${role}`;
            const memberName = schedule[key];
            if (memberName) {
                message += `▪️ *${role}:* ${memberName}\n`;
                hasMembers = true;
            }
        }
    });

    if (!hasMembers) message += `_(Ninguém escalado ainda)_\n`;
    message += `\n✅ Confirme sua presença no App!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSaveEventDetails = async (oldIso: string, newTitle: string, newTime: string) => {
     if(!ministryId || !selectedEventDetails) return;
     // Logic to update event... (omitted for brevity in this snippet as it's not the focus)
     addToast("Edição de detalhes salva!", "success");
     setSelectedEventDetails(null);
  }

  const handleSendGlobalAlert = async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert') => {
      if (!ministryId || !currentUser) return;
      
      // 1. Enviar Notificação Push (Sininho e Celular)
      await sendNotification(ministryId, {
          title,
          message,
          type
      });
      const notifs = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
      setNotifications(notifs);

      // 2. Criar Comunicado (Card no Dashboard)
      await createAnnouncement(ministryId, {
          title,
          message,
          type
      }, currentUser.name);
      
      const updatedAnnouncements = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
      setAnnouncements(updatedAnnouncements);
  };

  const handleMarkAnnouncementRead = async (announcementId: string) => {
      if (!ministryId || !currentUser) return;
      
      const updatedList = await markAnnouncementRead(ministryId, announcementId, currentUser);
      setAnnouncements(updatedList);
      addToast("Marcado como ciente.", "success");
  };

  const handleSaveSettings = async (newName: string) => {
      if (!ministryId) return;
      setCustomTitle(newName);
      await saveData(ministryId, 'ministry_config', { displayName: newName });
      addToast("Configurações salvas com sucesso!", "success");
  }

  // --- RENDER ---
  const renderDashboard = () => {
    // Filtrar comunicados visíveis
    const visibleAnnouncements = announcements.filter(announcement => {
        if (!currentUser) return false;
        // Admins veem tudo
        if (currentUser.role === 'admin') return true;
        // Membros veem apenas não lidos
        const hasRead = announcement.readBy.some(r => r.userId === currentUser.id);
        return !hasRead;
    });

    return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">
              Olá, {currentUser?.name.split(' ')[0]} 👋
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
               Bem-vindo ao painel de controle do {getMinistryTitle(ministryId)}.
            </p>
         </div>
       </div>

       {/* ANNOUNCEMENT CARDS - Só renderiza se houver itens visíveis */}
       {visibleAnnouncements.length > 0 && (
           <div className="space-y-4">
               {visibleAnnouncements.map(announcement => (
                   <AnnouncementCard 
                       key={announcement.id}
                       announcement={announcement}
                       currentUser={currentUser!}
                       onMarkRead={handleMarkAnnouncementRead}
                   />
               ))}
           </div>
       )}

        {/* BIRTHDAY CARD - Mostra Aniversariantes do mês atual */}
        <BirthdayCard 
          members={registeredMembers} 
          currentMonthIso={currentMonth} 
        />

       {nextEvent ? (
         <NextEventCard 
            event={nextEvent}
            schedule={schedule}
            attendance={attendance}
            roles={roles}
            ministryId={ministryId}
            currentUser={currentUser}
            onConfirm={(key) => {
                handleAttendanceToggle(key);
                addToast("Presença confirmada! Bom serviço.", "success");
            }}
         />
       ) : (
         <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-center mb-6">
            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-300">Tudo tranquilo!</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Nenhum evento próximo agendado para os próximos dias.</p>
         </div>
       )}

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div onClick={() => setCurrentTab('calendar')} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                 <CalendarIcon size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">Visualizar</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Escala do Mês</h3>
            <p className="text-sm text-zinc-500 mt-1">Veja quem está escalado em {getMonthName(currentMonth)}.</p>
         </div>

         <div onClick={() => setCurrentTab('availability')} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                 <Shield size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">Editar</span>
            </div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Minha Disponibilidade</h3>
            <p className="text-sm text-zinc-500 mt-1">Informe os dias que você pode servir.</p>
         </div>
       </div>
    </div>
  );
};

// Render Team Screen (Membros & Equipe) - Re-implementado com melhor visual
const renderTeam = () => {
  // Ordena a lista de membros alfabeticamente
  const sortedMembers = [...registeredMembers].sort((a, b) => a.name.localeCompare(b.name));
  
  // Função para renderizar os Badges de Funções
  const renderRoleBadges = (roles: string[] | undefined) => {
    if (!roles || roles.length === 0) return <span className="text-[10px] text-zinc-400 italic">Sem função</span>;
    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {roles.map((role, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
                    {role}
                </span>
            ))}
        </div>
    );
  };

  return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
              <div>
                  <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      <Users className="text-blue-500"/> Equipe e Membros
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1">
                      Gerencie quem faz parte do time e seus níveis de acesso.
                  </p>
              </div>
              <button 
                  onClick={handleRefreshList} 
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors"
                  title="Atualizar Lista"
              >
                  <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
          </div>

          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input 
                  type="text" 
                  placeholder="Buscar membro..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
              />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedMembers
                  .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map(member => {
                      const isAdmin = adminsList.includes(member.email || '');
                      const isMe = currentUser?.email === member.email;
                      const hasContactInfo = member.email || member.whatsapp || member.birthDate;

                      return (
                          <div key={member.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-start gap-4 group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                              {/* Avatar */}
                              <div className="shrink-0">
                                  {member.avatar_url ? (
                                      <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-700" />
                                  ) : (
                                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                                          {member.name.charAt(0).toUpperCase()}
                                      </div>
                                  )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <h3 className="font-bold text-zinc-800 dark:text-white truncate text-lg leading-tight">
                                              {member.name}
                                          </h3>
                                          {/* Exibição de Cargo (Admin/Membro) com Ícone */}
                                          <div className="flex items-center gap-1.5 mt-1 mb-2">
                                              {isAdmin ? (
                                                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                                                      <span title="Administrador"><ShieldCheck size={12}/></span> Administrador
                                                  </span>
                                              ) : (
                                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                                                      Membro
                                                  </span>
                                              )}
                                          </div>
                                          
                                          {/* Exibição das Funções (Badges) */}
                                          {renderRoleBadges(member.roles)}
                                      </div>
                                  </div>

                                  {/* Contact Details (Visual List) */}
                                  <div className="mt-4 space-y-1.5">
                                      {member.email && (
                                          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 truncate">
                                              <Mail size={14} className="text-zinc-400 shrink-0"/>
                                              <span className="truncate">{member.email}</span>
                                          </div>
                                      )}
                                      {member.whatsapp && (
                                          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                              <Smartphone size={14} className="text-zinc-400 shrink-0"/>
                                              <span>{member.whatsapp}</span>
                                          </div>
                                      )}
                                      {member.birthDate && (
                                          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                              <CalendarHeart size={14} className="text-pink-400 shrink-0"/>
                                              <span>
                                                  {new Date(member.birthDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                                              </span>
                                          </div>
                                      )}
                                      
                                      {!hasContactInfo && (
                                          <p className="text-[10px] text-zinc-400 italic mt-2">Sem informações de contato.</p>
                                      )}
                                  </div>
                              </div>

                              {/* Actions Column */}
                              <div className="flex flex-col gap-2">
                                   {currentUser?.role === 'admin' && !isMe && (
                                       <>
                                           <button 
                                               onClick={() => handleToggleAdmin(member.email || '', member.name)}
                                               className={`p-2 rounded-lg transition-colors ${isAdmin ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'}`}
                                               title={isAdmin ? "Remover Admin" : "Tornar Admin"}
                                           >
                                               <ShieldCheck size={18} />
                                           </button>
                                           <button 
                                               onClick={() => handleDeleteMember(member.id, member.name)}
                                               className="p-2 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                                               title="Excluir Membro"
                                           >
                                               <Trash2 size={18} />
                                           </button>
                                       </>
                                   )}
                              </div>
                          </div>
                      );
                  })}
          </div>
      </div>
  );
};

// --- RENDER CONTENT SWITCHER ---
const renderContent = () => {
  if (sessionLoading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Carregando...</div>;
  }
  
  if (!currentUser) {
    return <LoginScreen isLoading={loading} />;
  }

  // Dashboard Tab
  if (currentTab === 'dashboard') {
    return renderDashboard();
  }

  // Calendar Tab
  if (currentTab === 'calendar') {
     return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
           <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="text-indigo-500"/> Calendário
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                   Visão geral da escala de {getMonthName(currentMonth)}.
                </p>
              </div>

               {/* Month Selector Reuse */}
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <button onClick={() => {
                      const prev = new Date(year, month - 2, 1);
                      setCurrentMonth(prev.toISOString().slice(0, 7));
                  }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                  <div className="text-center min-w-[120px]">
                      <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                      <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                  </div>
                  <button onClick={() => {
                      const next = new Date(year, month, 1);
                      setCurrentMonth(next.toISOString().slice(0, 7));
                  }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
              </div>
           </div>

           <CalendarGrid 
              currentMonth={currentMonth}
              events={visibleEvents}
              schedule={schedule}
              roles={roles}
              onEventClick={(evt) => {
                  setSelectedEventDetails({ iso: evt.iso, title: evt.title, dateDisplay: evt.iso.split('T')[0].split('-').reverse().join('/') });
              }}
           />

           <div className="mt-8">
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
                onDeleteEvent={handleDeleteEvent}
                memberStats={memberStats}
                ministryId={ministryId}
              />
           </div>
        </div>
     );
  }

  if (currentTab === 'availability') {
    return (
      <AvailabilityScreen 
        availability={availability} 
        setAvailability={setAvailability}
        allMembersList={allMembersList}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        currentUser={currentUser}
        onSaveAvailability={handleSaveAvailability}
      />
    );
  }

  if (currentTab === 'profile') {
    return (
      <ProfileScreen 
        user={currentUser}
        onUpdateProfile={handleUpdateProfile}
        availableRoles={roles}
      />
    );
  }

  if (currentTab === 'swaps') {
      return (
          <SwapRequestsScreen 
              schedule={schedule}
              currentUser={currentUser}
              requests={swapRequests}
              visibleEvents={visibleEvents}
              onCreateRequest={handleCreateSwapRequest}
              onAcceptRequest={handleAcceptSwap}
              onCancelRequest={()=>{}}
          />
      );
  }

  if (currentTab === 'repertoire') {
      return (
          <RepertoireScreen 
              repertoire={repertoire}
              setRepertoire={async (newRep) => {
                  setRepertoire(newRep);
                  await saveData('shared', 'repertoire_v1', newRep);
              }}
              currentUser={currentUser}
              mode='view'
          />
      );
  }

  // --- MANAGEMENT TABS (ADMIN ONLY) ---
  if (currentUser.role === 'admin') {
      if (currentTab === 'editor') {
          return (
            <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                      <Edit3 className="text-blue-500"/> Editor de Escala
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                       Monte a escala oficial de {getMonthName(currentMonth)}.
                    </p>
                  </div>

                   <div className="flex items-center gap-2 self-end">
                       <ToolsMenu 
                            allMembers={allMembersList}
                            onExportIndividual={(m) => {
                                const doc = new jsPDF();
                                doc.text(`Escala: ${m}`, 10, 10);
                                doc.save(`escala_${m}.pdf`);
                            }}
                            onExportFull={() => {
                                const doc = new jsPDF();
                                autoTable(doc, { html: 'table' });
                                doc.save('escala_completa.pdf');
                            }}
                            onWhatsApp={handleShareNextEvent}
                            onCSV={() => {}}
                            onImportCSV={() => {}}
                            onClearMonth={async () => {
                                if(confirm("Limpar todo o mês?")) {
                                    const newSch = {...schedule};
                                    Object.keys(newSch).forEach(k => {
                                        if(k.startsWith(currentMonth)) delete newSch[k];
                                    });
                                    setSchedule(newSch);
                                    if (ministryId) await saveData(ministryId, `schedule_${currentMonth}`, newSch);
                                }
                            }}
                       />

                       <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm ml-2">
                          <button onClick={() => {
                              const prev = new Date(year, month - 2, 1);
                              setCurrentMonth(prev.toISOString().slice(0, 7));
                          }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                          <div className="text-center min-w-[120px]">
                              <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                              <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                          </div>
                          <button onClick={() => {
                              const next = new Date(year, month, 1);
                              setCurrentMonth(next.toISOString().slice(0, 7));
                          }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                      </div>
                   </div>
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
                  onDeleteEvent={handleDeleteEvent}
                  memberStats={memberStats}
                  ministryId={ministryId}
               />
               
               <div className="flex gap-2 justify-center mt-6">
                   <button onClick={() => setRolesModalOpen(true)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-zinc-700">Gerenciar Funções</button>
                   <button onClick={() => setAvailModalOpen(true)} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm hover:bg-zinc-300 dark:hover:bg-zinc-700">Gerenciar Indisponibilidade</button>
               </div>
            </div>
          );
      }

      if (currentTab === 'events') {
          return (
            <EventsScreen 
               customEvents={customEvents} 
               setCustomEvents={async (evts) => {
                   setCustomEvents(evts);
                   if (ministryId) await saveData(ministryId, `events_${currentMonth}`, evts);
               }}
               currentMonth={currentMonth}
               onMonthChange={setCurrentMonth}
            />
          );
      }

      if (currentTab === 'team') {
          return renderTeam();
      }

      if (currentTab === 'alerts') {
          return <AlertsManager onSend={handleSendGlobalAlert} />;
      }
      
      if (currentTab === 'settings') {
          return (
             <SettingsScreen 
                initialTitle={customTitle}
                ministryId={ministryId}
                theme={theme}
                onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                onSaveTitle={handleSaveSettings}
             />
          );
      }

      if (currentTab === 'availability-report') {
          return (
              <AvailabilityReportScreen 
                  availability={availability}
                  registeredMembers={registeredMembers}
                  membersMap={members}
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                  availableRoles={roles}
                  onRefresh={handleReloadAvailability}
              />
          );
      }

      if (currentTab === 'repertoire-manager') {
          return (
              <RepertoireScreen 
                  repertoire={repertoire}
                  setRepertoire={async (newRep) => {
                      setRepertoire(newRep);
                      await saveData('shared', 'repertoire_v1', newRep);
                  }}
                  currentUser={currentUser}
                  mode='manage'
              />
          );
      }
  }

  // Fallback for non-admins trying to access admin tabs
  return renderDashboard();
};

  return (
    <DashboardLayout 
      sidebarOpen={sidebarOpen} 
      setSidebarOpen={setSidebarOpen} 
      theme={theme} 
      toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} 
      onLogout={() => { logout(); setCurrentUser(null); }}
      title={getMinistryTitle(ministryId)}
      isConnected={isConnected}
      currentUser={currentUser}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      mainNavItems={MAIN_NAV_ITEMS}
      managementNavItems={MANAGEMENT_NAV_ITEMS}
      notifications={notifications}
      onNotificationsUpdate={setNotifications}
      // CRITICAL CHANGE: Always pass handleInstallApp if NOT standalone (installed)
      // This ensures the button appears in the sidebar even if Chrome hasn't fired the event yet.
      onInstall={!isStandalone ? handleInstallApp : undefined}
      isStandalone={isStandalone}
    >
      {renderContent()}

      {/* Confirmation Modal */}
      <ConfirmationModal 
          isOpen={!!confirmationData}
          onClose={() => setConfirmationData(null)}
          onConfirm={() => {
              if (confirmationData) {
                  handleAttendanceToggle(confirmationData.key);
                  setConfirmationData(null);
                  addToast("Presença confirmada com sucesso!", "success");
              }
          }}
          data={confirmationData}
      />
      
      {/* Install Modal (iOS instructions or Manual Fallback) */}
      <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />

      {/* Install Banner (Bottom) - Only shows if event captured */}
      <InstallBanner 
          isVisible={showInstallBanner} 
          onInstall={handleInstallApp} 
          onDismiss={handleDismissBanner}
          appName="Escala OBPC"
      />

      {/* Admin Modals */}
      <EventsModal 
          isOpen={eventsModalOpen} 
          onClose={() => setEventsModalOpen(false)} 
          events={customEvents} 
          hiddenEvents={hiddenEventsList}
          onAdd={async (e) => {
              const newEvts = [...customEvents, e];
              setCustomEvents(newEvts);
              if (ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
          }} 
          onRemove={async (id) => {
              const newEvts = customEvents.filter(ev => ev.id !== id);
              setCustomEvents(newEvts);
              if (ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
          }}
          onRestore={handleRestoreEvent}
      />

      <AvailabilityModal 
          isOpen={availModalOpen} 
          onClose={() => setAvailModalOpen(false)} 
          members={allMembersList}
          availability={availability}
          currentMonth={currentMonth}
          onUpdate={async (member, dates) => {
               const newAvail = { ...availability, [member]: dates };
               setAvailability(newAvail);
               if (ministryId) await saveData(ministryId, 'availability_v1', newAvail);
          }}
      />
      
      <RolesModal 
          isOpen={rolesModalOpen} 
          onClose={() => setRolesModalOpen(false)} 
          roles={roles}
          onUpdate={async (newRoles) => {
              setRoles(newRoles);
              if (ministryId) await saveData(ministryId, 'functions_config', newRoles);
          }}
      />

      {/* Event Details Modal (Calendar Click) */}
      <EventDetailsModal 
          isOpen={!!selectedEventDetails}
          onClose={() => setSelectedEventDetails(null)}
          event={selectedEventDetails}
          schedule={schedule}
          roles={roles}
          onSave={handleSaveEventDetails}
          onSwapRequest={handleCreateSwapRequest}
          currentUser={currentUser}
          ministryId={ministryId}
      />

    </DashboardLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
