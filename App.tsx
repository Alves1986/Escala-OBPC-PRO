
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { ScheduleCalendarView } from './components/ScheduleCalendarView'; // Novo Componente
import { EventsModal, AvailabilityModal, RolesModal, AuditModal, StatsModal } from './components/ManagementModals';
import { ProfileModal } from './components/ProfileModal';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User, SwapRequest, Tab } from './types';
import { loadData, saveData, getStorageKey, getSupabase, logout, updateUserProfile } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { Wand2, BrainCircuit } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { NextEventCard } from './components/NextEventCard';
import { NotificationToggle } from './components/NotificationToggle';
import { ConfirmationModal } from './components/ConfirmationModal';

const AppContent = () => {
  const { addToast, confirmAction } = useToast();
  // --- STATE ---
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  
  // Data
  const [members, setMembers] = useState<MemberMap>({});
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [ignoredEvents, setIgnoredEvents] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [scheduleIssues, setScheduleIssues] = useState<ScheduleAnalysis>({});
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  // Modal states are mostly replaced by Tabs, but Profile and Confirmation still need Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);

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
      if (session?.user) {
        const meta = session.user.user_metadata;
        setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            name: meta.name || 'Usuário',
            role: meta.role || 'member',
            ministryId: meta.ministryId,
            whatsapp: meta.whatsapp,
        });
        setMinistryId(meta.ministryId);
      }
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
         const meta = session.user.user_metadata;
         setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            name: meta.name || 'Usuário',
            role: meta.role || 'member',
            ministryId: meta.ministryId,
            whatsapp: meta.whatsapp,
         });
         setMinistryId(meta.ministryId);
      } else {
         setCurrentUser(null);
         setMinistryId(null);
      }
      setSessionLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- PWA & NOTIFICATIONS ---
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

  // --- DEEP LINKING ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action') || params.get('a');
    const key = params.get('key') || params.get('k');
    const name = params.get('name') || params.get('n');

    if ((action === 'confirm' || action === 'c') && key && name) {
      if (key.includes('_')) {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const isoDate = parts[0];
          const role = parts[1];
          if (isoDate && role) {
             const [datePart, timePart] = isoDate.split('T');
             const formattedDate = datePart && timePart 
                ? `${datePart.split('-').reverse().join('/')} às ${timePart}`
                : isoDate;
             setConfirmationData({ key, memberName: decodeURIComponent(name), eventName: 'Evento', date: formattedDate, role: role });
          }
        }
      }
    }
  }, []);

  // --- REALTIME ---
  useEffect(() => {
    if (!ministryId) return;
    const supabase = getSupabase();
    if(!supabase) return;

    const attendanceKey = getStorageKey(ministryId, 'attendance_v1');
    const swapsKey = getStorageKey(ministryId, 'swaps_v1');
    
    const channel = supabase
      .channel('app_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_storage', filter: `key=eq.${attendanceKey}` }, (payload) => {
          setAttendance(payload.new.value as AttendanceMap);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_storage', filter: `key=eq.${swapsKey}` }, (payload) => {
          setSwaps(payload.new.value as SwapRequest[]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ministryId]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (ministryId) {
      setLoading(true);
      const loadAll = async () => {
        try {
          const [m, s, a, c, ig, av, r, lg, th, sw] = await Promise.all([
            loadData<MemberMap>(ministryId, 'members_v7', {}),
            loadData<ScheduleMap>(ministryId, 'escala_full_v7', {}),
            loadData<AttendanceMap>(ministryId, 'attendance_v1', {}),
            loadData<CustomEvent[]>(ministryId, 'custom_events_v1', []),
            loadData<string[]>(ministryId, 'ignored_events_v1', []),
            loadData<AvailabilityMap>(ministryId, 'availability_v1', {}),
            loadData<string[]>(ministryId, 'functions_config', DEFAULT_ROLES),
            loadData<AuditLogEntry[]>(ministryId, 'audit_log_v1', []),
            loadData<'light'|'dark'>(ministryId, 'theme_pref', 'dark'),
            loadData<SwapRequest[]>(ministryId, 'swaps_v1', [])
          ]);
          
          if (Object.keys(m).length === 0) {
             const initM: MemberMap = {};
             DEFAULT_ROLES.forEach(role => initM[role] = []);
             setMembers(initM);
          } else { setMembers(m); }

          setSchedule(s);
          setAttendance(a);
          setCustomEvents(c);
          setIgnoredEvents(ig);
          setAvailability(av);
          setRoles(r);
          setAuditLog(lg);
          setTheme(th);
          setSwaps(sw || []);
          setIsConnected(true);
        } catch (e) {
          addToast("Erro ao carregar dados", "error");
          setIsConnected(false);
        } finally {
          setLoading(false);
        }
      };
      loadAll();
    }
  }, [ministryId]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);


  // --- ACTIONS ---

  const handleLogout = async () => {
    if (confirm("Sair do sistema?")) {
      await logout();
      setMinistryId(null);
      setCurrentUser(null);
      setSchedule({});
      setMembers({});
      setActiveTab('dashboard');
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
        saveData(mid, 'swaps_v1', swaps)
      ]);
      addToast("Dados salvos na nuvem!", "success");
    } catch (e) {
      addToast("Erro ao salvar", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (key: string, value: string) => {
    if (currentUser?.role !== 'admin') return;
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
    const assignedName = schedule[key];
    const isMe = currentUser?.name === assignedName;
    const isAdmin = currentUser?.role === 'admin';
    if (!isMe && !isAdmin) return addToast("Você só pode confirmar sua própria presença.", "warning");
    
    const newVal = !attendance[key];
    const newAtt = { ...attendance, [key]: newVal };
    setAttendance(newAtt);
    saveData(mid, 'attendance_v1', newAtt);
    addToast(newVal ? "Presença confirmada" : "Confirmação removida", "success");
  };

  const handleConfirmPresence = () => {
    const mid = ministryId;
    if (confirmationData && mid) {
      const { key } = confirmationData;
      const newAtt = { ...attendance, [key]: true };
      setAttendance(newAtt);
      saveData(mid, 'attendance_v1', newAtt);
      addToast("Presença Confirmada!", "success");
      setConfirmationData(null);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleRequestSwap = (key: string, eventTitle: string, dateDisplay: string) => {
    const mid = ministryId;
    if (!mid || !currentUser) return;
    if (swaps.find(s => s.key === key && s.status === 'pending')) return addToast("Já existe troca pendente.", "warning");
    
    const newSwap: SwapRequest = {
        id: crypto.randomUUID(),
        key, requesterName: currentUser.name, role: key.split('_')[1],
        eventName: eventTitle, dateDisplay, status: 'pending', createdAt: new Date().toISOString()
    };
    const updatedSwaps = [...swaps, newSwap];
    setSwaps(updatedSwaps);
    saveData(mid, 'swaps_v1', updatedSwaps);
    addToast("Solicitação de troca enviada!", "success");
  };

  const handleCancelSwap = (swapId: string) => {
    const mid = ministryId;
    if (!mid) return;
    const updatedSwaps = swaps.filter(s => s.id !== swapId);
    setSwaps(updatedSwaps);
    saveData(mid, 'swaps_v1', updatedSwaps);
    addToast("Solicitação cancelada.", "info");
  };

  const handleAcceptSwap = (swapId: string) => {
    const mid = ministryId;
    if (!mid || !currentUser) return;
    const swap = swaps.find(s => s.id === swapId);
    if (!swap) return;
    const membersInRole = members[swap.role] || [];
    if (!membersInRole.includes(currentUser.name) && currentUser.role !== 'admin') return addToast("Você não pode assumir esta função.", "error");

    const newSchedule = { ...schedule, [swap.key]: currentUser.name };
    const newAttendance = { ...attendance }; delete newAttendance[swap.key];
    const updatedSwaps = swaps.map(s => s.id === swapId ? { ...s, status: 'completed' as const } : s);
    setSchedule(newSchedule); setAttendance(newAttendance); setSwaps(updatedSwaps);
    
    Promise.all([
        saveData(mid, 'escala_full_v7', newSchedule),
        saveData(mid, 'attendance_v1', newAttendance),
        saveData(mid, 'swaps_v1', updatedSwaps)
    ]);
    addToast(`Troca realizada!`, "success");
    logAction("Troca", `${currentUser.name} assumiu lugar de ${swap.requesterName}`);
  };

  // --- EXPORT ---
  const exportPDF = (memberFilter?: string) => {
    const doc = new jsPDF('landscape');
    const [y, m] = currentMonth.split('-').map(Number);
    const dateObj = new Date(y, m - 1);
    const title = `Escala - ${dateObj.toLocaleDateString('pt-BR', { month: 'long' })} de ${y}`;
    doc.setFontSize(18); doc.setTextColor(40, 40, 40); doc.text(title, 14, 15);
    
    const head = [['Data', 'Evento', ...roles]];
    const body = visibleEvents.map(evt => [evt.dateDisplay, evt.title, ...roles.map(r => schedule[`${evt.iso}_${r}`] || '-')]);

    autoTable(doc, {
      startY: 25, head, body, theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [26, 188, 156], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    doc.save(`Escala_${currentMonth}.pdf`);
  };

  const copyToWhatsApp = () => {
    let text = `*ESCALA - ${getMonthName(currentMonth).toUpperCase()}*\n\n`;
    visibleEvents.forEach(evt => {
      text += `📅 *${evt.dateDisplay} - ${evt.title}*\n`;
      roles.forEach(r => {
        const who = schedule[`${evt.iso}_${r}`];
        if (who) text += `   ▪ ${r}: ${who}\n`;
      });
      text += `\n`;
    });
    navigator.clipboard.writeText(text).then(() => addToast("Copiado!", "success"));
  };
  
  const generateCSV = () => { /* ... (mantido igual) ... */ };
  const importCSV = (file: File) => { /* ... (mantido igual) ... */ };
  const clearMonthSchedule = () => {
    if (confirm("Limpar toda a escala do mês?")) {
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(k => { if(k.startsWith(currentMonth)) delete newSchedule[k]; });
      setSchedule(newSchedule);
      addToast("Escala limpa.", "info");
    }
  };

  // --- AI ---
  const generateAI = async () => {
     const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
     if(!apiKey) return addToast("API Key inválida", "error");
     setLoading(true);
     try {
       const genAI = new GoogleGenAI({ apiKey: apiKey as string });
       const prompt = `Gere uma escala (Mês: ${currentMonth}). Eventos: ${JSON.stringify(visibleEvents.map(e=>({d:e.iso, t:e.title})))}. Funções: ${JSON.stringify(roles)}. Membros: ${JSON.stringify(members)}. Disponibilidade (Datas Permitidas): ${JSON.stringify(availability)}. Histórico: ${JSON.stringify(memberStats)}. JSON ONLY: {"YYYY-MM-DDTHH:mm_Role": "Nome"}`;
       const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
       setSchedule(prev => ({ ...prev, ...JSON.parse(response.text || '{}') }));
       addToast("Gerado com IA!", "success");
     } catch(e) { addToast("Erro IA", "error"); } finally { setLoading(false); }
  };

  const analyzeSchedule = async () => {
     const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
     if(!apiKey) return addToast("API Key inválida", "error");
     setLoading(true);
     try {
        const genAI = new GoogleGenAI({ apiKey: apiKey as string });
        const currentSchedule: any = {}; Object.keys(schedule).forEach(k => { if (k.startsWith(currentMonth)) currentSchedule[k] = schedule[k]; });
        const prompt = `Analise conflitos. Escala: ${JSON.stringify(currentSchedule)}. Disponibilidade: ${JSON.stringify(availability)}. JSON ONLY: {"YYYY-MM-DDTHH:mm_Role": {"type":"error"|"warning","message":"..."}}`;
        const response = await genAI.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        setScheduleIssues(JSON.parse(response.text || '{}'));
        addToast("Análise feita!", "success");
     } catch(e) { addToast("Erro IA", "error"); } finally { setLoading(false); }
  };

  const handleUpdateProfile = async (name: string, whatsapp: string) => {
    const res = await updateUserProfile(name, whatsapp);
    if(res.success) {
      addToast(res.message, "success");
      if(currentUser) setCurrentUser({ ...currentUser, name, whatsapp });
    }
  };


  // --- RENDER CONTENT BY TAB ---
  const renderTabContent = () => {
      switch(activeTab) {
          case 'dashboard':
              return (
                  <div className="space-y-6 animate-fade-in">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Visão Geral</h2>
                          <div className="flex items-center gap-2">
                             <NotificationToggle ministryId={ministryId} />
                             {currentUser?.role === 'admin' && (
                                <div className="text-xs text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                                   ID: {ministryId}
                                </div>
                             )}
                          </div>
                      </div>
                      
                      {nextEvent ? (
                          <NextEventCard 
                            event={nextEvent} schedule={schedule} attendance={attendance} roles={roles}
                            onShare={(txt) => { navigator.share ? navigator.share({ title: 'Escala', text: txt }).catch(console.error) : navigator.clipboard.writeText(txt).then(() => addToast("Copiado!", "success")); }}
                            onConfirm={(key) => { const mid = ministryId; if (!mid) return; if (confirm("Confirmar presença?")) { const newVal = !attendance[key]; setAttendance({...attendance, [key]: newVal}); saveData(mid, 'attendance_v1', {...attendance, [key]: newVal}); } }}
                          />
                      ) : (
                          <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl text-center shadow-sm border border-zinc-200 dark:border-zinc-700">
                             <p className="text-zinc-500">Nenhum evento próximo agendado.</p>
                          </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                              <div className="text-zinc-500 text-xs uppercase font-bold">Eventos no Mês</div>
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{visibleEvents.length}</div>
                          </div>
                          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                              <div className="text-zinc-500 text-xs uppercase font-bold">Membros Ativos</div>
                              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{allMembersList.length}</div>
                          </div>
                          {currentUser?.role === 'admin' && (
                             <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 col-span-2 md:col-span-2">
                                <div className="text-zinc-500 text-xs uppercase font-bold mb-2">Ações Rápidas</div>
                                <div className="flex gap-2">
                                    <button onClick={() => setActiveTab('schedule_editor')} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Editar Escala</button>
                                    <button onClick={() => setActiveTab('stats')} className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold hover:bg-purple-100">Ver Relatório</button>
                                </div>
                             </div>
                          )}
                      </div>
                  </div>
              );

          case 'calendar':
              return (
                  <ScheduleCalendarView 
                    events={visibleEvents} roles={roles} schedule={schedule} attendance={attendance} currentUser={currentUser} 
                  />
              );

          case 'schedule_editor':
              if (currentUser?.role !== 'admin') return <div className="text-center p-10">Acesso Negado</div>;
              return (
                  <div className="space-y-4 animate-fade-in">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-4">
                              <button onClick={() => { const prev = new Date(year, month - 2, 1); setCurrentMonth(prev.toISOString().slice(0, 7)); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">←</button>
                              <div className="text-center">
                                  <span className="block text-sm font-medium text-zinc-500 uppercase">Mês de Referência</span>
                                  <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                              </div>
                              <button onClick={() => { const next = new Date(year, month, 1); setCurrentMonth(next.toISOString().slice(0, 7)); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">→</button>
                          </div>
                          
                          <div className="flex gap-2">
                              <button onClick={generateAI} className="flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-lg hover:bg-purple-100"><Wand2 size={16}/> Gerar IA</button>
                              <button onClick={analyzeSchedule} className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg hover:bg-amber-100"><BrainCircuit size={16}/> Analisar</button>
                              <ToolsMenu onExportIndividual={exportPDF} onExportFull={() => exportPDF()} onWhatsApp={copyToWhatsApp} onCSV={generateCSV} onImportCSV={importCSV} onClearMonth={clearMonthSchedule} allMembers={allMembersList} />
                              <button onClick={saveAll} disabled={loading} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">{loading ? '...' : 'Salvar'}</button>
                          </div>
                      </div>
                      
                      <ScheduleTable 
                        events={visibleEvents} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={members} scheduleIssues={scheduleIssues} memberStats={memberStats}
                        onCellChange={updateCell} onAttendanceToggle={toggleAttendance} onDeleteEvent={(iso) => setIgnoredEvents([...ignoredEvents, iso])}
                        currentUser={currentUser} swaps={swaps} onRequestSwap={handleRequestSwap} onCancelSwap={handleCancelSwap} onAcceptSwap={handleAcceptSwap}
                      />
                  </div>
              );

          case 'events':
              return <EventsModal isOpen={true} isPage={true} events={customEvents} hiddenEvents={hiddenEventsList} onAdd={evt => setCustomEvents([...customEvents, evt])} onRemove={id => setCustomEvents(customEvents.filter(e => e.id !== id))} onRestore={iso => setIgnoredEvents(ignoredEvents.filter(i => i !== iso))} />;
          
          case 'availability':
              return <AvailabilityModal isOpen={true} isPage={true} members={allMembersList} availability={availability} currentMonth={currentMonth} onUpdate={(m, dates) => setAvailability(prev => ({ ...prev, [m]: dates }))} currentUser={currentUser} />;
          
          case 'team':
              return <RolesModal isOpen={true} isPage={true} roles={roles} onUpdate={setRoles} members={members} setMembers={setMembers} />;
          
          case 'stats':
              return <StatsModal isOpen={true} isPage={true} stats={memberStats} monthName={getMonthName(currentMonth)} />;
          
          case 'logs':
              return <AuditModal isOpen={true} isPage={true} logs={auditLog} />;
          
          case 'profile':
              return <ProfileModal isOpen={true} onClose={() => setActiveTab('dashboard')} currentUser={currentUser} onUpdateProfile={handleUpdateProfile} />;

          default:
              return null;
      }
  };


  if (sessionLoading) {
     return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white"><div className="animate-spin text-4xl">⟳</div></div>;
  }

  if (!currentUser || !ministryId) {
    return (
      <>
        <LoginScreen isLoading={loading} />
        <ToastProvider>{null}</ToastProvider>
      </>
    );
  }

  return (
    <DashboardLayout 
      title={`Escala ${ministryId}`} 
      sidebarOpen={sidebarOpen} 
      setSidebarOpen={setSidebarOpen}
      theme={theme}
      toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      onLogout={handleLogout}
      isConnected={isConnected}
      deferredPrompt={installPrompt}
      onInstallAction={handleInstallApp}
      currentUser={currentUser}
      isIOS={isIOS}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
        {renderTabContent()}

        {/* Global Modals (Only those that must overlay everything) */}
        <ConfirmationModal isOpen={!!confirmationData} onClose={() => setConfirmationData(null)} onConfirm={handleConfirmPresence} data={confirmationData} />
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
