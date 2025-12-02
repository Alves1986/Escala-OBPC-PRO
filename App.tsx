
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsModal } from './components/StatsModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { ToolsMenu } from './components/ToolsMenu';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry, ScheduleAnalysis } from './types';
import { loadData, saveData } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { Download, Users, Calendar, BarChart2, Plus, Trash2, Wand2, Shield, Settings, Activity, BrainCircuit } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";
import { NextEventCard } from './components/NextEventCard';
import { NotificationToggle } from './components/NotificationToggle';

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
  const [loginLoading, setLoginLoading] = useState(false); // New state for login spinner
  const [statsOpen, setStatsOpen] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  
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
    // Sort events by date just in case
    const sorted = [...visibleEvents].sort((a, b) => a.iso.localeCompare(b.iso));
    
    return sorted.find(evt => {
      // evt.iso format is YYYY-MM-DDTHH:mm
      const eventDate = new Date(evt.iso);
      // Add 2 hours to event time to consider it "passed" only after it started
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
  
  // Register Service Worker for PWA and Push Notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let swUrl = './sw.js';
      try {
        // Attempt to construct absolute URL to bypass <base> tag issues in preview environments
        // If window.location.href is invalid or not available, fallback to relative path
        if (window.location.href) {
          swUrl = new URL('sw.js', window.location.href).href;
        }
      } catch (e) {
        console.warn("Could not construct absolute SW URL, using relative path:", e);
      }
      
      navigator.serviceWorker.register(swUrl)
        .then(registration => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch(err => {
          // Log warning instead of error to avoid console noise in environments where SW is restricted
          console.warn('Service Worker registration failed (PWA features disabled):', err);
        });
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
          } else {
             setMembers(m);
          }

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
          addToast("Erro ao carregar dados do Supabase", "error");
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

  // When month changes, clear issues
  useEffect(() => {
    setScheduleIssues({});
  }, [currentMonth]);

  // --- ACTIONS ---

  const handleLogin = (id: string) => {
    setLoginLoading(true);
    // Simular um pequeno delay para feedback visual
    setTimeout(() => {
      localStorage.setItem('escala_ministry_id', id);
      setMinistryId(id);
    }, 800);
  };

  const handleLogout = () => {
    confirmAction("Sair do Sistema", "Você tem certeza que deseja sair?", () => {
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
      addToast("Dados salvos na nuvem!", "success");
      setIsConnected(true);
    } catch (e) {
      addToast("Erro ao salvar dados", "error");
      setIsConnected(false);
    } finally {
      if(btn) btn.innerText = "Salvar";
    }
  };

  const handleDeleteEvent = (iso: string, title: string) => {
    confirmAction("Remover Evento", `Deseja remover ou ocultar o evento "${title}"?`, () => {
      const isCustom = customEvents.some(c => {
        const customIso = `${c.date}T${c.time}`;
        return customIso === iso;
      });

      if (isCustom) {
        setCustomEvents(prev => prev.filter(c => `${c.date}T${c.time}` !== iso));
        logAction("Excluir Evento Extra", title);
        addToast("Evento excluído", "success");
      } else {
        setIgnoredEvents(prev => [...prev, iso]);
        logAction("Ocultar Evento", title);
        addToast("Evento ocultado", "info");
      }
    });
  };

  const handleRestoreEvent = (iso: string) => {
    setIgnoredEvents(prev => prev.filter(e => e !== iso));
    logAction("Restaurar Evento", iso);
    addToast("Evento restaurado", "success");
  };

  const addMember = () => {
    if (!newMemberName || !newMemberRole) return addToast("Preencha nome e função", "warning");
    const updated = { ...members };
    if (!updated[newMemberRole]) updated[newMemberRole] = [];
    if (updated[newMemberRole].includes(newMemberName)) return addToast("Membro já existe nesta função", "warning");
    updated[newMemberRole].push(newMemberName);
    setMembers(updated);
    setNewMemberName("");
    logAction("Adicionar Membro", `${newMemberName} em ${newMemberRole}`);
    addToast("Membro adicionado", "success");
  };

  const removeMember = (role: string, name: string) => {
    confirmAction("Remover Membro", `Tem certeza que deseja remover ${name} da função ${role}?`, () => {
      const updated = { ...members };
      updated[role] = updated[role].filter(m => m !== name);
      setMembers(updated);
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(k => {
        if (newSchedule[k] === name && k.includes(role)) delete newSchedule[k];
      });
      setSchedule(newSchedule);
      logAction("Remover Membro", `${name} de ${role}`);
      addToast("Membro removido", "success");
    });
  };

  const handleCellChange = (key: string, value: string) => {
    const newSchedule = { ...schedule };
    if (value) newSchedule[key] = value;
    else delete newSchedule[key];
    setSchedule(newSchedule);
    // Clear issue for this cell if modified
    if (scheduleIssues[key]) {
      const newIssues = { ...scheduleIssues };
      delete newIssues[key];
      setScheduleIssues(newIssues);
    }
  };

  const handleAttendanceToggle = (key: string) => {
    const isConfirmed = !attendance[key];
    setAttendance(prev => ({ ...prev, [key]: isConfirmed }));
    
    // Log Activity
    const memberName = schedule[key] || 'Desconhecido';
    // key is like 2023-10-01T09:00_Som
    const parts = key.split('_');
    const role = parts.length > 1 ? parts[1] : '?';
    
    logAction(
      isConfirmed ? "Confirmar Presença" : "Remover Presença",
      `${memberName} (${role})`
    );
  };

  const handleClearMonth = () => {
    confirmAction("Limpar Mês", `Deseja apagar TODA a escala de ${getMonthName(currentMonth)}?`, () => {
      const newSchedule = { ...schedule };
      Object.keys(newSchedule).forEach(key => {
        if (key.startsWith(currentMonth)) delete newSchedule[key];
      });
      setSchedule(newSchedule);
      setScheduleIssues({});
      logAction("Limpar Mês", getMonthName(currentMonth));
      addToast("Mês limpo com sucesso", "success");
    });
  };

  const handleCSVImport = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return addToast("Arquivo CSV inválido", "error");

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('membro'));
      const roleIdx = headers.findIndex(h => h.includes('função') || h.includes('role') || h.includes('cargo'));
      const availIdx = headers.findIndex(h => h.includes('disponivel') || h.includes('datas') || h.includes('dates'));

      if (nameIdx === -1 || roleIdx === -1) {
        return addToast("Colunas 'Nome' e 'Função' obrigatórias", "error");
      }

      let isPositiveAvailability = false;
      if (availIdx !== -1) {
         if (confirm("As datas no CSV representam dias DISPONÍVEIS (Verde)?\nClique em 'Cancelar' se forem dias de INDISPONIBILIDADE.")) {
             isPositiveAvailability = true;
         }
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

          // Availability Logic
          if (availRaw) {
            // Try to parse dates like DD/MM/YYYY or YYYY-MM-DD
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
                  // For positive availability, we save as "+YYYY-MM-DD"
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
      
      logAction("Importar CSV", `Processados ${addedCount} registros.`);
      addToast(`Importação concluída!`, "success");
    };
    reader.readAsText(file);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = `Escala - ${getMonthName(currentMonth)}`;
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    const tableColumn = ["Data", "Evento", ...roles];
    const tableRows = visibleEvents.map(evt => {
      const row = [evt.dateDisplay, evt.title];
      roles.forEach(role => row.push(schedule[`${evt.iso}_${role}`] || "-"));
      return row;
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      theme: 'grid',
      headStyles: { fillColor: [41, 41, 41] },
    });
    
    doc.save(`escala_${currentMonth}.pdf`);
    addToast("PDF gerado com sucesso", "success");
  };

  const exportIndividualPDF = (memberName: string) => {
    const doc = new jsPDF();
    const title = `Escala Individual - ${memberName}`;
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(12);
    doc.text(`Mês: ${getMonthName(currentMonth)}`, 14, 22);

    const data: any[] = [];
    visibleEvents.forEach(evt => {
      roles.forEach(role => {
        const assigned = schedule[`${evt.iso}_${role}`];
        if (assigned === memberName) {
          data.push([evt.dateDisplay, evt.title, role]);
        }
      });
    });

    if (data.length === 0) return addToast("Este membro não tem escalas.", "info");

    autoTable(doc, {
      head: [['Data', 'Evento', 'Função']],
      body: data,
      startY: 30,
      theme: 'grid'
    });
    doc.save(`escala_${memberName.replace(/\s/g, '_')}.pdf`);
    addToast("PDF Individual gerado", "success");
  };

  const exportCSV = () => {
    let csv = `Evento;Data;${roles.join(';')}\n`;
    visibleEvents.forEach(evt => {
      const cols = roles.map(role => schedule[`${evt.iso}_${role}`] || "").join(';');
      csv += `${evt.title};${evt.dateDisplay};${cols}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-${currentMonth}.csv`;
    a.click();
    addToast("CSV baixado", "success");
  };

  const copyWhatsApp = () => {
    let text = `*Escala - ${getMonthName(currentMonth)}*\n\n`;
    visibleEvents.forEach(evt => {
      text += `*${evt.title} - ${evt.dateDisplay}*\n`;
      let hasEntry = false;
      roles.forEach(role => {
        const member = schedule[`${evt.iso}_${role}`];
        if (member) {
          text += `  - ${role}: ${member}\n`;
          hasEntry = true;
        }
      });
      if (!hasEntry) text += `  _(Ninguém escalado)_\n`;
      text += '\n';
    });
    navigator.clipboard.writeText(text);
    addToast("Copiado para WhatsApp!", "success");
  };

  // --- AI HELPERS ---

  const handleAIGeneration = async () => {
    addToast("IA: Analisando escalas e disponibilidade...", "info");
    const btn = document.getElementById('ai-btn');
    if(btn) btn.classList.add('animate-pulse');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const availabilityContext: Record<string, { blocked: string[], preferred: string[] }> = {};
      Object.keys(availability).forEach(m => {
          availabilityContext[m] = {
              blocked: availability[m].filter(d => !d.startsWith('+')),
              preferred: availability[m].filter(d => d.startsWith('+')).map(d => d.substring(1))
          };
      });

      let promptText = `Atue como um gestor de escalas. Gere uma escala para ${getMonthName(currentMonth)}.
      
      ROLES: ${roles.join(', ')}.
      
      EVENTOS: 
      ${visibleEvents.map(e => `- ${e.title} (${e.iso.split('T')[0]})`).join('\n')}
      
      MEMBROS POR ROLE: ${JSON.stringify(members)}.
      
      DISPONIBILIDADE: ${JSON.stringify(availabilityContext)}.
      
      REGRAS CRÍTICAS:
      1. PRIORIDADE MÁXIMA: Se um membro tem data em "preferred", escale-o nesse dia.
      2. PROIBIDO: Jamais escale membro em data "blocked".
      3. Tente equilibrar a carga entre quem não tem restrições.
      
      Retorne APENAS um JSON válido no formato: 
      {
        "YYYY-MM-DDTHH:mm_Role": "NomeMembro"
      }
      Sem markdown, sem explicações.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });
      
      const responseText = result.text || "{}";
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const suggestion = JSON.parse(cleanText);
      
      confirmAction("Sugestão da IA Pronta", "A IA gerou uma escala baseada na disponibilidade. Deseja aplicar?", () => {
          setSchedule(prev => ({ ...prev, ...suggestion }));
          logAction("IA", "Gerou sugestão automática");
          addToast("Escala gerada pela IA!", "success");
      });

    } catch (e: any) {
      console.error(e);
      addToast("Erro na IA: Verifique a API Key ou configuração.", "error");
    } finally {
      if(btn) btn.classList.remove('animate-pulse');
    }
  };

  const handleAIReview = async () => {
    addToast("IA: Revisando escala atual...", "info");
    const btn = document.getElementById('ai-review-btn');
    if(btn) btn.classList.add('animate-pulse');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Build current assignments for the month
      const currentAssignments: Record<string, string> = {};
      Object.keys(schedule).forEach(k => {
          if (k.startsWith(currentMonth)) currentAssignments[k] = schedule[k];
      });

      if (Object.keys(currentAssignments).length === 0) {
        return addToast("Nenhuma escala para revisar.", "warning");
      }

      const promptText = `Analise a escala de mídia abaixo e identifique problemas.
      
      CONTEXTO:
      - Escala Atual: ${JSON.stringify(currentAssignments)}
      - Disponibilidade (blocked=não pode, preferred=quer): ${JSON.stringify(availability)}
      - Estatísticas de uso: ${JSON.stringify(memberStats)}

      OBJETIVO:
      Encontre:
      1. Membros escalados muitas vezes seguidas (Cansaço).
      2. Distribuição injusta (alguém com 5 escalas, outro com 0).
      3. Membros escalados em dias que NÃO preferem (mas não bloquearam).
      4. Qualquer outro problema lógico.

      Retorne um JSON onde a CHAVE é o ID da escala ("YYYY-MM-DDTHH:mm_Role") e o VALOR é um objeto com:
      - "type": "warning" ou "error"
      - "message": "Explicação curta do problema"
      - "suggestedReplacement": "Nome de outro membro sugerido (opcional)"

      Formato de saída:
      {
        "2023-10-01T09:00_Som": { "type": "warning", "message": "Membro escalado 3x seguidas", "suggestedReplacement": "João" }
      }
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });

      const responseText = result.text || "{}";
      const cleanText = responseText.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(cleanText);
      
      setScheduleIssues(analysis);
      
      const issueCount = Object.keys(analysis).length;
      if (issueCount > 0) {
        addToast(`IA encontrou ${issueCount} pontos de atenção.`, "warning");
      } else {
        addToast("IA: Nenhuma problema grave encontrado!", "success");
      }

    } catch (e: any) {
      console.error(e);
      addToast("Erro na Revisão IA", "error");
    } finally {
      if(btn) btn.classList.remove('animate-pulse');
    }
  };

  const handleShareNextEvent = (text: string) => {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  if (!ministryId) return <LoginScreen onLogin={handleLogin} isLoading={loginLoading} />;
  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-zinc-900 text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

  // --- RENDER SIDEBAR ---
  const SidebarContent = (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Período</label>
        <input 
          type="month" 
          value={currentMonth}
          onChange={(e) => setCurrentMonth(e.target.value)}
          className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-brand-500 outline-none"
        />
      </div>

      <div>
         <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Gestão</label>
         <div className="grid grid-cols-2 gap-2">
           <button onClick={() => setEventsModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Calendar size={14}/> Eventos</button>
           <button onClick={() => setAvailModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Shield size={14}/> Disp.</button>
           <button onClick={() => setRolesModalOpen(true)} className="bg-zinc-600 hover:bg-zinc-700 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Settings size={14}/> Funções</button>
           <button onClick={() => setLogsModalOpen(true)} className="bg-blue-900 hover:bg-blue-800 text-white text-xs py-2 rounded flex items-center justify-center gap-1"><Activity size={14}/> Logs</button>
         </div>
      </div>

      <div>
         <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Adicionar Membro</label>
         <div className="space-y-2">
           <input type="text" placeholder="Nome" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded p-2 text-sm"/>
           <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded p-2 text-sm">
             <option value="">Função...</option>
             {roles.map(r => <option key={r} value={r}>{r}</option>)}
           </select>
           <button onClick={addMember} className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"><Plus size={14} /> Adicionar</button>
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
          <button onClick={() => setStatsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg shadow-md transition-all" title="Estatísticas"><BarChart2 size={18} /></button>
          
          <div className="flex bg-zinc-200 dark:bg-zinc-700 rounded-lg p-0.5">
            <button onClick={handleAIGeneration} id="ai-btn" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-600 transition-all text-sm font-medium">
                <Wand2 size={16} /> Gerar
            </button>
            <div className="w-px bg-zinc-300 dark:bg-zinc-600 my-1"></div>
            <button onClick={handleAIReview} id="ai-review-btn" className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white dark:hover:bg-zinc-600 transition-all text-sm font-medium" title="Revisar escala atual com IA">
                <BrainCircuit size={16} /> Revisar
            </button>
          </div>

          <NotificationToggle ministryId={ministryId} />

          <button onClick={exportPDF} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 px-3 py-2 rounded-lg transition-all" title="Baixar PDF"><Download size={18} /></button>
          
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
      
      <EventsModal 
        isOpen={eventsModalOpen} onClose={() => setEventsModalOpen(false)} 
        events={customEvents} 
        hiddenEvents={hiddenEventsList}
        onAdd={e => { setCustomEvents([...customEvents, e]); logAction("Add Evento", e.title); addToast("Evento adicionado", "success"); }} 
        onRemove={id => { setCustomEvents(customEvents.filter(e => e.id !== id)); logAction("Del Evento", id); addToast("Evento removido", "success"); }} 
        onRestore={handleRestoreEvent}
      />
      
      <AvailabilityModal 
        isOpen={availModalOpen} onClose={() => setAvailModalOpen(false)} 
        members={allMembersList} availability={availability} currentMonth={currentMonth}
        onUpdate={(m, dates) => setAvailability(prev => ({ ...prev, [m]: dates }))} 
      />

      <RolesModal 
        isOpen={rolesModalOpen} onClose={() => setRolesModalOpen(false)} 
        roles={roles} onUpdate={r => { setRoles(r); logAction("Update Roles", r.join(",")); addToast("Funções atualizadas", "info"); }} 
      />

      <AuditModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={auditLog} />

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
