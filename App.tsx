import React, { useState, useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { SessionProvider, useSession } from './context/SessionContext';
import { ToastProvider, useToast } from './components/Toast';
import { DashboardLayout, NavItem } from './components/DashboardLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { useAppStore } from './store/appStore';
import * as Supabase from './services/supabaseService';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { getLocalDateISOString } from './utils/dateUtils';

// Components
import { ScheduleTable } from './components/ScheduleTable';
import { CalendarGrid } from './components/CalendarGrid';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { WeatherWidget } from './components/WeatherWidget';
import { RepertoireScreen } from './components/RepertoireScreen';
import { MembersScreen } from './components/MembersScreen';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { AlertsManager } from './components/AlertsManager';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { MonthlyReportScreen } from './components/MonthlyReportScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { EventsScreen } from './components/EventsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SocialMediaScreen } from './components/SocialMediaScreen';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { InstallBanner } from './components/InstallBanner';
import { ToolsMenu } from './components/ToolsMenu';
import { RankingScreen } from './components/RankingScreen';

import { 
  LayoutDashboard, Calendar, CalendarCheck, Megaphone, 
  RotateCcw, Music, Trophy, Share2, Settings, FileBarChart, 
  ListMusic, FileText, CalendarDays, Send, Users
} from 'lucide-react';

