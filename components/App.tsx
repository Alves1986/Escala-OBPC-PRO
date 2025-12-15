import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMinistryData } from '../hooks/useMinistryData';
import { useOnlinePresence } from '../hooks/useOnlinePresence';
import { DashboardLayout } from './DashboardLayout';
import { LoadingScreen } from './LoadingScreen';
import { LoginScreen } from './LoginScreen';
import { SetupScreen } from './SetupScreen';
import { getLocalDateISOString } from '../utils/dateUtils';
import * as Supabase from '../services/supabaseService';
import { useToast, ToastProvider } from './Toast';
import { ErrorBoundary } from './ErrorBoundary';
// Import all screens
import { EventsScreen } from './EventsScreen';
import { AvailabilityScreen } from './AvailabilityScreen';
import { SwapRequestsScreen } from './SwapRequestsScreen';
import { RankingScreen } from './RankingScreen';
import { RepertoireScreen } from './RepertoireScreen';
import { AnnouncementsScreen } from './AnnouncementsScreen';
import { AlertsManager } from './AlertsManager';
import { AvailabilityReportScreen } from './AvailabilityReportScreen';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';
import { SocialMediaScreen } from './SocialMediaScreen';
import { MembersScreen } from './MembersScreen';
import { InstallBanner } from './InstallBanner';
import { InstallModal } from './InstallModal';
import { NotificationToggle } from './NotificationToggle';
// Import modals
import { EventsModal, AvailabilityModal, RolesModal } from './ManagementModals';
import { JoinMinistryModal } from './JoinMinistryModal';
import { NextEventCard } from './NextEventCard';
import { CalendarGrid } from './CalendarGrid';
import { ScheduleTable } from './ScheduleTable';
import { StatsModal } from './StatsModal';
import { MonthlyReportScreen } from './MonthlyReportScreen';
import { ToolsMenu } from './ToolsMenu';
import { WeatherWidget } from './WeatherWidget';
import { BirthdayCard } from './BirthdayCard';
import { ConfirmationModal } from './ConfirmationModal';
import { EventDetailsModal } from './EventDetailsModal';
import { generateScheduleWithAI } from '../services/aiService';
import { AppNotification, ThemeMode } from '../types';

