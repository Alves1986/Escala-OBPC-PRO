import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppStore } from './store/appStore';
import { useSession, SessionProvider } from './context/SessionContext';
import { useToast, ToastProvider } from './components/Toast';
import * as Supabase from './services/supabaseService';
import { DEFAULT_TABS, ALL_TABS } from './types';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { getLocalDateISOString, getMonthName, adjustMonth } from './utils/dateUtils';
import { generateIndividualPDF, generateFullSchedulePDF } from './utils/pdfGenerator';
import { subscribeUserToPush } from './utils/pushUtils';

import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, Share2, MousePointerClick, Briefcase, History, FileText, ChevronRight,
  AlertTriangle, Database, RefreshCw
} from 'lucide-react';

import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { InviteScreen } from './components/InviteScreen'; 
import { BillingLockScreen, OrganizationInactiveScreen } from './components/LockScreens';
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
import { Analytics } from '@vercel/analytics/react';
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { EventDetailsModal } from './components/EventDetailsModal';
import { StatsModal } from './components/StatsModal';
import { ConfirmationModal } from './components/ConfirmationModal';

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[50vh]">
    <Loader2 className="animate-spin text-teal-500" size={32} />
  </div>
);

const InnerApp = () => {
  const { user, status, error: sessionError, organization } = useSession();
  const { 
      setCurrentUser, 
      setMinistryId, 
      setAvailableMinistries, 
      availableMinistries, 
      ministryId: storeMinistryId, 
      themeMode, 
      setAppReady,
      isAppReady
  } = useAppStore();
  const { addToast, confirmAction } = useToast();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(() => getLocalDateISOString().slice(0, 7));

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('invite');
      console.log("INVITE TOKEN FROM URL", token);
      if (token) setInviteToken(token);
  }, []);

  useEffect(() => {
      if (status === 'ready' && user) {
          setCurrentUser(user);
          
          if (user.ministryId && !storeMinistryId) {
              setMinistryId(user.ministryId);
          }

          if (user.organizationId) {
              Supabase.fetchOrganizationMinistries(user.organizationId)
              .then(ministries => {
                  setAvailableMinistries(ministries);
                  setAppReady(true);
              })
              .catch(err => {
                  console.warn("Failed to load menus (non-critical)", err);
                  setAppReady(true);
              });
          } else {
              setAppReady(true);
          }
      }
  }, [status, user]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [themeMode]);

  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          if (!window.location.hash.includes('access_token')) {
              url.searchParams.set('tab', currentTab);
              try { window.history.replaceState({}, '', url.toString()); } catch (e) {}
          }
      }
  }, [currentTab]);

  const ministryId = storeMinistryId || user?.ministryId || '';
  const isAdmin = user?.role === 'admin';
  const orgId = user?.organizationId; 

  const ministryConfig = useMemo(() => {
      return availableMinistries.find(m => m.id === ministryId) || { 
          id: ministryId, 
          code: ministryId,
          label: '', 
          enabledTabs: DEFAULT_TABS,
      };
  }, [availableMinistries, ministryId]);

  const { 
    events, schedule, attendance,
    membersMap, publicMembers, availability,
    availabilityNotes, notifications, announcements, 
    repertoire, swapRequests, globalConflicts, auditLogs, roles, 
    ministryTitle, availabilityWindow, eventRules, nextEvent, 
    refreshData, isLoading: loadingData,
    setAvailability, setNotifications 
  } = useMinistryData(ministryId, currentMonth, user);

  const onlineUsers = useOnlinePresence(user?.id, user?.name);

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
      const handlePwaReady = () => setShowInstallBanner(true);
      window.addEventListener('pwa-ready', handlePwaReady);
      return () => window.removeEventListener('pwa-ready', handlePwaReady);
  }, []);

  useEffect(() => {
      const safeEnabledTabs = ministryConfig.enabledTabs || DEFAULT_TABS;
      const isKnownTab = ALL_TABS.includes(currentTab) || currentTab === 'profile';
      
      if (!isKnownTab) {
          setCurrentTab('dashboard');
      }
  }, [currentTab, ministryConfig]);

  const handleLogout = () => {
    // Only confirm if user is actually logged in and active
    if (status === 'ready') {
        confirmAction("Sair", "Deseja realmente sair do sistema?", async () => {
            await Supabase.logout();
            setCurrentUser(null);
            window.location.reload();
        });
    } else {
        Supabase.logout().then(() => {
            setCurrentUser(null);
            window.location.reload();
        });
    }
  };

  const handleEnableNotifications = async () => {
      const sub = await subscribeUserToPush();
      if (sub) {
          addToast("Notificações ativadas!", "success");
      } else {
          addToast("Não foi possível ativar notificações. Verifique as permissões do navegador.", "error");
      }
  };

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

  // --- Conditional Rendering ---

  if (inviteToken) {
      return (
          <InviteScreen 
              token={inviteToken} 
              onClear={() => {
                  setInviteToken(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete('invite');
                  window.history.replaceState({}, '', url.toString());
              }}
          />
      );
  }

  if (status === 'authenticating' || status === 'contextualizing' || status === 'idle') {
      return <LoadingScreen />;
  }

  if (status === 'locked_inactive') {
      return <OrganizationInactiveScreen onLogout={handleLogout} />;
  }

  if (status === 'locked_billing') {
      return <BillingLockScreen checkoutUrl={organization?.checkout_url} onLogout={handleLogout} />;
  }

  if (status === 'unauthenticated') {
      return <LoginScreen />;
  }

  if (status === 'error') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 shadow-xl border border-red-200 dark:border-red-900/50">
                  <AlertTriangle className="text-red-500 dark:text-red-400" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-zinc-800 dark:text-white mb-2">Erro de Sessão</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md leading-relaxed text-sm">
                  {sessionError?.message || "Não foi possível estabelecer a conexão."}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                  <button 
                      onClick={() => window.location.reload()} 
                      className="flex-1 py-3.5 px-6 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <RefreshCw size={18}/> Tentar Novamente
                  </button>
                  <button 
                      onClick={() => Supabase.logout().then(() => window.location.reload())} 
                      className="flex-1 py-3.5 px-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <Database size={18}/> Sair
                  </button>
              </div>
          </div>
      );
  }

  if (!user || !isAppReady) {
      return <LoadingScreen />;
  }

  const isTabValid = safeEnabledTabs.includes(currentTab) || currentTab === 'profile' || currentTab === 'super-admin' || currentTab === 'dashboard';

  return (
    <DashboardLayout
        onLogout={handleLogout}
        title={ministryTitle || 'Carregando...'}
        currentTab={isTabValid ? currentTab : 'dashboard'}
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
            if (user.id) {
                Supabase.updateProfileMinistry(user.id, id);
                const newFunctions = await Supabase.fetchUserFunctions(user.id, id, orgId!);
                setCurrentUser({ ...user, ministryId: id, functions: newFunctions });
            }
            
            const label = availableMinistries.find(m => m.id === id)?.label || 'Ministério';
            addToast(`Alternado para ${label}`, 'info');
            
            const newConfig = availableMinistries.find(m => m.id === id);
            if (newConfig && newConfig.enabledTabs && !newConfig.enabledTabs.includes(currentTab)) {
                setCurrentTab('dashboard');
            }
        }}
        onOpenJoinMinistry={() => setShowJoinModal(true)}
        activeMinistryId={ministryId}
    >
        <Suspense fallback={<LoadingFallback />}>
            {(currentTab === 'dashboard' || !isTabValid) && (
                <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="animate-slide-up">
                            <h1 className="text-2xl md:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
                                Olá, <span className="text-teal-600 dark:text-teal-400">{user.name.split(' ')[0]}</span>
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm md:text-base mt-1 font-medium">Bem-vindo ao painel do seu ministério.</p>
                        </div>
                        <div className="w-full md:w-auto animate-fade-in" style={{ animationDelay: '0.1s' }}><WeatherWidget /></div>
                    </div>

                    <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <NextEventCard 
                            event={nextEvent} 
                            schedule={schedule} 
                            attendance={attendance} 
                            roles={roles} 
                            members={publicMembers} 
                            onConfirm={async (key) => {
                                const assignment = Object.entries(schedule).find(([k, v]) => k === key); 
                                if (nextEvent && nextEvent.event) {
                                    const role = key.split('_').pop() || '';
                                    const memberName = user.name;
                                    setConfirmModalData({ 
                                        key, 
                                        memberName, 
                                        eventName: nextEvent.event.title, 
                                        date: nextEvent.event.date.split('-').reverse().slice(0, 2).join('/'), 
                                        role 
                                    }); 
                                }
                            }} 
                            ministryId={ministryId} 
                            currentUser={user} 
                        />
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
                                    onClearMonth={() => confirmAction("Limpar?", "Limpar escala?", () => Supabase.clearScheduleForMonth(ministryId, orgId!, currentMonth).then(refreshData))} 
                                    onResetEvents={() => addToast("Função de restaurar eventos desativada temporariamente", "info")}
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
                        onCellChange={async (cellKey, role, memberId, memberName) => { 
                            const eventObj = events.find(e => e.id === cellKey);
                            if (!eventObj) {
                                console.error("[onCellChange] Event not found:", cellKey);
                                return;
                            }

                            try {
                                if (memberId) {
                                    await Supabase.saveScheduleAssignment(ministryId, orgId!, cellKey, role, memberId, memberName || "");
                                } else {
                                    const logicalKey = `${cellKey}_${role}`;
                                    await Supabase.removeScheduleAssignment(ministryId, orgId!, logicalKey);
                                }
                                await refreshData(); 
                            } catch (error: any) {
                                const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
                                console.error("Erro ao salvar escala:", errorMsg);
                                addToast("Erro ao salvar: " + errorMsg, "error");
                            }
                        }} 
                        onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, orgId!, key); refreshData(); }} 
                        onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, orgId!, iso.split('T')[0] + 'T' + iso.split('T')[1]); refreshData(); })} 
                        onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} 
                        memberStats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} 
                        ministryId={ministryId} 
                        readOnly={false} 
                        onlineUsers={onlineUsers} 
                    />
                </div>
            )}

            {currentTab === 'super-admin' && user?.isSuperAdmin && (
                <SuperAdminDashboard />
            )}

            {currentTab === 'availability' && safeEnabledTabs.includes('availability') && (
                <AvailabilityScreen 
                    availability={availability} 
                    availabilityNotes={availabilityNotes} 
                    setAvailability={setAvailability} 
                    allMembersList={publicMembers.map(m => m.name)} 
                    currentMonth={currentMonth} 
                    onMonthChange={setCurrentMonth} 
                    currentUser={user} 
                    onSaveAvailability={async (mid, m, d, n, t) => { 
                        await Supabase.saveMemberAvailability(mid, orgId!, m, d, n, t); 
                        await refreshData(); 
                    }} 
                    availabilityWindow={availabilityWindow} 
                    ministryId={ministryId} 
                />
            )}
            
            {currentTab === 'swaps' && safeEnabledTabs.includes('swaps') && <SwapRequestsScreen schedule={schedule} currentUser={user} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { await Supabase.createSwapRequestSQL(ministryId, orgId!, { id: '', ministryId, requesterName: user.name, requesterId: user.id, role: role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); }} onAcceptRequest={async (reqId) => { await Supabase.performSwapSQL(ministryId, orgId!, reqId, user.name, user.id!); refreshData(); }} onCancelRequest={async (reqId) => { await Supabase.cancelSwapRequestSQL(reqId, orgId!); addToast("Pedido removido com sucesso.", "info"); refreshData(); }} />}
            {currentTab === 'ranking' && safeEnabledTabs.includes('ranking') && <RankingScreen ministryId={ministryId} currentUser={user} />}
            
            {(currentTab === 'repertoire' && safeEnabledTabs.includes('repertoire')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={user} mode="view" ministryId={ministryId} />}
            {(currentTab === 'repertoire-manager' && isAdmin && safeEnabledTabs.includes('repertoire-manager')) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={user} mode="manage" ministryId={ministryId} />}
            
            {currentTab === 'announcements' && safeEnabledTabs.includes('announcements') && (
                <AnnouncementsScreen 
                    announcements={announcements} 
                    currentUser={user} 
                    onMarkRead={async (id) => {
                        await Supabase.interactAnnouncementSQL(id, user.id!, user.name, 'read', orgId!);
                        await queryClient.invalidateQueries({ queryKey: ['announcements'] });
                        await refreshData();
                    }} 
                    onToggleLike={async (id) => {
                        await Supabase.interactAnnouncementSQL(id, user.id!, user.name, 'like', orgId!);
                        await queryClient.invalidateQueries({ queryKey: ['announcements'] });
                        await refreshData();
                    }} 
                />
            )}
            {currentTab === 'profile' && <ProfileScreen user={user} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId, orgId!); refreshData(); }} availableRoles={roles} />}
            {currentTab === 'settings' && safeEnabledTabs.includes('settings') && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, orgId!, newTitle); refreshData(); }} onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, orgId!, undefined, undefined, start, end); refreshData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} orgId={orgId!} onEnableNotifications={handleEnableNotifications} />}
            {currentTab === 'members' && isAdmin && safeEnabledTabs.includes('members') && <MembersScreen members={publicMembers} onlineUsers={onlineUsers} currentUser={user} availableRoles={roles} onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, ministryId, orgId!); refreshData(); }} onRemoveMember={async (id, name) => { await Supabase.deleteMember(ministryId, orgId!, id, name); refreshData(); }} onUpdateMember={async (id, data) => { await Supabase.updateMemberData(id, orgId!, data); refreshData(); }} />}
            {currentTab === 'event-rules' && isAdmin && safeEnabledTabs.includes('event-rules') && <EventsScreen />}
            {currentTab === 'report' && isAdmin && safeEnabledTabs.includes('report') && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
            {currentTab === 'monthly-report' && isAdmin && safeEnabledTabs.includes('monthly-report') && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
            {currentTab === 'social' && safeEnabledTabs.includes('social') && <SocialMediaScreen />}
            {currentTab === 'send-announcements' && isAdmin && safeEnabledTabs.includes('send-announcements') && <AlertsManager onSend={async (t, m, type, exp) => { await Supabase.sendNotificationSQL(ministryId, orgId!, { title: t, message: m, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, orgId!, { title: t, message: m, type, expirationDate: exp }, user.name); refreshData(); }} />}
        </Suspense>

        <InstallBanner isVisible={showInstallBanner} onInstall={() => (window as any).deferredPrompt.prompt()} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={async (id, r) => { await Supabase.joinMinistry(id, orgId!, r); window.location.reload(); }} alreadyJoined={user.allowedMinistries || []} />
        <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ id: e.iso, title: e.title, iso: e.iso, date: e.iso.split('T')[0], time: e.iso.split('T')[1] }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, orgId!, e); refreshData(); }} onRemove={async (id) => { await Supabase.deleteMinistryEvent(ministryId, orgId!, id); refreshData(); }} />
        <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (m, d) => { await Supabase.saveMemberAvailability(ministryId, orgId!, m, d, {}, currentMonth); refreshData(); }} currentMonth={currentMonth} />
        <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (r) => { await Supabase.saveMinistrySettings(ministryId, orgId!, undefined, r); refreshData(); }} />
        <AuditModal isOpen={isAuditModalOpen} onClose={() => setAuditModalOpen(false)} logs={auditLogs} />
        
        {eventDetailsModal.isOpen && <EventDetailsModal isOpen={eventDetailsModal.isOpen} onClose={() => setEventDetailsModal({ isOpen: false, event: null })} event={eventDetailsModal.event} schedule={schedule} roles={roles} allMembers={publicMembers} onSave={async (oldIso, newTitle, newTime, apply) => { const newIso = oldIso.split('T')[0] + 'T' + newTime; await Supabase.updateMinistryEvent(ministryId, orgId!, oldIso, newTitle, newIso, apply); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} onSwapRequest={async (r, i, t) => { await Supabase.createSwapRequestSQL(ministryId, orgId!, { id: '', ministryId, requesterName: user.name, requesterId: user.id, role: r, eventIso: i, eventTitle: t, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); setEventDetailsModal({ isOpen: false, event: null }); }} currentUser={user} ministryId={ministryId} canEdit={isAdmin} />}
        <StatsModal isOpen={statsModalOpen} onClose={() => setStatsModalOpen(false)} stats={Object.values(schedule).reduce<Record<string, number>>((acc, val) => { const v = val as string; if(v) acc[v] = (acc[v] || 0) + 1; return acc; }, {})} monthName={getMonthName(currentMonth)} />
        <ConfirmationModal isOpen={!!confirmModalData} onClose={() => setConfirmModalData(null)} data={confirmModalData} onConfirm={async () => { if (confirmModalData) { await Supabase.toggleAssignmentConfirmation(ministryId, orgId!, confirmModalData.key); refreshData(); setConfirmModalData(null); addToast("Presença confirmada!", "success"); }}} />
    </DashboardLayout>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>
          <InnerApp />
          <Analytics />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
};

export default App;