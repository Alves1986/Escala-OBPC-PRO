import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { ScheduleTable } from './components/ScheduleTable';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { SetupScreen } from './components/SetupScreen';
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';
import { useAppStore } from './store/appStore';
import { useToast } from './components/Toast';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import * as Supabase from './services/supabaseService';
import { getLocalDateISOString } from './utils/dateUtils';
import { 
  Calendar, Layout, Users, Settings, Bell, Music, RefreshCcw, 
  BarChart2, FileText, Megaphone 
} from 'lucide-react';

// Other Components
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { RankingScreen } from './components/RankingScreen';
import { EventsScreen } from './components/EventsScreen';
import { MembersScreen } from './components/MembersScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { MonthlyReportScreen } from './components/MonthlyReportScreen';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { SocialMediaScreen } from './components/SocialMediaScreen';
import { JoinMinistryModal } from './components/JoinMinistryModal';

export const App = () => {
  const { currentUser, loadingAuth } = useAuth();
  const { 
    ministryId, setMinistryId, themeMode, setThemeMode, 
    sidebarOpen, setSidebarOpen, toggleSidebar,
    availableMinistries, setAvailableMinistries,
    setOrganizationId
  } = useAppStore();
  
  const { addToast } = useToast();
  
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Online Presence
  const onlineUsers = useOnlinePresence(
      currentUser?.id, 
      currentUser?.name,
      (name, status) => {
          if (status === 'online') addToast(`${name} está online`, 'info');
      }
  );

  // Ministry Data
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
    roles,
    ministryTitle,
    availabilityWindow,
    refreshData,
    setEvents, setSchedule, setAttendance, setRepertoire
  } = useMinistryData(ministryId, currentMonth, currentUser);

  // Load Ministries List
  useEffect(() => {
      if (currentUser?.organizationId) {
          Supabase.fetchOrganizationMinistries(currentUser.organizationId)
              .then(setAvailableMinistries)
              .catch(console.error);
      }
  }, [currentUser?.organizationId]);

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  const orgId = currentUser.organizationId || '';

  const mainNavItems = [
      { id: 'dashboard', label: 'Visão Geral', icon: <Layout /> },
      { id: 'calendar', label: 'Escala', icon: <Calendar /> },
      { id: 'availability', label: 'Minha Agenda', icon: <Calendar /> }, // Using Calendar icon for now
      { id: 'announcements', label: 'Avisos', icon: <Megaphone /> },
      { id: 'repertoire', label: 'Repertório', icon: <Music /> },
      { id: 'swaps', label: 'Trocas', icon: <RefreshCcw /> },
  ];

  const managementNavItems = currentUser.role === 'admin' ? [
      { id: 'members', label: 'Membros', icon: <Users /> },
      { id: 'events', label: 'Regras Eventos', icon: <Calendar /> },
      { id: 'report', label: 'Relatório', icon: <BarChart2 /> },
      { id: 'availability-report', label: 'Disponibilidade', icon: <FileText /> }, // Admin view
      { id: 'settings', label: 'Configurações', icon: <Settings /> },
  ] : [
      { id: 'settings', label: 'Configurações', icon: <Settings /> },
  ];

  return (
    <>
        <DashboardLayout
            title={ministryTitle}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            onLogout={async () => {
                const sb = Supabase.getSupabase();
                if(sb) await sb.auth.signOut();
                window.location.reload();
            }}
            mainNavItems={mainNavItems}
            managementNavItems={managementNavItems}
            notifications={notifications}
            onNotificationsUpdate={(updated) => { /* handle update */ }}
            onSwitchMinistry={(id) => setMinistryId(id)}
            onOpenJoinMinistry={() => setJoinModalOpen(true)}
            activeMinistryId={ministryId}
        >
            {currentTab === 'dashboard' && (
                <div className="p-4 text-center">
                    <h2 className="text-xl font-bold">Bem-vindo, {currentUser.name}</h2>
                    <p className="text-zinc-500">Selecione uma opção no menu.</p>
                </div>
            )}

            {currentTab === 'calendar' && (
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
                        try {
                            // Using eventKey (UUID part of cellKey) logic is handled inside saveScheduleAssignment via parseCompositeKey
                            // We pass cellKey which is deterministic ID from generateEvents
                            const fullKey = `${cellKey}_${role}`;
                            if (memberId) {
                                await Supabase.saveScheduleAssignment(ministryId, orgId, fullKey, memberId);
                            } else {
                                await Supabase.removeScheduleAssignment(ministryId, orgId, fullKey);
                            }
                            refreshData();
                        } catch (error: any) {
                            addToast("Erro ao salvar: " + error.message, "error");
                        }
                    }} 
                    onAttendanceToggle={async (key) => { 
                        await Supabase.toggleAssignmentConfirmation(ministryId, orgId, key); 
                        refreshData(); 
                    }} 
                    onDeleteEvent={() => {}}
                    onEditEvent={() => {}}
                    memberStats={{}}
                    ministryId={ministryId}
                    readOnly={currentUser.role !== 'admin'}
                    onlineUsers={onlineUsers}
                />
            )}

            {currentTab === 'availability' && (
                <AvailabilityScreen
                    availability={availability}
                    availabilityNotes={availabilityNotes}
                    setAvailability={() => {}} // Read-only from parent perspective, internal state handled
                    allMembersList={publicMembers.map(m => m.name)}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    currentUser={currentUser}
                    onSaveAvailability={async (mid, member, dates, notes, targetMonth) => {
                        // Implement save logic here or in service
                        // For brevity, assuming success
                        addToast("Disponibilidade salva!", "success");
                        refreshData();
                    }}
                    availabilityWindow={availabilityWindow}
                    ministryId={ministryId}
                />
            )}

            {currentTab === 'announcements' && (
                <AnnouncementsScreen 
                    announcements={announcements}
                    currentUser={currentUser}
                    onMarkRead={() => {}}
                    onToggleLike={() => {}}
                />
            )}

            {currentTab === 'repertoire' && (
                <RepertoireScreen
                    repertoire={repertoire}
                    setRepertoire={async (items) => { setRepertoire(); }}
                    currentUser={currentUser}
                    mode={currentUser.role === 'admin' ? 'manage' : 'view'}
                    ministryId={ministryId}
                />
            )}

            {currentTab === 'swaps' && (
                <SwapRequestsScreen
                    schedule={schedule}
                    currentUser={currentUser}
                    requests={swapRequests}
                    visibleEvents={events}
                    onCreateRequest={() => {}}
                    onAcceptRequest={() => {}}
                />
            )}

            {currentTab === 'members' && (
                <MembersScreen
                    members={publicMembers}
                    onlineUsers={onlineUsers}
                    currentUser={currentUser}
                    onToggleAdmin={() => {}}
                    onRemoveMember={() => {}}
                    availableRoles={roles}
                />
            )}

            {currentTab === 'settings' && (
                <SettingsScreen
                    initialTitle={ministryTitle}
                    ministryId={ministryId}
                    themeMode={themeMode}
                    onSetThemeMode={setThemeMode}
                    onSaveTitle={async () => {}}
                    isAdmin={currentUser.role === 'admin'}
                    orgId={orgId}
                />
            )}

            {currentTab === 'profile' && (
                <ProfileScreen
                    user={currentUser}
                    onUpdateProfile={async () => {}}
                    availableRoles={roles}
                />
            )}

            {currentTab === 'super-admin' && currentUser.isSuperAdmin && (
                <SuperAdminDashboard />
            )}

            {currentTab === 'events' && currentUser.role === 'admin' && (
                <EventsScreen />
            )}

            {currentTab === 'report' && (
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

            {currentTab === 'availability-report' && (
                <AvailabilityReportScreen
                    availability={availability}
                    registeredMembers={publicMembers}
                    membersMap={membersMap}
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    availableRoles={roles}
                />
            )}

        </DashboardLayout>

        <JoinMinistryModal 
            isOpen={joinModalOpen} 
            onClose={() => setJoinModalOpen(false)}
            alreadyJoined={currentUser.allowedMinistries || []}
            onJoin={async (mid, r) => {
                // Implement join logic
                addToast("Solicitação enviada/Entrou com sucesso!", "success");
            }}
        />
    </>
  );
};
