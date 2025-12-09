
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
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { PublicLegalPage, LegalDocType } from './components/LegalDocuments';
import { WeatherWidget } from './components/WeatherWidget';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, AppNotification, TeamMemberProfile, SwapRequest, RepertoireItem, Announcement, GlobalConflictMap } from './types';
import { 
    loadData, saveData, getSupabase, logout, updateUserProfile, deleteMember, sendNotification, 
    createSwapRequest, performSwap, toggleAdmin, createAnnouncement, markAnnouncementRead, 
    fetchGlobalSchedules, joinMinistry, saveSubscription, toggleAnnouncementLike,
    fetchMinistryMembers, fetchMinistrySchedule, fetchMinistryAvailability, saveScheduleAssignment, saveScheduleBulk, saveMemberAvailability, updateMinistryEvent, syncMemberProfile, deleteMinistryEvent, resetToDefaultEvents, clearScheduleForMonth, toggleAssignmentConfirmation, createMinistryEvent
} from './services/supabaseService';
import { generateScheduleWithAI } from './services/aiService';
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
  { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20} /> },
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

  const [publicLegalDoc, setPublicLegalDoc] = useState<LegalDocType>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const legalParam = params.get('legal');
    if (legalParam === 'terms' || legalParam === 'privacy') {
        setPublicLegalDoc(legalParam as LegalDocType);
        setSessionLoading(false); 
    }
  }, []);

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); 
  
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('app_theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

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
  
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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
  
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  
  const [confirmationData, setConfirmationData] = useState<any>(null);

  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [joinMinistryModalOpen, setJoinMinistryModalOpen] = useState(false);
  
  const [selectedEventDetails, setSelectedEventDetails] = useState<{ iso: string; title: string; dateDisplay: string } | null>(null);

  const registerPushForAllMinistries = async () => {
      if (!currentUser || !('serviceWorker' in navigator)) return;

      try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription && currentUser.allowedMinistries) {
              for (const mid of currentUser.allowedMinistries) {
                  await saveSubscription(mid, subscription);
              }
          }
      } catch (error) {
          console.error("Erro ao sincronizar push:", error);
      }
  };

  useEffect(() => {
      if (isConnected && currentUser) {
          registerPushForAllMinistries();
      }
  }, [isConnected, currentUser?.id, ministryId]);

  useEffect(() => {
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);

    if (isStandaloneMode) {
      setShowInstallBanner(false);
      return;
    }

    const isDismissed = localStorage.getItem('installBannerDismissed');
    
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!isDismissed) {
        setShowInstallBanner(true);
      }
    };

    if ((window as any).deferredPrompt) {
        handleBeforeInstallPrompt((window as any).deferredPrompt);
        (window as any).deferredPrompt = null;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    if (isIOS && !isStandaloneMode && !isDismissed) {
         setShowInstallBanner(true);
    }
    
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
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
            setShowInstallBanner(false);
        }
    } else {
        setShowInstallModal(true);
    }
  };

  const handleDismissBanner = () => {
      setShowInstallBanner(false);
      localStorage.setItem('installBannerDismissed', 'true');
  };

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
    Object.values(members).forEach((arr) => {
      if (Array.isArray(arr)) (arr as string[]).forEach(m => list.add(m));
    });
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

  const activeAnnouncements = useMemo(() => {
      const now = new Date();
      return announcements
          .filter(a => {
              if (a.expirationDate) {
                  return new Date(a.expirationDate) > now;
              }
              return true; 
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [announcements]);

  const unreadAnnouncementsCount = useMemo(() => {
      if (!currentUser) return 0;
      return activeAnnouncements.filter(a => !a.readBy.some(r => r.userId === currentUser.id)).length;
  }, [activeAnnouncements, currentUser]);

  const logAction = (action: string, details: string) => {
    const newEntry: AuditLogEntry = {
      date: new Date().toLocaleString("pt-BR"),
      action,
      details
    };
    setAuditLog(prev => [newEntry, ...prev].slice(0, 200));
  };

  const getMinistryTitle = (id: string | null) => {
    if (customTitle) return customTitle;
    if (!id) return "Gestão de Escala OBPC";
    const cleanId = id.toLowerCase().trim();
    if (cleanId === 'midia') return "Mídia / Comunicação";
    if (cleanId === 'louvor') return "Louvor / Adoração";
    return `Escala ${id.charAt(0).toUpperCase() + id.slice(1)}`;
  }

  const loadAll = async (mid: string) => {
    setLoading(true);
    try {
      const cleanMid = mid.trim().toLowerCase().replace(/\s+/g, '-');
      
      const [
        resMemberData,
        resScheduleData,
        resAvailability,
        resGlobalConflicts,
        resRoles,
        resLogs,
        resIgnored,
        resNotif,
        resSwaps,
        resRepertoire,
        resAdmins,
        resConfig,
        resAnnouncements,
      ] = await Promise.all([
        fetchMinistryMembers(cleanMid),
        fetchMinistrySchedule(cleanMid, currentMonth),
        fetchMinistryAvailability(cleanMid),
        fetchGlobalSchedules(currentMonth, cleanMid),
        loadData<string[]>(cleanMid, 'functions_config', DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['midia']),
        loadData<AuditLogEntry[]>(cleanMid, 'audit_logs', []),
        loadData<string[]>(cleanMid, `ignored_events_${currentMonth}`, []),
        loadData<AppNotification[]>(cleanMid, 'notifications_v1', []),
        loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []),
        loadData<RepertoireItem[]>('shared', 'repertoire_v1', []),
        loadData<string[]>(cleanMid, 'admins_list', []),
        loadData<any>(cleanMid, 'ministry_config', { displayName: '' }),
        loadData<Announcement[]>(cleanMid, 'announcements_v1', []),
      ]);

      setMembers(resMemberData.memberMap);
      setRegisteredMembers(resMemberData.publicList);
      setSchedule(resScheduleData.schedule);
      setCustomEvents(resScheduleData.events);
      setAttendance(resScheduleData.attendance); 
      setAvailability(resAvailability);
      setGlobalConflicts(resGlobalConflicts);
      
      setRoles(resRoles);
      setAuditLog(resLogs);
      setIgnoredEvents(resIgnored);
      setNotifications(resNotif);
      setSwapRequests(resSwaps);
      setRepertoire(resRepertoire);
      setAdminsList(resAdmins);
      if (resConfig?.displayName) setCustomTitle(resConfig.displayName);
      setAnnouncements(resAnnouncements);

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

  useEffect(() => {
    if (publicLegalDoc) return;

    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
        
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
        
        await syncMemberProfile(cleanMid, user);

        setCurrentUser(user);
        setMinistryId(cleanMid);
        setSessionLoading(false);
      } else {
        setSessionLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
        
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
        
        await syncMemberProfile(cleanMid, user);
        
        setCurrentUser(user);
        setMinistryId(cleanMid);
      } else {
        setCurrentUser(null);
        setMinistryId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [publicLegalDoc]);

  useEffect(() => {
    if (ministryId) {
      loadAll(ministryId);
    }
  }, [ministryId, currentMonth]);

  const handleSwitchMinistry = async (newMinistryId: string) => {
      if (!currentUser) return;
      const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
      localStorage.setItem('last_ministry_id', cleanMid);
      setMinistryId(cleanMid);
      setCurrentUser(prev => prev ? { ...prev, ministryId: cleanMid } : null);
      
      setMembers({});
      setSchedule({});
      setNotifications([]);
      setAnnouncements([]);
      setRegisteredMembers([]);
      setCustomTitle("");
      
      addToast(`Trocando para ${getMinistryTitle(cleanMid)}...`, "info");
  };

  const handleJoinMinistry = async (newMinistryId: string, roles: string[]) => {
      if (!currentUser) return;
      const result = await joinMinistry(newMinistryId, roles);
      if (result.success) {
          addToast(result.message, "success");
          const newAllowed = [...(currentUser.allowedMinistries || []), newMinistryId];
          setCurrentUser(prev => prev ? { ...prev, allowedMinistries: newAllowed } : null);
          handleSwitchMinistry(newMinistryId);
      } else {
          addToast(result.message, "error");
      }
  };

  const handleAutoGenerateSchedule = async () => {
    if (!ministryId) return;

    const hasExistingSchedule = Object.keys(schedule).some(k => k.startsWith(currentMonth) && schedule[k]);
    
    if (hasExistingSchedule) {
        if (!confirm("Já existe uma escala preenchida para este mês. Deseja sobrescrever os espaços vazios e ajustar conforme a IA?")) {
            return;
        }
    }

    setAiLoading(true);

    try {
        const eventsToFill = visibleEvents.map(e => ({ iso: e.iso, title: e.title }));
        
        const result = await generateScheduleWithAI({
            events: eventsToFill,
            members: registeredMembers, 
            availability: availability,
            roles: roles,
            ministryId: ministryId
        });

        if (result) {
            const newSchedule = { ...schedule, ...result };
            
            Object.keys(result).forEach(k => {
                if (!newSchedule[k]) delete newSchedule[k];
            });

            setSchedule(newSchedule);
            
            const success = await saveScheduleBulk(ministryId, result);
            
            if (success) {
                addToast("Escala gerada com IA com sucesso!", "success");
            } else {
                addToast("Escala gerada, mas erro ao salvar no banco. Tente novamente.", "warning");
            }
        } else {
            addToast("Falha ao gerar escala. Verifique a configuração da API ou tente novamente.", "error");
        }
    } catch (e: any) {
        console.error(e);
        addToast(e.message || "Erro interno ao gerar escala.", "error");
    } finally {
        setAiLoading(false);
        await loadAll(ministryId);
    }
  };

  const handleResetMonth = async () => {
    if (!ministryId) return;
    
    confirmAction(
        "Restaurar Eventos Padrão?",
        "Isso APAGARÁ todos os eventos e escalas deste mês e recriará apenas os cultos oficiais (Quartas e Domingos) sem duplicatas. Use isso se a agenda estiver bagunçada.",
        async () => {
            const success = await resetToDefaultEvents(ministryId, currentMonth);
            if (success) {
                setSchedule(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(k => {
                        if (k.startsWith(currentMonth)) delete next[k];
                    });
                    return next;
                });
                setCustomEvents([]);
                setIgnoredEvents([]);
                
                await loadAll(ministryId);
                addToast("Eventos restaurados para o padrão com sucesso!", "success");
            } else {
                addToast("Erro ao restaurar eventos.", "error");
            }
        }
    );
  };

  useEffect(() => {
      if (!currentUser || !nextEvent || !schedule) return;
      
      const eventDate = nextEvent.iso.split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      
      if (eventDate === today) {
          let isScheduled = false;
          let myRole = '';
          
          Object.entries(schedule).forEach(([key, memberName]) => {
              if (key.startsWith(nextEvent.iso) && memberName === currentUser.name) {
                  isScheduled = true;
                  myRole = key.split('_').pop() || '';
              }
          });

          if (isScheduled) {
              const notifiedKey = `notified_schedule_${currentUser.id}_${today}`;
              if (!sessionStorage.getItem(notifiedKey)) {
                  if (Notification.permission === "granted") {
                      new Notification("Lembrete de Escala", {
                          body: `Olá ${currentUser.name}, você está escalado hoje (${myRole}) para o evento ${nextEvent.title}.`,
                          icon: "/icon.png"
                      });
                  }
                  addToast(`Lembrete: Você está escalado hoje como ${myRole}!`, "info");
                  sessionStorage.setItem(notifiedKey, 'true');
              }
          }
      }
  }, [currentUser, nextEvent, schedule]);

  const handleCellChange = async (key: string, value: string) => {
    if (!ministryId) return;
    
    const newSchedule = { ...schedule };
    if (value === "") {
        delete newSchedule[key];
    } else {
        newSchedule[key] = value;
    }
    setSchedule(newSchedule); 
    
    const success = await saveScheduleAssignment(ministryId, key, value);
    if (!success) {
        addToast("Erro ao salvar no banco. Recarregue a página.", "error");
    }

    const [date, role] = key.split('_');
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
    
    const success = await toggleAssignmentConfirmation(ministryId, key);
    if (!success) {
        setAttendance(attendance); // Revert
        addToast("Erro ao confirmar presença.", "error");
    }
  };

  const handleCreateAnnouncement = async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert', expirationDate: string) => {
      if (!ministryId || !currentUser) return;
      const success = await createAnnouncement(ministryId, { title, message, type, expirationDate }, currentUser.name);
      if (success) {
          const updated = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
          setAnnouncements(updated);
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

  if (publicLegalDoc) {
      return <PublicLegalPage type={publicLegalDoc} />;
  }

  if (sessionLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => window.location.reload()} />;
  }

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
          {currentTab === 'dashboard' && (
            <div className="space-y-8 pb-20 animate-fade-in max-w-5xl mx-auto">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                          Olá, {currentUser.name.split(' ')[0]} <span className="animate-wave text-3xl">👋</span>
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                          Bem-vindo ao painel de controle do {getMinistryTitle(ministryId)}.
                      </p>
                  </div>
                  
                  <WeatherWidget />
              </div>

              <div 
                  onClick={() => setCurrentTab('announcements')}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden group"
              >
                  <div className="absolute right-0 top-0 h-full w-32 bg-white/10 skew-x-12 translate-x-10 group-hover:translate-x-0 transition-transform"/>
                  <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                              <Megaphone size={28} />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg">Central de Avisos</h3>
                              <p className="text-indigo-100 text-sm">
                                  {unreadAnnouncementsCount > 0 
                                      ? `Você tem ${unreadAnnouncementsCount} aviso(s) não lido(s).` 
                                      : "Nenhum aviso novo no momento."
                                  }
                              </p>
                          </div>
                      </div>
                      <ChevronRight size={24} className="opacity-70 group-hover:translate-x-1 transition-transform"/>
                  </div>
              </div>

              <NextEventCard 
                  event={nextEvent} 
                  schedule={schedule} 
                  attendance={attendance} 
                  roles={roles}
                  onConfirm={handleAttendanceToggle}
                  ministryId={ministryId}
                  currentUser={currentUser}
              />

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

          {currentTab === 'announcements' && (
              <AnnouncementsScreen 
                  announcements={activeAnnouncements}
                  currentUser={currentUser}
                  onMarkRead={handleMarkAnnouncementRead}
                  onToggleLike={handleToggleAnnouncementLike}
              />
          )}

          {currentTab === 'calendar' && (
             <div className="animate-fade-in max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Calendário de Escalas</h2>
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <button 
                        onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                      >
                        ←
                      </button>
                      <span className="text-sm font-bold w-24 text-center">{currentMonth}</span>
                      <button 
                        onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))}
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
                    await saveMemberAvailability(currentUser?.id || 'manual', member, dates);
                    
                    const newAvail = { ...availability, [member]: dates };
                    setAvailability(newAvail);
                    
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
                      setRepertoire(items);
                  }}
                  currentUser={currentUser}
                  mode="view"
              />
          )}

          {currentUser.role === 'admin' && (
              <>
                {currentTab === 'editor' && (
                    <div className="space-y-6 animate-fade-in">
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
                                    onExportIndividual={(member) => {}}
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
                                        if (!ministryId) return;
                                        confirmAction("Limpar Escala?", "Isso removerá todos os membros escalados neste mês. Os eventos permanecerão vazios.", async () => {
                                            const success = await clearScheduleForMonth(ministryId, currentMonth);
                                            if (success) {
                                                const newSchedule = { ...schedule };
                                                Object.keys(newSchedule).forEach(k => {
                                                    if (k.startsWith(currentMonth)) delete newSchedule[k];
                                                });
                                                setSchedule(newSchedule);
                                                addToast("Escala do mês limpa com sucesso.", "success");
                                            } else {
                                                addToast("Erro ao limpar escala.", "error");
                                            }
                                        });
                                    }}
                                    onResetEvents={handleResetMonth}
                                    onGenerateAI={handleAutoGenerateSchedule}
                                    isGeneratingAI={aiLoading}
                                    allMembers={allMembersList}
                                />
                                
                                <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <button 
                                        onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))}
                                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"
                                    >
                                        ←
                                    </button>
                                    <span className="text-sm font-bold w-24 text-center">{currentMonth}</span>
                                    <button 
                                        onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))}
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
                            onDeleteEvent={async (iso, title) => {
                                confirmAction(
                                    "Excluir Evento?",
                                    `Isso apagará o evento "${title}" e todas as escalas associadas do banco de dados.`,
                                    async () => {
                                        if (ministryId) {
                                            await deleteMinistryEvent(ministryId, iso);
                                            setCustomEvents(prev => prev.filter(e => e.iso !== iso));
                                            setIgnoredEvents(prev => [...prev, iso]);
                                            await loadAll(ministryId); 
                                            addToast("Evento excluído permanentemente.", "success");
                                        }
                                    }
                                );
                            }}
                            onEditEvent={(evt) => setSelectedEventDetails(evt)} 
                            memberStats={memberStats}
                            ministryId={ministryId}
                            readOnly={false} 
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
                        onCreateEvent={async (evt) => {
                            if (ministryId) {
                                await createMinistryEvent(ministryId, evt);
                                await loadAll(ministryId);
                            }
                        }}
                        onDeleteEvent={async (id) => {
                            // Note: EventsScreen needs to handle deletion logic which might be by ID or by ISO
                            // For simplicity, we just reload all
                            if (ministryId) await loadAll(ministryId);
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
                                                                    await loadAll(ministryId); 
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
                                                        confirmAction("Excluir Membro", `Isso removerá ${member.name} e TODOS os seus dados de escalas deste ministério. Continuar?`, async () => {
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
                      const result = await updateUserProfile(name, whatsapp, avatar, functions, birthDate, ministryId || undefined);
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
                if (ministryId) {
                    await createMinistryEvent(ministryId, evt);
                    await loadAll(ministryId);
                }
            }}
            onRemove={async (id) => {
                // Delete logic needs ISO but customEvents usually has ID or ISO.
                // Assuming ID mapping is handled or we iterate to find ISO.
                // For direct SQL delete we need ISO (date_time). 
                // Currently simplified to reload.
                if (ministryId) await loadAll(ministryId);
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
                
                await saveMemberAvailability(currentUser?.id || 'manual', member, dates);
                
                const newAvail = { ...availability, [member]: dates };
                setAvailability(newAvail);
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
            canEdit={currentUser?.role === 'admin'} 
            onSave={async (oldIso, newTitle, newTime, applyToAll) => {
                if (!ministryId) return;
                
                const oldDate = oldIso.split('T')[0];
                let newCustomEvents = [...customEvents];
                let newIgnoredEvents = [...ignoredEvents];
                let newSchedule = { ...schedule };

                const processEvent = async (iso: string, currentTitle: string) => {
                    const date = iso.split('T')[0];
                    const time = iso.split('T')[1];
                    const newIso = `${date}T${newTime}`;

                    await updateMinistryEvent(ministryId, iso, newTitle, newIso);

                    if (iso !== newIso) {
                        const oldPrefix = `${iso}_`;
                        const newPrefix = `${newIso}_`;
                        
                        Object.keys(newSchedule).forEach(key => {
                            if (key.startsWith(oldPrefix)) {
                                const roleSuffix = key.replace(oldPrefix, '');
                                const member = newSchedule[key];
                                const newKey = `${newPrefix}${roleSuffix}`;
                                
                                newSchedule[newKey] = member;
                                delete newSchedule[key];
                                
                                saveScheduleAssignment(ministryId, newKey, member);
                            }
                        });
                    }
                };

                if (applyToAll && selectedEventDetails) {
                    const targetTitle = selectedEventDetails.title;
                    const matchingEvents = visibleEvents.filter(e => e.title === targetTitle);
                    
                    for (const evt of matchingEvents) {
                        await processEvent(evt.iso, evt.title);
                    }
                    addToast(`Atualizado ${matchingEvents.length} eventos em série.`, "success");
                } else {
                    await processEvent(oldIso, selectedEventDetails?.title || '');
                    addToast("Evento atualizado.", "success");
                }

                await loadAll(ministryId);
                
                setSelectedEventDetails(null);
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

const App = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export { App };
