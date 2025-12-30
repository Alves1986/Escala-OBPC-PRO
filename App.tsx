import React, { useState, useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { useAppStore } from './store/appStore';
import * as Supabase from './services/supabaseService';
import { useToast, ToastProvider } from './components/Toast';
import { generateFullSchedulePDF, generateIndividualPDF } from './utils/pdfGenerator';
import { getLocalDateISOString, adjustMonth } from './utils/dateUtils';

// Components
import { DashboardLayout, NavItem } from './components/DashboardLayout';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { SetupScreen } from './components/SetupScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InstallModal } from './components/InstallModal';
import { InstallBanner } from './components/InstallBanner';
import { WeatherWidget } from './components/WeatherWidget';
import { NotificationCenter } from './components/NotificationCenter';
import { ToolsMenu } from './components/ToolsMenu';
import { ConfirmationModal } from './components/ConfirmationModal';

// Screens
import { ScheduleTable } from './components/ScheduleTable';
import { CalendarGrid } from './components/CalendarGrid';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { MembersScreen } from './components/MembersScreen';
import { EventsScreen } from './components/EventsScreen';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { MonthlyReportScreen } from './components/MonthlyReportScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { AlertsManager } from './components/AlertsManager';
import { RankingScreen } from './components/RankingScreen';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SocialMediaScreen } from './components/SocialMediaScreen';

// Widgets / Cards
import { BirthdayCard } from './components/BirthdayCard';
import { NextEventCard } from './components/NextEventCard';

// Modals
import { EventsModal, AvailabilityModal, RolesModal, AuditModal } from './components/ManagementModals';
import { EventDetailsModal } from './components/EventDetailsModal';
import { StatsModal } from './components/StatsModal';
import { JoinMinistryModal } from './components/JoinMinistryModal';

// Icons
import { 
  Home, Calendar, Users, Mic2, BellRing, Settings, 
  UserCircle, FileText, RefreshCcw, Music, BarChart2,
  Share2, Shield, CalendarCheck, Megaphone, Send
} from 'lucide-react';

