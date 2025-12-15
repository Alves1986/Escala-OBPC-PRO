
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Clock, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, ShieldAlert, Share2, Sparkles, ChevronRight, FileText
} from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { SetupScreen } from './components/SetupScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { WeatherWidget } from './components/WeatherWidget';
import { InstallBanner } from './components/InstallBanner';
import { InstallModal } from './components/InstallModal';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { ToolsMenu } from './components/ToolsMenu';
import { EventDetailsModal } from './components/EventDetailsModal';
import { StatsModal } from './components/StatsModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal } from './components/ManagementModals';
import { ErrorBoundary } from './components/ErrorBoundary';

import * as Supabase from './services/supabaseService';
import { generateScheduleWithAI } from './services/aiService';
import { ThemeMode, SUPABASE_URL, SUPABASE_KEY } from './types';
import { adjustMonth, getMonthName, getLocalDateISOString } from './utils/dateUtils';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from './utils/pushUtils';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';

// --- Lazy Load Heavy Components (Code Splitting) ---
const ScheduleTable = React.lazy(() => import('./components/ScheduleTable').then(module => ({ default: module.ScheduleTable })));
const CalendarGrid = React.lazy(() => import('./components/CalendarGrid').then(module => ({ default: module.CalendarGrid })));
const AvailabilityScreen = React.lazy(() => import('./components/AvailabilityScreen').then(module => ({ default: module.AvailabilityScreen })));
const SwapRequestsScreen = React.lazy(() => import('./components/SwapRequestsScreen').then(module => ({ default: module.SwapRequestsScreen })));
const RepertoireScreen = React.lazy(() => import('./components/RepertoireScreen').then(module => ({ default: module.RepertoireScreen })));
const AnnouncementsScreen = React.lazy(() => import('./components/AnnouncementsScreen').then(module => ({ default: module.AnnouncementsScreen })));
const AlertsManager = React.lazy(() => import('./components/AlertsManager').then(module => ({ default: module.AlertsManager })));
const AvailabilityReportScreen = React.lazy(() => import('./components/AvailabilityReportScreen').then(module => ({ default: module.AvailabilityReportScreen })));
const MonthlyReportScreen = React.lazy(() => import('./components/MonthlyReportScreen').then(module => ({ default: module.MonthlyReportScreen })));
const SettingsScreen = React.lazy(() => import('./components/SettingsScreen').then(module => ({ default: module.SettingsScreen })));
const ProfileScreen = React.lazy(() => import('./components/ProfileScreen').then(module => ({ default: module.ProfileScreen })));
const EventsScreen = React.lazy(() => import('./components/EventsScreen').then(module => ({ default: module.EventsScreen })));
const RankingScreen = React.lazy(() => import('./components/RankingScreen').then(module => ({ default: module.RankingScreen })));
const MembersScreen = React.lazy(() => import('./components/MembersScreen').then(module => ({ default: module.MembersScreen })));
const SocialMediaScreen = React.lazy(() => import('./components/SocialMediaScreen').then(module => ({ default: module.SocialMediaScreen })));

// Loading Spinner para Lazy Components
const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 animate-fade-in">
    <Loader2 size={32} className="animate-spin mb-3 text-teal-500" />
    <p className="text-xs font-medium uppercase tracking-widest opacity-70">Carregando...</p>
  </div>
);

