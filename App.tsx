
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
  Trash
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { NextEventCard } from './components/NextEventCard';
import { NotificationToggle } from './components/NotificationToggle';
import { ConfirmationModal } from './components/ConfirmationModal';

// --- NAVIGATION ITEMS ---
const MAIN_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20} /> },
  { id: 'availability', label: 'Disponibilidade', icon: <Shield size={20} /> },
];

const MANAGEMENT_NAV_ITEMS = [
  { id: 'editor', label: 'Editor de Escala', icon: <Edit3 size={20} /> },
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  
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

  // --- DERIVED STATE ---
  const [year, month] = currentMonth.split('-').map(Number);
  
  const { visibleEvents } = useMemo(() => {
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
    
    // 1. Members from Role Map (Legacy/Manual)
    Object.values(members).forEach(arr => {
      if (Array.isArray(arr)) arr.forEach(m => list.add(m));
    });

    // 2. Members from Registered List (Auth)
    registeredMembers.forEach(m => list.add(m.name));

    // 3. Members from Availability Map (Ghost members who saved data)
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
  };

  // --- AUTH EFFECT ---
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) updateSession(session.user);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) updateSession(session.user);
      else { setCurrentUser(null); setMinistryId(null); }
      setSessionLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const updateSession = (user: any) => {
      const meta = user.user_metadata;
      setCurrentUser({
          id: user.id,
          email: user.email,
          name: meta.name || 'Usuário',
          role: meta.role || 'member',
          ministryId: meta.ministryId,
          whatsapp: meta.whatsapp,
          avatar_url: meta.avatar_url,
          functions: meta.functions || []
      });
      setMinistryId(meta.ministryId);
  }

  // --- PWA EFFECTS (UPDATED) ---
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    
    const handler = (e: any) => { 
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault(); 
        // Stash the event so it can be triggered later.
        setInstallPrompt(e); 
        console.log("PWA Install Prompt captured");
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setInstallPrompt(null);
  };

  // --- DATA LOADING & SAVING ---
  useEffect(() => {
    if (ministryId) {
      setLoading(true);
      const loadAll = async () => {
        try {
          // Use Promise.allSettled to ensure that one failure doesn't break the whole app
          const results = await Promise.allSettled([
            loadData<MemberMap>(ministryId, 'members_v7', {}),
            loadData<ScheduleMap>(ministryId, 'escala_full_v7', {}),
            loadData<AttendanceMap>(ministryId, 'attendance_v1', {}),
            loadData<CustomEvent[]>(ministryId, 'custom_events_v1', []),
            loadData<string[]>(ministryId, 'ignored_events_v1', []),
            loadData<AvailabilityMap>(ministryId, 'availability_v1', {}),
            loadData<string[]>(ministryId, 'functions_config', DEFAULT_ROLES),
            loadData<AuditLogEntry[]>(ministryId, 'audit_log_v1', []),
            loadData<'light'|'dark'>(ministryId, 'theme_pref', 'dark'),
            loadData<AppNotification[]>(ministryId, 'notifications_v1', []),
            loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', [])
          ]);

          // Helper to safely extract value or fallback
          const unwrap = <T,>(index: number, fallback: T): T => {
            const res = results[index];
            return res.status === 'fulfilled' ? (res.value as T) : fallback;
          };

          const m = unwrap<MemberMap>(0, {});
          const s = unwrap<ScheduleMap>(1, {});
          const a = unwrap<AttendanceMap>(2, {});
          const c = unwrap<CustomEvent[]>(3, []);
          const ig = unwrap<string[]>(4, []);
          const av = unwrap<AvailabilityMap>(5, {});
          const r = unwrap<string[]>(6, DEFAULT_ROLES);
          const lg = unwrap<AuditLogEntry[]>(7, []);
          const th = unwrap<'light'|'dark'>(8, 'dark');
          const notif = unwrap<AppNotification[]>(9, []);
          const regMem = unwrap<TeamMemberProfile[]>(10, []);

          setMembers(Object.keys(m).length === 0 ? (() => {const i:any={}; DEFAULT_ROLES.forEach(r=>i[r]=[]); return i})() : m);
          setSchedule(s); 
          setAttendance(a); 
          setCustomEvents(c); 
          setIgnoredEvents(ig); 
          setAvailability(av); 
          setRoles(r); 
          setAuditLog(lg); 
          setTheme(th); 
          setNotifications(notif); 
          setRegisteredMembers(regMem);
          setIsConnected(true);

          if (currentUser && currentUser.email) {
             const isInList = regMem.some(mem => 
                (mem.email && mem.email.toLowerCase() === currentUser.email?.toLowerCase()) || 
                mem.name === currentUser.name
             );

             if (!isInList) {
                 syncMemberProfile(ministryId, currentUser).then(newList => {
                     if (newList.length > 0) setRegisteredMembers(newList);
                 });
             }
          }

        } catch (e) { 
          // This catch block is now a safeguard for critical failures outside promises
          console.error("Critical error loading data:", e);
          addToast("Erro parcial ao carregar dados", "warning"); 
          setIsConnected(false); 
        } 
        finally { setLoading(false); }
      };
      loadAll();
    }
  }, [ministryId, currentUser]);

  // --- BACKGROUND SYNC ---
  useEffect(() => {
    if (!ministryId) return;

    const runSync = async () => {
       try {
          const remoteNotifs = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
          setNotifications(current => {
             if (remoteNotifs.length > 0) {
                 const latestRemote = remoteNotifs[0];
                 const latestLocal = current.length > 0 ? current[0] : null;
                 if ((!latestLocal || latestRemote.id !== latestLocal.id) && !latestRemote.read) {
                     setTimeout(() => addToast(latestRemote.title, 'info'), 100);
                 }
                 if (JSON.stringify(current) !== JSON.stringify(remoteNotifs)) return remoteNotifs;
             }
             return current;
          });

          if (currentTab === 'team') {
             const remoteMembers = await loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []);
             if (remoteMembers.length > 0) {
                 setRegisteredMembers(current => {
                    if (JSON.stringify(current) !== JSON.stringify(remoteMembers)) return remoteMembers;
                    return current;
                 });
             }
             const remoteAvail = await loadData<AvailabilityMap>(ministryId, 'availability_v1', {});
             setAvailability(current => {
                 if (JSON.stringify(current) !== JSON.stringify(remoteAvail)) return remoteAvail;
                 return current;
             });
          }
       } catch (e) {
          console.error("Erro no sync de background", e);
       }
    };
    runSync();
    const timer = setInterval(runSync, 15000);
    return () => clearInterval(timer);
  }, [ministryId, currentTab]); 

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // --- URL PARAM CONFIRMATION HANDLING ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('a') === 'c' && params.get('k') && params.get('n')) {
      setConfirmationData({
        key: params.get('k'),
        memberName: params.get('n'),
        role: params.get('k')?.split('_')[1],
        date: params.get('k')?.split('_')[0].replace('T', ' '),
        eventName: 'Evento da Escala'
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // --- NOTIFICATION OF THE DAY ---
  useEffect(() => {
    if (!nextEvent) return;
    const today = new Date().toISOString().split('T')[0];
    const eventDate = nextEvent.iso.split('T')[0];
    const lastNotified = localStorage.getItem('last_notified_event');

    if (today === eventDate && lastNotified !== nextEvent.iso) {
      addToast(`Hoje tem ${nextEvent.title}! Envie a escala.`, 'info');
      localStorage.setItem('last_notified_event', nextEvent.iso);
    }
  }, [nextEvent]);

  const handleLogout = async () => {
    if (confirm("Sair do sistema?")) { await logout(); setMinistryId(null); setCurrentUser(null); setSchedule({}); setMembers({}); }
  };

  const handleUpdateProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[]) => {
      const res = await updateUserProfile(name, whatsapp, avatar_url, functions);
      if (res.success) {
          addToast(res.message, "success");
          if (currentUser) {
              const updatedUser = { ...currentUser, name, whatsapp, avatar_url, functions: functions || currentUser.functions };
              setCurrentUser(updatedUser);
              if (ministryId) {
                  // Sincroniza lista pública e estado
                  const newList = await syncMemberProfile(ministryId, updatedUser);
                  setRegisteredMembers(newList);
                  
                  // Recarrega o mapa de membros (members_v7) para refletir as novas funções imediatamente na UI
                  const updatedMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
                  setMembers(updatedMap);
              }
          }
      } else {
          addToast(res.message, "error");
      }
  };

  const saveAll = async () => {
    const mid = ministryId;
    if (!mid) return;
    setLoading(true);
    try {
      await Promise.all([
        saveData(mid, 'members_v7', members),
        saveData(mid, 'escala_full_v7', schedule),
        saveData(mid, 'attendance_v1', attendance),
        saveData(mid, 'custom_events_v1', customEvents),
        saveData(mid, 'ignored_events_v1', ignoredEvents),
        saveData(mid, 'availability_v1', availability),
        saveData(mid, 'functions_config', roles),
        saveData(mid, 'audit_log_v1', auditLog),
        saveData(mid, 'theme_pref', theme),
        saveData(mid, 'notifications_v1', notifications)
      ]);
      addToast("Dados salvos na nuvem!", "success");
    } catch (e) { addToast("Erro ao salvar", "error"); } 
    finally { setLoading(false); }
  };
  
  const notify = async (type: 'info' | 'success' | 'warning' | 'alert', title: string, message: string) => {
      if (ministryId) {
          await sendNotification(ministryId, { type, title, message });
          const newNotif: AppNotification = { id: Date.now().toString(), timestamp: new Date().toISOString(), read: false, type, title, message };
          setNotifications(prev => [newNotif, ...prev]);
      }
  };

  const updateCell = (key: string, value: string) => {
    setSchedule(prev => ({ ...prev, [key]: value }));
    if (attendance[key]) {
       const newAtt = { ...attendance };
       delete newAtt[key];
       setAttendance(newAtt);
    }
  };

  const toggleAttendance = (key: string) => {
    const mid = ministryId;
    if (!mid) return;
    const newVal = !attendance[key];
    const newAtt = { ...attendance, [key]: newVal };
    setAttendance(newAtt);
    saveData(mid, 'attendance_v1', newAtt);
    
    if (newVal) {
        addToast("Presença confirmada", "success");
        const memberName = schedule[key] || "Alguém";
        const [iso, role] = key.split('_');
        const dateDisplay = iso.split('T')[0].split('-').reverse().join('/');
        notify('success', 'Presença Confirmada', `${memberName} confirmou presença para o dia ${dateDisplay} (${role}).`);
    } else {
        addToast("Confirmação removida", "info");
    }
  };

  const handleConfirmPresence = () => {
    if (!confirmationData || !ministryId) return;
    const { key, memberName, date } = confirmationData;
    const mid = ministryId;
    const newAtt = { ...attendance, [key]: true };
    setAttendance(newAtt);
    saveData(mid, 'attendance_v1', newAtt);
    addToast("Presença confirmada!", "success");
    notify('success', 'Presença Confirmada (Link)', `${memberName} confirmou presença via link para ${date}.`);
    setConfirmationData(null);
  };
  
  const handleSwapRequest = async (eventTitle: string, currentMember: string) => {
      await notify('warning', 'Solicitação de Troca', `${currentMember} solicitou troca para o evento ${eventTitle}.`);
      addToast("Solicitação de troca enviada ao líder.", "success");
  };

  const handleShareNextEvent = () => {
     if (!nextEvent) return;
     
     const assigned: { role: string; name: string; key: string }[] = [];
     roles.forEach(role => {
       const key = `${nextEvent.iso}_${role}`;
       const member = schedule[key];
       if (member) assigned.push({ role, name: member, key });
     });

     const url = new URL(window.location.href);
     url.search = ''; 
     url.hash = '';
     
     const time = nextEvent.iso.split('T')[1];

     let text = `📢 PRÓXIMO EVENTO - MINISTÉRIO DE MÍDIA 📢\n\n`;
     text += `🗓 ${nextEvent.title}\n`;
     text += `🕒 Data: ${nextEvent.dateDisplay} às ${time}\n\n`;
     text += `👥 Equipe Escalada:\n`;
     
     if (assigned.length === 0) {
       text += `_(Ninguém escalado ainda)_\n`;
     } else {
       assigned.forEach(t => {
         url.searchParams.set('a', 'c');
         url.searchParams.set('k', t.key);
         url.searchParams.set('n', t.name);
         const confirmLink = url.toString();
         text += `▪ ${t.role}: ${t.name}\n`;
         text += `   🔗 Confirme: <${confirmLink}>\n\n`;
       });
     }
     text += `🙏🏻 Deus Abençoe a Todos, tenham um ótimo culto.`;
     
     const waUrl = new URL("https://wa.me/");
     waUrl.searchParams.set("text", text);
     window.open(waUrl.toString(), "_blank");
  };

  const handleUpdateEvent = (oldIso: string, newTitle: string, newTime: string) => {
    if (!ministryId) return;
    const datePart = oldIso.split('T')[0];
    const newIso = `${datePart}T${newTime}`;

    if (newIso === oldIso && newTitle === selectedEvent?.title) {
        setSelectedEvent(null);
        return;
    }
    const existingCustom = customEvents.find(c => `${c.date}T${c.time}` === oldIso);
    let newCustomEvents = [...customEvents];
    let newIgnored = [...ignoredEvents];

    if (existingCustom) {
        newCustomEvents = customEvents.map(c => c.id === existingCustom.id ? { ...c, time: newTime, title: newTitle } : c);
    } else {
        newIgnored.push(oldIso);
        newCustomEvents.push({
            id: Date.now().toString(),
            date: datePart,
            time: newTime,
            title: newTitle
        });
    }

    setCustomEvents(newCustomEvents);
    setIgnoredEvents(newIgnored);
    saveData(ministryId, 'custom_events_v1', newCustomEvents);
    saveData(ministryId, 'ignored_events_v1', newIgnored);

    const newSchedule = { ...schedule };
    const newAttendance = { ...attendance };
    roles.forEach(role => {
        const oldKey = `${oldIso}_${role}`;
        const newKey = `${newIso}_${role}`;
        if (newSchedule[oldKey]) { newSchedule[newKey] = newSchedule[oldKey]; delete newSchedule[oldKey]; }
        if (newAttendance[oldKey]) { newAttendance[newKey] = newAttendance[oldKey]; delete newAttendance[oldKey]; }
    });

    setSchedule(newSchedule);
    setAttendance(newAttendance);
    saveData(ministryId, 'escala_full_v7', newSchedule);
    saveData(ministryId, 'attendance_v1', newAttendance);
    addToast("Evento e horários atualizados!", "success");
    setSelectedEvent(null);
  };

  const exportPDF = (memberFilter?: string) => {
    const doc = new jsPDF('landscape'); 
    const [y, m] = currentMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1);
    const monthFull = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const title = `Escala - ${monthFull.charAt(0).toUpperCase() + monthFull.slice(1)} de ${y}`;
    doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text(title, 14, 15);
    const head = [['Data', 'Evento', ...roles]];
    const body = visibleEvents.map(evt => [evt.dateDisplay, evt.title, ...roles.map(r => schedule[`${evt.iso}_${r}`] || '-')]);
    if (memberFilter) { doc.setFontSize(12); doc.setTextColor(80, 80, 80); doc.text(`Filtro: ${memberFilter}`, 14, 22); }
    autoTable(doc, { startY: 25, head: head, body: body, theme: 'grid', styles: { fontSize: 10, cellPadding: 3 }, headStyles: { fillColor: [26, 188, 156], textColor: [255, 255, 255] } });
    doc.save(`Escala_${currentMonth}.pdf`);
  };

  const generateAI = async () => {
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) return addToast("Chave API não configurada", "error");
    setLoading(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey as string });
      const prompt = `Gere uma escala para ${currentMonth}. Eventos: ${JSON.stringify(visibleEvents.map(e => ({date:e.iso, title:e.title})))}. Funções: ${JSON.stringify(roles)}. Membros: ${JSON.stringify(members)}. Indisponibilidade: ${JSON.stringify(availability)}. Histórico: ${JSON.stringify(memberStats)}. Retorne JSON: {"YYYY-MM-DDTHH:mm_Funcao": "Nome"}`;
      const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
      setSchedule(prev => ({ ...prev, ...JSON.parse(response.text || '{}') }));
      addToast("Escala gerada com IA!", "success");
      logAction("IA", "Escala gerada automaticamente.");
    } catch (e) { addToast("Erro na IA.", "error"); } finally { setLoading(false); }
  };

  const analyzeSchedule = async () => {
     const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY as string | undefined;
     if (!apiKey) return addToast("Chave API não configurada", "error");
     setLoading(true);
     try {
       const genAI = new GoogleGenAI({ apiKey: apiKey as string });
       const prompt = `Analise esta escala. Escala: ${JSON.stringify(schedule)}. Membros: ${JSON.stringify(members)}. Indisponibilidade: ${JSON.stringify(availability)}. Retorne JSON: {"key": {"type": "error"|"warning", "message": "...", "suggestedReplacement": "Nome"}}`;
       const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
       if (response.text) setScheduleIssues(JSON.parse(response.text));
       addToast("Análise concluída!", "success");
     } catch (e) { addToast("Erro na análise.", "error"); } finally { setLoading(false); }
  };

  // --- RENDER VIEWS ---

  const renderMonthSelector = () => (
    <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
      <button onClick={() => { const prev = new Date(year, month - 2, 1); setCurrentMonth(prev.toISOString().slice(0, 7)); }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
      <div className="text-center min-w-[120px]">
        <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
        <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
      </div>
      <button onClick={() => { const next = new Date(year, month, 1); setCurrentMonth(next.toISOString().slice(0, 7)); }} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Visão Geral</h2>
         {renderMonthSelector()}
      </div>

      {nextEvent ? (
        <NextEventCard 
          event={nextEvent} schedule={schedule} attendance={attendance} roles={roles}
          onConfirm={(key) => { 
              const mid = ministryId; 
              if (!mid) return; 
              if (confirm("Confirmar presença manualmente?")) { 
                  const newVal = !attendance[key]; 
                  setAttendance({...attendance, [key]: newVal}); 
                  saveData(mid, 'attendance_v1', {...attendance, [key]: newVal});
                  
                  if (newVal) {
                      const mName = schedule[key];
                      notify('success', 'Confirmação Manual', `Presença de ${mName} confirmada manualmente no dashboard.`);
                  }
              } 
          }}
        />
      ) : (
        <div className="p-8 text-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
           <p className="text-zinc-500">Nenhum evento próximo agendado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Eventos no Mês</h3>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{visibleEvents.length}</p>
         </div>
         <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Membros Ativos</h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{allMembersList.length}</p>
         </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
         <div className="flex items-center gap-4">
             <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Editor de Escala</h2>
             {renderMonthSelector()}
         </div>
         <div className="flex flex-wrap items-center gap-2">
           <button onClick={generateAI} className="flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> IA</button>
           <button onClick={analyzeSchedule} className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"><BrainCircuit size={14}/> Analisar</button>
           
           <ToolsMenu 
             onExportIndividual={(m) => exportPDF(m)}
             onExportFull={() => exportPDF()}
             onWhatsApp={() => {
                let text = `*ESCALA MÍDIA - ${getMonthName(currentMonth).toUpperCase()}*\n\n`;
                visibleEvents.forEach(evt => {
                  text += `📅 *${evt.dateDisplay} - ${evt.title} (${evt.iso.split('T')[1]})*\n`;
                  roles.forEach(r => { const w = schedule[`${evt.iso}_${r}`]; if(w) text += `   ▪ ${r}: ${w}\n`; });
                  text += `\n`;
                });
                const url = new URL("https://wa.me/");
                url.searchParams.set("text", text);
                window.open(url.toString(), "_blank");
             }}
             onCSV={() => {
                let csv = `Data,Evento,${roles.join(',')}\n`;
                visibleEvents.forEach(evt => {
                  const row = [evt.dateDisplay, evt.title, ...roles.map(r => schedule[`${evt.iso}_${r}`] || '')];
                  csv += row.join(',') + '\n';
                });
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `escala.csv`; a.click();
             }}
             onImportCSV={() => {}} 
             onClearMonth={() => { if(confirm("Limpar mês?")) { const ns = {...schedule}; Object.keys(ns).forEach(k => k.startsWith(currentMonth) && delete ns[k]); setSchedule(ns); } }}
             allMembers={allMembersList}
           />
           <button onClick={saveAll} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-600/20">{loading ? '...' : 'Salvar'}</button>
         </div>
      </div>
      
      {/* ADMIN SHARE ACTION FOR NEXT EVENT */}
      {nextEvent && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                  <Share2 size={20} />
              </div>
              <div>
                  <h3 className="font-bold text-blue-800 dark:text-blue-200 text-sm">Próximo Evento: {nextEvent.title}</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{nextEvent.dateDisplay} • Enviar escala para equipe</p>
              </div>
           </div>
           <button 
             onClick={handleShareNextEvent}
             className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md shadow-green-600/20 flex items-center gap-2 transition-transform active:scale-95"
           >
              <Share2 size={14}/> Enviar no WhatsApp
           </button>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
         <ScheduleTable 
            events={visibleEvents} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={members} scheduleIssues={scheduleIssues} memberStats={memberStats}
            onCellChange={updateCell} onAttendanceToggle={toggleAttendance} onDeleteEvent={(iso) => setIgnoredEvents([...ignoredEvents, iso])}
            allMembers={allMembersList}
          />
      </div>
    </div>
  );

  const renderCalendar = () => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay(); 
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
       <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Calendário</h2>
             {renderMonthSelector()}
          </div>
          <div className="grid grid-cols-7 gap-4">
             {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-sm font-bold text-zinc-500 uppercase py-2">{d}</div>
             ))}
             {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
             {days.map(day => {
               const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
               const dayEvents = visibleEvents.filter(e => e.iso.startsWith(dateStr));
               const isToday = new Date().toISOString().startsWith(dateStr);
               return (
                 <div key={day} className={`min-h-[100px] bg-white dark:bg-zinc-800 rounded-xl p-3 border ${isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200 dark:border-zinc-700'} relative`}>
                    <span className={`text-sm font-bold ${isToday ? 'text-blue-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{day}</span>
                    <div className="mt-2 space-y-1">
                       {dayEvents.map(evt => (
                          <div 
                            key={evt.iso} 
                            onClick={() => setSelectedEvent(evt)}
                            className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-1 rounded truncate border-l-2 border-blue-500 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                          >
                             {evt.iso.split('T')[1]} - {evt.title}
                             <div className="flex gap-0.5 mt-0.5 opacity-50">
                                {Array.from({length: roles.length}).map((_, i) => <div key={i} className={`w-1 h-1 rounded-full ${schedule[`${evt.iso}_${roles[i]}`] ? 'bg-blue-500' : 'bg-zinc-300'}`} />)}
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
               )
             })}
          </div>
       </div>
    )
  };

  const renderTeam = () => {
    const getMemberRoles = (memberName: string) => {
        const assignedRoles: string[] = [];
        Object.keys(members).forEach(role => { if (members[role].includes(memberName)) assignedRoles.push(role); });
        return assignedRoles;
    };

    // 1. Identificar "Membros Fantasmas" (Detectados no sistema, mas sem cadastro oficial)
    const ghostMembers = allMembersList.filter(name => !registeredMembers.some(rm => rm.name === name));
    
    // 2. Criar perfis temporários para exibição na tabela
    const ghostProfiles: TeamMemberProfile[] = ghostMembers.map(name => ({
        id: `sys-${name}-${Date.now()}`, // ID temporário
        name: name,
        roles: [],
        email: undefined,
        whatsapp: undefined,
        avatar_url: undefined,
        createdAt: new Date().toISOString()
    }));

    // 3. Unificar a lista (Membros Registrados + Membros Detectados)
    const allDisplayMembers = [...registeredMembers, ...ghostProfiles];

    // 4. Filtrar e Ordernar
    const filteredMembers = allDisplayMembers
        .filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email?.toLowerCase().includes(memberSearch.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const handleRefreshList = async () => {
        if (!ministryId) return;
        setLoading(true);
        const [regMem, av, notif] = await Promise.all([
             loadData<TeamMemberProfile[]>(ministryId, 'public_members_list', []),
             loadData<AvailabilityMap>(ministryId, 'availability_v1', {}),
             loadData<AppNotification[]>(ministryId, 'notifications_v1', [])
        ]);
        setRegisteredMembers(regMem); setAvailability(av); setNotifications(notif);
        setLoading(false); addToast("Dados sincronizados!", "success");
    };

    const handleDeleteMember = async (id: string, name: string) => {
        if (!ministryId) return;
        confirmAction("Excluir Membro", `Tem certeza que deseja remover ${name} da equipe? Isso limpará funções e disponibilidade.`, async () => {
            setLoading(true);
            const success = await deleteMember(ministryId, id, name);
            if (success) {
                // Optimistic UI Update
                setRegisteredMembers(prev => prev.filter(m => m.id !== id && m.name !== name));
                
                // Update Roles Map locally
                const newMembersMap = { ...members };
                Object.keys(newMembersMap).forEach(role => {
                    newMembersMap[role] = newMembersMap[role].filter(n => n !== name);
                });
                setMembers(newMembersMap);

                // Update Availability locally
                if (availability[name]) {
                    const newAvail = { ...availability };
                    delete newAvail[name];
                    setAvailability(newAvail);
                }

                addToast("Membro removido com sucesso!", "success");
            } else {
                addToast("Erro ao remover membro.", "error");
            }
            setLoading(false);
        });
    };

    return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
         <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Membros & Equipe</h2>
            <p className="text-zinc-500 text-sm">Lista de usuários cadastrados e membros ativos no sistema.</p>
         </div>
         <div className="flex gap-2 w-full md:w-auto">
            <button onClick={handleRefreshList} disabled={loading} className="bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 p-2.5 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/30" title="Atualizar Lista"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
            <div className="relative w-full md:w-72">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input type="text" placeholder="Buscar membro..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
             <button onClick={() => setRoles([...roles])} className="hidden md:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-zinc-200 dark:border-zinc-700" title="Gerenciar Funções"><Settings size={18} /></button>
         </div>
      </div>
      <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
             <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase">Todos os Membros (Registrados e Detectados)</h3>
             </div>
             {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-zinc-500"><Users size={32} className="mx-auto mb-2 opacity-20" /><p>Nenhum membro encontrado.</p></div>
             ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            <tr><th className="px-6 py-3">Membro</th><th className="px-6 py-3">Contato</th><th className="px-6 py-3">Funções</th><th className="px-6 py-3 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                            {filteredMembers.map(member => {
                                // Priority: Profile Roles (member.roles) -> Manual Map (getMemberRoles)
                                const assignedRoles = (member.roles && member.roles.length > 0) 
                                    ? member.roles 
                                    : getMemberRoles(member.name);

                                // Verifica se é um membro "fantasma" (sem ID oficial de banco de dados ou email)
                                const isGhost = member.id.startsWith('sys-'); 

                                return (
                                    <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                                        isGhost 
                                                        ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
                                                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{member.name}</span>
                                                        {isGhost && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300" title="Detectado automaticamente pelo sistema">AUTO</span>}
                                                    </div>
                                                    <div className="text-xs text-zinc-500">
                                                        {isGhost ? 'Membro ativo detectado' : `ID: ${member.id.substring(0, 8)}...`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {member.email ? (
                                                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><Mail size={14} className="opacity-50" /> {member.email}</div>
                                                ) : (
                                                    <span className="text-xs text-zinc-400 italic">--</span>
                                                )}
                                                {member.whatsapp && <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"><Phone size={14} className="opacity-50" /> {member.whatsapp}</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {assignedRoles.length > 0 ? assignedRoles.map(role => <span key={role} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">{role}</span>) : <span className="text-zinc-400 text-xs italic">Sem função</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleDeleteMember(member.id, member.name)}
                                                className="text-zinc-400 hover:text-red-500 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors" 
                                                title="Excluir Membro"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
             )}
          </div>
      </div>
      <div className="mt-8 border-t border-zinc-200 dark:border-zinc-700 pt-8">
         <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-4">Gerenciamento Rápido de Funções</h3>
         <div className="flex flex-wrap gap-4">
             {roles.map(role => (
                 <div key={role} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 flex items-center justify-between min-w-[200px] shadow-sm">
                     <span className="font-medium text-sm text-zinc-700 dark:text-zinc-300">{role}</span>
                     <div className="flex items-center gap-2"><span className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs px-2 py-1 rounded-full font-bold">{(members[role] || []).length}</span><button onClick={() => { confirmAction("Remover Função", `Tem certeza que deseja remover a função "${role}"?`, () => setRoles(prev => prev.filter(r => r !== role))); }} className="text-zinc-400 hover:text-red-500 p-1"><Trash2 size={14}/></button></div>
                 </div>
             ))}
             <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-3 min-w-[200px]"><input type="text" placeholder="+ Nova Função" className="bg-transparent text-sm w-full outline-none text-zinc-700 dark:text-zinc-300 placeholder-zinc-400" onKeyDown={(e) => { if(e.key === 'Enter' && e.currentTarget.value) { setRoles([...roles, e.currentTarget.value]); e.currentTarget.value = ''; } }} /></div>
         </div>
         <p className="text-xs text-zinc-400 mt-2">* Para adicionar membros às funções, use a coluna "Funções na Escala" (lógica a ser implementada) ou adicione manualmente no editor.</p>
      </div>
    </div>
    );
  };

  const renderStats = () => {
    const data = Object.entries(memberStats).map(([name, count]) => ({ name, count: Number(count) })).sort((a, b) => b.count - a.count);
    const maxVal = Math.max(...data.map(d => d.count), 1);
    return (
       <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
         <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
             <div><h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Estatísticas</h2><p className="text-zinc-500 text-sm">Frequência da equipe no mês atual.</p></div>
             {renderMonthSelector()}
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
             {data.length === 0 ? <p className="text-center text-zinc-500 py-10">Sem dados para exibir.</p> : (
                <div className="space-y-4">
                   {data.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-4">
                         <div className="w-32 text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate text-right">{item.name}</div>
                         <div className="flex-1 h-8 bg-zinc-100 dark:bg-zinc-700 rounded-lg overflow-hidden relative"><div className="h-full bg-indigo-500 flex items-center justify-end px-3 text-white font-bold text-xs transition-all duration-1000" style={{ width: `${(item.count / maxVal) * 100}%` }}>{item.count}</div></div>
                      </div>
                   ))}
                </div>
             )}
          </div>
       </div>
    );
  };

  const renderLogs = () => (
     <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white border-b border-zinc-200 dark:border-zinc-700 pb-4">Histórico de Atividades</h2>
        <div className="space-y-2">
           {auditLog.map((log, idx) => (
              <div key={idx} className="flex gap-4 p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <div className="text-xs font-bold text-zinc-500 w-24 pt-1">{log.date.split(' ')[0]}<br/>{log.date.split(' ')[1]}</div>
                 <div><span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 mb-1">{log.action}</span><p className="text-sm text-zinc-700 dark:text-zinc-300">{log.details}</p></div>
              </div>
           ))}
        </div>
     </div>
  );

  if (sessionLoading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white"><LayoutDashboard className="animate-spin mr-2"/> Carregando...</div>;
  if (!currentUser || !ministryId) return <><LoginScreen isLoading={loading} /><ToastProvider>{null}</ToastProvider></>;

  return (
    <DashboardLayout 
      title={getMinistryTitle(ministryId)} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} theme={theme} toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} onLogout={handleLogout} isConnected={isConnected} deferredPrompt={installPrompt} onInstallAction={handleInstallApp} currentUser={currentUser} isIOS={isIOS}
      currentTab={currentTab} onTabChange={setCurrentTab}
      mainNavItems={MAIN_NAV_ITEMS}
      managementNavItems={MANAGEMENT_NAV_ITEMS}
      notifications={notifications} onNotificationsUpdate={setNotifications}
    >
      <div className="pb-20">
        {currentTab === 'dashboard' && renderDashboard()}
        {currentTab === 'editor' && renderEditor()}
        {currentTab === 'calendar' && renderCalendar()}
        {currentTab === 'team' && renderTeam()}
        {currentTab === 'availability' && (
          <AvailabilityScreen 
            availability={availability} setAvailability={setAvailability} allMembersList={allMembersList}
            currentMonth={currentMonth} onMonthChange={setCurrentMonth} onNotify={(msg) => notify('info', 'Disponibilidade Atualizada', msg)} currentUser={currentUser}
          />
        )}
        {currentTab === 'events' && (
          <EventsScreen customEvents={customEvents} setCustomEvents={setCustomEvents} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
        )}
        {currentTab === 'profile' && (
            <ProfileScreen 
                user={currentUser} 
                onUpdateProfile={handleUpdateProfile} 
                availableRoles={roles}
            />
        )}
        {currentTab === 'stats' && renderStats()}
        {currentTab === 'logs' && renderLogs()}
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        {loading && <div className="bg-zinc-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-sm animate-slide-up"><div className="w-2 h-2 bg-white rounded-full animate-ping"/> Salvando...</div>}
        {!loading && <div className="bg-emerald-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold opacity-0 hover:opacity-100 transition-opacity cursor-default"><CheckCircle2 size={14}/> Dados salvos na nuvem!</div>}
      </div>

      <ConfirmationModal isOpen={!!confirmationData} onClose={() => setConfirmationData(null)} onConfirm={handleConfirmPresence} data={confirmationData} />
      
      <EventDetailsModal 
        isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)}
        event={selectedEvent} schedule={schedule} roles={roles}
        onSave={handleUpdateEvent} onSwapRequest={handleSwapRequest} currentUser={currentUser}
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
