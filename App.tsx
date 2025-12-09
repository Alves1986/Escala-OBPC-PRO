import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    getSupabase, logout, updateUserProfile, deleteMember, 
    fetchGlobalSchedules, joinMinistry,
    fetchMinistryMembers, fetchMinistrySchedule, fetchMinistryAvailability, saveScheduleAssignment, saveScheduleBulk, saveMemberAvailability, updateMinistryEvent, syncMemberProfile, deleteMinistryEvent, resetToDefaultEvents, clearScheduleForMonth, toggleAssignmentConfirmation, createMinistryEvent,
    fetchMinistrySettings, fetchRepertoire, fetchSwapRequests, fetchNotificationsSQL, fetchAnnouncementsSQL, fetchAdminsSQL,
    saveMinistrySettings, addToRepertoire, deleteFromRepertoire,
    createSwapRequestSQL, performSwapSQL, sendNotificationSQL, createAnnouncementSQL, interactAnnouncementSQL,
    toggleAdminSQL, markNotificationsReadSQL, saveSubscriptionSQL,
    fetchAuditLogs, logActionSQL
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

  // Ref para rastrear se a sessão foi encontrada (evita race conditions)
  const sessionFoundRef = useRef(false);

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

          // Fallback para o ministério atual se a lista estiver vazia
          const ministriesToSync = (currentUser.allowedMinistries && currentUser.allowedMinistries.length > 0) 
              ? currentUser.allowedMinistries 
              : [currentUser.ministryId || 'midia'];

          if (subscription) {
              for (const mid of ministriesToSync) {
                  await saveSubscriptionSQL(mid, subscription);
              }
              console.log("Push notifications synced for user:", currentUser.name);
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
  
  const { visibleEvents } = useMemo(() => {
    const allGenerated = generateMonthEvents(year, month - 1, customEvents);
    return { visibleEvents: allGenerated, hiddenEventsList: [] };
  }, [year, month, customEvents]);

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
    if (ministryId) {
        logActionSQL(ministryId, action, details);
    }
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
        resSettings,
        resLogs,
        resNotif,
        resSwaps,
        resRepertoire,
        resAdmins,
        resAnnouncements,
      ] = await Promise.all([
        fetchMinistryMembers(cleanMid),
        fetchMinistrySchedule(cleanMid, currentMonth),
        fetchMinistryAvailability(cleanMid),
        fetchGlobalSchedules(currentMonth, cleanMid),
        fetchMinistrySettings(cleanMid),
        fetchAuditLogs(cleanMid),
        fetchNotificationsSQL(cleanMid, currentUser?.id || ''),
        fetchSwapRequests(cleanMid),
        fetchRepertoire(cleanMid),
        fetchAdminsSQL(cleanMid),
        fetchAnnouncementsSQL(cleanMid),
      ]);

      setMembers(resMemberData.memberMap);
      setRegisteredMembers(resMemberData.publicList);
      setSchedule(resScheduleData.schedule);
      setCustomEvents(resScheduleData.events);
      setAttendance(resScheduleData.attendance); 
      setAvailability(resAvailability);
      setGlobalConflicts(resGlobalConflicts);
      
      setRoles(resSettings.roles);
      setCustomTitle(resSettings.displayName);
      setAuditLog(resLogs);
      setNotifications(resNotif);
      setSwapRequests(resSwaps);
      setRepertoire(resRepertoire);
      setAdminsList(resAdmins);
      setAnnouncements(resAnnouncements);

      if (currentUser && currentUser.email && resAdmins.includes(currentUser.email)) {
          if (currentUser.role !== 'admin') {
              setCurrentUser(prev => prev ? { ...prev, role: 'admin' } : null);
          }
      }

      setIsConnected(true);
      
      // FORÇA A ATUALIZAÇÃO DO PUSH ASSIM QUE OS DADOS CARREGAM
      // Isso garante o vínculo correto do dispositivo com o usuário atual
      registerPushForAllMinistries();

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

    let mounted = true;

    // Função centralizada para processar a sessão
    const handleSession = async (session: any) => {
        if (!mounted) return;

        if (session?.user) {
            // Marca que encontramos uma sessão válida
            sessionFoundRef.current = true;

            const metadata = session.user.user_metadata;
            let allowedMinistries = metadata.allowedMinistries || (metadata.ministryId ? [metadata.ministryId] : []);
            if (!Array.isArray(allowedMinistries)) allowedMinistries = [];
            
            const savedMid = localStorage.getItem('last_ministry_id');
            let cleanMid = allowedMinistries.length > 0 ? allowedMinistries[0].trim().toLowerCase().replace(/\s+/g, '-') : 'midia';
            
            if (savedMid && allowedMinistries.some((m: string) => m.trim().toLowerCase().replace(/\s+/g, '-') === savedMid)) {
                cleanMid = savedMid;
            }

            // GARANTIR: O ministério atual deve estar na lista de permitidos
            if (!allowedMinistries.includes(cleanMid)) {
                allowedMinistries = [...allowedMinistries, cleanMid];
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
            
            // Define o usuário IMEDIATAMENTE e para o loading
            if (mounted) {
                setCurrentUser(user);
                setMinistryId(cleanMid);
                setSessionLoading(false);
            }

            // Sincroniza em background
            syncMemberProfile(cleanMid, user).catch(console.error);
        }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session) handleSession(session);
        } else if (event === 'SIGNED_OUT') {
            // NÃO paramos o loading aqui durante a inicialização.
            // Deixamos o timeout do getSession decidir se deve mostrar a tela de login.
            sessionFoundRef.current = false;
            if (mounted) {
                setCurrentUser(null);
                setMinistryId(null);
            }
        }
    });

    // Verificação Inicial Otimizada com check de Token Local
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            handleSession(session);
        } else {
            // Se não tem sessão ativa imediata, verificamos se há indícios de token no storage
            // para decidir se esperamos um refresh ou mostramos login logo.
            let hasLocalToken = false;
            try {
                if (typeof localStorage !== 'undefined') {
                    const keys = Object.keys(localStorage);
                    hasLocalToken = keys.some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                }
            } catch(e) {}
            
            // Se tem token, espera mais (2s) pelo refresh. Se não tem, espera um pouco (500ms) para evitar flash visual em conexões rápidas.
            const timeoutDuration = hasLocalToken ? 2000 : 500;

            setTimeout(() => {
                // Se após o tempo ainda não encontramos sessão (sessionFoundRef false), encerramos o loading.
                if (mounted && !sessionFoundRef.current) {
                    setSessionLoading(false);
                }
            }, timeoutDuration);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [publicLegalDoc]);

  useEffect(() => {
    if (ministryId) {
      loadAll(ministryId);
    }
  }, [ministryId, currentMonth, currentUser?.id]); // Adicionado currentUser?.id para recarregar ao mudar usuário

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
      try {
          const success = await createAnnouncementSQL(ministryId, { title, message, type, expirationDate }, currentUser.name);
          if (success) {
              await loadAll(ministryId);
              await sendNotificationSQL(ministryId, {
                  title: `Novo Aviso: ${title}`,
                  message: message,
                  type: type,
                  actionLink: 'announcements'
              });
          } else {
              throw new Error("Falha ao criar aviso no banco de dados.");
          }
      } catch (error) {
          console.error("Erro ao criar aviso:", error);
          addToast("Erro ao enviar aviso. Tente novamente.", "error");
      }
  };

  const handleMarkAnnouncementRead = async (id: string) => {
      if (!ministryId || !currentUser || !currentUser.id) return;
      await interactAnnouncementSQL(id, currentUser.id, currentUser.name, 'read');
      // Optimistic update
      setAnnouncements(prev => prev.map(a => 
          a.id === id ? { ...a, readBy: [...a.readBy, { userId: currentUser.id!, name: currentUser.name, timestamp: new Date().toISOString() }] } : a
      ));
  };

  const handleToggleAnnouncementLike = async (id: string) => {
      if (!ministryId || !currentUser || !currentUser.id) return;
      await interactAnnouncementSQL(id, currentUser.id, currentUser.name, 'like');
      // Optimistic update logic slightly complex for likes, simpler to reload or just UI toggle
      await loadAll(ministryId);
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
                    await sendNotificationSQL(ministryId, {
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
                      if (!ministryId || !currentUser.id) return;
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
                      const success = await createSwapRequestSQL(ministryId, newReq);
                      if (success) {
                          setSwapRequests([newReq, ...swapRequests]);
                          addToast("Solicitação de troca criada!", "success");
                          await sendNotificationSQL(ministryId, {
                              type: 'warning',
                              title: 'Pedido de Troca',
                              message: `${currentUser.name} solicitou troca para ${title} (${role}).`,
                              actionLink: 'swaps'
                          });
                      }
                  }}
                  onAcceptRequest={async (reqId) => {
                      if (!ministryId || !currentUser.id) return;
                      const result = await performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id);
                      if (result.success) {
                          addToast(result.message, "success");
                          await loadAll(ministryId);
                      } else {
                          addToast(result.message, "error");
                      }
                  }}
              />
          )}

          {currentTab === 'repertoire' && (
              <RepertoireScreen 
                  repertoire={repertoire} 
                  setRepertoire={async () => { if(ministryId) await loadAll(ministryId); }}
                  currentUser={currentUser}
                  mode="view"
              />
          )}

          {currentTab === 'profile' && currentUser && (
              <ProfileScreen 
                  user={currentUser} 
                  availableRoles={roles}
                  onUpdateProfile={async (name, whatsapp, avatar_url, functions, birthDate) => {
                      if (!ministryId) return;
                      const result = await updateUserProfile(name, whatsapp, avatar_url, functions, birthDate, ministryId);
                      if (result.success) {
                          addToast(result.message, "success");
                          setCurrentUser(prev => prev ? { ...prev, name, whatsapp, avatar_url, functions, birthDate } : null);
                      } else {
                          addToast(result.message, "error");
                      }
                  }}
              />
          )}

          {/* GESTÃO TABS - Apenas Admin */}
          {currentUser.role === 'admin' && (
              <>
                {currentTab === 'editor' && (
                    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                    <Edit3 className="text-blue-500"/> Editor de Escala
                                </h2>
                                <p className="text-zinc-500 text-sm mt-1">
                                    Gerencie a escala oficial de <strong>{getMonthName(currentMonth)}</strong>.
                                </p>
                            </div>
                            
                            <div className="flex items-center gap-2 self-end">
                                <ToolsMenu 
                                    onExportIndividual={(m) => {
                                        const doc = new jsPDF();
                                        doc.text(`Escala de ${m} - ${currentMonth}`, 14, 20);
                                        const mySchedule = Object.entries(schedule)
                                            .filter(([k, v]) => k.startsWith(currentMonth) && v === m)
                                            .map(([k, v]) => {
                                                const [dateIso, role] = k.split('_');
                                                const evt = visibleEvents.find(e => e.iso === dateIso);
                                                return [evt?.dateDisplay || dateIso, evt?.title || 'Evento', role];
                                            });
                                        
                                        autoTable(doc, {
                                            head: [['Data', 'Evento', 'Função']],
                                            body: mySchedule,
                                            startY: 30
                                        });
                                        doc.save(`escala_${m}.pdf`);
                                    }}
                                    onExportFull={() => {
                                        const doc = new jsPDF('l'); // landscape
                                        doc.text(`Escala Geral - ${getMonthName(currentMonth)}`, 14, 15);
                                        
                                        const head = ['Data', 'Evento', ...roles];
                                        const body = visibleEvents.map(evt => {
                                            const row = [evt.dateDisplay, evt.title];
                                            roles.forEach(r => {
                                                if (ministryId === 'louvor' && r === 'Vocal') {
                                                    // No PDF do louvor, talvez queira listar vocais?
                                                    // Por simplicidade aqui não expandimos no PDF básico
                                                    row.push('Ver Detalhe'); 
                                                } else {
                                                    row.push(schedule[`${evt.iso}_${r}`] || '-');
                                                }
                                            });
                                            return row;
                                        });

                                        autoTable(doc, { head: [head], body: body, startY: 25, styles: { fontSize: 8 } });
                                        doc.save(`escala_completa_${currentMonth}.pdf`);
                                    }}
                                    onWhatsApp={() => {
                                        let text = `*Escala ${getMinistryTitle(ministryId)} - ${getMonthName(currentMonth)}*\n\n`;
                                        visibleEvents.forEach(evt => {
                                            text += `📅 *${evt.dateDisplay}* - ${evt.title}\n`;
                                            roles.forEach(r => {
                                                if (ministryId === 'louvor' && r === 'Vocal') {
                                                    [1,2,3,4,5].forEach(i => {
                                                        const m = schedule[`${evt.iso}_Vocal_${i}`];
                                                        if (m) text += `   🎤 Vocal ${i}: ${m}\n`;
                                                    })
                                                } else {
                                                    const m = schedule[`${evt.iso}_${r}`];
                                                    if (m) text += `   🔹 ${r}: ${m}\n`;
                                                }
                                            });
                                            text += `\n`;
                                        });
                                        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                                        window.open(url, '_blank');
                                    }}
                                    onCSV={() => {
                                        let csv = `Data,Evento,${roles.join(',')}\n`;
                                        visibleEvents.forEach(evt => {
                                            const row = [evt.dateDisplay, evt.title];
                                            roles.forEach(r => row.push(schedule[`${evt.iso}_${r}`] || ''));
                                            csv += row.join(',') + '\n';
                                        });
                                        const blob = new Blob([csv], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `escala_${currentMonth}.csv`;
                                        a.click();
                                    }}
                                    onImportCSV={(file) => {
                                        // TODO: Implementar parser de CSV se necessário
                                        addToast("Importação em desenvolvimento.", "info");
                                    }}
                                    onClearMonth={async () => {
                                        if (!ministryId) return;
                                        if (confirm("Tem certeza que deseja LIMPAR TODA a escala deste mês? Isso não pode ser desfeito.")) {
                                            const success = await clearScheduleForMonth(ministryId, currentMonth);
                                            if (success) {
                                                await loadAll(ministryId);
                                                addToast("Escala do mês limpa com sucesso.", "success");
                                            } else {
                                                addToast("Erro ao limpar escala.", "error");
                                            }
                                        }
                                    }}
                                    onResetEvents={handleResetMonth}
                                    onGenerateAI={handleAutoGenerateSchedule}
                                    isGeneratingAI={aiLoading}
                                    allMembers={allMembersList}
                                />
                                
                                <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                  <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                                  <span className="text-sm font-bold w-24 text-center">{currentMonth}</span>
                                  <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                                </div>
                            </div>
                        </div>

                        {/* Botão de Geração com IA em Destaque */}
                        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    ✨ Escala Inteligente (IA)
                                </h3>
                                <p className="text-indigo-100 text-sm mt-1 max-w-lg">
                                    Preencha automaticamente os espaços vazios da escala baseando-se na disponibilidade e histórico dos membros.
                                </p>
                            </div>
                            <button 
                                onClick={handleAutoGenerateSchedule}
                                disabled={aiLoading}
                                className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-lg shadow-md hover:bg-indigo-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                            >
                                {aiLoading ? 'Gerando...' : 'Gerar Escala Agora'}
                            </button>
                        </div>

                        <div className="overflow-x-auto">
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
                                    if (confirm(`Excluir evento "${title}"?`)) {
                                        if (ministryId) {
                                            await deleteMinistryEvent(ministryId, iso);
                                            await loadAll(ministryId);
                                        }
                                    }
                                }}
                                onEditEvent={(evt) => setSelectedEventDetails(evt)}
                                memberStats={memberStats}
                                ministryId={ministryId}
                            />
                        </div>
                    </div>
                )}

                {currentTab === 'repertoire-manager' && (
                    <RepertoireScreen 
                        repertoire={repertoire} 
                        setRepertoire={async () => { if(ministryId) await loadAll(ministryId); }}
                        currentUser={currentUser}
                        mode="manage"
                        onItemAdd={(title) => {
                            // Se quiser notificar
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
                        onRefresh={async () => { if(ministryId) await loadAll(ministryId); }}
                    />
                )}

                {currentTab === 'events' && (
                    <EventsScreen 
                        customEvents={customEvents}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        onCreateEvent={async (evt) => {
                            if (!ministryId) return;
                            const success = await createMinistryEvent(ministryId, evt);
                            if (success) {
                                addToast("Evento criado!", "success");
                                await loadAll(ministryId);
                            } else {
                                addToast("Erro ao criar evento.", "error");
                            }
                        }}
                        onDeleteEvent={async (isoOrId) => {
                            if (!ministryId) return;
                            // Se for ISO string
                            if (isoOrId.includes('T')) {
                                const iso = isoOrId.split('T')[0] + 'T' + isoOrId.split('T')[1];
                                await deleteMinistryEvent(ministryId, iso);
                            } else {
                                // Se for ID (caso venha do DB com ID)
                                // deleteMinistryEvent atualmente espera ISO no client-side logic,
                                // mas idealmente deveria aceitar ID. 
                                // O EventsScreen passa ISO se disponível.
                            }
                            await loadAll(ministryId);
                            addToast("Evento removido.", "success");
                        }}
                    />
                )}

                {currentTab === 'alerts' && (
                    <AlertsManager onSend={handleCreateAnnouncement} />
                )}

                {currentTab === 'team' && (
                    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
                            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                                <Users className="text-blue-500"/> Gestão de Membros
                            </h2>
                            <p className="text-zinc-500 text-sm mt-1">
                                Gerencie quem faz parte da equipe e suas funções.
                            </p>
                        </div>
                        
                        <BirthdayCard members={registeredMembers} currentMonthIso={currentMonth} />

                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                             <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                                 <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm uppercase">Lista de Membros ({registeredMembers.length})</h3>
                                 <input 
                                    type="text" 
                                    placeholder="Buscar membro..." 
                                    value={memberSearch}
                                    onChange={e => setMemberSearch(e.target.value)}
                                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs w-48"
                                 />
                             </div>
                             <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
                                 {registeredMembers
                                    .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                                    .map(member => (
                                     <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                         <div className="flex items-center gap-3">
                                             {member.avatar_url ? (
                                                 <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                                             ) : (
                                                 <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                                                     {member.name.charAt(0)}
                                                 </div>
                                             )}
                                             <div>
                                                 <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{member.name}</p>
                                                 <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                     {member.email || "Sem e-mail"} • {member.roles?.join(', ') || "Sem função"}
                                                 </p>
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             {member.email && (
                                                 <button 
                                                     onClick={() => toggleAdminSQL(member.email!, !member.isAdmin).then(() => {
                                                         if(ministryId) loadAll(ministryId);
                                                         addToast("Permissão de Admin alterada!", "success");
                                                     })}
                                                     className={`px-3 py-1 rounded text-xs font-bold ${member.isAdmin ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'}`}
                                                 >
                                                     {member.isAdmin ? 'Admin' : 'Membro'}
                                                 </button>
                                             )}
                                             
                                             <button 
                                                 onClick={() => confirmAction("Remover Membro", `Tem certeza que deseja remover ${member.name}?`, async () => {
                                                     if (!ministryId) return;
                                                     await deleteMember(ministryId, member.id, member.name);
                                                     await loadAll(ministryId);
                                                     addToast("Membro removido.", "success");
                                                 })}
                                                 className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                 title="Remover da equipe"
                                             >
                                                 <Trash2 size={16} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {currentTab === 'settings' && (
                    <SettingsScreen 
                        initialTitle={customTitle}
                        ministryId={ministryId}
                        theme={theme}
                        onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                        onSaveTitle={async (newTitle) => {
                            if (!ministryId) return;
                            await saveMinistrySettings(ministryId, newTitle);
                            setCustomTitle(newTitle);
                            addToast("Nome do ministério atualizado!", "success");
                        }}
                        onAnnounceUpdate={async () => {
                            if (!ministryId) return;
                            await createAnnouncementSQL(
                                ministryId,
                                {
                                    title: "Nova Atualização Disponível!",
                                    message: "Uma nova versão do app está disponível com melhorias de performance e correções. Recarregue a página para atualizar.",
                                    type: "success",
                                    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                                },
                                "Sistema"
                            );
                            addToast("Anúncio de atualização enviado.", "success");
                        }}
                        onEnableNotifications={async () => {
                            await registerPushForAllMinistries();
                        }}
                    />
                )}
              </>
          )}

        </DashboardLayout>

        {/* MODALS GLOBAIS */}
        <EventDetailsModal
            isOpen={!!selectedEventDetails}
            onClose={() => setSelectedEventDetails(null)}
            event={selectedEventDetails}
            schedule={schedule}
            roles={roles}
            onSave={async (oldIso, newTitle, newTime, applyToAll) => {
                if (!ministryId || !selectedEventDetails) return;
                
                const newIso = `${selectedEventDetails.iso.split('T')[0]}T${newTime}`;
                
                // TODO: Implementar applyToAll no backend se necessário
                // Por enquanto atualiza apenas o evento atual
                const success = await updateMinistryEvent(ministryId, oldIso, newTitle, newIso);
                
                if (success) {
                    addToast("Evento atualizado!", "success");
                    await loadAll(ministryId);
                    setSelectedEventDetails(null);
                } else {
                    addToast("Erro ao atualizar evento.", "error");
                }
            }}
            onSwapRequest={async (role, iso, title) => {
                // Abre aba de trocas e preenche? 
                // Simplificação: Chama a função direta de criação
                if (!ministryId || !currentUser?.id) return;
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
                const success = await createSwapRequestSQL(ministryId, newReq);
                if (success) {
                    addToast("Solicitação de troca enviada!", "success");
                    setSelectedEventDetails(null);
                    // Opcional: navegar para aba de trocas
                }
            }}
            currentUser={currentUser}
            ministryId={ministryId}
            canEdit={currentUser?.role === 'admin'}
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

export const App = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);