const InnerApp = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { currentUser, setCurrentUser, loadingAuth } = useAuth();
  const { addToast, confirmAction } = useToast();
  const presenceTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const onlineUsers = useOnlinePresence(
    currentUser?.id, 
    currentUser?.name,
    (name, status) => {
        if (status === 'offline') {
            if (presenceTimeouts.current[name]) clearTimeout(presenceTimeouts.current[name]);
            presenceTimeouts.current[name] = setTimeout(() => {
                addToast(`${name} saiu`, 'info'); 
                delete presenceTimeouts.current[name];
            }, 5000);
        } else {
            if (presenceTimeouts.current[name]) {
                clearTimeout(presenceTimeouts.current[name]);
                delete presenceTimeouts.current[name];
            } else {
                addToast(`${name} entrou`, 'success');
            }
        }
    }
  );
  
  const [ministryId, setMinistryId] = useState<string>('midia');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  
  // ========================================================================
  // LÓGICA DE ROTEAMENTO (Login Google vs Spotify)
  // ========================================================================
  
  // 1. Auxiliar para detectar callback do Spotify
  const isSpotifyCallback = () => {
      if (typeof window === 'undefined') return false;
      return window.location.hash.includes('state=spotify_login_app');
  };

  // 2. Estado inicial da aba
  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          // Só vai para o repertório se for callback do Spotify
          if (isSpotifyCallback()) return 'repertoire-manager'; 
          
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  const { 
    events, setEvents, schedule, setSchedule, attendance, setAttendance,
    membersMap, publicMembers, setPublicMembers, availability, setAvailability,
    availabilityNotes, notifications, setNotifications, announcements, 
    repertoire, setRepertoire, swapRequests, globalConflicts, roles, 
    ministryTitle, setMinistryTitle, availabilityWindow, setAvailabilityWindow, 
    refreshData: loadData, isLoading: loadingData
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

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
      try { return (localStorage.getItem('themeMode') as ThemeMode) || 'system'; } catch (e) { return 'system'; }
  });
  const [visualTheme, setVisualTheme] = useState<'light' | 'dark'>('light');
  const [showInitialLoading, setShowInitialLoading] = useState(true);

  // --- EFFECTS ---

  // 3. Gerenciamento de Login e Limpeza de URL
  useEffect(() => {
      // Caso 1: Retorno do Spotify (vai para repertório)
      if (isSpotifyCallback() && currentUser) {
          const target = currentUser.role === 'admin' ? 'repertoire-manager' : 'repertoire';
          if (currentTab !== target) setCurrentTab(target);
          return;
      }
      
      // Caso 2: Login Google/Supabase (vai para dashboard e limpa URL)
      if (currentUser && window.location.hash.includes('access_token') && !isSpotifyCallback()) {
          try {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
          } catch(e) {}
          
          if (currentTab === 'repertoire-manager') {
              setCurrentTab('dashboard');
          }
      }
  }, [currentUser]); 

  useEffect(() => {
      if (!loadingAuth && !loadingData) {
          const timer = setTimeout(() => setShowInitialLoading(false), 800);
          return () => clearTimeout(timer);
      }
  }, [loadingAuth, loadingData]);

  useEffect(() => {
      if (currentUser?.ministryId) setMinistryId(currentUser.ministryId);
  }, [currentUser]);

  useEffect(() => {
      const handleFocus = () => { if (currentUser && ministryId) loadData(); };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser, ministryId, loadData]);

  // Sync URL with Tab
  useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          if (!window.location.hash.includes('access_token') && !isSpotifyCallback()) {
              url.searchParams.set('tab', currentTab);
              try { window.history.replaceState({}, '', url.toString()); } catch (e) {}
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
            targetTheme = (hour >= 6 && hour < 18) ? 'light' : 'dark';
        } else {
            targetTheme = themeMode;
        }
        setVisualTheme(targetTheme);
        document.documentElement.classList.toggle('dark', targetTheme === 'dark');
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

  const handleEnableNotifications = async () => {
      try {
          if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error("Push não suportado");
          const reg = await navigator.serviceWorker.ready;
          if (!reg) throw new Error("Service Worker não está pronto.");
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
              sub = await reg.pushManager.subscribe({ 
                  userVisibleOnly: true, 
                  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) 
              });
          }
          if (sub) {
              await Supabase.saveSubscriptionSQL(ministryId, sub);
              addToast("Notificações ativadas com sucesso!", "success");
          }
      } catch(e: any) {
          console.error("Erro Push:", e);
          addToast("Erro ao ativar notificações. Verifique as permissões.", "error");
      }
  };

  const handleLogout = () => {
    confirmAction("Sair", "Deseja realmente sair do sistema?", async () => {
        await Supabase.logout();
        setCurrentUser(null);
        try { window.history.replaceState(null, '', '/'); } catch(e) {}
    });
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
              if (choiceResult.outcome === 'accepted') setShowInstallBanner(false);
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
              if (k.startsWith(eventIso) && k !== key && val === value) keyToRemove = k; 
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
      if (!success) { addToast("Erro ao salvar escala.", "error"); loadData(); }
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

  const handleSyncCalendar = () => {
      if (!currentUser || !schedule || !events) return;
      const myEvents: any[] = [];
      Object.keys(schedule).forEach(key => {
          if (schedule[key] === currentUser.name) {
              const iso = key.slice(0, 16);
              const role = key.split('_').pop() || 'Escala';
              const eventInfo = events.find(e => e.iso.startsWith(iso));
              if (eventInfo) {
                  const d = new Date(iso);
                  d.setHours(d.getHours() + 2);
                  myEvents.push({ title: `${eventInfo.title} (${role})`, start: iso, end: d.toISOString().slice(0, 19), description: `Função: ${role}` });
              }
          }
      });

      if (myEvents.length === 0) { addToast("Sem escalas para sincronizar.", "info"); return; }

      let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//EscalaOBPC//PT\n";
      myEvents.forEach(evt => {
          const dtStart = evt.start.replace(/[-:]/g, "").replace("T", "T") + "00";
          const dtEnd = evt.end.replace(/[-:]/g, "").replace("T", "T") + "00";
          ics += `BEGIN:VEVENT\nSUMMARY:${evt.title}\nDTSTART:${dtStart}\nDTEND:${dtEnd}\nDESCRIPTION:${evt.description}\nEND:VEVENT\n`;
      });
      ics += "END:VCALENDAR";

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `escala_${currentMonth}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("Calendário baixado!", "success");
  };

  const handleAiAutoFill = async () => {
      const runAi = async () => {
          addToast("Gerando escala inteligente com IA... aguarde.", "info");
          try {
              const generatedSchedule = await generateScheduleWithAI({
                  events: events.map(e => ({ iso: e.iso, title: e.title })),
                  members: publicMembers,
                  availability,
                  availabilityNotes,
                  roles,
                  ministryId
              });
              setSchedule(generatedSchedule);
              await Supabase.saveScheduleBulk(ministryId, generatedSchedule, true);
              addToast("Escala gerada com sucesso!", "success");
              await Supabase.sendNotificationSQL(ministryId, { title: "Escala Disponível", message: `Escala de ${getMonthName(currentMonth)} gerada com IA.`, type: 'info', actionLink: 'calendar' });
          } catch (e: any) { addToast(`Erro: ${e.message}`, "error"); }
      };
      if (Object.keys(schedule).length > 0) confirmAction("Sobrescrever?", "Deseja usar IA para refazer a escala existente?", runAi);
      else runAi();
  };

  // 1. CONFIG CHECK
  if ((!SUPABASE_URL || !SUPABASE_KEY) && !isDemoMode) {
      return <SetupScreen onEnterDemo={() => setIsDemoMode(true)} />;
  }

  if (loadingAuth || (currentUser && showInitialLoading)) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen isLoading={loadingAuth} />;

  const MAIN_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas de Escala', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
    { id: 'ranking', label: 'Destaques', icon: <Trophy size={20}/> },
    { id: 'social', label: 'Redes Sociais', icon: <Share2 size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileText size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disponibilidade', icon: <FileBarChart size={20}/> },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
  ];

  const isAdmin = currentUser.role === 'admin';

  return (
    <ErrorBoundary>
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
            managementNavItems={isAdmin ? MANAGEMENT_NAV : []}
            notifications={notifications}
            onNotificationsUpdate={setNotifications}
            onInstall={handleInstallApp}
            isStandalone={window.matchMedia('(display-mode: standalone)').matches}
            onSwitchMinistry={async (id) => {
                setMinistryId(id);
                if (currentUser) {
                    setCurrentUser({ ...currentUser, ministryId: id });
                    if(currentUser.id) await Supabase.updateProfileMinistry(currentUser.id, id);
                }
                addToast(`Alternado para ${id}`, 'info');
            }}
            onOpenJoinMinistry={() => setShowJoinModal(true)}
        >
            <Suspense fallback={<LoadingFallback />}>
                {currentTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                                    {(() => {
                                        const h = new Date().getHours();
                                        if (h < 12) return "Bom dia";
                                        if (h < 18) return "Boa tarde";
                                        return "Boa noite";
                                    })()}, <span className="text-teal-600 dark:text-teal-400">{currentUser.name.split(' ')[0]}</span>
                                </h1>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Bem-vindo ao painel do {ministryTitle}.</p>
                            </div>
                            <div className="hidden md:block">
                                <WeatherWidget />
                            </div>
                        </div>

                        {(() => {
                            const now = new Date();
                            const upcoming = events.filter(e => new Date(e.iso) >= now || e.iso.startsWith(now.toISOString().split('T')[0])).sort((a, b) => a.iso.localeCompare(b.iso))[0];
                            return <NextEventCard event={upcoming} schedule={schedule} attendance={attendance} roles={roles} onConfirm={(key) => { const assignment = Object.entries(schedule).find(([k, v]) => k === key); if (assignment) setConfirmModalData({ key, memberName: assignment[1], eventName: upcoming.title, date: upcoming.dateDisplay, role: key.split('_').pop() || '' }); }} ministryId={ministryId} currentUser={currentUser} />;
                        })()}
                        
                        <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />

                        {/* Quick Access Grid - Pro Style */}
                        <div>
                            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles size={14}/> Acesso Rápido</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <button onClick={() => setCurrentTab('availability')} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <CalendarCheck size={20} strokeWidth={1.5}/>
                                    </div>
                                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">Disponibilidade</span>
                                    <span className="text-[10px] text-zinc-500">Marcar dias livres</span>
                                </button>

                                <button onClick={() => setCurrentTab('calendar')} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <CalendarIcon size={20} strokeWidth={1.5}/>
                                    </div>
                                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">Escala Completa</span>
                                    <span className="text-[10px] text-zinc-500">Ver o mês inteiro</span>
                                </button>

                                <button onClick={() => setCurrentTab('swaps')} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <RefreshCcw size={20} strokeWidth={1.5}/>
                                    </div>
                                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">Trocas</span>
                                    <span className="text-[10px] text-zinc-500">Solicitar/Aceitar</span>
                                </button>

                                <button onClick={() => setCurrentTab('repertoire')} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-lg bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Music size={20} strokeWidth={1.5}/>
                                    </div>
                                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">Repertório</span>
                                    <span className="text-[10px] text-zinc-500">Músicas do culto</span>
                                </button>
                            </div>
                        </div>

                        {/* Recent Announcements */}
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/30">
                                <h3 className="font-bold text-zinc-800 dark:text-white text-sm">Quadro de Avisos</h3>
                                <button onClick={() => setCurrentTab('announcements')} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1">
                                    Ver Todos <ChevronRight size={12}/>
                                </button>
                            </div>
                            
                            <div className="p-0">
                                {announcements.length === 0 ? (
                                    <div className="p-8 text-center text-zinc-400">
                                        <Megaphone size={32} className="mx-auto mb-2 opacity-20"/>
                                        <p className="text-sm">Nenhum aviso recente.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {announcements.slice(0, 3).map(a => (
                                            <div key={a.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm line-clamp-1">{a.title}</span>
                                                    <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">{new Date(a.timestamp).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{a.message}</p>
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
                            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2"><CalendarIcon className="text-blue-500"/> Calendário</h2>
                            <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 min-w-[100px] text-center">{getMonthName(currentMonth)}</span>
                                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                            </div>
                        </div>
                        <CalendarGrid currentMonth={currentMonth} events={events} schedule={schedule} roles={roles} onEventClick={(event) => setEventDetailsModal({ isOpen: true, event })} />
                    </div>
                )}

                {currentTab === 'schedule-editor' && isAdmin && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                            <div><h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3"><Edit className="text-blue-600 dark:text-blue-500" size={32} /> Editor de Escala</h2><p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p></div>
                            <div className="flex items-center gap-3">
                                <ToolsMenu onExportIndividual={() => {}} onExportFull={() => {}} onWhatsApp={() => {}} onClearMonth={() => confirmAction("Limpar?", "Limpar toda a escala do mês?", () => Supabase.clearScheduleForMonth(ministryId, currentMonth).then(() => loadData()))} onResetEvents={() => confirmAction("Restaurar?", "Restaurar eventos padrão?", () => Supabase.resetToDefaultEvents(ministryId, currentMonth).then(() => loadData()))} onAiAutoFill={handleAiAutoFill} onSyncCalendar={handleSyncCalendar} allMembers={publicMembers.map(m => m.name)} />
                                <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-700 shadow-sm text-white"><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowLeft size={16}/></button><span className="text-sm font-bold min-w-[80px] text-center">{currentMonth}</span><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowRight size={16}/></button></div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => setEventsModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><Clock size={18} /> Eventos</button>
                            <button onClick={() => setAvailModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><ShieldAlert size={18} /> Indisponibilidade</button>
                            <button onClick={() => setRolesModalOpen(true)} className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium"><Settings size={18} /> Funções</button>
                        </div>
                        <ScheduleTable events={events} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={membersMap} allMembers={publicMembers.map(m => m.name)} memberProfiles={publicMembers} scheduleIssues={{}} globalConflicts={globalConflicts} onCellChange={handleCellChange} onAttendanceToggle={handleAttendanceToggle} onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]); loadData(); })} onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} memberStats={Object.values(schedule).reduce((acc: any, val: any) => { if(val) acc[val] = (acc[val] || 0) + 1; return acc; }, {})} ministryId={ministryId} readOnly={false} onlineUsers={onlineUsers} />
                    </div>
                )}

                {currentTab === 'monthly-report' && isAdmin && (
                    <MonthlyReportScreen 
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        schedule={schedule}
                        attendance={attendance}
                        swapRequests={swapRequests}
                        members={publicMembers}
                        events={events}
                    />
                )}

                {/* Other Tabs Mapped to Lazy Components */}
                {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'availability' && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (member, dates, notes, targetMonth) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates, targetMonth, notes); loadData(); }}} availabilityWindow={availabilityWindow} />}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { await loadData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'} ministryId={ministryId} />}
                {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(() => loadData())} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(() => loadData())} />}
                {currentTab === 'send-announcements' && isAdmin && <AlertsManager onSend={async (title, message, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title, message, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name); loadData(); }} />}
                {currentTab === 'report' && isAdmin && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await loadData(); }} />}
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { const res = await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); if (res.success) { addToast(res.message, "success"); if (currentUser) { setCurrentUser({ ...currentUser, name, whatsapp, avatar_url: avatar || currentUser.avatar_url, functions: funcs, birthDate: bdate }); } loadData(); } else { addToast(res.message, "error"); }}} availableRoles={roles} />}
                {currentTab === 'settings' && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={handleSetThemeMode} onSaveTheme={handleSaveTheme} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); setMinistryTitle(newTitle); addToast("Nome do ministério atualizado!", "success"); }} onAnnounceUpdate={async () => { await Supabase.sendNotificationSQL(ministryId, { title: "Atualização de Sistema", message: "Uma nova versão do app está disponível. Recarregue a página para aplicar.", type: "warning" }); addToast("Notificação de atualização enviada.", "success"); }} onEnableNotifications={handleEnableNotifications} onSaveAvailabilityWindow={async (start, end) => { setAvailabilityWindow({ start, end }); await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); loadData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
                {currentTab === 'social' && <SocialMediaScreen />}
                
                {currentTab === 'members' && isAdmin && (
                    <MembersScreen 
                        members={publicMembers} 
                        onlineUsers={onlineUsers} 
                        currentUser={currentUser}
                        availableRoles={roles}
                        onToggleAdmin={async (email, currentStatus, name) => {
                            if (!email) return addToast("Usuário sem e-mail não pode ser admin.", "error");
                            const newStatus = !currentStatus;
                            await Supabase.toggleAdminSQL(email, newStatus, ministryId);
                            loadData();
                            addToast(`${name} agora é ${newStatus ? 'Admin' : 'Membro'}.`, 'success');
                        }}
                        onRemoveMember={async (id, name) => {
                            confirmAction(
                                "Remover Membro",
                                `Deseja remover ${name} da equipe? Isso removerá o acesso dele ao ministério atual.`,
                                async () => {
                                    const result = await Supabase.deleteMember(ministryId, id, name);
                                    if (result.success) {
                                        setPublicMembers(prev => prev.filter(m => m.id !== id));
                                        loadData(false);
                                        addToast(`${name} removido.`, "success");
                                    } else {
                                        addToast(`Erro: ${result.message}`, "error");
                                    }
                                }
                            );
                        }}
                        onUpdateMember={async (id, data) => {
                            const res = await Supabase.updateMemberData(id, data);
                            if(res.success) {
                                addToast("Membro atualizado!", "success");
                                loadData();
                            } else {
                                addToast("Erro ao atualizar.", "error");
                            }
                        }}
                    />
                )}
            </Suspense>

            {/* Modals & Global UI */}
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); loadData(); }} onRemove={async (id) => { loadData(); }} />
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates, currentMonth, {}); loadData(); }}} currentMonth={currentMonth} />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
            <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={handleJoinMinistry} alreadyJoined={currentUser.allowedMinistries || []} />
            {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, applyToAll) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso, applyToAll); loadData(); setEventDetailsModal({ isOpen: false, event: null }); addToast("Evento atualizado.", "success"); }} onSwapRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if (success) { addToast("Troca solicitada!", "success"); loadData(); setEventDetailsModal({ isOpen: false, event: null }); }}} currentUser={currentUser} ministryId={ministryId} canEdit={isAdmin} />}
            <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={(() => { const stats: Record<string, number> = {}; Object.values(schedule).forEach((val) => { const name = val as string; if (name) stats[name] = (stats[name] || 0) + 1; }); return stats; })()} monthName={getMonthName(currentMonth)} />
            <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key); loadData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
        </DashboardLayout>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  );
}
