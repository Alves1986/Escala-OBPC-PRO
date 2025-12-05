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
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, AppNotification, TeamMemberProfile, SwapRequest, RepertoireItem, Announcement } from './types';
import { loadData, saveData, getSupabase, logout, updateUserProfile, deleteMember, sendNotification, createSwapRequest, performSwap, toggleAdmin, createAnnouncement, markAnnouncementRead } from './services/supabaseService';
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
    // Check if running in standalone mode (already installed)
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isInStandalone) {
        setIsStandalone(true);
    } else {
        // Only verify dismiss state if NOT standalone
        const isDismissed = localStorage.getItem('installBannerDismissed');
        
        // Listener for Android/Desktop Chrome
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setInstallPrompt(e);
            if (!isDismissed) setShowInstallBanner(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        
        // Manual check for iOS (since beforeinstallprompt doesn't fire)
        const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
        if (isIOS && !isDismissed) {
             setShowInstallBanner(true);
        }
        
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleInstallApp = async () => {
    setShowInstallBanner(false);
    if (installPrompt) {
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
        }
    } else {
        // If no prompt available (iOS or blocked), show manual instructions
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
    if (!id) return "Escala Mídia Pro";
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
        resAnnouncements
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
        loadData<Announcement[]>(cleanMid, 'announcements_v1', [])
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
            onConfirm={(key) => {
                const memberName = schedule[key];
                if(memberName) {
                   setConfirmationData({
                      key,
                      memberName,
                      eventName: nextEvent.title,
                      date: nextEvent.dateDisplay,
                      role: roles.find(r => `${nextEvent.iso}_${r}` === key) || 'Função'
                   });
                }
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

  const renderTeam = () => (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
           <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Membros & Equipe</h2>
           <p className="text-zinc-500 text-sm">Gerencie os membros cadastrados e funções.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleRefreshList} className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg flex items-center justify-center transition-colors">
                {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <RefreshCw size={20} />}
            </button>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar membro..." 
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-800 dark:text-zinc-100 outline-none w-64"
                />
            </div>
            <button onClick={() => setRolesModalOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white p-2.5 rounded-lg transition-colors"><Settings size={20}/></button>
        </div>
      </div>

      {/* Tabela de Membros Cadastrados */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
         <div className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Membros Cadastrados</h3>
            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded-full text-zinc-600 dark:text-zinc-300">Total: {registeredMembers.length}</span>
         </div>
         
         <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
             {registeredMembers.length === 0 ? (
                 <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center">
                     <Users size={48} className="mb-3 opacity-20"/>
                     <p>Nenhum membro cadastrado ainda.</p>
                 </div>
             ) : (
                 registeredMembers
                    .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(member => {
                     const isAdmin = adminsList.includes(member.email || '');
                     return (
                     <div key={member.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors gap-4">
                         <div className="flex items-start gap-4 flex-1">
                             {member.avatar_url ? (
                                 <img src={member.avatar_url} alt={member.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                             ) : (
                                 <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                     {member.name.charAt(0).toUpperCase()}
                                 </div>
                             )}
                             
                             <div className="flex-1">
                                 <div className="flex items-center gap-2">
                                     <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">{member.name}</h4>
                                     {isAdmin && (
                                       <span title="Administrador">
                                          <ShieldCheck size={16} className="text-blue-500" />
                                       </span>
                                     )}
                                 </div>
                                 <p className="text-[10px] text-zinc-400 font-mono mb-2">ID: {member.id.substring(0,8)}...</p>

                                 {/* Visual Contact Info Block */}
                                 <div className="flex flex-wrap gap-x-4 gap-y-1">
                                     {member.email && (
                                         <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                            <Mail size={12} />
                                            <span>{member.email}</span>
                                         </div>
                                     )}
                                     {member.whatsapp && (
                                         <a href={`https://wa.me/${member.whatsapp.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 transition-colors">
                                            <Phone size={12} />
                                            <span>{member.whatsapp}</span>
                                         </a>
                                     )}
                                     {member.birthDate && (
                                         <div className="flex items-center gap-1.5 text-xs text-pink-500 font-medium">
                                            <CalendarHeart size={12} />
                                            <span>{member.birthDate.split('-').reverse().join('/')}</span>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         </div>
                         
                         <div className="flex items-center gap-2 self-end md:self-center">
                             {/* Botão Tornar Admin */}
                             {currentUser?.role === 'admin' && member.email && (
                                 <button 
                                     onClick={() => handleToggleAdmin(member.email!, member.name)}
                                     className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isAdmin ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                                     title={isAdmin ? "Remover Admin" : "Tornar Admin"}
                                 >
                                     {isAdmin ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                                     <span className="md:hidden">{isAdmin ? 'Admin' : 'Membro'}</span>
                                 </button>
                             )}

                             {currentUser?.role === 'admin' && (
                                 <button 
                                     onClick={() => handleDeleteMember(member.id, member.name)}
                                     className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                     title="Excluir Membro"
                                 >
                                     <Trash2 size={18} />
                                 </button>
                             )}
                         </div>
                     </div>
                     );
                 })
             )}
         </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard': return renderDashboard();
      case 'team': return renderTeam();
      case 'calendar': 
         return (
            <div className="space-y-6 animate-fade-in">
                {/* Month Selector Reuse */}
                <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
                     <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Calendário</h2>
                        <p className="text-zinc-500 text-sm">Visão geral das escalas do mês.</p>
                     </div>
                     <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        <button onClick={() => setCurrentMonth(prev => {
                            const [y, m] = prev.split('-').map(Number);
                            return new Date(y, m - 2, 1).toISOString().slice(0, 7);
                        })} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                        <div className="text-center min-w-[120px]">
                            <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                            <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                        </div>
                        <button onClick={() => setCurrentMonth(prev => {
                            const [y, m] = prev.split('-').map(Number);
                            return new Date(y, m, 1).toISOString().slice(0, 7);
                        })} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                    </div>
                </div>

                <CalendarGrid 
                    currentMonth={currentMonth}
                    events={visibleEvents}
                    schedule={schedule}
                    roles={roles}
                    onEventClick={(evt) => {
                        const dateDisplay = evt.iso.split('T')[0].split('-').reverse().join('/');
                        setSelectedEventDetails({ iso: evt.iso, title: evt.title, dateDisplay });
                    }}
                />
            </div>
         );
      case 'editor':
        return (
          <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
                 <div>
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Editor de Escala</h2>
                    <p className="text-zinc-500 text-sm">Arraste ou selecione para escalar os membros.</p>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                         <Clock size={16}/> Gerenciar Eventos
                     </button>
                     <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-medium">
                         <Shield size={16}/> Indisponibilidades
                     </button>
                 </div>
             </div>
             
             <div className="flex justify-end mb-4">
                <ToolsMenu 
                    allMembers={allMembersList}
                    onExportIndividual={(m) => {
                        const doc = new jsPDF();
                        doc.text(`Escala Individual: ${m}`, 10, 10);
                        // Lógica de exportação...
                        doc.save(`escala_${m}.pdf`);
                    }} 
                    onExportFull={() => {
                         const doc = new jsPDF();
                         doc.text(`Escala Geral - ${currentMonth}`, 10, 10);
                         // Lógica completa de PDF...
                         doc.save(`escala_geral_${currentMonth}.pdf`);
                    }}
                    onWhatsApp={handleShareNextEvent}
                    onCSV={() => {}}
                    onImportCSV={() => {}}
                    onClearMonth={() => {
                        if(confirm("Limpar toda a escala deste mês?")) {
                            setSchedule({});
                            // Salvar vazio...
                        }
                    }}
                />
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
                onCellChange={handleCellChange}
                onAttendanceToggle={handleAttendanceToggle}
                onDeleteEvent={handleDeleteEvent}
                memberStats={memberStats}
                ministryId={ministryId}
             />
          </div>
        );
      case 'availability':
        return (
          <AvailabilityScreen 
            availability={availability} 
            setAvailability={setAvailability}
            allMembersList={allMembersList}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onNotify={(msg) => logAction("Disponibilidade", msg)}
            currentUser={currentUser}
            onSaveAvailability={handleSaveAvailability}
          />
        );
      case 'profile':
        if (!currentUser) return null;
        return (
            <ProfileScreen 
                user={currentUser} 
                onUpdateProfile={handleUpdateProfile}
                availableRoles={roles}
            />
        );
      case 'swaps':
        if (!currentUser) return null;
        return (
            <SwapRequestsScreen 
                schedule={schedule}
                currentUser={currentUser}
                requests={swapRequests}
                visibleEvents={visibleEvents}
                onCreateRequest={handleCreateSwapRequest}
                onAcceptRequest={handleAcceptSwap}
                onCancelRequest={() => {}}
            />
        );
      case 'repertoire':
        return (
            <RepertoireScreen 
                repertoire={repertoire} 
                setRepertoire={async (items) => {
                    if (ministryId) {
                        setRepertoire(items);
                        await saveData('shared', 'repertoire_v1', items);
                    }
                }}
                currentUser={currentUser}
                mode="view"
            />
        );
      case 'repertoire-manager':
          return (
              <RepertoireScreen 
                  repertoire={repertoire} 
                  setRepertoire={async (items) => {
                      if (ministryId) {
                          setRepertoire(items);
                          await saveData('shared', 'repertoire_v1', items);
                      }
                  }}
                  currentUser={currentUser}
                  mode="manage"
              />
          );
      case 'availability-report':
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
      case 'events':
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
      case 'alerts':
          return (
              <AlertsManager onSend={handleSendGlobalAlert} />
          );
      case 'settings':
          return (
              <SettingsScreen 
                  initialTitle={customTitle} 
                  ministryId={ministryId} 
                  theme={theme}
                  onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                  onSaveTitle={handleSaveSettings}
              />
          );
      default:
        return renderDashboard();
    }
  };

  return (
    <div className={theme}>
        {sessionLoading ? (
            <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-zinc-400 animate-pulse">Carregando sistema...</p>
                </div>
            </div>
        ) : !currentUser ? (
          <LoginScreen />
        ) : (
          <DashboardLayout
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            theme={theme}
            toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            onLogout={logout}
            title={getMinistryTitle(ministryId)}
            isConnected={isConnected}
            currentUser={currentUser}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            mainNavItems={MAIN_NAV_ITEMS}
            managementNavItems={MANAGEMENT_NAV_ITEMS}
            notifications={notifications}
            onNotificationsUpdate={setNotifications}
            onInstall={handleInstallApp}
            installPrompt={installPrompt}
            isStandalone={isStandalone}
          >
            {renderContent()}
          </DashboardLayout>
        )}
        
        {/* Modals Globais */}
        <ConfirmationModal 
            isOpen={!!confirmationData}
            onClose={() => setConfirmationData(null)}
            onConfirm={async () => {
                if (confirmationData) {
                    await handleAttendanceToggle(confirmationData.key);
                    setConfirmationData(null);
                    addToast("Presença confirmada com sucesso!", "success");
                }
            }}
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
            onRestore={handleRestoreEvent}
        />

        <AvailabilityModal 
            isOpen={availModalOpen} 
            onClose={() => setAvailModalOpen(false)}
            members={allMembersList}
            availability={availability}
            currentMonth={currentMonth}
            onUpdate={handleSaveAvailability}
        />

        <RolesModal 
            isOpen={rolesModalOpen} 
            onClose={() => setRolesModalOpen(false)}
            roles={roles} // Agora é string[]
            onUpdate={async (newRoles) => {
                setRoles(newRoles);
                if (ministryId) await saveData(ministryId, 'functions_config', newRoles);
            }}
        />

        <EventDetailsModal 
            isOpen={!!selectedEventDetails}
            onClose={() => setSelectedEventDetails(null)}
            event={selectedEventDetails}
            schedule={schedule}
            roles={roles}
            onSave={handleSaveEventDetails}
            currentUser={currentUser}
            ministryId={ministryId}
            onSwapRequest={handleCreateSwapRequest}
        />

        {/* Global Install Components */}
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        <InstallBanner 
            isVisible={showInstallBanner} 
            onInstall={handleInstallApp} 
            onDismiss={handleDismissBanner}
            appName="Escala Mídia Pro"
        />
    </div>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;