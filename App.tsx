
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
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User } from './types';
import { loadData, saveData, getStorageKey, getSupabase, logout, updateUserProfile } from './services/supabaseService';
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
  CheckCircle2
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
  { id: 'team', label: 'Equipe & Funções', icon: <Users size={20} /> },
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
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [ignoredEvents, setIgnoredEvents] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [scheduleIssues, setScheduleIssues] = useState<ScheduleAnalysis>({});
  
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
    const values = Object.values(members) as string[][];
    values.forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(m => list.add(m));
      }
    });
    return Array.from(list).sort();
  }, [members]);

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
          avatar_url: meta.avatar_url
      });
      setMinistryId(meta.ministryId);
  }

  // --- PWA EFFECTS ---
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // --- DATA LOADING & SAVING ---
  useEffect(() => {
    if (ministryId) {
      setLoading(true);
      const loadAll = async () => {
        try {
          const [m, s, a, c, ig, av, r, lg, th] = await Promise.all([
            loadData<MemberMap>(ministryId, 'members_v7', {}),
            loadData<ScheduleMap>(ministryId, 'escala_full_v7', {}),
            loadData<AttendanceMap>(ministryId, 'attendance_v1', {}),
            loadData<CustomEvent[]>(ministryId, 'custom_events_v1', []),
            loadData<string[]>(ministryId, 'ignored_events_v1', []),
            loadData<AvailabilityMap>(ministryId, 'availability_v1', {}),
            loadData<string[]>(ministryId, 'functions_config', DEFAULT_ROLES),
            loadData<AuditLogEntry[]>(ministryId, 'audit_log_v1', []),
            loadData<'light'|'dark'>(ministryId, 'theme_pref', 'dark')
          ]);
          setMembers(Object.keys(m).length === 0 ? (() => {const i:any={}; DEFAULT_ROLES.forEach(r=>i[r]=[]); return i})() : m);
          setSchedule(s); setAttendance(a); setCustomEvents(c); setIgnoredEvents(ig); setAvailability(av); setRoles(r); setAuditLog(lg); setTheme(th);
          setIsConnected(true);
        } catch (e) { addToast("Erro ao carregar dados", "error"); setIsConnected(false); } 
        finally { setLoading(false); }
      };
      loadAll();
    }
  }, [ministryId]);

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
      
      if ('Notification' in window && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification("Hoje tem Escala!", {
            body: `Não esqueça de enviar a escala do evento: ${nextEvent.title}`,
            icon: '/app-icon.png',
            vibrate: [200, 100, 200]
          } as any);
        });
      }
      localStorage.setItem('last_notified_event', nextEvent.iso);
    }
  }, [nextEvent]);

  const handleLogout = async () => {
    if (confirm("Sair do sistema?")) { await logout(); setMinistryId(null); setCurrentUser(null); setSchedule({}); setMembers({}); }
  };

  const handleUpdateProfile = async (name: string, whatsapp: string, avatar_url?: string) => {
      const res = await updateUserProfile(name, whatsapp, avatar_url);
      if (res.success) {
          addToast(res.message, "success");
          if (currentUser) {
              setCurrentUser({ ...currentUser, name, whatsapp, avatar_url });
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
        saveData(mid, 'theme_pref', theme)
      ]);
      addToast("Dados salvos na nuvem!", "success");
    } catch (e) { addToast("Erro ao salvar", "error"); } 
    finally { setLoading(false); }
  };

  // --- ACTIONS ---
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
    addToast(newVal ? "Presença confirmada" : "Confirmação removida", "success");
  };

  const handleConfirmPresence = () => {
    if (!confirmationData || !ministryId) return;
    const { key } = confirmationData;
    const mid = ministryId;
    const newAtt = { ...attendance, [key]: true };
    setAttendance(newAtt);
    saveData(mid, 'attendance_v1', newAtt);
    addToast("Presença confirmada!", "success");
    setConfirmationData(null);
  };

  // --- EVENT UPDATE LOGIC ---
  const handleUpdateEvent = (oldIso: string, newTitle: string, newTime: string) => {
    if (!ministryId) return;
    
    // 1. Calculate new ISO
    const datePart = oldIso.split('T')[0];
    const newIso = `${datePart}T${newTime}`;

    if (newIso === oldIso && newTitle === selectedEvent?.title) {
        setSelectedEvent(null);
        return;
    }

    // 2. Logic to update event list
    // Check if it's already a custom event
    const existingCustom = customEvents.find(c => `${c.date}T${c.time}` === oldIso);
    
    let newCustomEvents = [...customEvents];
    let newIgnored = [...ignoredEvents];

    if (existingCustom) {
        // Update existing custom event
        newCustomEvents = customEvents.map(c => c.id === existingCustom.id ? { ...c, time: newTime, title: newTitle } : c);
    } else {
        // It's a generated default event. Hide it and create a custom override
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

    // 3. Migrate Schedule and Attendance Data
    const newSchedule = { ...schedule };
    const newAttendance = { ...attendance };
    
    roles.forEach(role => {
        const oldKey = `${oldIso}_${role}`;
        const newKey = `${newIso}_${role}`;
        
        // Migrate schedule
        if (newSchedule[oldKey]) {
            newSchedule[newKey] = newSchedule[oldKey];
            delete newSchedule[oldKey];
        }
        
        // Migrate attendance
        if (newAttendance[oldKey]) {
            newAttendance[newKey] = newAttendance[oldKey];
            delete newAttendance[oldKey];
        }
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
    
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40); 
    doc.text(title, 14, 15);
    
    const head = [['Data', 'Evento', ...roles]];
    const body = visibleEvents.map(evt => {
      const row = [
        evt.dateDisplay,
        evt.title,
        ...roles.map(r => schedule[`${evt.iso}_${r}`] || '-')
      ];
      return row;
    });

    if (memberFilter) {
       doc.setFontSize(12);
       doc.setTextColor(80, 80, 80);
       doc.text(`Filtro: ${memberFilter}`, 14, 22);
    }

    autoTable(doc, {
      startY: 25,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [26, 188, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`Escala_${currentMonth}.pdf`);
  };

  // --- AI ---
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
     } catch (e) { 
        addToast("Erro na análise.", "error"); 
     } finally { 
        setLoading(false); 
     }
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
          onShare={(txt) => { 
             const url = new URL("https://wa.me/");
             url.searchParams.set("text", txt);
             window.open(url.toString(), "_blank");
          }}
          onConfirm={(key) => { const mid = ministryId; if (!mid) return; if (confirm("Confirmar presença manualmente?")) { const newVal = !attendance[key]; setAttendance({...attendance, [key]: newVal}); saveData(mid, 'attendance_v1', {...attendance, [key]: newVal}); } }}
        />
      ) : (
        <div className="p-8 text-center bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
           <p className="text-zinc-500">Nenhum evento próximo agendado.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Eventos no Mês</h3>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{visibleEvents.length}</p>
         </div>
         <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Membros Ativos</h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{allMembersList.length}</p>
         </div>
         <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-col justify-center gap-2">
            <h3 className="text-xs font-bold text-zinc-500 uppercase">Ações Rápidas</h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentTab('editor')} className="flex-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 p-2 rounded text-xs font-bold">Editar Escala</button>
              <button onClick={() => setCurrentTab('stats')} className="flex-1 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 p-2 rounded text-xs font-bold">Ver Relatórios</button>
            </div>
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
             onImportCSV={() => {}} // Simple placeholder
             onClearMonth={() => { if(confirm("Limpar mês?")) { const ns = {...schedule}; Object.keys(ns).forEach(k => k.startsWith(currentMonth) && delete ns[k]); setSchedule(ns); } }}
             allMembers={allMembersList}
           />
           <button onClick={saveAll} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-600/20">{loading ? '...' : 'Salvar'}</button>
         </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
         <ScheduleTable 
            events={visibleEvents} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={members} scheduleIssues={scheduleIssues} memberStats={memberStats}
            onCellChange={updateCell} onAttendanceToggle={toggleAttendance} onDeleteEvent={(iso) => setIgnoredEvents([...ignoredEvents, iso])}
          />
      </div>
    </div>
  );

  const renderCalendar = () => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0-6
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

  const renderTeam = () => (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
         <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Gerenciar Equipe e Funções</h2>
            <p className="text-zinc-500 text-sm">Adicione membros, organize funções e remova participantes.</p>
         </div>
         <div className="flex gap-2">
            <div className="relative">
               <input 
                  type="text" placeholder="Adicionar nova função..." 
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                  onKeyDown={(e) => { if(e.key === 'Enter' && e.currentTarget.value) { setRoles([...roles, e.currentTarget.value]); e.currentTarget.value = ''; } }}
               />
               <button className="absolute right-2 top-2 text-blue-500 font-bold text-xs bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">Adicionar</button>
            </div>
         </div>
      </div>

      <div className="space-y-4">
         {roles.map(role => (
           <div key={role} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 flex justify-between items-center">
                 <h3 className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                    {role} 
                    <span className="text-xs font-normal text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{(members[role] || []).length} membros</span>
                 </h3>
                 <button onClick={() => {if(confirm("Remover função?")) setRoles(roles.filter(r => r !== role))}} className="text-zinc-400 hover:text-red-500"><X size={16}/></button>
              </div>
              <div className="p-4">
                 <div className="flex flex-wrap gap-2 mb-3">
                    {(members[role] || []).map(m => (
                       <div key={m} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm">
                          {m}
                          <button 
                            onClick={() => {
                              confirmAction(
                                "Remover Membro",
                                `Tem certeza que deseja remover ${m} da função ${role}?`,
                                () => {
                                  setMembers({...members, [role]: members[role].filter(x => x !== m)});
                                  addToast("Membro removido.", "info");
                                }
                              );
                            }} 
                            className="text-zinc-400 hover:text-red-500"
                          >
                            <X size={14}/>
                          </button>
                       </div>
                    ))}
                 </div>
                 <input 
                    placeholder="Adicionar membro..." 
                    className="text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 focus:border-blue-500 outline-none w-full py-1 text-zinc-600 dark:text-zinc-300"
                    onKeyDown={(e) => {
                       if(e.key === 'Enter' && e.currentTarget.value) {
                          const val = e.currentTarget.value;
                          if(!(members[role] || []).includes(val)) {
                             setMembers({...members, [role]: [...(members[role] || []), val]});
                             e.currentTarget.value = "";
                          }
                       }
                    }}
                 />
              </div>
           </div>
         ))}
      </div>
    </div>
  );

  const renderStats = () => {
    const data = Object.entries(memberStats).map(([name, count]) => ({ name, count: Number(count) })).sort((a, b) => b.count - a.count);
    const maxVal = Math.max(...data.map(d => d.count), 1);

    return (
       <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
         <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
             <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Estatísticas</h2>
                <p className="text-zinc-500 text-sm">Frequência da equipe no mês atual.</p>
             </div>
             {renderMonthSelector()}
          </div>
          
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
             {data.length === 0 ? <p className="text-center text-zinc-500 py-10">Sem dados para exibir.</p> : (
                <div className="space-y-4">
                   {data.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-4">
                         <div className="w-32 text-sm font-medium text-zinc-600 dark:text-zinc-300 truncate text-right">{item.name}</div>
                         <div className="flex-1 h-8 bg-zinc-100 dark:bg-zinc-700 rounded-lg overflow-hidden relative">
                            <div className="h-full bg-indigo-500 flex items-center justify-end px-3 text-white font-bold text-xs transition-all duration-1000" style={{ width: `${(item.count / maxVal) * 100}%` }}>
                               {item.count}
                            </div>
                         </div>
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
                 <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 mb-1">{log.action}</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{log.details}</p>
                 </div>
              </div>
           ))}
        </div>
     </div>
  );

  // --- MAIN RENDER ---
  if (sessionLoading) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white"><LayoutDashboard className="animate-spin mr-2"/> Carregando...</div>;
  if (!currentUser || !ministryId) return <><LoginScreen isLoading={loading} /><ToastProvider>{null}</ToastProvider></>;

  return (
    <DashboardLayout 
      title={`Escala ${ministryId}`} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} theme={theme} toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} onLogout={handleLogout} isConnected={isConnected} deferredPrompt={installPrompt} onInstallAction={handleInstallApp} currentUser={currentUser} isIOS={isIOS}
      currentTab={currentTab} onTabChange={setCurrentTab}
      mainNavItems={MAIN_NAV_ITEMS}
      managementNavItems={MANAGEMENT_NAV_ITEMS}
    >
      <div className="pb-20">
        {currentTab === 'dashboard' && renderDashboard()}
        {currentTab === 'editor' && renderEditor()}
        {currentTab === 'calendar' && renderCalendar()}
        {currentTab === 'team' && renderTeam()}
        
        {/* Usando os novos componentes extraídos */}
        {currentTab === 'availability' && (
          <AvailabilityScreen 
            availability={availability} 
            setAvailability={setAvailability} 
            allMembersList={allMembersList}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        )}
        
        {currentTab === 'events' && (
          <EventsScreen 
            customEvents={customEvents} 
            setCustomEvents={setCustomEvents}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        )}
        
        {currentTab === 'profile' && (
            <ProfileScreen user={currentUser} onUpdateProfile={handleUpdateProfile} />
        )}
        
        {currentTab === 'stats' && renderStats()}
        {currentTab === 'logs' && renderLogs()}
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        {loading && (
           <div className="bg-zinc-900 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-sm animate-slide-up">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"/> Salvando...
           </div>
        )}
        {!loading && (
           <div className="bg-emerald-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold opacity-0 hover:opacity-100 transition-opacity cursor-default">
              <CheckCircle2 size={14}/> Dados salvos na nuvem!
           </div>
        )}
      </div>

      <ConfirmationModal isOpen={!!confirmationData} onClose={() => setConfirmationData(null)} onConfirm={handleConfirmPresence} data={confirmationData} />
      
      <EventDetailsModal 
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
        schedule={schedule}
        roles={roles}
        onSave={handleUpdateEvent}
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
