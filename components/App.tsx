
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMinistryData } from '../hooks/useMinistryData';
import { useOnlinePresence } from '../hooks/useOnlinePresence';
import { DashboardLayout } from './DashboardLayout';
import { LoadingScreen } from './LoadingScreen';
import { LoginScreen } from './LoginScreen';
import { SetupScreen } from './SetupScreen';
import { ErrorBoundary } from './ErrorBoundary';
import { useToast } from './Toast';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../types';

// Screens
import { EventsScreen } from './EventsScreen';
import { AvailabilityScreen } from './AvailabilityScreen';
import { SwapRequestsScreen } from './SwapRequestsScreen';
import { RankingScreen } from './RankingScreen';
import { RepertoireScreen } from './RepertoireScreen';
import { MembersScreen } from './MembersScreen';
import { AnnouncementsScreen } from './AnnouncementsScreen';
import { SettingsScreen } from './SettingsScreen';
import { ProfileScreen } from './ProfileScreen';
import { SocialMediaScreen } from './SocialMediaScreen';
import { MonthlyReportScreen } from './MonthlyReportScreen';
import { AvailabilityReportScreen } from './AvailabilityReportScreen';
import { CalendarGrid } from './CalendarGrid';
import { NextEventCard } from './NextEventCard';
import { WeatherWidget } from './WeatherWidget';
import { BirthdayCard } from './BirthdayCard';
import { ToolsMenu } from './ToolsMenu';
import { AlertsManager } from './AlertsManager';

// Modals & Components
import { EventsModal, AvailabilityModal, RolesModal } from './ManagementModals';
import { JoinMinistryModal } from './JoinMinistryModal';
import { InstallBanner } from './InstallBanner';
import { InstallModal } from './InstallModal';
import { EventDetailsModal } from './EventDetailsModal';
import { ConfirmationModal } from './ConfirmationModal';

// Icons
import { Layout, Calendar, Clock, RefreshCcw, Trophy, Music, Users, Megaphone, Settings, Share2, FileText, CalendarSearch } from 'lucide-react';

