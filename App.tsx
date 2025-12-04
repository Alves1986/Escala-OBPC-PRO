
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
import { loadData, saveData, getSupabase, logout, updateUserProfile, syncMemberProfile, deleteMember } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Calendar as CalendarIcon, 
  BarChart2, 
  Shield, 
  Activity, 
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
  Plus
} from 'lucide-react';
import { NextEventCard } from './components/NextEventCard';
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

const AppInner = () => {
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
  const [registeredMembers, setRegisteredMembers] = useState<TeamMemberProfile[]>([]);
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
    Object.values(members).forEach((arr) => {
      if (Array.isArray(arr)) (arr as string[]).forEach(m => list.add(m));
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

      // Extrai os resultados com segurança
      const resMembers = results[0];
      const resSchedule = results[1];
      const resAvail = results[2];
      const resEvents = results[3];
      const resRoles = results[4];
      const resLogs = results[5];
      const resIgnored = results[6];
      const resAttend = results[7];
      const resNotif = results[8];
      const resRegMembers = results[9];

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
        
        const amIInList = registeredMembers.some(m => 
            (m.id && currentUser.id && m.id === currentUser.id) || 
            (m.email && currentUser.email && m.email === currentUser.email) ||
            m.name === currentUser.name
        );

        if (!amIInList && registeredMembers) {
            console.log("Self-Healing: Usuário atual não encontrado na lista. Forçando sincronização...");
            const updatedList = await syncMemberProfile(ministryId, currentUser);
            if (updatedList.length > 0) {
                setRegisteredMembers(updatedList);
                addToast("Perfil sincronizado com a equipe!", "success");
            }
        }
    };

    const timeout = setTimeout(checkAndFixMembership, 3000);
    return () => clearTimeout(timeout);
  }, [currentUser, ministryId, registeredMembers]);

  // --- POLLING & SYNC ---
  useEffect(() => {
      if (!ministryId) return;

      const pollData = async () => {
          try {
              const latestNotifs = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
              if (JSON.stringify(latestNotifs) !== JSON.stringify(notifications)) {
                  setNotifications(latestNotifs);
                  const newUnread = latestNotifs.filter(n => !n.read && !notifications.some(old => old.id === n.id));
                  if (newUnread.length > 0) {
                      addToast(newUnread[0].title, "info");
                  }
              }

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

      const interval = setInterval(pollData, 15000);
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
        const key = `${nextEvent.iso}_${role}`;
        const memberName = schedule[key];
        if (memberName) {
            message += `▪️ *${role}:* ${memberName}\n`;
            hasMembers = true;
        }
    });

    if (!hasMembers) message += `_(Ninguém escalado ainda)_\n`;
    
    message += `\n✅ Confirme sua presença no App!`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // --- VIEWS ---
  const renderDashboard = () => (
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

  const renderTeam = () => (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
           <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Membros & Equipe</h2>
           <p className="text-zinc-500 text-sm">Lista de usuários cadastrados e membros ativos no sistema.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleRefreshList} 
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg flex items-center justify-center transition-colors"
                title="Atualizar Lista"
            >
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

      {/* Lista de Membros Registrados */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
         <div className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Membros Cadastrados (Login Ativo)</h3>
         </div>
         
         <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
             {registeredMembers.length === 0 ? (
                 <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center">
                     <Users size={48} className="mb-3 opacity-20"/>
                     <p>Nenhum membro encontrado.</p>
                     <p className="text-xs mt-1">Os membros aparecerão aqui após realizarem o cadastro. Tente clicar no botão de atualizar.</p>
                 </div>
             ) : (
                 registeredMembers
                    .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                    .map(member => (
                     <div key={member.id} className="p-4 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                         <div className="flex items-center gap-4">
                             {member.avatar_url ? (
                                 <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                             ) : (
                                 <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                     {member.name.charAt(0).toUpperCase()}
                                 </div>
                             )}
                             <div>
                                 <h4 className="font-bold text-zinc-800 dark:text-zinc-100">{member.name}</h4>
                                 <p className="text-xs text-zinc-500">ID: {member.id.substring(0,8)}...</p>
                             </div>
                         </div>
                         
                         <div className="hidden md:block text-sm text-zinc-600 dark:text-zinc-400">
                             {member.email && <div className="flex items-center gap-2"><Mail size={14}/> {member.email}</div>}
                             {member.whatsapp && <div className="flex items-center gap-2 mt-1"><Phone size={14}/> {member.whatsapp}</div>}
                         </div>

                         <div className="flex items-center gap-4">
                             <div className="text-right">
                                {member.roles && member.roles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                        {member.roles.map(r => (
                                            <span key={r} className="text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 font-medium">
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs text-zinc-400 italic">Sem função</span>
                                )}
                             </div>
                             
                             <button 
                                onClick={() => handleDeleteMember(member.id, member.name)}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Excluir Membro"
                             >
                                <Trash2 size={18} />
                             </button>
                         </div>
                     </div>
                 ))
             )}
         </div>
      </div>

      {/* Gerenciamento Rápido de Funções (Legado/Manual) */}
      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Gerenciamento Rápido de Funções</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
            <div key={role} className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-zinc-700 dark:text-zinc-200">{role}</h4>
                    <div className="flex gap-2">
                        <span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-600 dark:text-zinc-400">
                            {(members[role] || []).length}
                        </span>
                        <button 
                            onClick={() => {
                                if(confirm(`Excluir a função "${role}"?`)) {
                                    setRoles(roles.filter(r => r !== role));
                                }
                            }}
                            className="text-zinc-400 hover:text-red-500"
                        >
                            <Trash2 size={16}/>
                        </button>
                    </div>
                </div>
                
                {/* Visualização de Membros na Função (Somente Leitura) */}
                <div className="flex flex-wrap gap-1 mb-2">
                    {(members[role] || []).map(m => (
                        <span key={m} className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400">
                            {m}
                        </span>
                    ))}
                </div>

                <button 
                    onClick={() => {
                        const name = prompt(`Adicionar membro em ${role}:`);
                        if (name) {
                            const current = members[role] || [];
                            if (!current.includes(name)) {
                                const newMap = { ...members, [role]: [...current, name] };
                                setMembers(newMap);
                                if(ministryId) saveData(ministryId, 'members_v7', newMap);
                            }
                        }
                    }}
                    className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    + Adicionar Manualmente
                </button>
                <p className="text-[10px] text-zinc-400 mt-2 text-center">* Para adicionar membros às funções, use a coluna "Funções na Escala" (lógica a ser implementada) ou adicione manualmente no editor.</p>
            </div>
            ))}
            
            <button 
                onClick={() => setRolesModalOpen(true)}
                className="flex items-center justify-center p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
            >
                <div className="flex flex-col items-center gap-2">
                    <Plus size={24}/>
                    <span className="font-bold">+ Nova Função</span>
                </div>
            </button>
        </div>
      </div>
    </div>
  );

  if (sessionLoading) {
      return (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
      );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  return (
    <DashboardLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      theme={theme}
      toggleTheme={() => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        if (newTheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      }}
      onLogout={async () => {
        await logout();
        setCurrentUser(null);
      }}
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
           <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <button onClick={() => {
                    const prev = new Date(year, month - 2, 1);
                    setCurrentMonth(prev.toISOString().slice(0, 7));
                 }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors text-zinc-600 dark:text-zinc-400">
                    ←
                 </button>
                 <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[100px] text-center capitalize">
                    {getMonthName(currentMonth)}
                 </span>
                 <button onClick={() => {
                    const next = new Date(year, month, 1);
                    setCurrentMonth(next.toISOString().slice(0, 7));
                 }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors text-zinc-600 dark:text-zinc-400">
                    →
                 </button>
              </div>

              {currentUser.role === 'admin' && (
                 <ToolsMenu 
                    allMembers={allMembersList}
                    onExportIndividual={(member) => {
                        const doc = new jsPDF();
                        doc.text(`Escala Individual - ${member}`, 14, 20);
                        doc.text(`Mês: ${getMonthName(currentMonth)}`, 14, 30);
                        
                        const data: any[] = [];
                        visibleEvents.forEach(evt => {
                           roles.forEach(role => {
                               if (schedule[`${evt.iso}_${role}`] === member) {
                                   data.push([evt.dateDisplay, evt.title, role]);
                               }
                           });
                        });
                        
                        autoTable(doc, {
                            head: [['Data', 'Evento', 'Função']],
                            body: data,
                            startY: 40
                        });
                        doc.save(`escala_${member}.pdf`);
                    }} 
                    onExportFull={() => {
                        const doc = new jsPDF('l', 'mm', 'a4');
                        doc.setFontSize(16);
                        doc.text(`Escala Geral - ${getMonthName(currentMonth)}`, 14, 20);
                        
                        const head = [['Data', 'Evento', ...roles]];
                        const body = visibleEvents.map(evt => {
                            const row = [evt.dateDisplay, evt.title];
                            roles.forEach(role => {
                                row.push(schedule[`${evt.iso}_${role}`] || '-');
                            });
                            return row;
                        });

                        autoTable(doc, {
                            head: head,
                            body: body,
                            startY: 30,
                            styles: { fontSize: 8 },
                        });
                        doc.save(`escala_${currentMonth}.pdf`);
                    }}
                    onWhatsApp={handleShareNextEvent}
                    onCSV={() => {
                        const headers = ['Data', 'Evento', ...roles].join(',');
                        const rows = visibleEvents.map(evt => {
                            const row = [evt.dateDisplay, evt.title];
                            roles.forEach(role => row.push(schedule[`${evt.iso}_${role}`] || ''));
                            return row.join(',');
                        }).join('\n');
                        const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + rows;
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `escala_${currentMonth}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    onImportCSV={(file) => {
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const text = e.target?.result as string;
                            const lines = text.split('\n');
                            const newMembers = { ...members };
                            lines.forEach(line => {
                                const [name, role] = line.split(',').map(s => s.trim());
                                if (name && role) {
                                    if (!newMembers[role]) newMembers[role] = [];
                                    if (!newMembers[role].includes(name)) newMembers[role].push(name);
                                }
                            });
                            setMembers(newMembers);
                            if(ministryId) await saveData(ministryId, 'members_v7', newMembers);
                            addToast("Membros importados!", "success");
                        };
                        reader.readAsText(file);
                    }}
                    onClearMonth={async () => {
                        if(confirm("Limpar toda a escala deste mês?")) {
                            const newSchedule = { ...schedule };
                            Object.keys(newSchedule).forEach(k => {
                                if(k.startsWith(currentMonth)) delete newSchedule[k];
                            });
                            setSchedule(newSchedule);
                            if(ministryId) await saveData(ministryId, `schedule_${currentMonth}`, newSchedule);
                            addToast("Mês limpo.", "info");
                        }
                    }}
                 />
              )}
           </div>

           <ScheduleTable 
              events={visibleEvents}
              roles={roles}
              schedule={schedule}
              attendance={attendance}
              availability={availability}
              members={consolidatedMembers}
              allMembers={allMembersList}
              scheduleIssues={scheduleIssues}
              onCellChange={handleCellChange}
              onAttendanceToggle={handleAttendanceToggle}
              onDeleteEvent={handleDeleteEvent}
              memberStats={memberStats}
           />
           
           <div className="flex flex-wrap gap-2 text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Presença Confirmada</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Conflito de Horário</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Aviso IA</span>
           </div>
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
            onNotify={(msg) => {
                if(ministryId) {
                    import('./services/supabaseService').then(s => {
                        s.sendNotification(ministryId, {
                            type: 'info',
                            title: 'Disponibilidade Atualizada',
                            message: msg
                        });
                    });
                }
            }}
         />
      )}

      {currentTab === 'editor' && currentUser?.role === 'admin' && (
        <div className="animate-fade-in space-y-4">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-4">Editor de Escala</h2>
            <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                    Ferramentas avançadas para gerenciamento da escala.
                </p>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors">
                        <Clock size={18}/> Gerenciar Eventos Extras
                    </button>
                    <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors">
                        <Shield size={18}/> Gerenciar Indisponibilidade (Admin)
                    </button>
                    <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors">
                        <Settings size={18}/> Editar Funções
                    </button>
                </div>

                <div className="mt-8 border-t border-zinc-200 dark:border-zinc-700 pt-6">
                    <h3 className="font-bold text-lg text-zinc-800 dark:text-white mb-2">Anunciar Próximo Evento</h3>
                    <p className="text-sm text-zinc-500 mb-4">Envie a escala do próximo culto para o WhatsApp do grupo.</p>
                    
                    {nextEvent ? (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-green-800 dark:text-green-300">{nextEvent.title}</p>
                                <p className="text-xs text-green-600 dark:text-green-400">{nextEvent.dateDisplay}</p>
                            </div>
                            <button 
                                onClick={handleShareNextEvent}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Phone size={18}/> Enviar no WhatsApp
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500 text-sm italic">
                            Nenhum evento próximo encontrado para anunciar.
                        </div>
                    )}
                </div>
            </div>
        </div>
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
         <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Estatísticas</h2>
            <button onClick={() => setStatsModalOpen(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 shadow-lg">
                Ver Gráfico de Participação
            </button>
         </div>
      )}

      {currentTab === 'logs' && currentUser?.role === 'admin' && (
         <div className="p-4 max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold mb-4">Logs do Sistema</h2>
             <div className="bg-zinc-900 text-zinc-300 p-4 rounded-xl font-mono text-xs h-[500px] overflow-y-auto custom-scrollbar">
                 {auditLog.map((log, i) => (
                     <div key={i} className="mb-2 border-b border-zinc-800 pb-2">
                         <span className="text-zinc-500">[{log.date}]</span> <span className="text-blue-400">{log.action}:</span> {log.details}
                     </div>
                 ))}
             </div>
         </div>
      )}
      
      {currentTab === 'profile' && currentUser && (
         <ProfileScreen 
            user={currentUser} 
            onUpdateProfile={handleUpdateProfile}
            availableRoles={roles}
         />
      )}

      {/* MODALS */}
      <ConfirmationModal 
         isOpen={!!confirmationData}
         onClose={() => setConfirmationData(null)}
         data={confirmationData}
         onConfirm={async () => {
             if (confirmationData && ministryId) {
                 await handleAttendanceToggle(confirmationData.key);
                 setConfirmationData(null);
                 addToast("Presença confirmada!", "success");
             }
         }}
      />

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

      <AvailabilityModal 
        isOpen={availModalOpen} 
        onClose={() => setAvailModalOpen(false)} 
        members={Object.keys(availability)}
        availability={availability}
        currentMonth={currentMonth}
        onUpdate={async (m, dates) => {
            const newAvail = { ...availability, [m]: dates };
            setAvailability(newAvail);
            if(ministryId) await saveData(ministryId, 'availability_v1', newAvail);
        }}
      />

      <RolesModal 
        isOpen={rolesModalOpen} 
        onClose={() => setRolesModalOpen(false)} 
        roles={roles}
        onUpdate={async (r) => {
            setRoles(r);
            if(ministryId) {
                await saveData(ministryId, 'functions_config', r);
                // Also update legacy roles map to keep keys consistent
                const newMembers = { ...members };
                r.forEach(role => { if(!newMembers[role]) newMembers[role] = []; });
                await saveData(ministryId, 'members_v7', newMembers);
            }
        }}
      />

      <AuditModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={auditLog} />
      <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={memberStats} monthName={getMonthName(currentMonth)} />
      
      {/* Event Details (Click on Event Name to Edit) Not implemented in table click yet, but component exists */}
    </DashboardLayout>
  );
};

// --- MAIN APP WRAPPER ---
// Fixes "useToast must be used within a ToastProvider" error
const App = () => {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
};

export default App;
