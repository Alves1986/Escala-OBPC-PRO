import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from './store/appStore';
import { getLocalDateISOString } from './utils/dateUtils';
import { useMinistryData } from './hooks/useMinistryData';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import { DashboardLayout } from './components/DashboardLayout';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { CalendarGrid } from './components/CalendarGrid';
import { EventDetailsModal } from './components/EventDetailsModal';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { SetupScreen } from './components/SetupScreen';
import { InstallModal } from './components/InstallModal';
import { useAuth } from './hooks/useAuth';
import * as Supabase from './services/supabaseService';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { LayoutGrid, Calendar, CalendarCheck } from 'lucide-react';

// Other screens
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { MembersScreen } from './components/MembersScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { RankingScreen } from './components/RankingScreen';
import { SocialMediaScreen } from './components/SocialMediaScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { MonthlyReportScreen } from './components/MonthlyReportScreen';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { EventsScreen } from './components/EventsScreen';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';

const InnerApp = () => {
  const { currentUser, ministryId, setMinistryId, availableMinistries, setAvailableMinistries, themeMode } = useAppStore();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; iso: string; title: string; dateDisplay: string } | null>(null);

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
    isLoading,
    refreshData,
    setRepertoire,
    setMinistryTitle
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);
  const isAdmin = currentUser?.role === 'admin';
  const orgId = currentUser?.organizationId || '';

  const handleEventUpdate = async (id: string, newTitle: string, newTime: string, applyToAll: boolean) => {
      if (!selectedEvent) return;
      const datePart = selectedEvent.iso.split('T')[0];
      const newIso = `${datePart}T${newTime}`;
      
      await Supabase.updateMinistryEvent(ministryId, orgId, id, newTitle, newIso, applyToAll);
      
      refreshData();
      setSelectedEvent(null);
  };

  if (!currentUser) return <LoginScreen />;

  return (
    <DashboardLayout
      title={ministryTitle}
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      onLogout={async () => {
          await Supabase.disconnectManual();
          window.location.reload();
      }}
      notifications={notifications}
      onNotificationsUpdate={() => refreshData()}
      mainNavItems={[
          { id: 'dashboard', label: 'Início', icon: <LayoutGrid /> },
          { id: 'calendar', label: 'Escala', icon: <Calendar /> },
          { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck /> }
      ]}
      managementNavItems={[]}
      onSwitchMinistry={(id) => setMinistryId(id)}
      onOpenJoinMinistry={() => setShowJoinModal(true)}
      activeMinistryId={ministryId}
    >
        {currentTab === 'dashboard' && (
           <div className="space-y-6">
              <AnnouncementsScreen announcements={announcements} currentUser={currentUser!} onMarkRead={() => {}} onToggleLike={() => {}} />
              <CalendarGrid 
                  currentMonth={currentMonth} 
                  events={events}
                  schedule={schedule} 
                  roles={roles} 
                  onEventClick={(evt) => setSelectedEvent(evt)} 
              />
           </div>
        )}
        
        {currentTab === 'calendar' && (
            <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl shadow">
               <h2 className="text-xl font-bold mb-4">Escala Completa</h2>
               <CalendarGrid 
                   currentMonth={currentMonth} 
                   events={events} 
                   schedule={schedule} 
                   roles={roles} 
                   onEventClick={(evt) => setSelectedEvent(evt)}
               />
            </div>
        )}

        {currentTab === 'availability' && (
            <AvailabilityScreen 
                availability={availability} 
                availabilityNotes={availabilityNotes} 
                setAvailability={() => {}} 
                allMembersList={publicMembers.map(m => m.name)} 
                currentMonth={currentMonth} 
                onMonthChange={setCurrentMonth} 
                currentUser={currentUser} 
                onSaveAvailability={async (mid, member, dates, notes, month) => {
                    await refreshData();
                }}
                ministryId={ministryId}
                availabilityWindow={availabilityWindow}
            />
        )}

        {selectedEvent && (
            <EventDetailsModal 
                isOpen={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                event={selectedEvent}
                schedule={schedule}
                roles={roles}
                allMembers={publicMembers}
                currentUser={currentUser}
                ministryId={ministryId}
                canEdit={isAdmin}
                onSave={handleEventUpdate}
                onSwapRequest={async (role, iso, title) => {
                    await Supabase.createSwapRequestSQL(ministryId, orgId, {
                        requesterName: currentUser?.name,
                        requesterId: currentUser?.id,
                        role,
                        eventIso: iso,
                        eventTitle: title
                    });
                    refreshData();
                    setSelectedEvent(null);
                }}
            />
        )}

        <JoinMinistryModal 
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            onJoin={async () => {}} 
            alreadyJoined={[]}
        />

    </DashboardLayout>
  );
};

const AppContent = () => {
    const sb = Supabase.getSupabase();
    const { loadingAuth } = useAuth();
    
    if (!sb) {
        return (
            <SetupScreen 
                onEnterDemo={() => {}} 
                onConfigured={() => window.location.reload()} 
            />
        );
    }

    if (loadingAuth) return <LoadingScreen />;

    return <InnerApp />;
}

const App = () => {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <AppContent />
                </ToastProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

export default App;