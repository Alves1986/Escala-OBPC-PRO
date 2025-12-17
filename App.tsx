
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppStore } from './store/appStore';
import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Clock, ArrowLeft, ArrowRight,
  Calendar as CalendarIcon, Trophy, Loader2, ShieldAlert, Share2, Sparkles, ChevronRight, FileText, History
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
import { SUPABASE_URL, SUPABASE_KEY } from './types';
import { adjustMonth, getMonthName, getLocalDateISOString } from './utils/dateUtils';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from './utils/pushUtils';

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
                addToast(`Alternado para ${id}`, 'info');
                refreshData();
            }}
            onOpenJoinMinistry={() => setShowJoinModal(true)}
        >
            <Suspense fallback={<LoadingFallback />}>
                {/* Dashboard */}
                {currentTab === 'dashboard' && (
                    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight leading-tight">
                                    Olá, <span className="text-teal-600 dark:text-teal-400">{currentUser.name.split(' ')[0]}</span>
                                </h1>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Bem-vindo ao painel do {ministryTitle}.</p>
                            </div>
                            <div className="w-full md:w-auto"><WeatherWidget /></div>
                        </div>

                        {/* Next Event */}
                        {(() => {
                            const now = new Date();
                            const upcoming = events.filter(e => new Date(e.iso) >= now || e.iso.startsWith(now.toISOString().split('T')[0])).sort((a, b) => a.iso.localeCompare(b.iso))[0];
                            return <NextEventCard event={upcoming} schedule={schedule} attendance={attendance} roles={roles} onConfirm={(key) => { const assignment = Object.entries(schedule).find(([k, v]) => k === key); if (assignment) setConfirmModalData({ key, memberName: assignment[1], eventName: upcoming.title, date: upcoming.dateDisplay, role: key.split('_').pop() || '' }); }} ministryId={ministryId} currentUser={currentUser} />;
                        })()}
                        
                        <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                    </div>
                )}

                {/* Calendar */}
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

                {/* Schedule Editor (Admin) */}
                {currentTab === 'schedule-editor' && isAdmin && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                            <div><h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3"><Edit className="text-blue-600 dark:text-blue-500" size={32} /> Editor de Escala</h2><p className="text-zinc-500 dark:text-zinc-400 mt-2">Gerencie a escala oficial de {getMonthName(currentMonth)}.</p></div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setAuditModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-xs font-bold"
                                >
                                    <History size={16}/> Histórico
                                </button>
                                <ToolsMenu 
                                    onExportIndividual={(member) => generateIndividualPDF(ministryTitle, currentMonth, member, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().slice(0,2).join('/')})), schedule)} 
                                    onExportFull={() => generateFullSchedulePDF(ministryTitle, currentMonth, events.map(e => ({...e, dateDisplay: e.iso.split('T')[0].split('-').reverse().slice(0,2).join('/')})), roles, schedule)} 
                                    onWhatsApp={() => {}} 
                                    onClearMonth={() => confirmAction("Limpar?", "Limpar escala?", () => Supabase.clearScheduleForMonth(ministryId, currentMonth).then(refreshData))} 
                                    onResetEvents={() => confirmAction("Restaurar?", "Restaurar eventos?", () => Supabase.resetToDefaultEvents(ministryId, currentMonth).then(refreshData))}
                                    allMembers={publicMembers.map(m => m.name)} 
                                />
                                <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-700 shadow-sm text-white"><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowLeft size={16}/></button><span className="text-sm font-bold min-w-[80px] text-center">{currentMonth}</span><button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-700 rounded-md"><ArrowRight size={16}/></button></div>
                            </div>
                        </div>
                        <ScheduleTable events={events} roles={roles} schedule={schedule} attendance={attendance} availability={availability} members={membersMap} allMembers={publicMembers.map(m => m.name)} memberProfiles={publicMembers} scheduleIssues={{}} globalConflicts={globalConflicts} onCellChange={async (key, val) => { await Supabase.saveScheduleAssignment(ministryId, key, val); refreshData(); }} onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, key); refreshData(); }} onDeleteEvent={async (iso, title) => confirmAction("Remover?", `Remover "${title}"?`, async () => { await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]); refreshData(); })} onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })} memberStats={Object.values(schedule).reduce((acc: any, val: any) => { if(val) acc[val] = (acc[val] || 0) + 1; return acc; }, {})} ministryId={ministryId} readOnly={false} onlineUsers={onlineUsers} />
                    </div>
                )}

                {/* Other Tabs Mapped */}
                {currentTab === 'availability' && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (m, d, n, t) => { await Supabase.saveMemberAvailability(m, d, n, t); refreshData(); }} availabilityWindow={availabilityWindow} />}
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); refreshData(); }} onAcceptRequest={async (reqId) => { await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); refreshData(); }} />}
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
                {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'} ministryId={ministryId} />}
                {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(refreshData)} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(refreshData)} />}
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); refreshData(); }} availableRoles={roles} />}
                {currentTab === 'settings' && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); refreshData(); }} onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); refreshData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
                {currentTab === 'members' && isAdmin && <MembersScreen members={publicMembers} onlineUsers={onlineUsers} currentUser={currentUser} availableRoles={roles} onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, ministryId); refreshData(); }} onRemoveMember={async (id, name) => { await Supabase.deleteMember(ministryId, id, name); refreshData(); }} />}
                {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); refreshData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); refreshData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                {currentTab === 'report' && isAdmin && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
                {currentTab === 'monthly-report' && isAdmin && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
                {currentTab === 'social' && <SocialMediaScreen />}
                {currentTab === 'send-announcements' && isAdmin && <AlertsManager onSend={async (t, m, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title: t, message: m, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title: t, message: m, type, expirationDate: exp }, currentUser.name); refreshData(); }} />}
            </Suspense>

            {/* Modals */}
            <InstallBanner isVisible={showInstallBanner} onInstall={() => (window as any).deferredPrompt.prompt()} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            <JoinMinistryModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} onJoin={async (id, r) => { await Supabase.joinMinistry(id, r); window.location.reload(); }} alreadyJoined={currentUser.allowedMinistries || []} />
            <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); refreshData(); }} onRemove={async (id) => { refreshData(); }} />
            <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (m, d) => { await Supabase.saveMemberAvailability(m, d, {}, currentMonth); refreshData(); }} currentMonth={currentMonth} />
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
