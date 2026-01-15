import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppStore } from './store/appStore';
import { useAuth } from './hooks/useAuth';
import { useToast, ToastProvider } from './components/Toast';
import * as Supabase from './services/supabaseService';
import { SUPABASE_URL, SUPABASE_KEY } from './services/supabaseService';
import { DEFAULT_TABS } from './types';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { getLocalDateISOString, getMonthName, adjustMonth } from './utils/dateUtils';
import { generateIndividualPDF, generateFullSchedulePDF } from './utils/pdfGenerator';

import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, Share2, MousePointerClick, Briefcase, History, FileText, ChevronRight,
  AlertTriangle, Database
} from 'lucide-react';

import { SetupScreen } from './components/SetupScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { WeatherWidget } from './components/WeatherWidget';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { CalendarGrid } from './components/CalendarGrid';
import { ToolsMenu } from './components/ToolsMenu';
import { ScheduleTable } from './components/ScheduleTable';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { RankingScreen } from './components/RankingScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { MembersScreen } from './components/MembersScreen';
import { EventsScreen } from './components/EventsScreen';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { MonthlyReportScreen } from './components/MonthlyReportScreen';
import { SocialMediaScreen } from './components/SocialMediaScreen';
import { AlertsManager } from './components/AlertsManager';
import { InstallBanner } from './components/InstallBanner';
import { InstallModal } from './components/InstallModal';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { EventDetailsModal } from './components/EventDetailsModal';
import { StatsModal } from './components/StatsModal';
import { ConfirmationModal } from './components/ConfirmationModal';

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[50vh]">
    <Loader2 className="animate-spin text-teal-500" size={32} />
  </div>
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const InnerApp = () => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isConfigured, setIsConfigured] = useState(!!(SUPABASE_URL && SUPABASE_KEY));
  const { currentUser, loadingAuth } = useAuth();
  const { setCurrentUser, setMinistryId, setAvailableMinistries, availableMinistries, ministryId: storeMinistryId, themeMode, isAppReady, setAppReady } = useAppStore();
  const { addToast, confirmAction } = useToast();
  
  const [currentMonth, setCurrentMonth] = useState(() => getLocalDateISOString().slice(0, 7));
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
      setIsConfigured(!!(SUPABASE_URL && SUPABASE_KEY));
  }, [SUPABASE_URL, SUPABASE_KEY]);

  useEffect(() => {
      if (currentUser) {
          useAppStore.getState().setCurrentUser(currentUser);
      }
  }, [currentUser]);

  useEffect(() => {
      const boot = async () => {
          if (!currentUser?.organizationId) {
              setAppReady(false);
              return;
          }

          setAppReady(false); 
          setBootError(null);
          console.log('[BOOT] Starting Sequence for Org:', currentUser.organizationId);

          try {
              const fetchedMinistries = await Supabase.fetchOrganizationMinistries(currentUser.organizationId);
              setAvailableMinistries(fetchedMinistries);

              let targetMinistryId = '';

              const localStored = localStorage.getItem('ministry_id');
              const isLocalValid = localStored && UUID_REGEX.test(localStored) && fetchedMinistries.some(m => m.id === localStored) && currentUser.allowedMinistries?.includes(localStored);
              
              if (isLocalValid) {
                  targetMinistryId = localStored!;
              } 
              else if (currentUser.ministryId && UUID_REGEX.test(currentUser.ministryId) && fetchedMinistries.some(m => m.id === currentUser.ministryId) && currentUser.allowedMinistries?.includes(currentUser.ministryId)) {
                  targetMinistryId = currentUser.ministryId;
              }
              else if (currentUser.allowedMinistries && currentUser.allowedMinistries.length > 0) {
                  const firstAllowed = fetchedMinistries.find(m => currentUser.allowedMinistries?.includes(m.id));
                  if (firstAllowed) targetMinistryId = firstAllowed.id;
              }

              if (targetMinistryId) {
                  console.log('[BOOT] Resolved Ministry:', targetMinistryId);
                  setMinistryId(targetMinistryId);
                  
                  localStorage.setItem('ministry_id', targetMinistryId);
                  
                  const funcs = await Supabase.fetchUserFunctions(currentUser.id!, targetMinistryId, currentUser.organizationId);
                  setCurrentUser({ ...currentUser, ministryId: targetMinistryId, functions: funcs });

                  setAppReady(true);
                  console.log('[BOOT] App Ready');
              } else {
                  console.warn('[BOOT] No valid ministry found for user.');
                  setAppReady(true); 
              }

          } catch (e: any) {
              console.error('[BOOT] Failed:', JSON.stringify(e, null, 2) || e);
              
              let msg = "Erro desconhecido ao inicializar.";
              if (e?.message?.includes('fetch')) {
                  msg = "Falha de conexão com o servidor. Verifique sua internet ou a URL configurada.";
              } else if (e?.message) {
                  msg = e.message;
              }
              setBootError(msg);
              addToast("Erro na inicialização.", "error");
          }
      };

      if (!loadingAuth) {
          boot();
      }
  }, [currentUser?.organizationId, loadingAuth]);


  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [themeMode]);

  const ministryId = useAppStore(state => state.ministryId);
  
  const ministryConfig = useMemo(() => {
      return availableMinistries.find(m => m.id === ministryId) || { 
          id: ministryId, 
          code: ministryId,
          label: '', 
          enabledTabs: DEFAULT_TABS,
      };
  }, [ministryId, availableMinistries]);

  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  const { 
    events, schedule, attendance,
    membersMap, publicMembers, availability,
    availabilityNotes, notifications, announcements, 
    repertoire, swapRequests, globalConflicts, auditLogs, roles, 
    ministryTitle, availabilityWindow, eventRules,
    refreshData, isLoading: loadingData,
    setAvailability, setNotifications 
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);

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

  useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          if (!window.location.hash.includes('access_token')) {
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

  const handleLogout = () => {
    confirmAction("Sair", "Deseja realmente sair do sistema?", async () => {
        await Supabase.logout();
        setCurrentUser(null);
        setAppReady(false); 
        try { window.history.replaceState(null, '', '/'); } catch(e) {}
    });
  };

  if ((!isConfigured && !isDemoMode)) {
      if (import.meta.env.DEV) {
        return (
            <SetupScreen 
                onEnterDemo={() => setIsDemoMode(true)} 
                onConfigured={() => setIsConfigured(true)}
            />
        );
      }
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-xl">
                  <AlertTriangle className="text-red-500" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Erro de Configuração</h2>
              <p className="text-zinc-500 max-w-md leading-relaxed text-sm">
                  O sistema não detectou as variáveis de ambiente necessárias. Entre em contato com o administrador do sistema.
              </p>
          </div>
      );
  }

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen isLoading={loadingAuth} />;

  if (bootError) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-xl border border-red-200 dark:border-red-900/50">
                  <AlertTriangle className="text-red-500 dark:text-red-400" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">Falha na Inicialização</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md leading-relaxed text-sm">{bootError}</p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button 
                      onClick={() => window.location.reload()} 
                      className="flex-1 py-3.5 px-6 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <RefreshCcw size={18}/> Tentar Novamente
                  </button>
                  <button 
                      onClick={() => {
                          if(confirm("Isso desconectará sua conta e limpará as configurações de conexão. Continuar?")) {
                              Supabase.disconnectManual();
                              localStorage.clear();
                              window.location.reload();
                          }
                      }} 
                      className="flex-1 py-3.5 px-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <Database size={18}/> Reconfigurar
                  </button>
              </div>
              <button 
                  onClick={() => Supabase.logout().then(() => window.location.reload())} 
                  className="mt-8 text-xs font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline uppercase tracking-widest transition-colors"
              >
                  Sair da Conta
              </button>
          </div>
      );
  }

  if (!isAppReady) return <LoadingScreen />;

  const isAdmin = currentUser.role === 'admin';
  const orgId = currentUser.organizationId;
  
  if (!orgId) return <LoadingScreen />;

  const RAW_MAIN_NAV = [
    { id: 'dashboard', label: 'Início', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
    { id: 'ranking', label: 'Destaques', icon: <Trophy size={20}/> },
    { id: 'social', label: 'Redes', icon: <Share2 size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const RAW_MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileText size={20}/> },
    { id: 'repertoire-manager', label: 'Ger. Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disp.', icon: <FileBarChart size={20}/> },
    { id: 'event-rules', label: 'Regras de Agenda', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros', icon: <Users size={20}/> },
  ];

  const RAW_QUICK_ACTIONS = [
    { id: 'calendar', label: 'Ver Escala', icon: <CalendarIcon size={24} />, color: 'bg-blue-500', hover: 'hover:bg-blue-600' },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={24} />, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw size={24} />, color: 'bg-amber-500', hover: 'hover:bg-amber-600' },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={24} />, color: 'bg-pink-500', hover: 'hover:bg-pink-600' },
  ];

  const safeEnabledTabs = ministryConfig.enabledTabs || DEFAULT_TABS;
  const MAIN_NAV = RAW_MAIN_NAV.filter(item => safeEnabledTabs.includes(item.id));
  const MANAGEMENT_NAV = RAW_MANAGEMENT_NAV.filter(item => safeEnabledTabs.includes(item.id));
  const QUICK_ACTIONS = RAW_QUICK_ACTIONS.filter(item => safeEnabledTabs.includes(item.id));

  return (
    <ErrorBoundary>
        <DashboardLayout
            onLogout={handleLogout}
            title={ministryTitle || 'Carregando...'}
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
                setAppReady(false); 
                setMinistryId(id);
                if (currentUser && currentUser.id) {
                    await Supabase.updateProfileMinistry(currentUser.id, id);
                    const newFunctions = await Supabase.fetchUserFunctions(currentUser.id, id, orgId);
                    setCurrentUser({ ...currentUser, ministryId: id, functions: newFunctions });
                }
                
                const label = availableMinistries.find(m => m.id === id)?.label || 'Ministério';
                addToast(`Alternado para ${label}`, 'info');
                await refreshData();
                setAppReady(true);
                
                const newConfig = availableMinistries.find(m => m.id === id);
                if (newConfig && newConfig.enabledTabs && !newConfig.enabledTabs.includes(currentTab)) {
                    setCurrentTab('dashboard');
                }
            }}
            onOpenJoinMinistry={() => setShowJoinModal(true)}
            activeMinistryId={ministryId}
        >
            <Suspense fallback={<LoadingFallback />}>
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

                        <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            {(() => {
                                const now = new Date();
                                const bufferMs = 2.5 * 60 * 60 * 1000; 
                                
                                const upcoming = events.filter(e => {
                                    const eventDate = new Date(e.iso);
                                    const expirationDate = new Date(eventDate.getTime() + bufferMs);
                                    return expirationDate > now;
                                }).sort((a, b) => a.iso.localeCompare(b.iso))[0];

                                return <NextEventCard event={upcoming} schedule={schedule} attendance={attendance} roles={roles} members={publicMembers} onConfirm={(key) => { const assignment = Object.entries(schedule).find(([k, v]) => k === key); if (assignment) setConfirmModalData({ key, memberName: assignment[1], eventName: upcoming.title, date: upcoming.dateDisplay, role: key.split('_').pop() || '' }); }} ministryId={ministryId} currentUser={currentUser} />;
                            })()}
                        </div>

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

                {currentTab === 'calendar' && safeEnabledTabs.includes('calendar') && (
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

                {currentTab === 'schedule-editor' && isAdmin && safeEnabledTabs.includes('schedule-editor') && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                            <div className="w-full xl:w-auto">
                                <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                                    <Edit className="text-blue-600 dark:text-blue-500" size={32} /> Editor de Escala
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
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
                                        onClearMonth={() => confirmAction("Limpar?", "Limpar escala?", () => Supabase.clearScheduleForMonth(ministryId, orgId, currentMonth).then(refreshData))} 
                                        allMembers={publicMembers.map(m => m.name)} 
                                    />
                                </div>
                                
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
                            availabilityNotes={availabilityNotes}
                            members={membersMap} 
                            allMembers={publicMembers.map(m => m.name)} 
                            memberProfiles={publicMembers} 
                            scheduleIssues={{}} 
                            globalConflicts={globalConflicts} 
                            onCellChange={async (key, val) => { 
                                const success = await Supabase.saveScheduleAssignment(ministryId, orgId, key, val); 
                                if (success) {
                                    refreshData(); 
                                } else {
                                    addToast("Erro ao salvar: Membro não encontrado ou dados inválidos.", "error");
                                }
                            }} 
                            onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, orgId, key); refreshData(); }} 
                            onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, orgId, iso.split('T')[0] + 'T' + iso.split('T')[1]); refreshData(); })} 
                            onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} 
                            memberStats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} 
                            ministryId={ministryId} 
                            readOnly={false} 
                            onlineUsers={onlineUsers} 
                        />
                    </div>
                )}

                {currentTab === 'super-admin' && currentUser?.isSuperAdmin && (
                    <SuperAdminDashboard />
                )}

                {currentTab === 'availability' && safeEnabledTabs.includes('availability') && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (mid, m, d, n, t) => { await Supabase.saveMemberAvailability(mid, orgId, m, d, n, t); refreshData(); }} availabilityWindow={availabilityWindow} ministryId={ministryId} />}
                {currentTab === 'swaps' && safeEnabledTabs.includes('swaps') && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { await Supabase.createSwapRequestSQL(ministryId, orgId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role: role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); }} onAcceptRequest={async (reqId) => { await Supabase.performSwapSQL(ministryId, orgId, reqId, currentUser.name, currentUser.id!); refreshData(); }} onCancelRequest={async (reqId) => { await Supabase.cancelSwapRequestSQL(reqId, orgId); addToast("Pedido removido com sucesso.", "info"); refreshData(); }} />}
                {currentTab === 'ranking' && safeEnabledTabs.includes('ranking') && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                
                {(currentTab === 'repertoire' && safeEnabledTabs.includes('repertoire')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode="view" ministryId={ministryId} />}
                {(currentTab === 'repertoire-manager' && isAdmin && safeEnabledTabs.includes('repertoire-manager')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode="manage" ministryId={ministryId} />}
                
                {currentTab === 'announcements' && safeEnabledTabs.includes('announcements') && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read', orgId).then(refreshData)} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like', orgId).then(refreshData)} />}
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId, orgId); refreshData(); }} availableRoles={roles} />}
                {currentTab === 'settings' && safeEnabledTabs.includes('settings') && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, orgId, newTitle); refreshData(); }} onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, orgId, undefined, undefined, start, end); refreshData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} orgId={orgId} />}
                {currentTab === 'members' && isAdmin && safeEnabledTabs.includes('members') && <MembersScreen members={publicMembers} onlineUsers={onlineUsers} currentUser={currentUser} availableRoles={roles} onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, ministryId, orgId); refreshData(); }} onRemoveMember={async (id, name) => { await Supabase.deleteMember(ministryId, orgId, id, name); refreshData(); }} onUpdateMember={async (id, data) => { await Supabase.updateMemberData(id, orgId, data); refreshData(); }} />}
                {currentTab === 'event-rules' && isAdmin && safeEnabledTabs.includes('event-rules') && <EventsScreen rules={eventRules} />}
                {currentTab === 'report' && isAdmin && safeEnabledTabs.includes('report') && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
                {currentTab === 'monthly-report' && isAdmin && safeEnabledTabs.includes('monthly-report') && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
                {currentTab === 'social' && safeEnabledTabs.includes('social') && <SocialMediaScreen />}
                {currentTab === 'send-announcements' && isAdmin && safeEnabledTabs.includes('send-announcements') && <AlertsManager onSend={async (t, m, type, exp) => { await Supabase.sendNotificationSQL(ministryId, orgId, { title: t, message: m, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, orgId, { title: t, message: m, type, expirationDate: exp }, currentUser.name); refreshData(); }} />}
            </Suspense>

            <InstallBanner isVisible={showInstallBanner} onInstall={() => (window as any).deferredPrompt.prompt()} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={async (id, r) => { await Supabase.joinMinistry(id, orgId, r); window.location.reload(); }} alreadyJoined={currentUser.allowedMinistries || []} />
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ id: e.id, title: e.title, iso: e.iso, date: e.iso.split('T')[0], time: e.iso.split('T')[1] }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, orgId, e); refreshData(); }} onRemove={async (id) => { await Supabase.deleteMinistryEvent(ministryId, orgId, id); refreshData(); }} />
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (m, d) => { await Supabase.saveMemberAvailability(ministryId, orgId, m, d, {}, currentMonth); refreshData(); }} currentMonth={currentMonth} />
            <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (r) => { await Supabase.saveMinistrySettings(ministryId, orgId, undefined, r); refreshData(); }} />
            <AuditModal isOpen={isAuditModalOpen} onClose={() => setAuditModalOpen(false)} logs={auditLogs} />
            
            {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, apply) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, orgId, oldIso, newTitle, newIso, apply); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} onSwapRequest={async (r, i, t) => { await Supabase.createSwapRequestSQL(ministryId, orgId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role: r, eventIso: i, eventTitle: t, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} currentUser={currentUser} ministryId={ministryId} canEdit={isAdmin} />}
            <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} monthName={getMonthName(currentMonth)} />
            <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, orgId, confirmModalData.key); refreshData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
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