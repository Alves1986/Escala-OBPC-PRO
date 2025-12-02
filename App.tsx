
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsModal } from './components/StatsModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis } from './types';
import { loadData, saveData, getStorageKey } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { Download, Users, Calendar, BarChart2, Plus, Trash2, Wand2, Shield, Settings, Activity, BrainCircuit } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { NextEventCard } from './components/NextEventCard';
import { NotificationToggle } from './components/NotificationToggle';
import { ConfirmationModal } from './components/ConfirmationModal';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './types';

// Initialize Supabase for Realtime subscription
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AppContent = () => {
  const { addToast, confirmAction } = useToast();
  // --- STATE ---
  const [ministryId, setMinistryId] = useState<string | null>(localStorage.getItem('escala_ministry_id'));
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
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
  const [loginLoading, setLoginLoading] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  
  // Confirmation Modal State
  const [confirmationData, setConfirmationData] = useState<any>(null);
  
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

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

  // Find Next Event Logic
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

  // --- LOGGING ---
  const logAction = (action: string, details: string) => {
    const newEntry: AuditLogEntry = {
      date: new Date().toLocaleString("pt-BR"),
      action,
      details
    };
    setAuditLog(prev => [newEntry, ...prev].slice(0, 200));
  };

  // --- EFFECTS ---

  // URL Parameter Check for Confirmation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const key = params.get('key');
    const name = params.get('name');

    if (action === 'confirm' && key && name) {
      // Decode key: 2023-10-01T19:30_Som
      const [isoDate, role] = key.split('_');
      const [datePart, timePart] = isoDate.split('T');
      const formattedDate = `${datePart.split('-').reverse().join('/')} às ${timePart}`;

      setConfirmationData({
        key,
        memberName: decodeURIComponent(name),
        eventName: 'Evento', // Generic, or could be fetched
        date: formattedDate,
        role: role
      });
    }
  }, []);

  // Realtime Subscription for Admin Notifications
  useEffect(() => {
    if (!ministryId) return;

    // Listen to changes in app_storage where key corresponds to attendance
    const attendanceKey = getStorageKey(ministryId, 'attendance_v1');
    
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_storage', filter: `key=eq.${attendanceKey}` },
        (payload) => {
          // Check if local data matches remote. If not, it means someone else updated it.
          const newData = payload.new.value as AttendanceMap;
          
          // Simple diff check: find a key that is TRUE in new data but FALSE/UNDEFINED in current state
          // NOTE: This runs on every client. We only want to notify if the app is in background or just open.
          // Since we update local state optimistically, we might trigger this on ourselves if we don't check carefully.
          // For simplicity in this demo, we just sync the data.
          setAttendance(newData);

          // Trigger Notification
          if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
             new Notification('Atualização na Escala', {
               body: 'Alguém confirmou presença! Abra o app para ver.',
               icon: 'https://img.icons8.com/fluency/192/calendar.png'
             });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ministryId]);

  
  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let swUrl = './sw.js';
      try {
        if (window.location.href) {
          swUrl = new URL('sw.js', window.location.href).href;
        }
      } catch (e) { console.warn(e); }
      
      navigator.serviceWorker.register(swUrl)
        .catch(err => console.warn('SW failed:', err));
    }
  }, []);

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
          setAuditLog(lg);
          setTheme(th);
          setIsConnected(true);
        } catch (e) {
          addToast("Erro ao carregar dados", "error");
          setIsConnected(false);
        } finally {
          setLoading(false);
          setLoginLoading(false);
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

  // --- ACTIONS ---

  const handleLogin = (id: string) => {
    setLoginLoading(true);
    setTimeout(() => {
      localStorage.setItem('escala_ministry_id', id);
      setMinistryId(id);
    }, 800);
  };

  const handleLogout = () => {
    confirmAction("Sair", "Deseja sair?", () => {
      localStorage.removeItem('escala_ministry_id');
      setMinistryId(null);
      setIsConnected(false);
    });
  };

  const saveAll = async () => {
    if (!ministryId) return;
    const btn = document.getElementById('save-btn');
    if(btn) btn.innerText = "Salvando...";
    
    try {
      await Promise.all([
        saveData(ministryId, 'members_v7', members),
        saveData(ministryId, 'escala_full_v7', schedule),
        saveData(ministryId, 'attendance_v1', attendance),
        saveData(ministryId, 'custom_events_v1', customEvents),
        saveData(ministryId, 'ignored_events_v1', ignoredEvents),
        saveData(ministryId, 'availability_v1', availability),
        saveData(ministryId, 'functions_config', roles),
        saveData(ministryId, 'audit_log_v1', auditLog),
        saveData(ministryId, 'theme_pref', theme),
      ]);
      addToast("Salvo!", "success");
      setIsConnected(true);
    } catch (e) {
      addToast("Erro ao salvar", "error");
      setIsConnected(false);
    } finally {
      if(btn) btn.innerText = "Salvar";
    }
  };

  const handleDeleteEvent = (iso: string, title: string) => {
    confirmAction("Remover Evento", `Remover "${title}"?`, () => {
      const isCustom = customEvents.some(c => `${c.date}T${c.time}` === iso);
      if (isCustom) {
        setCustomEvents(prev => prev.filter(c => `${c.date}T${c.time}` !== iso));
        logAction("Excluir Evento", title);
        addToast("Excluído", "success");
      } else {
        setIgnoredEvents(prev => [...prev, iso]);
        logAction("Ocultar Evento", title);
        addToast("Ocultado", "info");
      }
    });
  };

  const handleRestoreEvent = (iso: string) => {
    setIgnoredEvents(prev => prev.filter(e => e !== iso));
    addToast("Restaurado", "success");
  };

  const addMember = () => {
    if (!newMemberName || !newMemberRole) return addToast("Preencha tudo", "warning");
    const updated = { ...members };
    if (!updated[newMemberRole]) updated[newMemberRole] = [];
    if (updated[newMemberRole].includes(newMemberName)) return addToast("Já existe", "warning");
    updated[newMemberRole].push(newMemberName);
    setMembers(updated);
    setNewMemberName("");
    logAction("Novo Membro", newMemberName);
    addToast("Adicionado", "success");
  };

  const removeMember = (role: string, name: string) => {
    confirmAction("Remover", `Remover ${name}?`, () => {
      const updated = { ...members };
      updated[role] = updated[role].filter(m => m !== name);
      setMembers(updated);
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(k => {
        if (newSchedule[k] === name && k.includes(role)) delete newSchedule[k];
      });
      setSchedule(newSchedule);
      logAction("Remover Membro", name);
      addToast("Removido", "success");
    });
  };

  const handleCellChange = (key: string, value: string) => {
    const newSchedule = { ...schedule };
    if (value) newSchedule[key] = value;
    else delete newSchedule[key];
    setSchedule(newSchedule);
    if (scheduleIssues[key]) {
      const newIssues = { ...scheduleIssues };
      delete newIssues[key];
      setScheduleIssues(newIssues);
    }
  };

  const handleAttendanceToggle = async (key: string) => {
    const isConfirmed = !attendance[key];
    const newAttendance = { ...attendance, [key]: isConfirmed };
    setAttendance(newAttendance);
    
    // Immediate Save for Realtime
    if (ministryId) {
       await saveData(ministryId, 'attendance_v1', newAttendance);
    }

    const memberName = schedule[key] || 'Desconhecido';
    logAction(
      isConfirmed ? "Confirmou Presença" : "Removeu Presença",
      `${memberName} (${key.split('_')[1] || '?'})`
    );
  };
  
  const handleExternalConfirmation = async () => {
    if (!confirmationData) return;
    const { key, memberName } = confirmationData;
    
    // Update local state
    const newAttendance = { ...attendance, [key]: true };
    setAttendance(newAttendance);
    
    // Save immediately to DB
    if (ministryId) {
        await saveData(ministryId, 'attendance_v1', newAttendance);
        
        // Add specific log
        const newLog = {
          date: new Date().toLocaleString("pt-BR"),
          action: "Confirmação Externa",
          details: `${memberName} confirmou via Link.`
        };
        const newLogs = [newLog, ...auditLog].slice(0, 200);
        setAuditLog(newLogs);
        await saveData(ministryId, 'audit_log_v1', newLogs);
    }

    addToast(`Obrigado ${memberName}! Presença confirmada.`, "success");
    setConfirmationData(null);
    
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleClearMonth = () => {
    confirmAction("Limpar Mês", `Apagar escala de ${getMonthName(currentMonth)}?`, () => {
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(key => {
        if (key.startsWith(currentMonth)) delete newSchedule[key];
      });
      setSchedule(newSchedule);
      setScheduleIssues({});
      addToast("Mês limpo", "success");
    });
  };

  const handleCSVImport = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return addToast("CSV inválido", "error");

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name'));
      const roleIdx = headers.findIndex(h => h.includes('função') || h.includes('role'));
      const availIdx = headers.findIndex(h => h.includes('disponivel') || h.includes('datas'));

      if (nameIdx === -1 || roleIdx === -1) return addToast("Colunas obrigatórias faltando", "error");

      let isPositiveAvailability = false;
      if (availIdx !== -1) {
         if (confirm("As datas representam dias DISPONÍVEIS (Verde)?")) isPositiveAvailability = true;
      }

      const newMembers = { ...members };
      const newRoles = [...roles];
      const newAvailability = { ...availability };
      let addedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx];
        const roleRaw = cols[roleIdx];
        const availRaw = cols[availIdx];

        if (name && roleRaw) {
          const role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase();
          
          if (!newRoles.includes(role)) {
            newRoles.push(role);
            newMembers[role] = [];
          }
          if (!newMembers[role]) newMembers[role] = [];
          if (!newMembers[role].includes(name)) {
            newMembers[role].push(name);
            addedCount++;
          }

          if (availRaw) {
            const dates = availRaw.match(/\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}-\d{2}-\d{2}/g);
            if (dates) {
               const isoDates = dates.map(d => {
                 if (d.includes('/')) return d.split('/').reverse().join('-');
                 return d;
               });
               
               if (!isPositiveAvailability) {
                  const existing = newAvailability[name] || [];
                  newAvailability[name] = Array.from(new Set([...existing, ...isoDates]));
               } else {
                  const existing = newAvailability[name] || [];
                  const positiveDates = isoDates.map(d => `+${d}`);
                  newAvailability[name] = Array.from(new Set([...existing, ...positiveDates]));
               }
            }
          }
        }
      }

      setRoles(newRoles);
      setMembers(newMembers);
      setAvailability(newAvailability);
      
      await Promise.all([
        saveData(ministryId || "", 'members_v7', newMembers),
        saveData(ministryId || "", 'functions_config', newRoles),
        saveData(ministryId || "", 'availability_v1', newAvailability)
      ]);
      addToast(`Importado: ${addedCount} registros`, "success");
    };
    reader.readAsText(file);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text(`Escala - ${getMonthName(currentMonth)}`, 14, 15);
    const tableColumn = ["Data", "Evento", ...roles];
    const tableRows = visibleEvents.map(evt => {
      const row = [evt.dateDisplay, evt.title];
      roles.forEach(role => row.push(schedule[`${evt.iso}_${role}`] || "-"));
      return row;
    });
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 25, theme: 'grid' });
    doc.save(`escala_${currentMonth}.pdf`);
  };

  const exportIndividualPDF = (memberName: string) => {
    const doc = new jsPDF();
    doc.text(`Escala Individual - ${memberName}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Mês: ${getMonthName(currentMonth)}`, 14, 22);

    const data: any[] = [];
    visibleEvents.forEach(evt => {
      roles.forEach(role => {
        if (schedule[`${evt.iso}_${role}`] === memberName) {
          data.push([evt.dateDisplay, evt.title, role]);
        }
      });
    });

    if (data.length === 0) return addToast("Sem escalas", "info");

    autoTable(doc, { head: [['Data', 'Evento', 'Função']], body: data, startY: 30, theme: 'grid' });
    doc.save(`escala_${memberName.replace(/\s/g, '_')}.pdf`);
  };

  const exportCSV = () => {
    let csv = `Evento;Data;${roles.join(';')}\n`;
    visibleEvents.forEach(evt => {
      const cols = roles.map(role => schedule[`${evt.iso}_${role}`] || "").join(';');
      csv += `${evt.title};${evt.dateDisplay};${cols}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `escala-${currentMonth}.csv`;
    a.click();
  };

  const copyWhatsApp = () => {
    let text = `*Escala - ${getMonthName(currentMonth)}*\n\n`;
    visibleEvents.forEach(evt => {
      text += `*${evt.title} - ${evt.dateDisplay}*\n`;
      let hasEntry = false;
      roles.forEach(role => {
        const member = schedule[`${evt.iso}_${role}`];
        if (member) { text += `  - ${role}: ${member}\n`; hasEntry = true; }
      });
      if (!hasEntry) text += `  _(Vazio)_\n`;
      text += '\n';
    });
    navigator.clipboard.writeText(text);
    addToast("Copiado!", "success");
  };

  // --- AI HELPERS ---

  const handleAIGeneration = async () => {
    addToast("IA: Gerando...", "info");
    const btn = document.getElementById('ai-btn');
    if(btn) btn.classList.add('animate-pulse');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const availabilityContext: any = {};
      Object.keys(availability).forEach(m => {
          availabilityContext[m] = {
              blocked: availability[m].filter(d => !d.startsWith('+')),
              preferred: availability[m].filter(d => d.startsWith('+')).map(d => d.substring(1))
          };
      });

      let promptText = `Gere escala para ${getMonthName(currentMonth)}.
      ROLES: ${roles.join(', ')}.
      EVENTOS: ${visibleEvents.map(e => `${e.title} (${e.iso.split('T')[0]})`).join(', ')}
      MEMBROS: ${JSON.stringify(members)}.
      DISPONIBILIDADE: ${JSON.stringify(availabilityContext)}.
      Regras: Respeite bloqueios, priorize preferidos. Retorne JSON: {"key": "nome"}`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });
      
      const cleanText = (result.text || "{}").replace(/```json|```/g, '').trim();
      const suggestion = JSON.parse(cleanText);
      
      confirmAction("IA Pronta", "Aplicar sugestão?", () => {
          setSchedule(prev => ({ ...prev, ...suggestion }));
          logAction("IA", "Escala gerada");
          addToast("Aplicado!", "success");
      });

    } catch (e) { addToast("Erro IA", "error"); } 
    finally { if(btn) btn.classList.remove('animate-pulse'); }
  };

  const handleAIReview = async () => {
    addToast("IA: Revisando...", "info");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentAssignments: any = {};
      Object.keys(schedule).forEach(k => { if (k.startsWith(currentMonth)) currentAssignments[k] = schedule[k]; });

      const promptText = `Revise escala. Dados: ${JSON.stringify(currentAssignments)}. Disp: ${JSON.stringify(availability)}. Stats: ${JSON.stringify(memberStats)}.
      Retorne JSON com erros/avisos: {"key": {"type": "warning", "message": "msg"}}`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      const cleanText = (result.text || "{}").replace(/```json|```/g, '').trim();
      setScheduleIssues(JSON.parse(cleanText));
      addToast("Revisão concluída", "success");
    } catch (e) { addToast("Erro IA", "error"); }
  };

  const handleShareNextEvent = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!ministryId) return <LoginScreen onLogin={handleLogin} isLoading={loginLoading} />;
  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-900 text-white">Carregando...</div>;

  // --- RENDER SIDEBAR ---
  const SidebarContent = (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Mês</label>
        <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
      </div>

      <div>
         <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Gestão</label>
         <div className="grid grid-cols-2 gap-2">
           <button onClick={() => setEventsModalOpen(true)} className="bg-orange-600 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Calendar size={14}/> Eventos</button>
           <button onClick={() => setAvailModalOpen(true)} className="bg-purple-600 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Shield size={14}/> Disp.</button>
           <button onClick={() => setRolesModalOpen(true)} className="bg-zinc-600 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Settings size={14}/> Funções</button>
           <button onClick={() => setLogsModalOpen(true)} className="bg-blue-900 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Activity size={14}/> Logs</button>
         </div>
      </div>

      <div>
         <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Novo Membro</label>
         <div className="space-y-2">
           <input type="text" placeholder="Nome" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded p-2 text-sm"/>
           <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded p-2 text-sm">
             <option value="">Função...</option>
             {roles.map(r => <option key={r} value={r}>{r}</option>)}
           </select>
           <button onClick={addMember} className="w-full bg-green-600 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"><Plus size={14} /> Adicionar</button>
         </div>
      </div>

      <div className="flex-1">
        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Equipe</label>
        <div className="space-y-3">
          {roles.map(role => (
            <div key={role} className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-2 border border-zinc-200 dark:border-zinc-700/50">
              <h4 className="text-xs font-bold text-brand-600 mb-2">{role}</h4>
              <ul className="space-y-1">
                {(members[role] || []).length === 0 && <li className="text-xs text-zinc-400 italic">Vazio</li>}
                {(members[role] || []).map(m => (
                  <li key={m} className="flex justify-between items-center text-xs group">
                    <span className="text-zinc-700 dark:text-zinc-300">{m}</span>
                    <button onClick={() => removeMember(role, m)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout 
      sidebar={SidebarContent} 
      sidebarOpen={sidebarOpen} 
      setSidebarOpen={setSidebarOpen}
      theme={theme}
      toggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
      onLogout={handleLogout}
      title="Escala Mídia Pro"
      isConnected={isConnected}
    >
      <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestão profissional de escalas.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <button onClick={saveAll} id="save-btn" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all">Salvar</button>
          <button onClick={() => setStatsOpen(true)} className="bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-md" title="Estatísticas"><BarChart2 size={18} /></button>
          
          <div className="flex bg-zinc-200 dark:bg-zinc-700 rounded-lg p-0.5">
            <button onClick={handleAIGeneration} id="ai-btn" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-600 text-sm font-medium"><Wand2 size={16} /> Gerar</button>
            <div className="w-px bg-zinc-300 dark:bg-zinc-600 my-1"></div>
            <button onClick={handleAIReview} id="ai-review-btn" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-600 text-sm font-medium" title="Revisar"><BrainCircuit size={16} /> Revisar</button>
          </div>

          <NotificationToggle ministryId={ministryId} />
          <button onClick={exportPDF} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 px-3 py-2 rounded-lg" title="Baixar PDF"><Download size={18} /></button>
          
          <ToolsMenu 
            onExportIndividual={exportIndividualPDF}
            onWhatsApp={copyWhatsApp}
            onCSV={exportCSV}
            onImportCSV={handleCSVImport}
            onClearMonth={handleClearMonth}
            allMembers={allMembersList}
          />
        </div>
      </div>

      <NextEventCard 
        event={nextEvent} 
        schedule={schedule}
        attendance={attendance}
        roles={roles} 
        onShare={handleShareNextEvent}
        onConfirm={handleAttendanceToggle}
      />

      <ScheduleTable 
        events={visibleEvents}
        roles={roles}
        schedule={schedule}
        attendance={attendance}
        availability={availability}
        members={members}
        scheduleIssues={scheduleIssues}
        onCellChange={handleCellChange}
        onAttendanceToggle={handleAttendanceToggle}
        onDeleteEvent={handleDeleteEvent}
        memberStats={memberStats}
      />

      <StatsModal isOpen={statsOpen} onClose={() => setStatsOpen(false)} stats={memberStats} monthName={getMonthName(currentMonth)} />
      <EventsModal isOpen={eventsModalOpen} onClose={() => setEventsModalOpen(false)} events={customEvents} hiddenEvents={hiddenEventsList} onAdd={e => { setCustomEvents([...customEvents, e]); addToast("Evento add", "success"); }} onRemove={id => { setCustomEvents(customEvents.filter(e => e.id !== id)); addToast("Evento removido", "success"); }} onRestore={handleRestoreEvent} />
      <AvailabilityModal isOpen={availModalOpen} onClose={() => setAvailModalOpen(false)} members={allMembersList} availability={availability} currentMonth={currentMonth} onUpdate={(m, dates) => setAvailability(prev => ({ ...prev, [m]: dates }))} />
      <RolesModal isOpen={rolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={r => { setRoles(r); addToast("Funções atualizadas", "info"); }} />
      <AuditModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={auditLog} />

      {/* Confirmation Modal - Pops up when URL param is present */}
      <ConfirmationModal 
        isOpen={!!confirmationData} 
        onClose={() => setConfirmationData(null)}
        onConfirm={handleExternalConfirmation}
        data={confirmationData}
      />

    </DashboardLayout>
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
