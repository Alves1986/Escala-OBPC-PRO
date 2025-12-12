
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Calendar, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Trash2, ShieldAlert, Clock, ArrowLeft, ArrowRight,
  ShieldCheck, Mail, Phone, Calendar as CalendarIcon, Gift, Trophy
} from 'lucide-react';
import { ToastProvider, useToast } from './Toast';
import { LoginScreen } from './LoginScreen';
import { SetupScreen } from './SetupScreen';
import { DashboardLayout } from './DashboardLayout';
import { NextEventCard } from './NextEventCard';
import { BirthdayCard } from './BirthdayCard';
import { WeatherWidget } from './WeatherWidget';
import { ScheduleTable } from './ScheduleTable';
import { CalendarGrid } from './CalendarGrid';
import { AvailabilityScreen } from './AvailabilityScreen';
import { SwapRequestsScreen } from './SwapRequestsScreen';
import { RepertoireScreen } from './RepertoireScreen';
import { AnnouncementsScreen } from './AnnouncementsScreen';
import { AlertsManager } from './AlertsManager';
import { AvailabilityReportScreen } from './AvailabilityReportScreen';
import { SettingsScreen } from './SettingsScreen';
import { ProfileScreen } from './ProfileScreen';
import { EventsScreen } from './EventsScreen';
import { InstallBanner } from './InstallBanner';
import { InstallModal } from './InstallModal';
import { JoinMinistryModal } from './JoinMinistryModal';
import { ToolsMenu } from './ToolsMenu';
import { EventDetailsModal } from './EventDetailsModal';
import { StatsModal } from './StatsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal } from './ManagementModals';
import { RankingScreen } from './RankingScreen';

import * as Supabase from '../services/supabaseService';
import { generateScheduleWithAI } from '../services/aiService';
import { ThemeMode, SUPABASE_URL, SUPABASE_KEY } from '../types';
import { adjustMonth, getMonthName, getLocalDateISOString } from '../utils/dateUtils';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from '../utils/pushUtils';

// Novos Hooks
import { useAuth } from '../hooks/useAuth';
import { useMinistryData } from '../hooks/useMinistryData';

