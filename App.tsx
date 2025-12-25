import React, { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppStore } from './store/appStore';
import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Clock, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, ShieldAlert, Share2, Sparkles, ChevronRight, FileText, History,
  CheckCircle2, MousePointerClick, Briefcase
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
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { ErrorBoundary } from './components/ErrorBoundary';

import * as Supabase from './services/supabaseService';
import { generateScheduleWithAI } from './services/aiService';
import { generateFullSchedulePDF, generateIndividualPDF } from './utils/pdfGenerator';
import { SUPABASE_URL, SUPABASE_KEY } from './services/supabaseService';
import { adjustMonth, getMonthName, getLocalDateISOString } from './utils/dateUtils';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from './utils/pushUtils';
import { getMinistryConfig, isValidMinistry, MINISTRIES, ValidMinistryId } from './types'; 

// Hooks
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';

// --- Lazy Load Heavy Components ---
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

// Loading Spinner
const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400 animate-fade-in">
    <Loader2 size={32} className="animate-spin mb-3 text-teal-500" />
    <p className="text-xs font-medium uppercase tracking-widest opacity-70">Carregando...</p>
  </div>
);

const InnerApp = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const { currentUser, loadingAuth } = useAuth();
  const { setCurrentUser, setMinistryId, sidebarOpen, setSidebarOpen, themeMode, setSidebarOpen: setStoreSidebarOpen } = useAppStore();
  const { addToast, confirmAction } = useToast();
  
  // Initialize Global Store
  useEffect(() => {
      if (currentUser) {
          useAppStore.getState().setCurrentUser(currentUser);
      }
  }, [currentUser]);

  // Apply Theme Mode Side Effect
  useEffect(() => {
    const applyTheme = () => {
      const isDark = 
        themeMode === 'dark' || 
        (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
        if (themeMode === 'system') applyTheme();
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  
  // Tab State
  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  // Use the refactored Hook (now backed by React Query)
  const ministryId = useAppStore(state => state.ministryId);
  
  // PORTEIRO: Verifica e corrige o ministryId inválido
  useEffect(() => {
      if (currentUser && !isValidMinistry(ministryId)) {
          console.warn(`Ministério inválido detectado: "${ministryId}". Iniciando protocolo de correção...`);
          
          // Tenta encontrar o primeiro ministério válido na lista do usuário
          const validId = currentUser.allowedMinistries?.find(id => isValidMinistry(id));
          
          // Fallback final para 'midia' (que é garantido existir em MINISTRIES)
          const fallback: ValidMinistryId = isValidMinistry(validId) ? validId : MINISTRIES[0].id;
          
          setMinistryId(fallback);
      }
  }, [ministryId, currentUser]);

  // Obter configuração do ministério ativo (Controle de Visibilidade)
  // Como isValidMinistry é usado acima, aqui é seguro, mas getMinistryConfig tem fallback interno também.
  const ministryConfig = useMemo(() => getMinistryConfig(ministryId), [ministryId]);

  const { 
    events, schedule, attendance,
    membersMap, publicMembers, availability,
    availabilityNotes, notifications, announcements, 
    repertoire, swapRequests, globalConflicts, auditLogs, roles, 
    ministryTitle, availabilityWindow, 
    refreshData, isLoading: loadingData,
    setAvailability, setNotifications, setRepertoire, setPublicMembers // Legacy setters
  } = useMinistryData(ministryId, currentMonth, currentUser);

  // Online Presence
  const presenceTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);

  // Modals
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [eventDetailsModal, setEventDetailsModal] = useState<{ isOpen: boolean; event: any | null }>({ isOpen: false, event: null });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<any>(null);
  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);
  const [isAuditModalOpen, setAuditModalOpen] = useState(false);

  // --- LOGIC ---

  useEffect(() => {
      // URL Tab Sync
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          if (!window.location.hash.includes('access_token')) {
              url.searchParams.set('tab', currentTab);
              try { window.history.replaceState({}, '', url.toString()); } catch (e) {}
          }
      }
  }, [currentTab]);

  useEffect(() => {
      // PWA Prompt
      const handlePwaReady = () => setShowInstallBanner(true);
      window.addEventListener('pwa-ready', handlePwaReady);
      return () => window.removeEventListener('pwa-ready', handlePwaReady);
  }, []);

  const handleLogout = () => {
    confirmAction("Sair", "Deseja realmente sair do sistema?", async () => {
        await Supabase.logout();
        setCurrentUser(null);
        try { window.history.replaceState(null, '', '/'); } catch(e) {}
    });
  };

  if ((!SUPABASE_URL || !SUPABASE_KEY) && !isDemoMode) {
      return <SetupScreen onEnterDemo={() => setIsDemoMode(true)} />;
  }

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen isLoading={loadingAuth} />;

  const isAdmin = currentUser.role === 'admin';

  // Definição Completa das Abas (Source of Truth do Layout)
  const RAW_MAIN_NAV = [
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

  const RAW_MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileText size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disponibilidade', icon: <FileBarChart size={20}/> },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
  ];

  const RAW_QUICK_ACTIONS = [
    { id: 'calendar', label: 'Minhas Escalas', icon: <CalendarIcon size={24} />, color: 'bg-blue-500', hover: 'hover:bg-blue-600' },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={24} />, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
    { id: 'swaps', label: 'Trocas de Vaga', icon: <RefreshCcw size={24} />, color: 'bg-amber-500', hover: 'hover:bg-amber-600' },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={24} />, color: 'bg-pink-500', hover: 'hover:bg-pink-600' },
  ];

  // FILTRAGEM DINÂMICA: Aplica a configuração do ministério ativo (Source of Truth)
  const MAIN_NAV = RAW_MAIN_NAV.filter(item => ministryConfig.enabledTabs.includes(item.id));
  const MANAGEMENT_NAV = RAW_MANAGEMENT_NAV.filter(item => ministryConfig.enabledTabs.includes(item.id));
  const QUICK_ACTIONS = RAW_QUICK_ACTIONS.filter(item => ministryConfig.enabledTabs.includes(item.id));

  return (
    <ErrorBoundary>
        <DashboardLayout
            onLogout={handleLogout}
            title={ministryTitle}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            mainNavItems={MAIN_NAV}
            managementNavItems={isAdmin ? MANAGEMENT_NAV : []}
            notifications={notifications}
            onNotificationsUpdate={setNotifications}
            onInstall={() => {
                const prompt = (window as any).deferredPrompt;
                if(prompt) prompt.prompt(); else setShowInstallModal(true);
            }}
            isStandalone={window.matchMedia('(display-mode: standalone)').matches}
            onSwitchMinistry={async (id) => {
                setMinistryId(id);
                if (currentUser && currentUser.id) await Supabase.updateProfileMinistry(currentUser.id, id);
                addToast(`Alternado para ${getMinistryConfig(id).label}`, 'info');
                refreshData();
                
                // Se a nova configuração não tiver a aba atual, volta pro dashboard
                const newConfig = getMinistryConfig(id);
                if (!newConfig.enabledTabs.includes(currentTab)) setCurrentTab('dashboard');
            }}
            onOpenJoinMinistry={() => setShowJoinModal(true)}
            activeMinistryId={ministryId}
        >
            <Suspense fallback={<LoadingFallback />}>
                {/* Dashboard */}
                {currentTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="animate-slide-up">
                                <h1 className="text-2xl md:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
                                    Olá, <span className="text-teal-600 dark:text-teal-400">{currentUser.name.split(' ')[0]}</span>
                                </h1>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base mt-1 font-medium">Bem-vindo ao painel do seu ministério.</p>
                            </div>
                            <div className="w-full md:w-auto animate-fade-in" style={{ animationDelay: '0.1s' }}><WeatherWidget /></div>
                        </div>

                        {/* Next Event */}
                        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            {(() => {
                                const now = new Date();
                                const bufferMs = 2.5 * 60 * 60 * 1000; // 2 horas e 30 minutos em milissegundos
                                
                                const upcoming = events.filter(e => {
                                    const eventDate = new Date(e.iso);
                                    // A data de expiração é o horário do evento + 2h 30min
                                    const expirationDate = new Date(eventDate.getTime() + bufferMs);
                                    
                                    // O evento é válido se o momento atual for menor que a data de expiração
                                    // Ou seja, ainda não passou de 2h30min após o início
                                    return expirationDate > now;
                                }).sort((a, b) => a.iso.localeCompare(b.iso))[0];

                                return <NextEventCard event={upcoming} schedule={schedule} attendance={attendance} roles={roles} members={publicMembers} onConfirm={(key) => { const assignment = Object.entries(schedule).find(([k, v]) => k === key); if (assignment) setConfirmModalData({ key, memberName: assignment[1], eventName: upcoming.title, date: upcoming.dateDisplay, role: key.split('_').pop() || '' }); }} ministryId={ministryId} currentUser={currentUser} />;
                            })()}
                        </div>

                        {/* Quick Access Section - Desktop Only (Hidden on LG and below as requested) */}
                        <div className="hidden lg:block space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <MousePointerClick size={14}/> Acesso Rápido
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {QUICK_ACTIONS.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => setCurrentTab(action.id)}
                                        className="group relative flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50 hover:-translate-y-1 active:scale-95 overflow-hidden"
                                    >
                                        <div className={`absolute top-0 left-0 w-full h-1 ${action.color} opacity-80`}></div>
                                        <div className={`mb-3 p-3 rounded-xl ${action.color} text-white shadow-lg transition-transform group-hover:scale-110`}>
                                            {action.icon}
                                        </div>
                                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">{action.label}</span>
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={14} className="text-zinc-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
                            <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                        </div>
                    </div>
                )}

                {/* Calendar */}
                {currentTab === 'calendar' && ministryConfig.enabledTabs.includes('calendar') && (
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

                {/* Schedule Editor (Admin) */}
                {currentTab === 'schedule-editor' && isAdmin && ministryConfig.enabledTabs.includes('schedule-editor') && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                            <div className="w-full xl:w-auto">
                                <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                                    <Edit className="text-blue-600 dark:text-blue-500" size={32} /> Editor de Escala
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p>
                            </div>
                            
                            {/* Toolbar Container: Actions + Date Nav */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                                
                                {/* Actions Group - Scrollable to prevent bad wrapping on small screens */}
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:overflow-visible pb-1 sm:pb-0">
                                    <button 
                                        onClick={() => setRolesModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-bold whitespace-nowrap border border-zinc-200 dark:border-zinc-700"
                                    >
                                        <Briefcase size={16}/> <span>Funções</span>
                                    </button>
                                    <button 
                                        onClick={() => setAuditModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-sm font-bold whitespace-nowrap border border-zinc-200 dark:border-zinc-700"
                                    >
                                        <History size={16}/> <span>Histórico</span>
                                    </button>
                                    <ToolsMenu 
                                        onExportIndividual={(member) => generateIndividualPDF(ministryTitle, currentMonth, member, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().slice(0,2).join('/')})), schedule)} 
                                        onExportFull={() => generateFullSchedulePDF(ministryTitle, currentMonth, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().slice(0,2).join('/')})), roles, schedule)} 
                                        onWhatsApp={() => {}} 
                                        onClearMonth={() => confirmAction("Limpar?", "Limpar escala?", () => Supabase.clearScheduleForMonth(ministryId, currentMonth).then(refreshData))} 
                                        onResetEvents={() => confirmAction("Restaurar?", "Restaurar eventos?", () => Supabase.resetToDefaultEvents(ministryId, currentMonth).then(refreshData))}
                                        allMembers={publicMembers.map(m => m.name)} 
                                    />
                                </div>
                                
                                {/* Date Navigator */}
                                <div className="flex items-center justify-between gap-1 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm sm:ml-2">
                                    <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"><ArrowLeft size={18}/></button>
                                    <span className="text-sm font-bold min-w-[90px] text-center text-zinc-800 dark:text-zinc-100 tabular-nums">{currentMonth}</span>
                                    <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors"><ArrowRight size={18}/></button>
                                </div>
                            </div>
                        </div>
                        
                        <ScheduleTable 
                            events={events} 
                            roles={roles} 
                            schedule={schedule} 
                            attendance={attendance} 
                            availability={availability}
                            availabilityNotes={availabilityNotes} // Passando notas para a tabela 
                            members={membersMap} 
                            allMembers={publicMembers.map(m => m.name)} 
                            memberProfiles={publicMembers} 
                            scheduleIssues={{}} 
                            globalConflicts={globalConflicts} 
                            onCellChange={async (key, val) => { await Supabase.saveScheduleAssignment(ministryId, key, val); refreshData(); }} 
                            onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, key); refreshData(); }} 
                            onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]); refreshData(); })} 
                            onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} 
                            memberStats={Object.values(schedule).reduce((acc: any, val: any) => { if(val) acc[val] = (acc[val] || 0) + 1; return acc; }, {})} 
                            ministryId={ministryId} 
                            readOnly={false} 
                            onlineUsers={onlineUsers} 
                        />
                    </div>
                )}

                {/* Other Tabs Mapped & Filtered */}
                {currentTab === 'availability' && ministryConfig.enabledTabs.includes('availability') && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (mid, m, d, n, t) => { await Supabase.saveMemberAvailability(mid, m, d, n, t); refreshData(); }} availabilityWindow={availabilityWindow} ministryId={ministryId} />}
                {currentTab === 'swaps' && ministryConfig.enabledTabs.includes('swaps') && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); }} onAcceptRequest={async (reqId) => { await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); refreshData(); }} onCancelRequest={async (reqId) => { await Supabase.cancelSwapRequestSQL(reqId); addToast("Pedido removido com sucesso.", "info"); refreshData(); }} />}
                {currentTab === 'ranking' && ministryConfig.enabledTabs.includes('ranking') && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                
                {/* Repertoire Tabs - Checked via Config */}
                {(currentTab === 'repertoire' && ministryConfig.enabledTabs.includes('repertoire')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode="view" ministryId={ministryId} />}
                {(currentTab === 'repertoire-manager' && isAdmin && ministryConfig.enabledTabs.includes('repertoire-manager')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode="manage" ministryId={ministryId} />}
                
                {currentTab === 'announcements' && ministryConfig.enabledTabs.includes('announcements') && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(refreshData)} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(refreshData)} />}
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); refreshData(); }} availableRoles={roles} />}
                {currentTab === 'settings' && ministryConfig.enabledTabs.includes('settings') && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); refreshData(); }} onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); refreshData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
                {currentTab === 'members' && isAdmin && ministryConfig.enabledTabs.includes('members') && <MembersScreen members={publicMembers} onlineUsers={onlineUsers} currentUser={currentUser} availableRoles={roles} onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, ministryId); refreshData(); }} onRemoveMember={async (id, name) => { await Supabase.deleteMember(ministryId, id, name); refreshData(); }} />}
                {currentTab === 'events' && isAdmin && ministryConfig.enabledTabs.includes('events') && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); refreshData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); refreshData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'report' && isAdmin && ministryConfig.enabledTabs.includes('report') && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
                {currentTab === 'monthly-report' && isAdmin && ministryConfig.enabledTabs.includes('monthly-report') && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
                {currentTab === 'social' && ministryConfig.enabledTabs.includes('social') && <SocialMediaScreen />}
                {currentTab === 'send-announcements' && isAdmin && ministryConfig.enabledTabs.includes('send-announcements') && <AlertsManager onSend={async (t, m, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title: t, message: m, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title: t, message: m, type, expirationDate: exp }, currentUser.name); refreshData(); }} />}
            </Suspense>

            {/* Modals */}
            <InstallBanner isVisible={showInstallBanner} onInstall={() => (window as any).deferredPrompt.prompt()} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={async (id, r) => { await Supabase.joinMinistry(id, r); window.location.reload(); }} alreadyJoined={currentUser.allowedMinistries || []} />
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); refreshData(); }} onRemove={async (id) => { refreshData(); }} />
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (m, d) => { await Supabase.saveMemberAvailability(ministryId, m, d, {}, currentMonth); refreshData(); }} currentMonth={currentMonth} />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (r) => { await Supabase.saveMinistrySettings(ministryId, undefined, r); refreshData(); }} />
            <AuditModal isOpen={isAuditModalOpen} onClose={() => setAuditModalOpen(false)} logs={auditLogs} />
            
            {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, apply) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso, apply); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} onSwapRequest={async (r, i, t) => { await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role: r, eventIso: i, eventTitle: t, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} currentUser={currentUser} ministryId={ministryId} canEdit={isAdmin} />}
            <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={Object.values(schedule).reduce((acc: any, val: any) => { if(val) acc[val] = (acc[val] || 0) + 1; return acc; }, {})} monthName={getMonthName(currentMonth)} />
            <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key); refreshData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
        </DashboardLayout>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <ToastProvider>
            <InnerApp />
        </ToastProvider>
    </QueryClientProvider>
  );
}