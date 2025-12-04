
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { EventsScreen } from './components/EventsScreen';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { EventDetailsModal } from './components/EventDetailsModal';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, AppNotification, TeamMemberProfile } from './types';
import { loadData, saveData, getStorageKey, getSupabase, logout, updateUserProfile, sendNotification, syncMemberProfile, deleteMember } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { 
  Calendar as CalendarIcon, 
  BarChart2, 
  Shield, 
  Settings, 
  Activity, 
  LayoutDashboard, 
  Users, 
  Edit3, 
  Plus, 
  Trash2, 
  Search, 
  ChevronDown,
  Wand2,
  BrainCircuit,
  FileText,
  Clock,
  ArrowRight,
  X,
  CheckCircle2,
  Mail,
  Phone,
  UserCircle2,
  RefreshCw,
  AlertCircle,
  Share2,
  AlertTriangle,
  Trash,
  CalendarSearch
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { NextEventCard } from './components/NextEventCard';
import { NotificationToggle } from './components/NotificationToggle';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { StatsModal } from './components/StatsModal';

// --- NAVIGATION ITEMS ---
const MAIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20} /> },
  { id: 'availability', label: 'Disponibilidade', icon: <Shield size={20} /> },
];

const MANAGEMENT_NAV_ITEMS = [
  { id: 'editor', label: 'Editor de Escala', icon: <Edit3 size={20} /> },
  { id: 'availability-report', label: 'Relat. Disponibilidade', icon: <CalendarSearch size={20} /> },
  { id: 'events', label: 'Eventos', icon: <Clock size={20} /> },
  { id: 'team', label: 'Membros & Equipe', icon: <Users size={20} /> },
  { id: 'stats', label: 'Estatísticas', icon: <BarChart2 size={20} /> },
  { id: 'logs', label: 'Logs do Sistema', icon: <Activity size={20} /> },
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
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Data State
  const [members, setMembers] = useState<MemberMap>({});
  const [registeredMembers, setRegisteredMembers] = useState<TeamMemberProfile[]>([]); // New State
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [ignoredEvents, setIgnoredEvents] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [scheduleIssues, setScheduleIssues] = useState<ScheduleAnalysis>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [collapsedRoles, setCollapsedRoles] = useState<string[]>([]);
  
  // Confirmation Modal State
  const [confirmationData, setConfirmationData] = useState<any>(null);
  // Event Details Modal State
  const [selectedEvent, setSelectedEvent] = useState<{ iso: string; title: string; dateDisplay: string } | null>(null);

  // Modals States
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

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
  
  // Lista Consolidada para uso no Editor (Inclui funções manuais + cadastrados)
  const consolidatedMembers = useMemo(() => {
    const map: Record<string, string[]> = { ...members }; // Começa com o mapa manual
    
    // Varre os membros cadastrados para injetá-los nas funções corretas
    registeredMembers.forEach(profile => {
      if (profile.roles && profile.roles.length > 0) {
         profile.roles.forEach(role => {
            if (!map[role]) map[role] = [];
            // Adiciona se ainda não estiver na lista manual dessa função
            if (!map[role].includes(profile.name)) {
                map[role] = [...map[role], profile.name];
            }
         });
      }
    });
    
    return map;
  }, [members, registeredMembers]);

  const allMembersList = useMemo(() => {
    const list = new Set<string>();
    
    // 1. Members from Role Map
    Object.values(members).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(m => list.add(m));
    });

    // 2. Members from Registered List
    registeredMembers.forEach(m => list.add(m.name));

    // 3. Members from Availability Map (Ghost members)
    Object.keys(availability).forEach(m => list.add(m));

    return Array.from(list).sort();
  }, [members, registeredMembers, availability]);

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
    if (!id) return "Escala Mídia Pro";
    const cleanId = id.toLowerCase().trim();
    if (cleanId === 'midia') return "Mídia / Comunicação";
    if (cleanId === 'louvor') return "Louvor / Adoração";
    return `Escala ${id.charAt(0).toUpperCase() + id.slice(1)}`;
  }

  // --- HELPER UNWRAP FUNCTION ---
  // Extrai o valor de Promise.allSettled. Se rejeitado, retorna fallback.
  const unwrap = <T,>(result: PromiseSettledResult<T>, fallback: T): T => {
    return result.status === 'fulfilled' ? result.value : fallback;
  };

  // --- INITIAL DATA LOAD ---
  const loadAll = async (mid: string) => {
    setLoading(true);
    try {
      const cleanMid = mid.trim().toLowerCase().replace(/\s+/g, '-');
      
      const results = await Promise.allSettled([
        loadData<MemberMap>(cleanMid, 'members_v7', {}),
        loadData<ScheduleMap>(cleanMid, `schedule_${currentMonth}`, {}),
        loadData<AvailabilityMap>(cleanMid, 'availability_v1', {}),
        loadData<CustomEvent[]>(cleanMid, `events_${currentMonth}`, []),
        loadData<string[]>(cleanMid, 'functions_config', DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['midia']),
        loadData<AuditLogEntry[]>(cleanMid, 'audit_logs', []),
        loadData<string[]>(cleanMid, `ignored_events_${currentMonth}`, []),
        loadData<AttendanceMap>(cleanMid, `attendance_${currentMonth}`, {}),
        loadData<AppNotification[]>(cleanMid, 'notifications_v1', []),
        loadData<TeamMemberProfile[]>(cleanMid, 'public_members_list', [])
      ]);

      const [
          resMembers, resSchedule, resAvail, resEvents, 
          resRoles, resLogs, resIgnored, resAttend, resNotif, resRegMembers
      ] = results;

      setMembers(unwrap(resMembers, {}));
      setSchedule(unwrap(resSchedule, {}));
      setAvailability(unwrap(resAvail, {}));
      setCustomEvents(unwrap(resEvents, []));
      setRoles(unwrap(resRoles, DEFAULT_ROLES[cleanMid] || DEFAULT_ROLES['midia']));
      setAuditLog(unwrap(resLogs, []));
      setIgnoredEvents(unwrap(resIgnored, []));
      setAttendance(unwrap(resAttend, {}));
      setNotifications(unwrap(resNotif, []));
      setRegisteredMembers(unwrap(resRegMembers, []));

      setIsConnected(true);
    } catch (e) {
      console.error("Load Error", e);
      addToast("Erro ao carregar dados. Verifique a conexão.", "error");
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

  // --- SELF-HEALING: Auto-Add Current User to Member List ---
  useEffect(() => {
    const checkAndFixMembership = async () => {
        if (!currentUser || !ministryId || loading) return;
        
        // Verifica se o usuário atual está na lista carregada
        // Se a lista estiver vazia (registeredMembers.length === 0), mas estamos logados, 
        // significa que provavelmente precisamos nos inserir nela.
        const amIInList = registeredMembers.some(m => 
            (m.id && currentUser.id && m.id === currentUser.id) || 
            (m.email && currentUser.email && m.email === currentUser.email) ||
            m.name === currentUser.name
        );

        if (!amIInList && registeredMembers) {
            console.log("Self-Healing: Usuário atual não encontrado na lista. Forçando sincronização...");
            
            // Força a sincronização
            const updatedList = await syncMemberProfile(ministryId, currentUser);
            
            // Atualiza o estado local imediatamente
            if (updatedList.length > 0) {
                setRegisteredMembers(updatedList);
                addToast("Perfil sincronizado com a equipe!", "success");
            }
        }
    };

    // Delay para garantir que o load inicial terminou
    const timeout = setTimeout(checkAndFixMembership, 3000);
    return () => clearTimeout(timeout);
  }, [currentUser, ministryId, registeredMembers]); // Removed loading from deps to avoid loop, handled inside

  // --- POLLING & SYNC ---
  // Recarrega notificações e membros a cada 15s para manter sincronia
  useEffect(() => {
      if (!ministryId) return;

      const pollData = async () => {
          try {
              // 1. Notificações
              const latestNotifs = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
              if (JSON.stringify(latestNotifs) !== JSON.stringify(notifications)) {
                  setNotifications(latestNotifs);
                  
                  // Se houver uma nova não lida, avisa
                  const newUnread = latestNotifs.filter(n => !n.read && !notifications.some(old => old.id === n.id));
                  if (newUnread.length > 0) {
                      addToast(newUnread[0].title, "info");
                  }
              }

              // 2. Membros (apenas se estiver na aba de equipe para economizar recursos)
              if (currentTab === 'team') {
                   const latestMembers = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
                   if (JSON.stringify(latestMembers) !== JSON.stringify(registeredMembers)) {
                       setRegisteredMembers(latestMembers);
                   }
              }

              setIsConnected(true);
          } catch (e) {
              console.warn("Polling failed", e);
              setIsConnected(false);
          }
      };

      const interval = setInterval(pollData, 15000); // 15s
      return () => clearInterval(interval);
  }, [ministryId, notifications, registeredMembers, currentTab]);


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
    
    // Check if custom event
    const custom = customEvents.find(e => e.date === iso.split('T')[0] && e.time === iso.split('T')[1]);
    if (custom) {
       // It's a custom event, delete it
       const newEvents = customEvents.filter(e => e.id !== custom.id);
       setCustomEvents(newEvents);
       await saveData(ministryId, `events_${currentMonth}`, newEvents);
       logAction('Excluir Evento', `Evento extra '${title}' removido.`);
    } else {
       // It's a standard event, ignore it
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
             // Optimistic Update
             setRegisteredMembers(prev => prev.filter(m => m.id !== memberId));
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

  const handleRefreshList = async () => {
      if (!ministryId) return;
      setLoading(true);
      const list = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
      const latestAvail = await loadData<AvailabilityMap>(ministryId, 'availability_v1', {});
      const latestNotif = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
      
      setRegisteredMembers(list);
      setAvailability(latestAvail);
      setNotifications(latestNotif);
      setLoading(false);
      addToast("Lista atualizada!", "success");
  };

  const handleUpdateProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[]) => {
    if (!currentUser) return;
    const res = await updateUserProfile(name, whatsapp, avatar_url, functions);
    if (res.success) {
      setCurrentUser(prev => prev ? { ...prev, name, whatsapp, avatar_url, functions: functions || prev.functions } : null);
      addToast("Perfil salvo!", "success");
      
      // Força recarga imediata dos membros locais e do mapa
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

  const handleShareNextEvent = () => {
     if (!nextEvent || !ministryId) return;
     
     const dateDisplay = nextEvent.dateDisplay;
     const timeDisplay = nextEvent.iso.split('T')[1];
     
     let msg = `*ESCALA - ${nextEvent.title}*\n`;
     msg += `📅 ${dateDisplay} às ${timeDisplay}\n\n`;
     
     roles.forEach(role => {
         const key = `${nextEvent.iso}_${role}`;
         const member = schedule[key];
         if (member) {
             msg += `*${role}:* ${member}\n`;
         }
     });
     
     msg += `\nConfira no app: https://escala-midia-pro.vercel.app`;
     
     const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
     window.open(url, '_blank');
  };

  const getDayStatus = (dateStr: string, memberName: string) => {
    const dates = availability[memberName] || [];
    const entry = dates.find(d => d.startsWith(dateStr));
    if (!entry) return null;
    if (entry.endsWith('_M')) return 'Manhã';
    if (entry.endsWith('_N')) return 'Noite';
    return 'Dia Todo';
  };

  // --- VIEWS ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
       {/* Greeting Section */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">
              Olá, {currentUser?.name.split(' ')[0]} 👋
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
               Bem-vindo ao painel de controle do {getMinistryTitle(ministryId)}.
            </p>
         </div>
         {/* Botões Rápidos (Apenas para não-admin ou ações gerais) */}
       </div>

       {/* Next Event Card */}
       {nextEvent ? (
         <NextEventCard 
            event={nextEvent}
            schedule={schedule}
            attendance={attendance}
            roles={roles}
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
         {/* Events Card */}
         <div onClick={() => setCurrentTab('calendar')} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                 <CalendarIcon size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mês Atual</span>
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{visibleEvents.length} Eventos</h3>
            <p className="text-sm text-zinc-500">Agendados para {getMonthName(currentMonth)}</p>
         </div>

         {/* Members Card */}
         <div onClick={() => currentUser?.role === 'admin' ? setCurrentTab('team') : null} className={`bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all group ${currentUser?.role === 'admin' ? 'cursor-pointer hover:shadow-md' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                 <Users size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Equipe</span>
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{registeredMembers.length} Membros</h3>
            <p className="text-sm text-zinc-500">Cadastrados e ativos no sistema</p>
         </div>
       </div>
    </div>
  );
  
  const renderTeam = () => {
    // Mescla membros oficiais com qualquer outro nome encontrado na lista de todos os membros
    // para garantir que ninguém fique de fora visualmente
    const allUniqueMembers = Array.from(new Set([
        ...registeredMembers.map(m => m.name),
        ...allMembersList // Inclui membros fantasmas que podem ter vindo da disponibilidade
    ])).sort();

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Membros & Equipe</h2>
                    <p className="text-zinc-500 text-sm mt-1">Lista de usuários cadastrados e membros ativos no sistema.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleRefreshList} 
                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" 
                        title="Atualizar Lista"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar membro..." 
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                    <button onClick={() => setRolesModalOpen(true)} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* TABELA UNIFICADA DE MEMBROS */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-3 border-b border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Membros Cadastrados (Login Ativo)</h3>
                </div>
                
                {allUniqueMembers.filter(name => name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-zinc-500">
                        <Users size={48} className="mb-4 opacity-20" />
                        <p>Nenhum membro encontrado.</p>
                        <p className="text-xs mt-2 opacity-60">Os membros aparecerão aqui após realizarem o cadastro. Tente clicar no botão de atualizar.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                        {allUniqueMembers
                            .filter(name => name.toLowerCase().includes(memberSearch.toLowerCase()))
                            .map(name => {
                                const profile = registeredMembers.find(m => m.name === name);
                                const isRegistered = !!profile;
                                
                                // Determina as funções para exibir
                                let displayRoles: string[] = [];
                                
                                // Prioridade 1: Funções do Perfil Oficial
                                if (profile && profile.roles && profile.roles.length > 0) {
                                    displayRoles = profile.roles;
                                } else {
                                    // Prioridade 2: Funções do Mapa Manual (Legado/Fallback)
                                    Object.entries(members).forEach(([role, list]) => {
                                        if ((list as string[]).includes(name)) displayRoles.push(role);
                                    });
                                }

                                return (
                                    <div key={name} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            {/* Avatar */}
                                            {profile?.avatar_url ? (
                                                <img src={profile.avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${isRegistered ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            
                                            <div>
                                                <h4 className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                                    {name}
                                                    {!isRegistered && (
                                                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded border border-orange-200" title="Este membro usa o sistema mas não tem cadastro oficial linkado">
                                                            Não Sincronizado
                                                        </span>
                                                    )}
                                                </h4>
                                                
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-0.5">
                                                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                                        {profile?.id ? `ID: ${profile.id.substring(0, 8)}...` : 'ID: --'}
                                                    </span>
                                                    {profile?.email && (
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                                            <Mail size={12}/> {profile.email}
                                                        </span>
                                                    )}
                                                    {profile?.whatsapp && (
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                                            <Phone size={12}/> {profile.whatsapp}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Roles Badges */}
                                            <div className="flex flex-wrap justify-end gap-1 max-w-[200px]">
                                                {displayRoles.length > 0 ? (
                                                    displayRoles.map(r => (
                                                        <span key={r} className="text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-600">
                                                            {r}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-zinc-400 italic">Sem função</span>
                                                )}
                                            </div>

                                            {/* Delete Button */}
                                            <button 
                                                onClick={() => handleDeleteMember(profile?.id || 'ghost', name)}
                                                className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Excluir Membro"
                                            >
                                                <Trash size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Gerenciamento Rápido de Funções (Visualização legada, mas útil para admin organizar grupos) */}
            <div className="mt-8">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Gerenciamento Rápido de Funções</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {roles.map(role => {
                         // Conta membros nesta função (usando lista consolidada registeredMembers)
                         const count = registeredMembers.filter(m => m.roles && m.roles.includes(role)).length 
                                       + (members[role] || []).filter(m => !registeredMembers.some(rm => rm.name === m)).length;

                         return (
                            <div key={role} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 flex justify-between items-center group">
                                <span className="font-medium text-sm text-zinc-300">{role}</span>
                                <div className="flex items-center gap-2">
                                    <span className="bg-zinc-700 text-xs px-2 py-1 rounded-full text-zinc-400">{count}</span>
                                    <button onClick={() => {
                                        if(confirm(`Excluir a função "${role}"?`)) {
                                            setRoles(prev => prev.filter(r => r !== role));
                                        }
                                    }} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                         );
                    })}
                    <button 
                        onClick={() => setRolesModalOpen(true)}
                        className="border border-dashed border-zinc-700 rounded-lg p-3 flex items-center justify-center gap-2 text-zinc-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm font-medium"
                    >
                        <Plus size={16}/> Nova Função
                    </button>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                    * Para adicionar membros às funções, peça para eles editarem o "Meu Perfil" ou use o gerenciamento rápido.
                </p>
            </div>
        </div>
    );
  };

  // --- RENDER ---
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
         <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm animate-pulse">Carregando sistema...</p>
         </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <ToastProvider>
      <DashboardLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={theme}
        toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
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
      >
        {currentTab === 'dashboard' && renderDashboard()}
        
        {currentTab === 'calendar' && (
          <div className="animate-fade-in space-y-4">
             <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-4">
                   <button onClick={() => {
                       const prev = new Date(year, month - 2, 1);
                       setCurrentMonth(prev.toISOString().slice(0, 7));
                   }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300"><ChevronDown className="rotate-90" size={20}/></button>
                   
                   <h2 className="text-xl font-bold text-zinc-800 dark:text-white capitalize min-w-[140px] text-center">
                      {getMonthName(currentMonth)}
                   </h2>

                   <button onClick={() => {
                       const next = new Date(year, month, 1);
                       setCurrentMonth(next.toISOString().slice(0, 7));
                   }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300"><ChevronDown className="-rotate-90" size={20}/></button>
                </div>
                
                {/* Visual Legend */}
                <div className="hidden md:flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span>Confirmado</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span>Conflito</div>
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span>Aviso IA</div>
                </div>
             </div>

             <ScheduleTable 
                events={visibleEvents}
                roles={roles}
                schedule={schedule}
                attendance={attendance}
                availability={availability}
                members={consolidatedMembers} // Usa a lista consolidada (Manual + Cadastrados)
                allMembers={allMembersList}   // Usa a lista completa de nomes para o grupo "Outros"
                scheduleIssues={scheduleIssues}
                onCellChange={handleCellChange}
                onAttendanceToggle={handleAttendanceToggle}
                onDeleteEvent={handleDeleteEvent}
                memberStats={memberStats}
             />
          </div>
        )}

        {currentTab === 'availability' && (
          <AvailabilityScreen 
            availability={availability} 
            setAvailability={async (newAvail) => {
               setAvailability(newAvail);
               if(ministryId) await saveData(ministryId, 'availability_v1', newAvail);
            }} 
            allMembersList={allMembersList}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            currentUser={currentUser}
            onNotify={(msg) => {
               if(ministryId) sendNotification(ministryId, { title: 'Disponibilidade Atualizada', message: msg, type: 'info' });
            }}
          />
        )}

        {currentTab === 'availability-report' && currentUser?.role === 'admin' && (
           <AvailabilityReportScreen 
              availability={availability}
              registeredMembers={registeredMembers}
              membersMap={members}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              availableRoles={roles}
           />
        )}

        {currentTab === 'editor' && currentUser?.role === 'admin' && (
           <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                 <Edit3 className="text-blue-500"/> Editor de Escala
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <button onClick={() => setEventsModalOpen(true)} className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center gap-3 hover:shadow-md transition-all group">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                       <Clock size={24}/>
                    </div>
                    <div className="text-left">
                       <h3 className="font-bold text-zinc-800 dark:text-white">Gerenciar Eventos</h3>
                       <p className="text-xs text-zinc-500">Adicionar cultos extras ou ocultar datas.</p>
                    </div>
                 </button>

                 <button onClick={() => setRolesModalOpen(true)} className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center gap-3 hover:shadow-md transition-all group">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                       <Settings size={24}/>
                    </div>
                    <div className="text-left">
                       <h3 className="font-bold text-zinc-800 dark:text-white">Configurar Funções</h3>
                       <p className="text-xs text-zinc-500">Adicionar ou remover cargos da equipe.</p>
                    </div>
                 </button>
              </div>

              {/* Botão de Anunciar Escala */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                      <h3 className="text-lg font-bold flex items-center gap-2"><Share2 size={20}/> Anunciar Próximo Evento</h3>
                      {nextEvent ? (
                          <p className="text-blue-100 text-sm mt-1">
                             Compartilhe a escala de <strong>{nextEvent.title}</strong> ({nextEvent.dateDisplay}) no WhatsApp da equipe.
                          </p>
                      ) : (
                          <p className="text-blue-200 text-sm mt-1">Nenhum evento próximo para anunciar.</p>
                      )}
                  </div>
                  <button 
                     onClick={handleShareNextEvent}
                     disabled={!nextEvent}
                     className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl shadow-md hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                     Enviar no WhatsApp
                  </button>
              </div>

              <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                 <h4 className="font-bold flex items-center gap-2"><Wand2 size={16}/> Dica Pro</h4>
                 <p>Use a tabela do Calendário para editar a escala. O sistema salva automaticamente. Se precisar de ajustes finos, clique no ícone de IA nas células para ver sugestões.</p>
              </div>
           </div>
        )}

        {currentTab === 'events' && currentUser?.role === 'admin' && (
           <EventsScreen 
              customEvents={customEvents} 
              setCustomEvents={async (evts) => {
                 setCustomEvents(evts);
                 if(ministryId) await saveData(ministryId, `events_${currentMonth}`, evts);
              }}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
           />
        )}

        {currentTab === 'team' && currentUser?.role === 'admin' && renderTeam()}

        {currentTab === 'stats' && currentUser?.role === 'admin' && (
           <div className="animate-fade-in max-w-4xl mx-auto space-y-6">
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                 <BarChart2 className="text-emerald-500"/> Estatísticas
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <h3 className="font-bold text-zinc-700 dark:text-zinc-300 mb-4">Participação no Mês ({getMonthName(currentMonth)})</h3>
                    <div className="space-y-3">
                       {(Object.entries(memberStats) as [string, number][])
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([name, count]) => (
                             <div key={name} className="flex items-center gap-3">
                                <span className="text-sm font-medium w-24 truncate text-right">{name}</span>
                                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-blue-500" style={{ width: `${(count / 10) * 100}%` }}></div>
                                </div>
                                <span className="text-xs font-bold">{count}</span>
                             </div>
                          ))}
                    </div>
                    <button onClick={() => setStatsModalOpen(true)} className="w-full mt-6 py-2 text-sm text-blue-500 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                       Ver Todos
                    </button>
                 </div>

                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col items-center justify-center text-center">
                    <div className="p-4 bg-zinc-100 dark:bg-zinc-700 rounded-full mb-4">
                       <FileText size={32} className="text-zinc-400"/>
                    </div>
                    <h3 className="font-bold text-zinc-800 dark:text-white">Exportar Relatórios</h3>
                    <p className="text-sm text-zinc-500 mt-2 mb-6 max-w-xs">Baixe a escala completa em PDF ou gere planilhas para análise externa.</p>
                    <ToolsMenu 
                       onExportIndividual={(m) => {
                          const doc = new jsPDF();
                          doc.text(`Escala Individual: ${m}`, 10, 10);
                          // Lógica simples de export
                          doc.save(`escala_${m}.pdf`);
                       }}
                       onExportFull={() => {
                          const doc = new jsPDF();
                          autoTable(doc, {
                             head: [['Data', 'Evento', ...roles]],
                             body: visibleEvents.map(evt => [
                                evt.dateDisplay,
                                evt.title,
                                ...roles.map(r => schedule[`${evt.iso}_${r}`] || '-')
                             ])
                          });
                          doc.save(`escala_${currentMonth}.pdf`);
                       }}
                       onWhatsApp={handleShareNextEvent} // Reusing logic
                       onCSV={() => {}}
                       onImportCSV={() => {}}
                       onClearMonth={() => {}}
                       allMembers={allMembersList}
                    />
                 </div>
              </div>
           </div>
        )}

        {currentTab === 'logs' && currentUser?.role === 'admin' && (
           <div className="animate-fade-in max-w-4xl mx-auto space-y-4">
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                 <Activity className="text-zinc-500"/> Logs do Sistema
              </h2>
              <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-green-400 h-96 overflow-y-auto custom-scrollbar border border-zinc-800 shadow-inner">
                 {auditLog.length === 0 && <span className="text-zinc-600">// Nenhum registro de atividade.</span>}
                 {auditLog.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-zinc-900 pb-1">
                       <span className="text-zinc-500">[{log.date}]</span> <span className="text-yellow-500">{log.action}:</span> {log.details}
                    </div>
                 ))}
              </div>
           </div>
        )}

        {currentTab === 'profile' && (
           <ProfileScreen 
             user={currentUser} 
             onUpdateProfile={handleUpdateProfile}
             availableRoles={roles}
           />
        )}
      </DashboardLayout>

      {/* GLOBAL MODALS */}
      <EventsModal 
         isOpen={eventsModalOpen} 
         onClose={() => setEventsModalOpen(false)}
         events={customEvents}
         hiddenEvents={hiddenEventsList}
         onAdd={async (e) => {
             const newEvts = [...customEvents, e];
             setCustomEvents(newEvts);
             if(ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
         }}
         onRemove={async (id) => {
             const newEvts = customEvents.filter(e => e.id !== id);
             setCustomEvents(newEvts);
             if(ministryId) await saveData(ministryId, `events_${currentMonth}`, newEvts);
         }}
         onRestore={handleRestoreEvent}
      />

      <RolesModal 
         isOpen={rolesModalOpen}
         onClose={() => setRolesModalOpen(false)}
         roles={roles}
         onUpdate={async (newRoles) => {
             setRoles(newRoles);
             if(ministryId) {
                // Salva na config de funções E no mapa de membros (criando chaves vazias se necessário)
                await saveData(ministryId, 'functions_config', newRoles);
                
                // Atualiza members_v7 para garantir que as novas chaves existam
                const currentMap = { ...members };
                newRoles.forEach(r => {
                    if (!currentMap[r]) currentMap[r] = [];
                });
                // (Opcional) Poderíamos remover chaves antigas, mas é mais seguro manter por histórico
                setMembers(currentMap);
                await saveData(ministryId, 'members_v7', currentMap);
             }
         }}
      />

      <StatsModal 
         isOpen={statsModalOpen}
         onClose={() => setStatsModalOpen(false)}
         stats={memberStats}
         monthName={getMonthName(currentMonth)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal 
         isOpen={!!confirmationData}
         onClose={() => setConfirmationData(null)}
         data={confirmationData}
         onConfirm={() => {
            if(confirmationData) handleAttendanceToggle(confirmationData.key);
            setConfirmationData(null);
            addToast("Presença confirmada!", "success");
         }}
      />
    </ToastProvider>
  );
};

export default AppContent;
