import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsModal } from './components/StatsModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis, User } from './types';
import { loadData, saveData, getStorageKey, getSupabase, logout } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { Download, Users, Calendar, BarChart2, Plus, Trash2, Wand2, Shield, Settings, Activity, BrainCircuit, ChevronDown } from 'lucide-react';
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

  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [collapsedRoles, setCollapsedRoles] = useState<string[]>(DEFAULT_ROLES);
  
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
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  
  // Confirmation Modal State
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

    // Check active session
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

    // Listen for changes
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


  // --- PWA & NOTIFICATIONS EFFECTS ---
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

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

             setConfirmationData({
               key,
               memberName: decodeURIComponent(name),
               eventName: 'Evento',
               date: formattedDate,
               role: role
             });
          }
        }
      }
    }
  }, []);

  // Realtime Subscription
  useEffect(() => {
    if (!ministryId) return;
    const supabase = getSupabase();
    if(!supabase) return;

    const attendanceKey = getStorageKey(ministryId, 'attendance_v1');
    
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_storage', filter: `key=eq.${attendanceKey}` },
        (payload) => {
          const newData = payload.new.value as AttendanceMap;
          setAttendance(newData);
          if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
             new Notification('Atualização na Escala', {
               body: 'Alguém confirmou presença! Abra o app para ver.',
               icon: '/app-icon.png'
             });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ministryId]);

  // Daily Reminder
  useEffect(() => {
    if (visibleEvents.length === 0) return;
    const checkTodayReminder = () => {
      const today = new Date().toISOString().split('T')[0];
      const todaysEvent = visibleEvents.find(e => e.iso.startsWith(today));
      if (todaysEvent) {
        const lastRemindedDate = localStorage.getItem('escala_daily_reminder_date');
        if (lastRemindedDate !== today) {
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const options: any = {
                body: "Não esqueça de enviar a escala para a equipe confirmar presença!",
                icon: "/app-icon.png",
                tag: 'daily-event-reminder',
                vibrate: [200, 100, 200]
              };
              new Notification(`📅 Hoje tem: ${todaysEvent.title}`, options);
            } catch (e) { console.error(e); }
          }
          addToast(`Lembrete: Hoje tem ${todaysEvent.title}. Envie a escala!`, "info");
          localStorage.setItem('escala_daily_reminder_date', today);
        }
      }
    };
    checkTodayReminder();
  }, [visibleEvents, addToast]);
  
  // SW Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let swUrl = './sw.js';
      try { if (window.location.href) swUrl = new URL('sw.js', window.location.href).href; } catch (e) {}
      navigator.serviceWorker.register(swUrl).catch(console.warn);
    }
  }, []);

  // Data Loading
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
          setCollapsedRoles(r); 
          setAuditLog(lg);
          setTheme(th);
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

  useEffect(() => { setScheduleIssues({}); }, [currentMonth]);


  const handleLogout = async () => {
    if (confirm("Sair do sistema?")) {
      await logout();
      setMinistryId(null);
      setCurrentUser(null);
      setSchedule({});
      setMembers({});
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
    } catch (e) {
      addToast("Erro ao salvar", "error");
    } finally {
      setLoading(false);
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
    addToast(newVal ? "Presença confirmada" : "Confirmação removida", "success");
  };

  const handleConfirmPresence = () => {
    const mid = ministryId;
    
    if (confirmationData && mid) {
      const { key } = confirmationData;
      const newAtt = { ...attendance, [key]: true };
      setAttendance(newAtt);
      
      saveData(mid, 'attendance_v1', newAtt);
      
      addToast("Presença Confirmada com Sucesso!", "success");
      setConfirmationData(null);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // --- EXPORT TOOLS ---
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

  const copyToWhatsApp = () => {
    let text = `*ESCALA MÍDIA - ${getMonthName(currentMonth).toUpperCase()}*\n\n`;
    visibleEvents.forEach(evt => {
      text += `📅 *${evt.dateDisplay} - ${evt.title} (${evt.iso.split('T')[1]})*\n`;
      roles.forEach(r => {
        const who = schedule[`${evt.iso}_${r}`];
        if (who) text += `   ▪ ${r}: ${who}\n`;
      });
      text += `\n`;
    });
    navigator.clipboard.writeText(text);
    addToast("Copiado para área de transferência!", "success");
  };
  
  const generateCSV = () => {
    let csv = `Data,Evento,${roles.join(',')}\n`;
    visibleEvents.forEach(evt => {
      const row = [evt.dateDisplay, evt.title, ...roles.map(r => schedule[`${evt.iso}_${r}`] || '')];
      csv += row.join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala_${currentMonth}.csv`;
    a.click();
  };
  
  const importCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') return;
      
      const lines = text.split('\n');
      const newMembers: MemberMap = { ...members };
      lines.forEach(line => {
        const [name, role] = line.split(',').map(s => s.trim());
        if (name && role && roles.includes(role)) {
          if (!newMembers[role]) newMembers[role] = [];
          if (!newMembers[role].includes(name)) newMembers[role].push(name);
        }
      });
      setMembers(newMembers);
      addToast("Membros importados via CSV!", "success");
      saveAll();
    };
    reader.readAsText(file);
  };

  const clearMonthSchedule = () => {
    if (confirm("Tem certeza que deseja limpar TODA a escala deste mês?")) {
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(key => {
        if (key.startsWith(currentMonth)) delete newSchedule[key];
      });
      setSchedule(newSchedule);
      addToast("Escala do mês limpa.", "info");
      logAction("Limpar Mês", `Escala de ${currentMonth} foi limpa.`);
    }
  };

  // --- AI ---
  const generateAI = async () => {
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) return addToast("Chave API não configurada", "error");

    setLoading(true);
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey as string });
      
      const prompt = `
        Gere uma escala para uma equipe de mídia.
        Mês: ${currentMonth}
        Dias/Eventos: ${JSON.stringify(visibleEvents.map(e => ({ date: e.iso, title: e.title })))}
        Funções: ${JSON.stringify(roles)}
        Membros Disponíveis por Função: ${JSON.stringify(members)}
        Indisponibilidades: ${JSON.stringify(availability)}
        Histórico Anterior: ${JSON.stringify(memberStats)}
        Retorne APENAS um JSON no formato: { "YYYY-MM-DDTHH:mm_Funcao": "NomeMembro", ... }
      `;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const generatedSchedule = JSON.parse(response.text || '{}');
      setSchedule(prev => ({ ...prev, ...generatedSchedule }));
      addToast("Escala gerada com IA!", "success");
      logAction("IA", "Escala gerada automaticamente.");

    } catch (e) {
      addToast("Erro na IA. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  };
  
  const analyzeSchedule = async () => {
     const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY as string | undefined;
     if (!apiKey) return addToast("Chave API não configurada", "error");
     
     setLoading(true);
     try {
       const genAI = new GoogleGenAI({ apiKey: apiKey as string });
       const currentSchedule: any = {};
       Object.keys(schedule).forEach(k => { if (k.startsWith(currentMonth)) currentSchedule[k] = schedule[k]; });

       const prompt = `
         Analise esta escala de equipe de mídia.
         Escala Atual: ${JSON.stringify(currentSchedule)}
         Membros: ${JSON.stringify(members)}
         Indisponibilidades: ${JSON.stringify(availability)}
         Retorne um JSON: { "YYYY-MM-DDTHH:mm_Funcao": { "type": "error"|"warning", "message": "...", "suggestedReplacement": "Nome" } }
       `;
       
       const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      if (response.text) {
         setScheduleIssues(JSON.parse(response.text));
         addToast("Análise concluída!", "success");
      }
    } catch (e) {
      addToast("Erro na análise.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleRoleCollapse = (role: string) => {
    if (collapsedRoles.includes(role)) {
      setCollapsedRoles(collapsedRoles.filter(r => r !== role));
    } else {
      setCollapsedRoles([...collapsedRoles, role]);
    }
  };

  if (sessionLoading) {
     return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Carregando...</div>;
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
      sidebar={
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2 px-2">
               <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Equipe</h3>
               <button onClick={() => setRolesModalOpen(true)} className="p-1 text-zinc-400 hover:text-blue-500 rounded"><Settings size={14}/></button>
            </div>
            <div className="space-y-2">
              {roles.map(role => (
                <div key={role} className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                  <div onClick={() => toggleRoleCollapse(role)} className="p-3 flex justify-between items-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{role}</span>
                    <ChevronDown size={14} className={`text-zinc-400 transition-transform ${!collapsedRoles.includes(role) ? 'rotate-180' : ''}`} />
                  </div>
                  <div className={`px-3 transition-all duration-300 ease-in-out overflow-hidden ${collapsedRoles.includes(role) ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100 pb-3'}`}>
                    <ul className="space-y-1 mt-1">
                      {(members[role] || []).map(m => (
                        <li key={m} className="text-sm text-zinc-600 dark:text-zinc-300 flex justify-between group">
                          <span>{m}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm(`Remover ${m}?`)) { setMembers({...members, [role]: members[role].filter(x => x !== m)}); } }}
                            className="opacity-0 group-hover:opacity-100 text-red-500"
                          ><Trash2 size={12}/></button>
                        </li>
                      ))}
                      <li className="pt-2">
                         <input placeholder="Novo..." className="w-full text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1"
                             onKeyDown={(e) => {
                               if (e.key === 'Enter' && e.currentTarget.value) {
                                 const val = e.currentTarget.value;
                                 if (!(members[role] || []).includes(val)) {
                                      setMembers({...members, [role]: [...(members[role] || []), val]});
                                      e.currentTarget.value = "";
                                 }
                               }
                             }}
                         />
                      </li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
           <button onClick={() => { const prev = new Date(year, month - 2, 1); setCurrentMonth(prev.toISOString().slice(0, 7)); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">←</button>
           <div className="text-center min-w-[140px]">
             <span className="block text-sm font-medium text-zinc-500 uppercase tracking-wide">Mês de Referência</span>
             <span className="block text-lg font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
           </div>
           <button onClick={() => { const next = new Date(year, month, 1); setCurrentMonth(next.toISOString().slice(0, 7)); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">→</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-4 py-2 rounded-lg font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm">
            <Calendar size={18} className="text-blue-500"/> <span className="hidden sm:inline">Eventos</span>
          </button>
          <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-4 py-2 rounded-lg font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm">
            <Shield size={18} className="text-red-500"/> <span className="hidden sm:inline">Indisponibilidade</span>
          </button>
          
          <ToolsMenu 
            onExportIndividual={(m) => exportPDF(m)}
            onExportFull={() => exportPDF()}
            onWhatsApp={copyToWhatsApp}
            onCSV={generateCSV}
            onImportCSV={importCSV}
            onClearMonth={clearMonthSchedule}
            allMembers={allMembersList}
          />

          <button onClick={saveAll} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50">
            {loading ? <div className="animate-spin text-xl">⟳</div> : "Salvar"}
          </button>
        </div>
      </div>

      {nextEvent && (
        <NextEventCard 
          event={nextEvent} schedule={schedule} attendance={attendance} roles={roles}
          onShare={(txt) => { navigator.share ? navigator.share({ title: 'Escala', text: txt }).catch(console.error) : navigator.clipboard.writeText(txt).then(() => addToast("Copiado!", "success")); }}
          onConfirm={(key) => { const mid = ministryId; if (!mid) return; if (confirm("Confirmar presença manualmente?")) { const newVal = !attendance[key]; setAttendance({...attendance, [key]: newVal}); saveData(mid, 'attendance_v1', {...attendance, [key]: newVal}); } }}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
           <button onClick={generateAI} className="flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors"><Wand2 size={14}/> Gerar com IA</button>
           <button onClick={analyzeSchedule} className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"><BrainCircuit size={14}/> Analisar</button>
        </div>
        <div className="flex items-center gap-2">
           <NotificationToggle ministryId={ministryId} />
           <button onClick={() => setStatsOpen(true)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"><BarChart2 size={20} /></button>
           <button onClick={() => setLogsModalOpen(true)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"><Activity size={20} /></button>
        </div>
      </div>

      <ScheduleTable 
        events={visibleEvents} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={members} scheduleIssues={scheduleIssues} memberStats={memberStats}
        onCellChange={updateCell} onAttendanceToggle={toggleAttendance} onDeleteEvent={(iso) => setIgnoredEvents([...ignoredEvents, iso])}
      />
      
      {hiddenEventsList.length > 0 && <div className="mt-4 text-center"><button onClick={() => setEventsModalOpen(true)} className="text-xs text-zinc-400 hover:text-blue-500 underline">Ver {hiddenEventsList.length} ocultos</button></div>}

      <StatsModal isOpen={statsOpen} onClose={() => setStatsOpen(false)} stats={memberStats} monthName={getMonthName(currentMonth)} />
      <EventsModal isOpen={eventsModalOpen} onClose={() => setEventsModalOpen(false)} events={customEvents} hiddenEvents={hiddenEventsList} onAdd={evt => setCustomEvents([...customEvents, evt])} onRemove={id => setCustomEvents(customEvents.filter(e => e.id !== id))} onRestore={iso => setIgnoredEvents(ignoredEvents.filter(i => i !== iso))} />
      <AvailabilityModal isOpen={availModalOpen} onClose={() => setAvailModalOpen(false)} members={allMembersList} availability={availability} currentMonth={currentMonth} onUpdate={(m, dates) => setAvailability(prev => ({ ...prev, [m]: dates }))} />
      <RolesModal isOpen={rolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={setRoles} />
      <AuditModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={auditLog} />
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