const InnerApp = () => {
  const { currentUser, setCurrentUser, loadingAuth } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(getLocalDateISOString().slice(0, 7));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [currentTab, setCurrentTab] = useState('home');
  const [isInstallModalOpen, setInstallModalOpen] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // Modals state
  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);
  const [isJoinModalOpen, setJoinModalOpen] = useState(false);

  const {
    events, schedule, attendance, membersMap, publicMembers, availability, availabilityNotes,
    notifications, announcements, repertoire, swapRequests, globalConflicts, roles,
    ministryTitle, availabilityWindow, isLoading, refreshData: loadData,
    setEvents, setSchedule, setAttendance, setAvailability, setPublicMembers, setMinistryTitle, setAvailabilityWindow, setRepertoire
  } = useMinistryData(currentUser?.ministryId || null, currentMonth, currentUser);

  const onlineUsers = useOnlinePresence(currentUser?.id, currentUser?.name);
  const { addToast, confirmAction } = useToast();

  const isAdmin = currentUser?.role === 'admin';
  const ministryId = currentUser?.ministryId || '';

  // Theme Management
  useEffect(() => {
      const savedTheme = localStorage.getItem('theme') as ThemeMode;
      if (savedTheme) {
          setTheme(savedTheme);
          applyTheme(savedTheme);
      } else {
          applyTheme('light');
      }
  }, []);

  const applyTheme = (mode: ThemeMode) => {
      const root = window.document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      if (mode === 'dark' || (mode === 'system' && isSystemDark)) {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
      setTheme(mode);
      applyTheme(mode);
  };

  const handleSaveTheme = () => {
      localStorage.setItem('theme', theme);
      addToast('Tema salvo neste dispositivo.', 'success');
  };

  // Notification Handling
  const handleEnableNotifications = async () => {
      if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
              addToast('Notificações ativadas!', 'success');
          }
      }
  };

  // Handlers for data updates
  const handleNotificationsUpdate = (updated: AppNotification[]) => {
      // Typically handled by refetching, but optimistically we can ignore or implement local state update
      loadData();
  };

  if (loadingAuth || isLoading) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  // Navigation Items
  const mainNavItems = [
      { id: 'home', label: 'Visão Geral', icon: <div /> },
      { id: 'availability', label: 'Disponibilidade', icon: <div /> },
      { id: 'swaps', label: 'Trocas', icon: <div /> },
      { id: 'repertoire', label: 'Repertório', icon: <div /> },
      { id: 'announcements', label: 'Avisos', icon: <div /> },
      { id: 'ranking', label: 'Ranking', icon: <div /> },
      { id: 'social', label: 'Redes Sociais', icon: <div /> },
  ];

  const managementNavItems = isAdmin ? [
      { id: 'events', label: 'Gerenciar Eventos', icon: <div /> },
      { id: 'members', label: 'Membros', icon: <div /> },
      { id: 'send-announcements', label: 'Enviar Avisos', icon: <div /> },
      { id: 'report', label: 'Relatórios', icon: <div /> },
      { id: 'settings', label: 'Configurações', icon: <div /> },
  ] : [];
  
  return (
    <DashboardLayout 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={theme === 'dark' ? 'dark' : 'light'}
        toggleTheme={() => handleSetThemeMode(theme === 'dark' ? 'light' : 'dark')}
        onLogout={async () => { await Supabase.supabase?.auth.signOut(); window.location.reload(); }}
        title={ministryTitle || 'Gestão Escala'}
        isConnected={true}
        currentUser={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        mainNavItems={mainNavItems}
        managementNavItems={managementNavItems}
        notifications={notifications}
        onNotificationsUpdate={handleNotificationsUpdate}
        onSwitchMinistry={(mid) => { /* logic to switch */ window.location.reload(); }}
        onOpenJoinMinistry={() => setJoinModalOpen(true)}
    >
        <Suspense fallback={<LoadingScreen />}>
            {currentTab === 'home' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       <NextEventCard 
                           event={events.find(e => e.iso >= getLocalDateISOString())} 
                           schedule={schedule} 
                           attendance={attendance} 
                           roles={roles} 
                           onConfirm={(key) => { /* logic */ }} 
                           ministryId={ministryId} 
                           currentUser={currentUser} 
                       />
                       <WeatherWidget />
                       <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
                    </div>
                    <ScheduleTable 
                        events={events} 
                        roles={roles} 
                        schedule={schedule} 
                        attendance={attendance} 
                        availability={availability} 
                        members={membersMap} 
                        allMembers={publicMembers.map(m => m.name)} 
                        memberProfiles={publicMembers}
                        scheduleIssues={{}} 
                        globalConflicts={globalConflicts}
                        onCellChange={(key, val) => { /* logic to update local schedule state or save */ }}
                        onAttendanceToggle={(key) => { /* logic */ }}
                        onDeleteEvent={(iso, title) => { /* logic */ }}
                        onEditEvent={(evt) => { /* logic */ }}
                        memberStats={{}}
                        ministryId={ministryId}
                        onlineUsers={onlineUsers}
                    />
                </div>
            )}

            {currentTab === 'events' && isAdmin && <EventsScreen customEvents={events.map(e => ({ ...e, iso: e.iso }))} onCreateEvent={async (evt) => { await Supabase.createMinistryEvent(ministryId, evt); loadData(); }} onDeleteEvent={async (iso) => { await Supabase.deleteMinistryEvent(ministryId, iso); loadData(); }} currentMonth={currentMonth} onMonthChange={setCurrentMonth} />}
            
            {currentTab === 'availability' && <AvailabilityScreen availability={availability} availabilityNotes={availabilityNotes} setAvailability={setAvailability} allMembersList={publicMembers.map(m => m.name)} currentMonth={currentMonth} onMonthChange={setCurrentMonth} currentUser={currentUser} onSaveAvailability={async (member, dates, notes, targetMonth) => { 
                const p = publicMembers.find(pm => pm.name === member); 
                if (p) { 
                    const res = await Supabase.saveMemberAvailability(ministryId, p.id, member, dates, targetMonth, notes); 
                    if (res?.success) loadData(); else addToast(res.message, 'error');
                }
            }} availabilityWindow={availabilityWindow} />}
            
            {currentTab === 'swaps' && <SwapRequestsScreen schedule={schedule} currentUser={currentUser} requests={swapRequests} visibleEvents={events} onCreateRequest={async (role, iso, title) => { const success = await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() }); if(success) { addToast("Solicitação criada!", "success"); loadData(); }}} onAcceptRequest={async (reqId) => { const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!); if(result.success) { addToast(result.message, "success"); loadData(); } else { addToast(result.message, "error"); }}} />}
            
            {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
            
            {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && <RepertoireScreen repertoire={repertoire} setRepertoire={async (items) => { setRepertoire(items); await loadData(); }} currentUser={currentUser} mode={currentTab === 'repertoire-manager' || isAdmin ? 'manage' : 'view'} ministryId={ministryId} />}
            
            {currentTab === 'announcements' && <AnnouncementsScreen announcements={announcements} currentUser={currentUser} onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(() => loadData())} onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(() => loadData())} />}
            
            {currentTab === 'send-announcements' && isAdmin && <AlertsManager onSend={async (title, message, type, exp) => { await Supabase.sendNotificationSQL(ministryId, { title, message, type, actionLink: 'announcements' }); await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name); loadData(); }} />}
            
            {currentTab === 'report' && isAdmin && <AvailabilityReportScreen availability={availability} registeredMembers={publicMembers} membersMap={membersMap} currentMonth={currentMonth} onMonthChange={setCurrentMonth} availableRoles={roles} onRefresh={async () => { await loadData(); }} />}
            
            {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async (name, whatsapp, avatar, funcs, bdate) => { const res = await Supabase.updateUserProfile(name, whatsapp, avatar, funcs, bdate, ministryId); if (res.success) { addToast(res.message, "success"); if (currentUser) { setCurrentUser({ ...currentUser, name, whatsapp, avatar_url: avatar || currentUser.avatar_url, functions: funcs, birthDate: bdate }); } loadData(); } else { addToast(res.message, "error"); }}} availableRoles={roles} />}
            
            {currentTab === 'settings' && <SettingsScreen initialTitle={ministryTitle} ministryId={ministryId} themeMode={theme} onSetThemeMode={handleSetThemeMode} onSaveTheme={handleSaveTheme} onSaveTitle={async (newTitle) => { await Supabase.saveMinistrySettings(ministryId, newTitle); setMinistryTitle(newTitle); addToast("Nome do ministério atualizado!", "success"); }} onAnnounceUpdate={async () => { await Supabase.sendNotificationSQL(ministryId, { title: "Atualização de Sistema", message: "Uma nova versão do app está disponível. Recarregue a página para aplicar.", type: "warning" }); addToast("Notificação de atualização enviada.", "success"); }} onEnableNotifications={handleEnableNotifications} onSaveAvailabilityWindow={async (start, end) => { setAvailabilityWindow({ start, end }); await Supabase.saveMinistrySettings(ministryId, undefined, undefined, start, end); loadData(); }} availabilityWindow={availabilityWindow} isAdmin={isAdmin} />}
            
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
                />
            )}
        </Suspense>

        {/* Modals */}
        <EventsModal isOpen={isEventsModalOpen} onClose={() => setEventsModalOpen(false)} events={events.map(e => ({ ...e, iso: e.iso }))} onAdd={async (e) => { await Supabase.createMinistryEvent(ministryId, e); loadData(); }} onRemove={async (id) => { await Supabase.deleteMinistryEvent(ministryId, id); loadData(); }} />
        <AvailabilityModal isOpen={isAvailModalOpen} onClose={() => setAvailModalOpen(false)} members={publicMembers.map(m => m.name)} availability={availability} onUpdate={async (member, dates) => { const p = publicMembers.find(pm => pm.name === member); if (p) { await Supabase.saveMemberAvailability(ministryId, p.id, member, dates, currentMonth, {}); loadData(); }}} currentMonth={currentMonth} />
        <RolesModal isOpen={isRolesModalOpen} onClose={() => setRolesModalOpen(false)} roles={roles} onUpdate={async (newRoles) => { await Supabase.saveMinistrySettings(ministryId, undefined, newRoles); loadData(); }} />
        <JoinMinistryModal isOpen={isJoinModalOpen} onClose={() => setJoinModalOpen(false)} onJoin={async (mid, r) => { /* logic */ }} alreadyJoined={currentUser.allowedMinistries || []} />
        
        {showInstallBanner && <InstallBanner isVisible={true} onInstall={() => setInstallModalOpen(true)} onDismiss={() => setShowInstallBanner(false)} appName="Gestão Escala" />}
        <InstallModal isOpen={isInstallModalOpen} onClose={() => setInstallModalOpen(false)} />
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <InnerApp />
      </ToastProvider>
    </ErrorBoundary>
  );
}