const App = () => {
  const { currentUser, loadingAuth } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Modals State
  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  const { addToast } = useToast();

  const ministryId = currentUser?.ministryId || null;
  const isAdmin = currentUser?.role === 'admin';

  const {
    events, schedule, attendance, membersMap, publicMembers,
    availability, availabilityNotes, setAvailability, notifications,
    announcements, repertoire, setRepertoire, swapRequests,
    globalConflicts, roles, setRoles, ministryTitle,
    availabilityWindow, setAvailabilityWindow,
    isLoading: loadingData, refreshData: loadData
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);

  // Theme Init
  useEffect(() => {
      const savedTheme = localStorage.getItem('theme_mode') || 'light';
      setTheme(savedTheme as any);
      if (savedTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('theme_mode', newTheme);
      if (newTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const handleInstallApp = () => {
      // PWA Install logic placeholder
      addToast("Instruções de instalação abertas.", "info");
  };

  const mainNavItems = [
      { id: 'dashboard', label: 'Visão Geral', icon: <Layout /> },
      { id: 'availability', label: 'Minha Disponibilidade', icon: <Clock /> },
      { id: 'swaps', label: 'Trocas', icon: <RefreshCcw /> },
      { id: 'ranking', label: 'Ranking', icon: <Trophy /> },
      { id: 'repertoire', label: 'Repertório', icon: <Music /> },
      { id: 'announcements', label: 'Avisos', icon: <Megaphone /> },
      { id: 'social', label: 'Redes Sociais', icon: <Share2 /> },
  ];

  const managementNavItems = isAdmin ? [
      { id: 'events', label: 'Gerenciar Eventos', icon: <Calendar /> },
      { id: 'members', label: 'Membros & Equipe', icon: <Users /> },
      { id: 'monthly-report', label: 'Relatório Mensal', icon: <FileText /> },
      { id: 'avail-report', label: 'Relatório Disponib.', icon: <CalendarSearch /> },
      { id: 'settings', label: 'Configurações', icon: <Settings /> },
  ] : [];

  if (!SUPABASE_URL) return <SetupScreen onEnterDemo={() => {}} />;
  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  return (
    <ErrorBoundary>
      <DashboardLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={() => Supabase.getSupabase()?.auth.signOut()}
        title={ministryTitle || 'Gestão Escala'}
        isConnected={navigator.onLine}
        currentUser={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        mainNavItems={mainNavItems}
        managementNavItems={managementNavItems}
        notifications={notifications}
        onNotificationsUpdate={(n) => { /* Optimistic update not needed as we reload */ loadData(); }}
        onInstall={() => setShowInstallBanner(true)}
      >
        {currentTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
                <NextEventCard 
                    event={events.find(e => e.iso >= new Date().toISOString().slice(0,16))} 
                    schedule={schedule} 
                    attendance={attendance} 
                    roles={roles} 
                    onConfirm={async (key) => { /* Implement Confirm */ }} 
                    ministryId={ministryId}
                    currentUser={currentUser}
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <CalendarGrid 
                            currentMonth={currentMonth} 
                            events={events} 
                            schedule={schedule} 
                            roles={roles} 
                        />
                    </div>
                    <div className="space-y-6">
                        <WeatherWidget />
                        <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                    </div>
                </div>
            </div>
        )}

        {currentTab === 'events' && isAdmin && (
            <EventsScreen 
                customEvents={events} 
                onCreateEvent={async (evt) => { 
                    await Supabase.createMinistryEvent(ministryId!, { ...evt, id: '', iso: `${evt.date}T${evt.time}` }); 
                    loadData(); 
                }} 
                onDeleteEvent={async (id) => { 
                    await Supabase.deleteMinistryEvent(ministryId!, id); 
                    loadData(); 
                }} 
                currentMonth={currentMonth} 
                onMonthChange={setCurrentMonth} 
            />
        )}

        {currentTab === 'availability' && (
            <AvailabilityScreen 
                availability={availability} 
                availabilityNotes={availabilityNotes} 
                setAvailability={(val) => { /* Handled via fetch */ }} 
                allMembersList={publicMembers.map(m => m.name)} 
                currentMonth={currentMonth} 
                onMonthChange={setCurrentMonth} 
                currentUser={currentUser} 
                onSaveAvailability={async (member, dates, notes, targetMonth) => { 
                    const p = publicMembers.find(pm => pm.name === member); 
                    if (p) { 
                        try {
                            await Supabase.saveMemberAvailability(p.id, member, dates, targetMonth, ministryId!, notes); 
                            await loadData(); 
                        } catch (e: any) {
                            addToast(`Erro ao salvar: ${e.message}`, 'error');
                        }
                    }
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
                    const success = await Supabase.createSwapRequestSQL(ministryId!, { requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title }); 
                    if(success) { addToast("Solicitação criada!", "success"); loadData(); }
                }} 
                onAcceptRequest={async (reqId) => { 
                    const result = await Supabase.performSwapSQL(ministryId!, reqId, currentUser.name, currentUser.id!); 
                    if(result.success) { addToast(result.message, "success"); loadData(); } 
                    else { addToast(result.message, "error"); }
                }} 
            />
        )}

        {currentTab === 'ranking' && ministryId && (
            <RankingScreen ministryId={ministryId} currentUser={currentUser} />
        )}

        {currentTab === 'repertoire' && (
            <RepertoireScreen 
                repertoire={repertoire} 
                setRepertoire={async (items) => { await loadData(); }} 
                currentUser={currentUser} 
                mode={isAdmin ? 'manage' : 'view'} 
                ministryId={ministryId} 
            />
        )}

        {currentTab === 'announcements' && (
            <div className="space-y-8">
                {isAdmin && (
                    <AlertsManager onSend={async (title, msg, type, date) => {
                        await Supabase.sendNotificationSQL(ministryId!, { title, message: msg, type });
                        loadData();
                    }} />
                )}
                <AnnouncementsScreen 
                    announcements={announcements} 
                    currentUser={currentUser} 
                    onMarkRead={() => {}} 
                    onToggleLike={() => {}} 
                />
            </div>
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

        {currentTab === 'settings' && isAdmin && (
            <SettingsScreen 
                initialTitle={ministryTitle} 
                ministryId={ministryId} 
                themeMode={theme as any} 
                onSetThemeMode={(m) => { setTheme(m as any); }} 
                onSaveTitle={async (t) => { await Supabase.saveMinistrySettings(ministryId!, t); loadData(); }} 
                onSaveAvailabilityWindow={async (s, e) => { 
                    await Supabase.saveMinistrySettings(ministryId!); // Needs impl in service to accept window
                    loadData(); 
                }} 
                availabilityWindow={availabilityWindow} 
                isAdmin={isAdmin}
            />
        )}

        {currentTab === 'profile' && (
            <ProfileScreen 
                user={currentUser} 
                onUpdateProfile={async () => { await loadData(); }} 
                availableRoles={roles} 
            />
        )}

        {currentTab === 'social' && <SocialMediaScreen />}

        {currentTab === 'monthly-report' && (
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

        {currentTab === 'avail-report' && (
            <AvailabilityReportScreen 
                availability={availability} 
                registeredMembers={publicMembers} 
                membersMap={membersMap} 
                currentMonth={currentMonth} 
                onMonthChange={setCurrentMonth} 
                availableRoles={roles} 
            />
        )}

        {/* Global Modals */}
        <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId!, { ...e, iso: `${e.date}T${e.time}` }); loadData(); }} onRemove={async (id) => { await Supabase.deleteMinistryEvent(ministryId!, id); loadData(); }} />
        <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(p.id, member, dates, currentMonth, ministryId!, {}); loadData(); }}} currentMonth={currentMonth} />
        <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId!, undefined, newRoles); loadData(); }} />
        <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle || "Gestão Escala"} />
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default App;
