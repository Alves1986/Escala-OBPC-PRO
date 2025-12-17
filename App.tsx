
import React, { useState, useEffect, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAppStore } from './store/appStore';
import { 
  LayoutDashboard, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Clock, Calendar as CalendarIcon,
  Trophy, Share2, FileText, Loader2
} from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { SetupScreen } from './components/SetupScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { WeatherWidget } from './components/WeatherWidget';
import { ErrorBoundary } from './components/ErrorBoundary';

import * as Supabase from './services/supabaseService';
import { SUPABASE_URL, SUPABASE_KEY } from './types';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useMinistryData } from './hooks/useMinistryData';

// --- Lazy Load Screens for Performance ---
const ScheduleTable = React.lazy(() => import('./components/ScheduleTable').then(m => ({ default: m.ScheduleTable })));
const CalendarGrid = React.lazy(() => import('./components/CalendarGrid').then(m => ({ default: m.CalendarGrid })));
const AvailabilityScreen = React.lazy(() => import('./components/AvailabilityScreen').then(m => ({ default: m.AvailabilityScreen })));
const SwapRequestsScreen = React.lazy(() => import('./components/SwapRequestsScreen').then(m => ({ default: m.SwapRequestsScreen })));
const RepertoireScreen = React.lazy(() => import('./components/RepertoireScreen').then(m => ({ default: m.RepertoireScreen })));
const AnnouncementsScreen = React.lazy(() => import('./components/AnnouncementsScreen').then(m => ({ default: m.AnnouncementsScreen })));
const RankingScreen = React.lazy(() => import('./components/RankingScreen').then(m => ({ default: m.RankingScreen })));
const MembersScreen = React.lazy(() => import('./components/MembersScreen').then(m => ({ default: m.MembersScreen })));
const ProfileScreen = React.lazy(() => import('./components/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const SettingsScreen = React.lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-zinc-400">
    <Loader2 size={32} className="animate-spin mb-3 text-teal-500" />
    <p className="text-xs font-medium uppercase tracking-widest opacity-70">Carregando...</p>
  </div>
);

const InnerApp = () => {
  const { currentUser, loadingAuth, setCurrentUser } = useAuth();
  const { ministryId, setMinistryId, themeMode, setThemeMode } = useAppStore();
  const { addToast } = useToast();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Sync Global Theme class
  useEffect(() => {
    const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [themeMode]);

  // Data Fetching
  const { 
    events, schedule, attendance,
    publicMembers, notifications, 
    repertoire, swapRequests, roles, 
    ministryTitle, availabilityWindow,
    refreshData, isLoading: loadingData,
    setNotifications // Para o setter das notificações
  } = useMinistryData(ministryId, currentMonth, currentUser);

  const handleLogout = async () => {
    await Supabase.getSupabase()?.auth.signOut();
    setCurrentUser(null);
  };

  // Se não houver configuração do Supabase, mostra tela de Setup
  if ((!SUPABASE_URL || !SUPABASE_KEY) && !isDemoMode) {
    return <SetupScreen onEnterDemo={() => setIsDemoMode(true)} />;
  }

  if (loadingAuth) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen isLoading={loadingAuth} />;

  const isAdmin = currentUser.role === 'admin';

  const MAIN_NAV = [
    { id: 'dashboard', label: 'Início', icon: <LayoutDashboard /> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone /> },
    { id: 'calendar', label: 'Escala', icon: <CalendarIcon /> },
    { id: 'availability', label: 'Minha Dispo', icon: <CalendarCheck /> },
    { id: 'swaps', label: 'Trocas', icon: <RefreshCcw /> },
    { id: 'repertoire', label: 'Repertório', icon: <Music /> },
    { id: 'ranking', label: 'Ranking', icon: <Trophy /> },
    { id: 'settings', label: 'Ajustes', icon: <Settings /> },
  ];

  const MANAGEMENT_NAV = isAdmin ? [
    { id: 'members', label: 'Membros', icon: <Users /> },
    { id: 'reports', label: 'Relatórios', icon: <FileBarChart /> },
  ] : [];

  return (
    <ErrorBoundary>
      <DashboardLayout
        title={ministryTitle}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onLogout={handleLogout}
        mainNavItems={MAIN_NAV}
        managementNavItems={MANAGEMENT_NAV}
        notifications={notifications}
        onNotificationsUpdate={setNotifications}
        onSwitchMinistry={(id) => setMinistryId(id)}
      >
        <Suspense fallback={<LoadingFallback />}>
          {currentTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
                            Olá, <span className="text-teal-600 dark:text-teal-400">{currentUser.name.split(' ')[0]}</span>
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Bem-vindo ao seu painel ministerial.</p>
                    </div>
                    <WeatherWidget />
                </div>

                {/* Card de Próximo Evento */}
                {(() => {
                    const now = new Date().toISOString();
                    const upcoming = events.filter(e => e.iso >= now).sort((a, b) => a.iso.localeCompare(b.iso))[0];
                    return <NextEventCard event={upcoming} schedule={schedule} attendance={attendance} roles={roles} ministryId={ministryId} currentUser={currentUser} onConfirm={(key) => Supabase.toggleAssignmentConfirmation(ministryId, key).then(refreshData)} />;
                })()}

                <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />
            </div>
          )}

          {currentTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
              <CalendarGrid currentMonth={currentMonth} events={events} schedule={schedule} roles={roles} />
              {isAdmin && (
                <div className="mt-8 bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                   <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit size={20} className="text-blue-500"/> Editor de Escala (Admin)</h3>
                   <ScheduleTable 
                      events={events} 
                      roles={roles} 
                      schedule={schedule} 
                      attendance={attendance} 
                      availability={{}} 
                      members={{}} 
                      allMembers={publicMembers.map(m => m.name)} 
                      memberStats={{}} 
                      ministryId={ministryId} 
                      onCellChange={(key, val) => Supabase.saveScheduleAssignment(ministryId, key, val).then(refreshData)}
                      onAttendanceToggle={(key) => Supabase.toggleAssignmentConfirmation(ministryId, key).then(refreshData)}
                      onDeleteEvent={() => {}}
                      onEditEvent={() => {}}
                      scheduleIssues={{}}
                      globalConflicts={{}}
                   />
                </div>
              )}
            </div>
          )}

          {currentTab === 'availability' && (
            <AvailabilityScreen 
              availability={{}} 
              availabilityNotes={{}} 
              setAvailability={() => {}} 
              allMembersList={publicMembers.map(m => m.name)} 
              currentMonth={currentMonth} 
              onMonthChange={setCurrentMonth} 
              currentUser={currentUser} 
              onSaveAvailability={async (m, dates, notes, month) => {
                // Implementação da persistência aqui
                refreshData();
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
                await Supabase.createSwapRequestSQL(ministryId, { id: '', ministryId, requesterName: currentUser.name, requesterId: currentUser.id, role, eventIso: iso, eventTitle: title, status: 'pending', createdAt: new Date().toISOString() });
                refreshData();
              }}
              onAcceptRequest={async (id) => {
                await Supabase.performSwapSQL(ministryId, id, currentUser.name, currentUser.id!);
                refreshData();
              }}
              onCancelRequest={async (id) => {
                await Supabase.cancelSwapRequestSQL(id);
                refreshData();
              }}
            />
          )}

          {currentTab === 'repertoire' && (
            <RepertoireScreen repertoire={repertoire} setRepertoire={async () => { refreshData(); }} currentUser={currentUser} mode="view" ministryId={ministryId} />
          )}

          {currentTab === 'announcements' && (
            <AnnouncementsScreen announcements={[]} currentUser={currentUser} onMarkRead={() => {}} onToggleLike={() => {}} />
          )}

          {currentTab === 'ranking' && <RankingScreen ministryId={ministryId} currentUser={currentUser} />}
          
          {currentTab === 'profile' && <ProfileScreen user={currentUser} onUpdateProfile={async () => { refreshData(); }} availableRoles={roles} />}

          {currentTab === 'settings' && (
            <SettingsScreen 
              initialTitle={ministryTitle} 
              ministryId={ministryId} 
              themeMode={themeMode} 
              onSetThemeMode={setThemeMode} 
              onSaveTitle={async (t) => {}} 
              isAdmin={isAdmin}
            />
          )}
        </Suspense>
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