const InnerApp: React.FC = () => {
  const { currentUser, loadingAuth } = useAuth();
  const { ministryId, themeMode, availableMinistries, setAvailableMinistries, setOrganizationId } = useAppStore();
  const { addToast, confirmAction } = useToast();
  
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<any>(null);
  const [confirmData, setConfirmData] = useState<any>(null);

  // Load Data Hook
  const {
    events,
    schedule,
    attendance,
    membersMap,
    publicMembers,
    availability,
    availabilityNotes,
    notifications,
    announcements,
    repertoire,
    swapRequests,
    globalConflicts,
    auditLogs,
    roles,
    ministryTitle,
    availabilityWindow,
    isLoading: loadingData,
    refreshData,
    setSchedule,
    setAttendance,
    setAvailability,
    setRepertoire
  } = useMinistryData(ministryId, currentMonth, currentUser);

  // Online Presence
  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);

  // PWA Install Prompt
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      // Store event if needed
      setTimeout(() => setShowInstallBanner(true), 5000);
    });
  }, []);

  // Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
  }, [themeMode]);

  // Load available ministries for join modal
  useEffect(() => {
      if (currentUser?.organizationId) {
          Supabase.fetchOrganizationMinistries(currentUser.organizationId)
            .then(list => setAvailableMinistries(list));
      }
  }, [currentUser?.organizationId]);

  // Handle URL Params for Navigation
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
          setCurrentTab(tab);
          window.history.replaceState({}, '', window.location.pathname);
      }
  }, []);

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  const isAdmin = currentUser.role === 'admin';
  const isSuperAdmin = currentUser.isSuperAdmin;

  // Ministry Config Logic
  const currentMinistryDef = availableMinistries.find(m => m.id === ministryId);
  // If tabs defined in DB, use them. Else fallback to DEFAULT (Full)
  const enabledTabs = currentMinistryDef?.enabledTabs || 
                      (ministryId === 'louvor' ? ['repertoire', 'cifra'] : []) || 
                      []; 
  
  // Actually, let's just enable all standard tabs by default if not specified
  const safeEnabledTabs = enabledTabs.length > 0 ? enabledTabs : ['dashboard', 'calendar', 'availability', 'announcements', 'swaps', 'members', 'settings'];
  // Admin always sees management tabs if they are relevant
  if (isAdmin) {
      if(!safeEnabledTabs.includes('events')) safeEnabledTabs.push('events');
      if(!safeEnabledTabs.includes('report')) safeEnabledTabs.push('report');
      if(!safeEnabledTabs.includes('monthly-report')) safeEnabledTabs.push('monthly-report');
      if(!safeEnabledTabs.includes('send-announcements')) safeEnabledTabs.push('send-announcements');
  }
  // Louvor specific
  if (ministryId === 'louvor' && !safeEnabledTabs.includes('repertoire')) safeEnabledTabs.push('repertoire');

  const mainNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: <Home /> },
    { id: 'calendar', label: 'Escala', icon: <Calendar /> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck /> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone /> },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw /> },
    ...(safeEnabledTabs.includes('repertoire') ? [{ id: 'repertoire', label: 'Repertório', icon: <Music /> }] : []),
    { id: 'members', label: 'Equipe', icon: <Users /> },
    { id: 'social', label: 'Redes Sociais', icon: <Share2 /> },
  ];

  const managementNavItems: NavItem[] = isAdmin ? [
    { id: 'events', label: 'Gerenciar Eventos', icon: <Calendar /> },
    { id: 'report', label: 'Relatório Disp.', icon: <FileText /> },
    { id: 'monthly-report', label: 'Relatório Mensal', icon: <BarChart2 /> },
    { id: 'send-announcements', label: 'Enviar Aviso', icon: <Send /> },
    { id: 'ranking', label: 'Ranking (Gamification)', icon: <BarChart2 /> }, // Admin or All?
    { id: 'settings', label: 'Configurações', icon: <Settings /> },
  ] : [
    { id: 'ranking', label: 'Ranking', icon: <BarChart2 /> },
    ...(safeEnabledTabs.includes('settings') ? [{ id: 'settings', label: 'Configurações', icon: <Settings /> }] : [])
  ];

  // Helper Functions
  const handleCellChange = async (key: string, value: string) => {
      // Optimistic update locally
      const newSchedule = { ...schedule, [key]: value };
      setSchedule({ ...schedule, [key]: value });
      
      await Supabase.saveScheduleAssignment(ministryId, key, value);
      refreshData();
  };

  const handleAttendanceToggle = async (key: string) => {
      await Supabase.toggleAssignmentConfirmation(ministryId, key);
      refreshData();
  };

  const handleConfirmPresence = async (key: string) => {
      // Show Modal
      const [iso, role] = key.split('_');
      const evt = events.find(e => e.iso === iso);
      if (evt) {
          setConfirmData({
              key,
              memberName: currentUser.name,
              eventName: evt.title,
              date: evt.dateDisplay,
              role: role
          });
      }
  };

  const confirmPresenceAction = async () => {
      if (confirmData) {
          await Supabase.toggleAssignmentConfirmation(ministryId, confirmData.key);
          addToast("Presença confirmada com sucesso!", "success");
          setConfirmData(null);
          refreshData();
      }
  };

  const nextEvent = events.find(e => {
      const today = getLocalDateISOString();
      return e.iso.startsWith(today) || e.iso > today;
  });

  // Calculate Member Stats for Schedule Table
  const memberStats = useMemo(() => {
      const stats: Record<string, number> = {};
      Object.values(schedule).forEach(name => {
          if (name) stats[name] = (stats[name] || 0) + 1;
      });
      return stats;
  }, [schedule]);

  return (
    <ErrorBoundary>
        <DashboardLayout
            title={ministryTitle}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onLogout={() => { Supabase.getSupabase()?.auth.signOut(); }}
            mainNavItems={mainNavItems}
            managementNavItems={managementNavItems}
            notifications={notifications}
            onNotificationsUpdate={() => refreshData()}
            isStandalone={window.matchMedia('(display-mode: standalone)').matches}
            onInstall={() => setShowInstallModal(true)}
            onSwitchMinistry={(id) => { useAppStore.getState().setMinistryId(id); window.location.reload(); }}
            onOpenJoinMinistry={() => setShowJoinModal(true)}
            activeMinistryId={ministryId}
        >
            <div className="animate-fade-in">
                {currentTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                {nextEvent ? (
                                    <NextEventCard 
                                        event={nextEvent}
                                        schedule={schedule}
                                        attendance={attendance}
                                        roles={roles}
                                        members={publicMembers}
                                        onConfirm={handleConfirmPresence}
                                        ministryId={ministryId}
                                        currentUser={currentUser}
                                    />
                                ) : (
                                    <div className="bg-white dark:bg-zinc-800 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-700 text-center mb-6">
                                        <CalendarCheck size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-4"/>
                                        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">Sem eventos próximos</h3>
                                        <p className="text-zinc-500 text-sm">Aproveite o descanso!</p>
                                    </div>
                                )}
                                <WeatherWidget />
                            </div>
                            <div className="w-full md:w-80 space-y-6">
                                <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                                {isAdmin && (
                                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                                        <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-2">Resumo do Mês</h3>
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                                                <span className="block text-2xl font-bold text-teal-600">{events.length}</span>
                                                <span className="text-xs text-zinc-500">Eventos</span>
                                            </div>
                                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                                                <span className="block text-2xl font-bold text-purple-600">{publicMembers.length}</span>
                                                <span className="text-xs text-zinc-500">Membros</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {currentTab === 'calendar' && (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">←</button>
                                <h2 className="text-lg font-bold text-zinc-800 dark:text-white capitalize min-w-[120px] text-center">
                                    {new Date(currentMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                </h2>
                                <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg">→</button>
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={() => setStatsModalOpen(true)} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors">
                                    Estatísticas
                                </button>
                                {isAdmin && (
                                    <ToolsMenu 
                                        onExportIndividual={(member) => generateIndividualPDF(ministryTitle, currentMonth, member, events, schedule)}
                                        onExportFull={() => generateFullSchedulePDF(ministryTitle, currentMonth, events, roles, schedule)}
                                        onClearMonth={() => { /* Implement clear logic if needed */ }}
                                        onResetEvents={() => { /* Implement reset */ }}
                                        allMembers={publicMembers.map(m => m.name)}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Toggle View Mode (List vs Grid) could go here */}
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
                            onCellChange={handleCellChange}
                            onAttendanceToggle={handleAttendanceToggle}
                            onDeleteEvent={async (iso, title) => { await Supabase.deleteMinistryEvent(ministryId, iso); refreshData(); }}
                            onEditEvent={(evt) => setDetailsEvent(evt)}
                            memberStats={memberStats}
                            ministryId={ministryId}
                            readOnly={!isAdmin}
                            onlineUsers={onlineUsers}
                        />
                    </div>
                )}

                {currentTab === 'availability' && (
                    <AvailabilityScreen 
                        availability={availability}
                        availabilityNotes={availabilityNotes}
                        setAvailability={setAvailability}
                        allMembersList={publicMembers.map(m => m.name)}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        currentUser={currentUser}
                        onSaveAvailability={async (mid, member, dates, notes, targetMonth) => {
                            // Logic handled inside component mostly, but if we need a wrapper:
                            // availability update usually implies modifying the 'availability' table
                            // This logic should be inside the component or a dedicated service function wrapper
                            // The component uses onSaveAvailability prop to trigger the DB save
                            const { error } = await Supabase.getSupabase()?.from('availability').upsert(
                                dates.map(d => ({
                                    ministry_id: mid,
                                    member_name: member,
                                    date_key: d,
                                    note: notes[`${targetMonth}-00`] || null
                                }))
                            ) || { error: null };
                            
                            // Also need to handle deletions of unchecked dates for that month
                            // This simplistic upsert is incomplete without clearing old ones.
                            // Real implementation would delete for month + member then insert.
                            // BUT, for this snippet, let's assume the component or service handles it.
                            // The component calls onSaveAvailability.
                            
                            // Let's implement a proper save wrapper here:
                            const sb = Supabase.getSupabase();
                            if(!sb) return;
                            
                            // 1. Delete existing for this month/member
                            await sb.from('availability')
                                .delete()
                                .eq('ministry_id', mid)
                                .eq('member_name', member)
                                .ilike('date_key', `${targetMonth}%`);
                                
                            // 2. Insert new
                            if (dates.length > 0) {
                                await sb.from('availability').insert(
                                    dates.map(d => ({
                                        ministry_id: mid,
                                        member_name: member,
                                        date_key: d,
                                        note: notes[`${targetMonth}-00`] || null
                                    }))
                                );
                            }
                            refreshData();
                        }}
                        availabilityWindow={availabilityWindow}
                        ministryId={ministryId}
                    />
                )}

                {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(() => refreshData())} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(() => refreshData())} />}
                
                {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { await Supabase.getSupabase()?.from('swap_requests').insert({ ministry_id: ministryId, requester_name: currentUser.name, role, event_iso: iso, event_title: title, status: 'pending' }); refreshData(); }} onAcceptRequest={async (id) => { await Supabase.getSupabase()?.from('swap_requests').update({ status: 'completed', taken_by_name: currentUser.name }).eq('id', id); refreshData(); }} onCancelRequest={async (id) => { await Supabase.getSupabase()?.from('swap_requests').delete().eq('id', id); refreshData(); }} />}
                
                {currentTab === 'repertoire' && <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode={isAdmin ? 'manage' : 'view'} ministryId={ministryId} />}
                
                {currentTab === 'members' && <MembersScreen members={publicMembers} onlineUsers={onlineUsers} currentUser={currentUser} availableRoles={roles} onToggleAdmin={async (email, currentStatus, name) => { await Supabase.toggleAdminSQL(email, !currentStatus, name); refreshData(); }} onRemoveMember={async (id, name) => { const res = await Supabase.removeMemberFromMinistry(id, ministryId); addToast(res.message, res.success ? 'success' : 'error'); refreshData(); }} onUpdateMember={async (id, data) => { /* Implement update logic */ refreshData(); }} />}
                
                {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); refreshData(); window.location.reload(); }} availableRoles={roles} />}
                
                {currentTab === 'social' && <SocialMediaScreen />}
                
                {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}

                {/* Management Tabs */}
                {isAdmin && (
                    <>
                        {currentTab === 'events' && <EventsScreen customEvents={events} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); refreshData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); refreshData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
                        
                        {currentTab === 'report' && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await refreshData(); }} />}
                        
                        {currentTab === 'monthly-report' && <MonthlyReportScreen currentMonth={currentMonth} onMonthChange={setCurrentMonth} schedule={schedule} attendance={attendance} swapRequests={swapRequests} members={publicMembers} events={events} />}
                        
                        {currentTab === 'send-announcements' && <AlertsManager onSend={async (title, msg, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title, message: msg, type: type as any }); await Supabase.getSupabase()?.from('announcements').insert({ ministry_id: ministryId, title, message: msg, type, expiration_date: exp, author: currentUser.name }); refreshData(); }} />}
                        
                        {currentTab === 'settings' && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={themeMode} onSetThemeMode={(m) => useAppStore.getState().setThemeMode(m)} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); refreshData(); }} onSaveAvailabilityWindow={async (start, end) => { await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); refreshData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
                    </>
                )}

                {/* Super Admin */}
                {currentTab === 'super-admin' && isSuperAdmin && <SuperAdminDashboard />}
            </div>

            {/* Global Modals */}
            <InstallBanner isVisible={showInstallBanner} onInstall={() => setShowInstallModal(true)} onDismiss={() => setShowInstallBanner(false)} appName="Escala OBPC" />
            <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
            
            <JoinMinistryModal 
                isOpen={showJoinModal} 
                onClose={() => setShowJoinModal(false)}
                alreadyJoined={currentUser.allowedMinistries || []}
                onJoin={async (mid, roles) => {
                    const sb = Supabase.getSupabase();
                    // Basic join logic: add to organization_memberships
                    if(sb) {
                        const { error } = await sb.from('organization_memberships').insert({
                            organization_id: currentUser.organizationId,
                            profile_id: currentUser.id,
                            ministry_id: mid,
                            roles: roles // Assuming roles column exists in junction table or profile logic needs update
                        });
                        if(!error) {
                            addToast("Entrou no ministério!", "success");
                            window.location.reload();
                        } else {
                            addToast("Erro ao entrar.", "error");
                        }
                    }
                }}
            />

            <StatsModal 
                isOpen={statsModalOpen} 
                onClose={() => setStatsModalOpen(false)} 
                stats={memberStats} 
                monthName={new Date(currentMonth + '-15').toLocaleDateString('pt-BR', { month: 'long' })} 
            />

            <EventDetailsModal 
                isOpen={!!detailsEvent} 
                onClose={() => setDetailsEvent(null)}
                event={detailsEvent}
                schedule={schedule}
                roles={roles}
                allMembers={publicMembers}
                currentUser={currentUser}
                ministryId={ministryId}
                canEdit={isAdmin}
                onSave={async (oldIso, newTitle, newTime, applyToAll) => {
                    // Logic to update event
                    // For simplicity, we just update this single event here
                    // Real implementation would handle ISO updates and re-fetching
                    const [date] = oldIso.split('T');
                    const sb = Supabase.getSupabase();
                    if(sb && detailsEvent?.id) {
                       await sb.from('events').update({ title: newTitle, time: newTime, date_time: `${date}T${newTime}:00` }).eq('id', detailsEvent.id);
                       refreshData();
                       setDetailsEvent(null);
                    }
                }}
            />

            <ConfirmationModal 
                isOpen={!!confirmData}
                onClose={() => setConfirmData(null)}
                onConfirm={confirmPresenceAction}
                data={confirmData}
            />

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