const InnerApp = () => {
  // --- CONFIG CHECK ---
  if (!SUPABASE_URL || !SUPABASE_KEY) {
      return <SetupScreen />;
  }

  // --- CUSTOM HOOKS ---
  const { currentUser, setCurrentUser, loadingAuth } = useAuth();
  
  const [ministryId, setMinistryId] = useState<string>('midia');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  
  // Lógica de Tabs Atualizada: Detecta retorno do Spotify
  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          // Se tiver voltando do Spotify com token no hash, força a aba de gerenciamento
          if (window.location.hash && window.location.hash.includes('access_token')) {
              return 'repertoire-manager';
          }
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  const { 
    events, setEvents,
    schedule, setSchedule,
    attendance, setAttendance,
    membersMap, 
    publicMembers, 
    availability, setAvailability,
    notifications, setNotifications,
    announcements, 
    repertoire, setRepertoire,
    swapRequests, 
    globalConflicts,
    roles, 
    ministryTitle, setMinistryTitle,
    availabilityWindow,
    refreshData: loadData
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [eventDetailsModal, setEventDetailsModal] = useState<{ isOpen: boolean; event: any | null }>({ isOpen: false, event: null });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<any>(null);

  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);

  // Ref para controlar a última atualização e evitar recargas agressivas
  const lastRefreshTimeRef = useRef<number>(Date.now());

  const { addToast, confirmAction } = useToast();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
      try {
          const saved = localStorage.getItem('themeMode');
          return (saved as ThemeMode) || 'system';
      } catch (e) {
          return 'system';
      }
  });
  const [visualTheme, setVisualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
      if (currentUser?.ministryId) {
          setMinistryId(currentUser.ministryId);
      }
  }, [currentUser]);

  // Auto-refresh data on window focus (THROTTLED)
  useEffect(() => {
      const handleFocus = () => {
          if (currentUser && ministryId) {
              const now = Date.now();
              // Só atualiza se passaram mais de 10 minutos (600000ms) desde a última carga
              // Isso evita perder dados de formulários ao trocar de aba/app rapidamente
              if (now - lastRefreshTimeRef.current > 600000) {
                  console.log("Retornou ao app após tempo inativo: Atualizando dados...");
                  loadData();
                  lastRefreshTimeRef.current = now;
              }
          }
      };
      
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser, ministryId, loadData]);

  useEffect(() => {
      const url = new URL(window.location.href);
      // Evita sobrescrever se estamos com hash de acesso (token spotify)
      if (!window.location.hash.includes('access_token')) {
          if (url.searchParams.get('tab') !== currentTab) {
              url.searchParams.set('tab', currentTab);
              try {
                window.history.replaceState({}, '', url.toString());
              } catch (e) {}
          }
      }
  }, [currentTab]);

  useEffect(() => {
      const handlePwaReady = () => setShowInstallBanner(true);
      window.addEventListener('pwa-ready', handlePwaReady);
      return () => window.removeEventListener('pwa-ready', handlePwaReady);
  }, []);

  useEffect(() => {
    const applyTheme = () => {
        let targetTheme: 'light' | 'dark' = 'light';
        if (themeMode === 'system') {
            const hour = new Date().getHours();
            if (hour >= 6 && hour < 18) targetTheme = 'light';
            else targetTheme = 'dark';
        } else {
            targetTheme = themeMode;
        }
        setVisualTheme(targetTheme);
        if (targetTheme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    };
    applyTheme();
    let interval: any;
    if (themeMode === 'system') interval = setInterval(applyTheme, 60000);
    return () => { if (interval) clearInterval(interval); };
  }, [themeMode]);

  const handleSetThemeMode = (mode: ThemeMode) => setThemeMode(mode);
  
  const handleSaveTheme = () => {
      try {
          localStorage.setItem('themeMode', themeMode);
          addToast("Preferência de tema salva com sucesso!", "success");
      } catch (e) {
          addToast("Erro ao salvar preferência.", "warning");
      }
  };

  const toggleVisualTheme = () => {
      if (themeMode === 'system') setThemeMode(visualTheme === 'light' ? 'dark' : 'light');
      else setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    confirmAction(
      "Sair",
      "Deseja realmente sair do sistema?",
      async () => {
        await Supabase.logout();
        setCurrentUser(null);
        try { window.history.replaceState(null, '', '/'); } catch(e) {}
      }
    );
  };

  const handleSwitchMinistry = (id: string) => {
      setMinistryId(id);
      if (currentUser) {
          setCurrentUser({ ...currentUser, ministryId: id });
      }
      addToast(`Alternado para ${id}`, 'info');
  };

  const handleJoinMinistry = async (newId: string, roles: string[]) => {
      const result = await Supabase.joinMinistry(newId, roles);
      if (result.success) {
          addToast(result.message, 'success');
          window.location.reload();
      } else {
          addToast(result.message, 'error');
      }
  };

  const handleInstallApp = () => {
      const promptEvent = (window as any).deferredPrompt;
      if (promptEvent) {
          promptEvent.prompt();
          promptEvent.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') console.log('User accepted PWA install');
              setShowInstallBanner(false);
          });
      } else {
          setShowInstallModal(true);
      }
  };

  const handleCellChange = async (key: string, value: string) => {
      let keyToRemove: string | null = null;
      if (value) {
          const eventIso = key.substring(0, 16);
          Object.entries(schedule).forEach(([k, val]) => {
              if (k.startsWith(eventIso) && k !== key) {
                  if (val === value) keyToRemove = k; 
              }
          });
      }

      setSchedule(prev => {
          const next = { ...prev };
          if (keyToRemove) delete next[keyToRemove];
          if (value) next[key] = value; else delete next[key];
          return next;
      });

      if (keyToRemove) await Supabase.saveScheduleAssignment(ministryId, keyToRemove, "");
      const success = await Supabase.saveScheduleAssignment(ministryId, key, value);
      if (!success) {
          addToast("Erro ao salvar escala.", "error");
          loadData();
      }
  };

  const handleAttendanceToggle = async (key: string) => {
      const success = await Supabase.toggleAssignmentConfirmation(ministryId, key);
      if (success) {
          setAttendance(prev => {
              const newVal = !prev[key];
              const copy = { ...prev };
              if (newVal) copy[key] = true; else delete copy[key];
              return copy;
          });
      }
  };

  const handleEnableNotifications = async () => {
      try {
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error("Push não suportado");
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
          if (sub) {
              await Supabase.saveSubscriptionSQL(ministryId, sub);
              addToast("Notificações ativadas!", "success");
          }
      } catch(e: any) {
          addToast("Erro ao ativar notificações.", "error");
      }
  };

  // --- AI HANDLER ---
  const handleAiAutoFill = async () => {
      if (Object.keys(schedule).length > 0) {
          if (!confirm("A escala já possui itens preenchidos. Deseja sobrescrever usando Inteligência Artificial?")) return;
      }

      addToast("Gerando escala inteligente com Gemini... aguarde.", "info");

      try {
          const generatedSchedule = await generateScheduleWithAI({
              events: events.map(e => ({ iso: e.iso, title: e.title })),
              members: publicMembers,
              availability,
              roles,
              ministryId
          });

          // Update State Local
          setSchedule(generatedSchedule);
          // Save Bulk to DB with Strict Mode enabled to prevent event duplication
          await Supabase.saveScheduleBulk(ministryId, generatedSchedule, true);
          
          addToast("Escala gerada com sucesso!", "success");
      } catch (e: any) {
          addToast(`Erro: ${e.message}`, "error");
      }
  };

  if (loadingAuth) return <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">Carregando...</div>;
  if (!currentUser) return <LoginScreen isLoading={loadingAuth} />;

  const MAIN_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas de Escala', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
    { id: 'ranking', label: 'Destaques', icon: <Trophy size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disponibilidade', icon: <FileBarChart size={20}/> },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
  ];

  const isAdmin = currentUser.role === 'admin';

  return (
    <DashboardLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={visualTheme}
        toggleTheme={toggleVisualTheme}
        onLogout={handleLogout}
        title={ministryTitle}
        isConnected={true}
        currentUser={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        mainNavItems={MAIN_NAV}
        managementNavItems={MANAGEMENT_NAV}
        notifications={notifications}
        onNotificationsUpdate={setNotifications}
        onInstall={handleInstallApp}
        isStandalone={window.matchMedia('(display-mode: standalone)').matches}
        onSwitchMinistry={handleSwitchMinistry}
        onOpenJoinMinistry={() => setShowJoinModal(true)}
    >
        {/* ... (Tab Content rendering remains same) ... */}
        {currentTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                          {(() => {
                              const h = new Date().getHours();
                              if (h < 12) return "Bom dia";
                              if (h < 18) return "Boa tarde";
                              return "Boa noite";
                          })()}, {currentUser.name.split(' ')[0]} <span className="animate-wave text-3xl">👋</span>
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                          Bem-vindo a {ministryTitle}.
                      </p>
                  </div>
                  <WeatherWidget />
              </div>

              {(() => {
                  const now = new Date();
                  const upcoming = events
                    .filter(e => new Date(e.iso) >= now || e.iso.startsWith(now.toISOString().split('T')[0]))
                    .sort((a, b) => a.iso.localeCompare(b.iso))[0];
                  
                  return (
                      <NextEventCard 
                          event={upcoming}
                          schedule={schedule}
                          attendance={attendance}
                          roles={roles}
                          onConfirm={(key) => {
                             const assignment = Object.entries(schedule).find(([k, v]) => k === key);
                             if (assignment) {
                                setConfirmModalData({
                                    key,
                                    memberName: assignment[1],
                                    eventName: upcoming.title,
                                    date: upcoming.dateDisplay,
                                    role: key.split('_').pop() || ''
                                });
                             }
                          }}
                          ministryId={ministryId}
                          currentUser={currentUser}
                      />
                  );
              })()}
              
              <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                    <h3 className="font-bold text-zinc-800 dark:text-white mb-4">Acesso Rápido</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setCurrentTab('availability')} className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex flex-col items-center gap-2 text-center">
                            <CalendarCheck size={24}/> Marcar Disponibilidade
                        </button>
                        <button onClick={() => setCurrentTab('calendar')} className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors flex flex-col items-center gap-2 text-center">
                            <CalendarIcon size={24}/> Ver Escala Completa
                        </button>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-zinc-800 dark:text-white">Últimos Avisos</h3>
                        <button onClick={() => setCurrentTab('announcements')} className="text-xs text-blue-500 font-bold hover:underline">Ver Todos</button>
                     </div>
                     {announcements.length === 0 ? (
                         <p className="text-sm text-zinc-400 italic">Nenhum aviso recente.</p>
                     ) : (
                         <div className="space-y-3">
                             {announcements.slice(0, 3).map(a => (
                                 <div key={a.id} className="text-sm border-l-2 border-blue-500 pl-3">
                                     <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{a.title}</p>
                                     <p className="text-zinc-500 text-xs truncate">{a.message}</p>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
              </div>
            </div>
        )}

        {currentTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                           <CalendarIcon className="text-blue-500"/> Calendário de Escala
                        </h2>
                     </div>
                     <div className="flex flex-wrap items-center gap-2">
                         <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                            <div className="text-center min-w-[120px]">
                                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                            </div>
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                        </div>
                     </div>
                </div>

                <CalendarGrid 
                    currentMonth={currentMonth}
                    events={events}
                    schedule={schedule}
                    roles={roles}
                    onEventClick={(event) => setEventDetailsModal({ isOpen: true, event })}
                />
            </div>
        )}

        {currentTab === 'schedule-editor' && isAdmin && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                           <Edit className="text-blue-600 dark:text-blue-500" size={32} /> 
                           Editor de Escala
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-base">
                            Gerencie a escala oficial de <span className="text-zinc-800 dark:text-zinc-200 font-bold capitalize">{getMonthName(currentMonth)}</span>.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <ToolsMenu 
                            onExportIndividual={() => {}} 
                            onExportFull={() => {}} 
                            onWhatsApp={() => {}} 
                            onClearMonth={() => {
                                if(confirm("Limpar toda a escala deste mês?")) {
                                    Supabase.clearScheduleForMonth(ministryId, currentMonth).then(loadData);
                                }
                            }}
                            onResetEvents={() => {
                                if(confirm("Restaurar eventos padrão? (Isso removerá eventos duplicados)")) {
                                    Supabase.resetToDefaultEvents(ministryId, currentMonth).then(loadData);
                                }
                            }}
                            onAiAutoFill={handleAiAutoFill}
                            allMembers={publicMembers.map(m => m.name)}
                         />
                         
                         <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-700 shadow-sm text-white">
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-700 rounded-md transition-colors">
                                <ArrowLeft size={16} /> 
                            </button>
                            <div className="text-center min-w-[80px]">
                                <span className="block text-sm font-bold">{currentMonth}</span>
                            </div>
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-700 rounded-md transition-colors">
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95">
                        <Clock size={18} /> Gerenciar Eventos
                    </button>
                    <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95">
                        <ShieldAlert size={18} /> Gerenciar Indisponibilidade
                    </button>
                    <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95">
                        <Settings size={18} /> Configurar Funções
                    </button>
                </div>

                <ScheduleTable 
                    events={events}
                    roles={roles}
                    schedule={schedule}
                    attendance={attendance}
                    availability={availability}
                    members={membersMap}
                    allMembers={publicMembers.map(m => m.name)}
                    memberProfiles={publicMembers}
                    scheduleIssues={{}} 
                    globalConflicts={globalConflicts}
                    onCellChange={handleCellChange}
                    onAttendanceToggle={handleAttendanceToggle}
                    onDeleteEvent={async (iso, title) => {
                         if(confirm(`Remover o evento "${title}"?`)) {
                             await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]);
                             loadData();
                         }
                    }}
                    onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })}
                    memberStats={(() => {
                        const stats: Record<string, number> = {};
                        Object.values(schedule).forEach((val) => {
                            const name = val as string;
                            if (name) stats[name] = (stats[name] || 0) + 1;
                        });
                        return stats;
                    })()}
                    ministryId={ministryId}
                    readOnly={false}
                />
            </div>
        )}

        {currentTab === 'events' && isAdmin && (
            <EventsScreen 
                customEvents={events.map(e => ({ ...e, iso: e.iso }))}
                onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }}
                onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
            />
        )}

        {currentTab === 'availability' && (
            <AvailabilityScreen 
                availability={availability}
                setAvailability={setAvailability}
                allMembersList={publicMembers.map(m => m.name)}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                currentUser={currentUser}
                onSaveAvailability={async (member, dates) => {
                     const p = publicMembers.find(pm => pm.name === member);
                     if (p) { await Supabase.saveMemberAvailability(p.id, member, dates); loadData(); }
                }}
                availabilityWindow={availabilityWindow}
            />
        )}

        {currentTab === 'swaps' && (
            <SwapRequestsScreen 
                schedule={schedule}
                currentUser={currentUser}
                requests={swapRequests}
                visibleEvents={events}
                onCreateRequest={async (role, iso, title) => {
                    const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() });
                    if(success) { addToast("Solicitação criada!", "success"); loadData(); }
                }}
                onAcceptRequest={async (reqId) => {
                    const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!);
                    if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }
                }}
            />
        )}

        {currentTab === 'ranking' && (
            <RankingScreen 
                ministryId={ministryId}
                currentUser={currentUser}
            />
        )}

        {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && (
            <RepertoireScreen 
                repertoire={repertoire}
                setRepertoire={async () => { await loadData(); }}
                currentUser={currentUser}
                mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'}
                ministryId={ministryId}
            />
        )}

        {currentTab === 'announcements' && (
            <div className="space-y-8">
                <AnnouncementsScreen 
                    announcements={announcements}
                    currentUser={currentUser}
                    onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(loadData)}
                    onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(loadData)}
                />
            </div>
        )}

        {currentTab === 'send-announcements' && isAdmin && (
            <div className="space-y-8">
                <AlertsManager 
                    onSend={async (title, message, type, exp) => {
                            await Supabase.sendNotificationSQL(ministryId, { title, message, type });
                            await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name);
                            loadData();
                    }}
                />
            </div>
        )}

        {currentTab === 'members' && isAdmin && (
             <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
                 <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                            <Users className="text-indigo-500"/> Membros & Equipe
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1">Gerencie os integrantes, funções e permissões de acesso.</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {publicMembers.map(member => (
                        <div key={member.id} className="bg-[#18181b] rounded-2xl border border-zinc-800 p-5 flex flex-col gap-4 relative group shadow-sm transition-all hover:border-zinc-700">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    {member.avatar_url ? <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700 shadow-sm" /> : <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold border-2 border-zinc-700 shadow-sm">{member.name.charAt(0).toUpperCase()}</div>}
                                    <div>
                                        <h3 className="font-bold text-lg text-zinc-100 truncate max-w-[150px]" title={member.name}>{member.name}</h3>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mt-0.5">{member.isAdmin ? 'Administrador' : 'Membro'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <button onClick={async () => { if (member.email) { const newStatus = !member.isAdmin; await Supabase.toggleAdminSQL(member.email, newStatus); loadData(); addToast(`${member.name} agora é ${newStatus ? 'Admin' : 'Membro'}.`, 'success'); } else { addToast("Este usuário não possui e-mail para ser admin.", "error"); } }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors border ${member.isAdmin ? 'bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700' : 'bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'}`} title={member.isAdmin ? "Remover Admin" : "Tornar Admin"}><ShieldCheck size={16} fill={member.isAdmin ? "currentColor" : "none"} /></button>
                                    <button onClick={async () => { if(confirm(`Remover ${member.name} da equipe?`)) { await Supabase.deleteMember(ministryId, member.id, member.name); loadData(); addToast(`${member.name} removido.`, "success"); } }} className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors border bg-transparent border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/10"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {member.roles && member.roles.length > 0 ? member.roles.map(role => <span key={role} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-900/20 text-blue-400 border border-blue-900/30">{role}</span>) : <span className="text-xs text-zinc-600 italic px-2">Sem função definida</span>}
                            </div>
                            <hr className="border-zinc-800" />
                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors"><Mail size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/><span className="truncate">{member.email || "Sem e-mail"}</span></div>
                                <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors">{member.whatsapp ? <><Phone size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/><span className="truncate">{member.whatsapp}</span></> : <span className="text-zinc-600 italic text-xs pl-7">WhatsApp não informado</span>}</div>
                                {member.birthDate && <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors"><Gift size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/><span className="truncate">{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span></div>}
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
        )}

        {currentTab === 'settings' && (
            <SettingsScreen 
                initialTitle={ministryTitle} 
                ministryId={ministryId}
                themeMode={themeMode}
                onSetThemeMode={handleSetThemeMode}
                onSaveTheme={handleSaveTheme}
                onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); setMinistryTitle(newTitle); addToast("Nome do ministério atualizado!", "success"); }}
                onAnnounceUpdate={async () => { await Supabase.sendNotificationSQL(ministryId, { title: "Atualização de Sistema", message: "Uma nova versão do app está disponível. Recarregue a página para aplicar.", type: "warning" }); addToast("Notificação de atualização enviada.", "success"); }}
                onEnableNotifications={handleEnableNotifications}
                onSaveAvailabilityWindow={async (start, end, spotifyId, spotifySecret) => { 
                    await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end, spotifyId, spotifySecret); 
                    loadData(); 
                }}
                availabilityWindow={availabilityWindow}
                isAdmin={isAdmin}
            />
        )}

        {currentTab === 'report' && isAdmin && (
            <AvailabilityReportScreen 
                availability={availability}
                registeredMembers={publicMembers}
                membersMap={membersMap}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                availableRoles={roles}
                onRefresh={async () => { await loadData(); addToast("Dados atualizados!", "success"); }}
            />
        )}

        {currentTab === 'profile' && currentUser && (
             <ProfileScreen 
                user={currentUser}
                availableRoles={roles}
                onUpdateProfile={async (name, whatsapp, avatar_url, functions, birthDate) => { const res = await Supabase.updateUserProfile(name, whatsapp, avatar_url, functions, birthDate, ministryId); if (res.success) { addToast(res.message, "success"); setCurrentUser({ ...currentUser, name, whatsapp, avatar_url, functions, birthDate }); await loadData(); } else { addToast(res.message, "error"); } }}
             />
        )}

        <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); loadData(); }} onRemove={async (id) => { loadData(); }} />
        <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates); loadData(); } }} currentMonth={currentMonth} />
        <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
        <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={handleJoinMinistry} alreadyJoined={currentUser.allowedMinistries || []} />
        {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, applyToAll) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso, applyToAll); loadData(); setEventDetailsModal({ isOpen: false, event: null }); addToast("Evento atualizado.", "success"); }} onSwapRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if (success) { addToast("Troca solicitada!", "success"); loadData(); setEventDetailsModal({ isOpen: false, event: null }); } }} currentUser={currentUser} ministryId={ministryId} canEdit={isAdmin} />}
        <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={(() => { const stats: Record<string, number> = {}; Object.values(schedule).forEach((val) => { const name = val as string; if (name) stats[name] = (stats[name] || 0) + 1; }); return stats; })()} monthName={getMonthName(currentMonth)} />
        <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key); loadData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); } }} />
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  );
}