const InnerApp = () => {
  const { status } = useSession();
  const { 
    currentUser, 
    ministryId, setMinistryId, 
    setAvailableMinistries
  } = useAppStore();
  
  const { addToast } = useToast();

  // Navigation
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));

  // UI State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Data
  const {
    events, schedule, attendance, membersMap, publicMembers, availability, availabilityNotes,
    notifications, announcements, repertoire, swapRequests, globalConflicts,
    roles, ministryTitle, availabilityWindow, isLoading, refreshData,
    setRepertoire
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);
  const orgId = currentUser?.organizationId || '';

  // Load Ministries
  useEffect(() => {
    if (orgId) {
      Supabase.fetchOrganizationMinistries(orgId).then(setAvailableMinistries);
    }
  }, [orgId, setAvailableMinistries]);

  // Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      }
    }
  };

  if (status === 'authenticating' || status === 'contextualizing' || (status === 'ready' && isLoading && !ministryId)) {
    return <LoadingScreen />;
  }

  // Define Navigation
  const mainNav: NavItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: <LayoutDashboard /> },
    { id: 'calendar', label: 'Escala', icon: <Calendar /> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck /> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone /> },
    { id: 'swaps', label: 'Trocas', icon: <RotateCcw /> },
    { id: 'repertoire', label: 'Repertório', icon: <Music /> },
    { id: 'ranking', label: 'Ranking', icon: <Trophy /> },
    { id: 'social', label: 'Social', icon: <Share2 /> },
  ];

  const adminNav: NavItem[] = [];
  if (currentUser?.role === 'admin') {
    adminNav.push(
      { id: 'settings', label: 'Configurações', icon: <Settings /> },
      { id: 'schedule-editor', label: 'Editor de Escala', icon: <Calendar /> },
      { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileBarChart /> },
      { id: 'repertoire-manager', label: 'Gestão Músicas', icon: <ListMusic /> },
      { id: 'report', label: 'Relatório Disp.', icon: <FileText /> },
      { id: 'event-rules', label: 'Regras Eventos', icon: <CalendarDays /> },
      { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send /> },
      { id: 'members', label: 'Membros', icon: <Users /> }
    );
  }

  const renderContent = () => {
    switch (currentTab) {
        case 'dashboard':
            const nextEvent = events.find(e => e.iso >= getLocalDateISOString()) || events[0];
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <NextEventCard 
                                event={nextEvent}
                                schedule={schedule}
                                attendance={attendance}
                                roles={roles}
                                members={publicMembers}
                                onConfirm={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, orgId, key); refreshData(); }}
                                ministryId={ministryId}
                                currentUser={currentUser}
                            />
                        </div>
                        <div className="space-y-6">
                            <WeatherWidget />
                            <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                        </div>
                    </div>
                </div>
            );
        case 'calendar':
            return (
                <div className="space-y-6">
                    <CalendarGrid 
                        currentMonth={currentMonth}
                        events={events}
                        schedule={schedule}
                        roles={roles}
                    />
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
                        onCellChange={() => {}} 
                        onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, orgId, key); refreshData(); }} 
                        onDeleteEvent={() => {}}
                        onEditEvent={() => {}}
                        memberStats={{}}
                        ministryId={ministryId}
                        readOnly={true}
                        onlineUsers={onlineUsers}
                    />
                </div>
            );
        case 'schedule-editor':
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                        <h2 className="text-xl font-bold">Editor de Escala</h2>
                        <ToolsMenu 
                            onExportIndividual={() => {}} 
                            onExportFull={() => {}}
                            onClearMonth={() => {}}
                            onResetEvents={() => {}}
                            allMembers={publicMembers.map(m => m.name)}
                        />
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
                                console.error("[onCellChange] Critical: Event not found for key", cellKey);
                                return;
                            }
                            let realEventId = cellKey;
                            if (cellKey.length > 36 && cellKey[36] === '_') {
                                realEventId = cellKey.substring(0, 36);
                            }
                            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            if (!uuidRegex.test(realEventId)) {
                                addToast("Erro interno: ID de evento inválido.", "error");
                                return;
                            }
                            try {
                                if (memberId) {
                                    const fullKey = `${cellKey}_${role}`;
                                    await Supabase.saveScheduleAssignment(ministryId, orgId, fullKey, memberName || "", memberId);
                                } else {
                                    const logicalKey = `${cellKey}_${role}`;
                                    await Supabase.removeScheduleAssignment(ministryId, orgId, logicalKey);
                                }
                                refreshData();
                            } catch (error: any) {
                                addToast("Erro ao salvar: " + error.message, "error");
                            }
                        }} 
                        onAttendanceToggle={async (key) => { await Supabase.toggleAssignmentConfirmation(ministryId, orgId, key); refreshData(); }} 
                        onDeleteEvent={() => {}}
                        onEditEvent={() => {}}
                        memberStats={{}}
                        ministryId={ministryId}
                        readOnly={false}
                        onlineUsers={onlineUsers}
                    />
                </div>
            );
        case 'availability':
            return (
                <AvailabilityScreen 
                    availability={availability}
                    availabilityNotes={availabilityNotes}
                    setAvailability={() => {}}
                    allMembersList={publicMembers.map(m => m.name)}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    currentUser={currentUser}
                    onSaveAvailability={async (mid, member, dates, notes) => {
                        // TODO: Implement proper save via service
                        refreshData();
                    }}
                    availabilityWindow={availabilityWindow}
                    ministryId={ministryId}
                />
            );
        case 'report':
            return (
                <AvailabilityReportScreen 
                    availability={availability}
                    registeredMembers={publicMembers}
                    membersMap={membersMap}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    availableRoles={roles}
                    onRefresh={refreshData}
                />
            );
        case 'monthly-report':
            return (
                <MonthlyReportScreen 
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    schedule={schedule}
                    attendance={attendance}
                    swapRequests={swapRequests}
                    members={publicMembers}
                    events={events}
                />
            );
        case 'announcements':
            return (
                <AnnouncementsScreen 
                    announcements={announcements}
                    currentUser={currentUser!}
                    onMarkRead={() => {}}
                    onToggleLike={() => {}}
                />
            );
        case 'send-announcements':
            return (
                <AlertsManager 
                    onSend={async (title, msg, type, exp) => {
                        await Supabase.sendNotificationSQL(ministryId, orgId, { title, message: msg, type });
                        refreshData();
                    }}
                />
            );
        case 'repertoire':
            return (
                <RepertoireScreen 
                    repertoire={repertoire}
                    setRepertoire={async (items) => { /* Update */ }}
                    currentUser={currentUser}
                    mode="view"
                    ministryId={ministryId}
                />
            );
        case 'repertoire-manager':
            return (
                <RepertoireScreen 
                    repertoire={repertoire}
                    setRepertoire={async (items) => { refreshData(); }}
                    currentUser={currentUser}
                    mode="manage"
                    onItemAdd={() => refreshData()}
                    ministryId={ministryId}
                />
            );
        case 'swaps':
            return (
                <SwapRequestsScreen 
                    schedule={schedule}
                    currentUser={currentUser!}
                    requests={swapRequests}
                    visibleEvents={events}
                    onCreateRequest={() => {}}
                    onAcceptRequest={() => {}}
                />
            );
        case 'ranking':
            return (
                <RankingScreen 
                    ministryId={ministryId}
                    currentUser={currentUser!}
                />
            );
        case 'social':
            return <SocialMediaScreen />;
        case 'settings':
            return (
                <SettingsScreen 
                    initialTitle={ministryTitle}
                    ministryId={ministryId}
                    themeMode={'system'}
                    onSetThemeMode={() => {}}
                    onSaveTitle={async () => {}}
                    orgId={orgId}
                    isAdmin={currentUser?.role === 'admin'}
                />
            );
        case 'members':
            return (
                <MembersScreen 
                    members={publicMembers}
                    onlineUsers={onlineUsers}
                    currentUser={currentUser!}
                    onToggleAdmin={() => {}}
                    onRemoveMember={() => {}}
                    availableRoles={roles}
                />
            );
        case 'event-rules':
            return <EventsScreen />;
        case 'profile':
            return (
                <ProfileScreen 
                    user={currentUser!}
                    onUpdateProfile={async () => {}}
                    availableRoles={roles}
                />
            );
        case 'super-admin':
            return <SuperAdminDashboard />;
        default:
            return <div className="p-10 text-center">Página não encontrada: {currentTab}</div>;
    }
  };

  return (
    <DashboardLayout
      title={ministryTitle}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      mainNavItems={mainNav}
      managementNavItems={adminNav}
      notifications={notifications}
      onNotificationsUpdate={() => refreshData()}
      onLogout={async () => {
          const sb = Supabase.getSupabase();
          if (sb) await sb.auth.signOut();
          window.location.reload();
      }}
      onInstall={handleInstall}
      onSwitchMinistry={(id) => setMinistryId(id)}
      onOpenJoinMinistry={() => setShowJoinModal(true)}
      activeMinistryId={ministryId}
    >
      {renderContent()}
      
      <JoinMinistryModal 
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={async (mid, roles) => { setShowJoinModal(false); }}
        alreadyJoined={currentUser?.allowedMinistries || []}
      />
      
      <InstallBanner 
        isVisible={showInstallBanner}
        onInstall={handleInstall}
        onDismiss={() => setShowInstallBanner(false)}
        appName="Escala OBPC"
      />
    </DashboardLayout>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>
           <InnerApp />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}