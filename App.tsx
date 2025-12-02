
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { StatsModal } from './components/StatsModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { ToolsMenu } from './components/ToolsMenu';
import { MemberMap, ScheduleMap, AttendanceMap, CustomEvent, AvailabilityMap, DEFAULT_ROLES, AuditLogEntry } from './types';
import { loadData, saveData } from './services/supabaseService';
import { generateMonthEvents, getMonthName } from './utils/dateUtils';
import { Download, Users, Calendar, BarChart2, Plus, Trash2, Wand2, Shield, Settings, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { GoogleGenAI } from "@google/genai";

// Login Screen Component
const LoginScreen = ({ onLogin }: { onLogin: (id: string) => void }) => {
  const [input, setInput] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 p-4">
      <div className="bg-zinc-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h1 className="text-3xl font-bold text-center mb-2 text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Escala Mídia Pro</h1>
        <p className="text-zinc-400 text-center mb-8">Gestão Profissional de Ministério</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">ID do Ministério</label>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value.toLowerCase())}
              placeholder="ex: midia-sede" 
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              onKeyDown={e => e.key === 'Enter' && onLogin(input)}
            />
          </div>
          <button 
            onClick={() => onLogin(input)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-900/20"
          >
            Acessar Sistema
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- STATE ---
  const [ministryId, setMinistryId] = useState<string | null>(localStorage.getItem('escala_ministry_id'));
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data
  const [members, setMembers] = useState<MemberMap>({});
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [ignoredEvents, setIgnoredEvents] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [availModalOpen, setAvailModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

  // --- DERIVED STATE ---
  const [year, month] = currentMonth.split('-').map(Number);
  
  // Generate all potential events, then separate into visible and hidden
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
  
  const allMembersList = useMemo(() => {
    const list = new Set<string>();
    Object.values(members).forEach(arr => arr.forEach(m => list.add(m)));
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
  
  // Initial Load
  useEffect(() => {
    if (ministryId) {
      setLoading(true);
      const loadAll = async () => {
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
        setLoading(false);
      };
      loadAll();
    }
  }, [ministryId]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // --- ACTIONS ---

  const handleLogin = (id: string) => {
    if (id.length < 3) return alert("ID muito curto");
    localStorage.setItem('escala_ministry_id', id);
    setMinistryId(id);
  };

  const handleLogout = () => {
    if (confirm("Sair do sistema?")) {
      localStorage.removeItem('escala_ministry_id');
      setMinistryId(null);
    }
  };

  const saveAll = async () => {
    if (!ministryId) return;
    const btn = document.getElementById('save-btn');
    if(btn) btn.innerText = "Salvando...";
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
    if(btn) btn.innerText = "Salvar";
    alert("Dados salvos com sucesso na nuvem!");
  };

  // --- EVENT MANAGEMENT ---
  const handleDeleteEvent = (iso: string, title: string) => {
    if (!confirm(`Deseja remover o evento "${title}"?`)) return;

    // Check if it's a custom event
    const isCustom = customEvents.some(c => {
      const customIso = `${c.date}T${c.time}`;
      return customIso === iso;
    });

    if (isCustom) {
      setCustomEvents(prev => prev.filter(c => `${c.date}T${c.time}` !== iso));
      logAction("Excluir Evento Extra", title);
    } else {
      setIgnoredEvents(prev => [...prev, iso]);
      logAction("Ocultar Evento", title);
    }
  };

  const handleRestoreEvent = (iso: string) => {
    setIgnoredEvents(prev => prev.filter(e => e !== iso));
    logAction("Restaurar Evento", iso);
  };

  // --- MEMBER MANAGEMENT ---
  const addMember = () => {
    if (!newMemberName || !newMemberRole) return;
    const updated = { ...members };
    if (!updated[newMemberRole]) updated[newMemberRole] = [];
    if (updated[newMemberRole].includes(newMemberName)) return alert("Membro já existe");
    updated[newMemberRole].push(newMemberName);
    setMembers(updated);
    setNewMemberName("");
    logAction("Adicionar Membro", `${newMemberName} em ${newMemberRole}`);
  };

  const removeMember = (role: string, name: string) => {
    if (!confirm(`Remover ${name}?`)) return;
    const updated = { ...members };
    updated[role] = updated[role].filter(m => m !== name);
    setMembers(updated);
    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach(k => {
      if (newSchedule[k] === name && k.includes(role)) delete newSchedule[k];
    });
    setSchedule(newSchedule);
    logAction("Remover Membro", `${name} de ${role}`);
  };

  // --- TABLE ACTIONS ---
  const handleCellChange = (key: string, value: string) => {
    const newSchedule = { ...schedule };
    if (value) newSchedule[key] = value;
    else delete newSchedule[key];
    setSchedule(newSchedule);
  };

  // --- RESTORED UTILITIES ---
  
  const handleClearMonth = () => {
    if (!confirm(`Deseja limpar TODA a escala de ${getMonthName(currentMonth)}?`)) return;
    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach(key => {
      if (key.startsWith(currentMonth)) delete newSchedule[key];
    });
    setSchedule(newSchedule);
    logAction("Limpar Mês", getMonthName(currentMonth));
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
    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      theme: 'grid',
      headStyles: { fillColor: [41, 41, 41] },
    });
    doc.save(`escala_${currentMonth}.pdf`);
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

    if (data.length === 0) return alert("Este membro não tem escalas neste mês.");

    (doc as any).autoTable({
      head: [['Data', 'Evento', 'Função']],
      body: data,
      startY: 30,
      theme: 'grid'
    });
    doc.save(`escala_${memberName.replace(/\s/g, '_')}.pdf`);
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
    alert("Copiado para a área de transferência!");
  };

  // --- AI ---
  const handleAIGeneration = async () => {
    if (!process.env.API_KEY) return alert("API Key missing.");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let promptText = `Gere uma escala para ${getMonthName(currentMonth)}.
      Roles: ${roles.join(', ')}.
      Eventos: ${visibleEvents.map(e => `${e.title} (${e.dateDisplay})`).join(', ')}.
      Membros disponíveis: ${JSON.stringify(members)}.
      Histórico de indisponibilidade (YYYY-MM-DD): ${JSON.stringify(availability)}.
      Regras: Tente equilibrar a carga. Respeite a indisponibilidade.
      Retorne APENAS um JSON no formato: {"YYYY-MM-DDTHH:mm_Role": "NomeMembro"}.`;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: promptText,
        config: { responseMimeType: "application/json" }
      });
      const suggestion = JSON.parse(result.text || "{}");
      if (confirm("IA Gerou uma sugestão. Deseja aplicar?")) {
        setSchedule(prev => ({ ...prev, ...suggestion }));
        logAction("IA", "Gerou sugestão automática");
      }
    } catch (e: any) {
      console.error(e);
      alert("Erro na IA: " + (e.message || e));
    }
  };

  if (!ministryId) return <LoginScreen onLogin={handleLogin} />;
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
    >
      <div className="mb-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gestão profissional de escalas.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          <button onClick={saveAll} id="save-btn" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all">Salvar</button>
          <button onClick={() => setStatsOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg shadow-md transition-all"><BarChart2 size={18} /></button>
          <button onClick={handleAIGeneration} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-2 rounded-lg shadow-md transition-all"><Wand2 size={18} /></button>
          <button onClick={exportPDF} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 px-3 py-2 rounded-lg transition-all"><Download size={18} /></button>
          
          {/* New Tools Menu */}
          <ToolsMenu 
            onExportIndividual={exportIndividualPDF}
            onWhatsApp={copyWhatsApp}
            onCSV={exportCSV}
            onClearMonth={handleClearMonth}
            allMembers={allMembersList}
          />
        </div>
      </div>

      <ScheduleTable 
        events={visibleEvents}
        roles={roles}
        schedule={schedule}
        attendance={attendance}
        availability={availability}
        members={members}
        onCellChange={handleCellChange}
        onAttendanceToggle={(key) => setAttendance(prev => ({ ...prev, [key]: !prev[key] }))}
        onDeleteEvent={handleDeleteEvent}
        memberStats={memberStats}
      />

      {/* Modals */}
      <StatsModal isOpen={statsOpen} onClose={() => setStatsOpen(false)} stats={memberStats} monthName={getMonthName(currentMonth)} />
      
      <EventsModal 
        isOpen={eventsModalOpen} onClose={() => setEventsModalOpen(false)} 
        events={customEvents} 
        hiddenEvents={hiddenEventsList}
        onAdd={e => { setCustomEvents([...customEvents, e]); logAction("Add Evento", e.title); }} 
        onRemove={id => { setCustomEvents(customEvents.filter(e => e.id !== id)); logAction("Del Evento", id); }} 
        onRestore={handleRestoreEvent}
      />
      
      <AvailabilityModal 
        isOpen={availModalOpen} onClose={() => setAvailModalOpen(false)} 
        members={allMembersList} availability={availability} currentMonth={currentMonth}
        onUpdate={(m, dates) => setAvailability(prev => ({ ...prev, [m]: dates }))} 
      />

      <RolesModal 
        isOpen={rolesModalOpen} onClose={() => setRolesModalOpen(false)} 
        roles={roles} onUpdate={r => { setRoles(r); logAction("Update Roles", r.join(",")); }} 
      />

      <AuditModal isOpen={logsModalOpen} onClose={() => setLogsModalOpen(false)} logs={auditLog} />

    </DashboardLayout>
  );
};

export default App;
