
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, Calendar, CalendarCheck, RefreshCcw, Music, 
  Megaphone, Settings, FileBarChart, CalendarDays,
  Users, Edit, Send, ListMusic, Trash2, ShieldAlert, Clock, ArrowLeft, ArrowRight,
  ShieldCheck, Mail, Phone, Calendar as CalendarIcon, Gift
} from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { LoginScreen } from './components/LoginScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { NextEventCard } from './components/NextEventCard';
import { BirthdayCard } from './components/BirthdayCard';
import { WeatherWidget } from './components/WeatherWidget';
import { ScheduleTable } from './components/ScheduleTable';
import { CalendarGrid } from './components/CalendarGrid';
import { AvailabilityScreen } from './components/AvailabilityScreen';
import { SwapRequestsScreen } from './components/SwapRequestsScreen';
import { RepertoireScreen } from './components/RepertoireScreen';
import { AnnouncementsScreen } from './components/AnnouncementsScreen';
import { AlertsManager } from './components/AlertsManager';
import { AvailabilityReportScreen } from './components/AvailabilityReportScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { EventsScreen } from './components/EventsScreen';
import { InstallBanner } from './components/InstallBanner';
import { InstallModal } from './components/InstallModal';
import { JoinMinistryModal } from './components/JoinMinistryModal';
import { ToolsMenu } from './components/ToolsMenu';
import { EventDetailsModal } from './components/EventDetailsModal';
import { StatsModal } from './components/StatsModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { EventsModal, AvailabilityModal, RolesModal } from './components/ManagementModals';

import * as Supabase from './services/supabaseService';
import { 
  User, ScheduleMap, AttendanceMap, AvailabilityMap, 
  AppNotification, Announcement, SwapRequest, RepertoireItem, 
  TeamMemberProfile, MemberMap, Role,
  GlobalConflictMap
} from './types';
import { adjustMonth, getMonthName } from './utils/dateUtils';

const InnerApp = () => {
  // --- AUTH & USER STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // --- APP STATE ---
  const [ministryId, setMinistryId] = useState<string>('midia');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // --- DATA STATE ---
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [events, setEvents] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [membersMap, setMembersMap] = useState<MemberMap>({});
  const [publicMembers, setPublicMembers] = useState<TeamMemberProfile[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [globalConflicts, setGlobalConflicts] = useState<GlobalConflictMap>({});
  
  // --- SETTINGS STATE ---
  const [roles, setRoles] = useState<Role[]>([]);
  const [ministryTitle, setMinistryTitle] = useState("");
  
  // --- UI MODALS STATE ---
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [eventDetailsModal, setEventDetailsModal] = useState<{ isOpen: boolean; event: any | null }>({ isOpen: false, event: null });
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<any>(null);

  // --- MANAGEMENT MODALS STATE (Editor Tab) ---
  const [isEventsModalOpen, setEventsModalOpen] = useState(false);
  const [isAvailModalOpen, setAvailModalOpen] = useState(false);
  const [isRolesModalOpen, setRolesModalOpen] = useState(false);

  const { addToast } = useToast();

  // --- INITIALIZATION ---
  useEffect(() => {
    const sb = Supabase.getSupabase();
    if (!sb) {
        setLoadingAuth(false);
        return;
    }

    // Função centralizada para processar sessão do usuário
    const handleUserSession = async (user: any) => {
        if (!user) {
            setCurrentUser(null);
            setLoadingAuth(false);
            return;
        }

        try {
            const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                
                // --- ADMIN RECOVERY LOGIC ---
                let isUserAdmin = profile.is_admin;
                // Force admin for specific email if lost
                if (user.email === 'cassia.andinho@gmail.com') {
                    isUserAdmin = true;
                    if (!profile.is_admin) {
                         Supabase.toggleAdminSQL(user.email, true).catch(console.error);
                    }
                }
                // ---------------------------

                setMinistryId(userMinistry);
                setCurrentUser({
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: isUserAdmin ? 'admin' : 'member',
                    ministryId: userMinistry,
                    allowedMinistries: profile.allowed_ministries || [userMinistry],
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: profile.functions || []
                });
            }
        } catch (e) {
            console.error("Erro ao carregar perfil:", e);
        } finally {
            setLoadingAuth(false);
        }
    };

    sb.auth.getUser().then(({ data: { user } }) => handleUserSession(user));

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            setLoadingAuth(true); 
            handleUserSession(session.user);
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setLoadingAuth(false);
        }
    });
      
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
        document.documentElement.classList.add('dark');
    }

    window.addEventListener('pwa-ready', () => setShowInstallBanner(true));

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  const toggleTheme = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      if (newTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const loadData = useCallback(async () => {
    if (!currentUser || !ministryId) return;

    const settings = await Supabase.fetchMinistrySettings(ministryId);
    setMinistryTitle(settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
    setRoles(settings.roles);

    const schedData = await Supabase.fetchMinistrySchedule(ministryId, currentMonth);
    setEvents(schedData.events);
    setSchedule(schedData.schedule);
    setAttendance(schedData.attendance);

    const membersData = await Supabase.fetchMinistryMembers(ministryId);
    setMembersMap(membersData.memberMap);
    setPublicMembers(membersData.publicList);

    const availData = await Supabase.fetchMinistryAvailability(ministryId);
    setAvailability(availData);

    const notifs = await Supabase.fetchNotificationsSQL(ministryId, currentUser.id!);
    setNotifications(notifs);
    const ann = await Supabase.fetchAnnouncementsSQL(ministryId);
    setAnnouncements(ann);

    const swaps = await Supabase.fetchSwapRequests(ministryId);
    setSwapRequests(swaps);
    const rep = await Supabase.fetchRepertoire(ministryId);
    setRepertoire(rep);
    
    const conflicts = await Supabase.fetchGlobalSchedules(currentMonth, ministryId);
    setGlobalConflicts(conflicts);

  }, [currentUser, ministryId, currentMonth]);

  useEffect(() => {
     loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await Supabase.logout();
    setCurrentUser(null);
    window.location.reload();
  };

  const handleSwitchMinistry = (id: string) => {
      setMinistryId(id);
      if (currentUser) {
          setCurrentUser({ ...currentUser, ministryId: id });
      }
      addToast(`Alternado para ${id}`, 'info');
  };

  const handleJoinMinistry = async (newId: string, roles: string[]) => {
      const result = await Supabase.joinMinistry(newId, roles);
      if (result.success) {
          addToast(result.message, 'success');
          window.location.reload();
      } else {
          addToast(result.message, 'error');
      }
  };

  const handleInstallApp = () => {
      const promptEvent = (window as any).deferredPrompt;
      if (promptEvent) {
          promptEvent.prompt();
          promptEvent.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                  console.log('User accepted PWA install');
              }
              setShowInstallBanner(false);
          });
      } else {
          setShowInstallModal(true);
      }
  };

  const handleCellChange = async (key: string, value: string) => {
      const success = await Supabase.saveScheduleAssignment(ministryId, key, value);
      if (success) {
          setSchedule(prev => ({ ...prev, [key]: value }));
      } else {
          addToast("Erro ao salvar escala.", "error");
      }
  };

  const handleAttendanceToggle = async (key: string) => {
      const success = await Supabase.toggleAssignmentConfirmation(ministryId, key);
      if (success) {
          setAttendance(prev => {
              const newVal = !prev[key];
              const copy = { ...prev };
              if (newVal) copy[key] = true; else delete copy[key];
              return copy;
          });
      }
  };

  if (loadingAuth) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-white">
               <div className="flex flex-col items-center gap-4">
                   <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                   <p className="text-sm font-medium animate-pulse">Carregando sistema...</p>
               </div>
          </div>
      );
  }

  if (!currentUser) {
      return <LoginScreen isLoading={loadingAuth} />;
  }

  const MAIN_NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'announcements', label: 'Avisos', icon: <Megaphone size={20}/> },
    { id: 'calendar', label: 'Calendário', icon: <CalendarIcon size={20}/> },
    { id: 'availability', label: 'Disponibilidade', icon: <CalendarCheck size={20}/> },
    { id: 'swaps', label: 'Trocas de Escala', icon: <RefreshCcw size={20}/> },
    { id: 'repertoire', label: 'Repertório', icon: <Music size={20}/> },
  ];

  const MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disponibilidade', icon: <FileBarChart size={20}/> },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const isAdmin = currentUser.role === 'admin';

  return (
    <DashboardLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={handleLogout}
        title={ministryTitle}
        isConnected={true}
        currentUser={currentUser}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        mainNavItems={MAIN_NAV}
        managementNavItems={MANAGEMENT_NAV}
        notifications={notifications}
        onNotificationsUpdate={setNotifications}
        onInstall={handleInstallApp}
        isStandalone={window.matchMedia('(display-mode: standalone)').matches}
        onSwitchMinistry={handleSwitchMinistry}
        onOpenJoinMinistry={() => setShowJoinModal(true)}
    >
        {currentTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h1 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                          {(() => {
                              const h = new Date().getHours();
                              if (h < 12) return "Bom dia";
                              if (h < 18) return "Boa tarde";
                              return "Boa noite";
                          })()}, {currentUser.name.split(' ')[0]} <span className="animate-wave text-3xl">👋</span>
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                          Bem-vindo ao painel de controle do {ministryTitle}.
                      </p>
                  </div>
                  <WeatherWidget />
              </div>

              {(() => {
                  const now = new Date();
                  const upcoming = events
                    .filter(e => new Date(e.iso) >= now || e.iso.startsWith(now.toISOString().split('T')[0]))
                    .sort((a, b) => a.iso.localeCompare(b.iso))[0];
                  
                  return (
                      <NextEventCard 
                          event={upcoming}
                          schedule={schedule}
                          attendance={attendance}
                          roles={roles}
                          onConfirm={(key) => {
                             const assignment = Object.entries(schedule).find(([k, v]) => k === key);
                             if (assignment) {
                                setConfirmModalData({
                                    key,
                                    memberName: assignment[1],
                                    eventName: upcoming.title,
                                    date: upcoming.dateDisplay,
                                    role: key.split('_').pop() || ''
                                });
                             }
                          }}
                          ministryId={ministryId}
                          currentUser={currentUser}
                      />
                  );
              })()}
              
              <BirthdayCard members={publicMembers} currentMonthIso={currentMonth} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                    <h3 className="font-bold text-zinc-800 dark:text-white mb-4">Acesso Rápido</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setCurrentTab('availability')} className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex flex-col items-center gap-2 text-center">
                            <CalendarCheck size={24}/> Marcar Disponibilidade
                        </button>
                        <button onClick={() => setCurrentTab('calendar')} className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors flex flex-col items-center gap-2 text-center">
                            <CalendarIcon size={24}/> Ver Escala Completa
                        </button>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-zinc-800 dark:text-white">Últimos Avisos</h3>
                        <button onClick={() => setCurrentTab('announcements')} className="text-xs text-blue-500 font-bold hover:underline">Ver Todos</button>
                     </div>
                     {announcements.length === 0 ? (
                         <p className="text-sm text-zinc-400 italic">Nenhum aviso recente.</p>
                     ) : (
                         <div className="space-y-3">
                             {announcements.slice(0, 3).map(a => (
                                 <div key={a.id} className="text-sm border-l-2 border-blue-500 pl-3">
                                     <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{a.title}</p>
                                     <p className="text-zinc-500 text-xs truncate">{a.message}</p>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
              </div>
            </div>
        )}

        {currentTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                           <CalendarIcon className="text-blue-500"/> Calendário de Escala
                        </h2>
                     </div>
                     <div className="flex flex-wrap items-center gap-2">
                         <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                            <div className="text-center min-w-[120px]">
                                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                            </div>
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
                        </div>
                     </div>
                </div>

                <CalendarGrid 
                    currentMonth={currentMonth}
                    events={events}
                    schedule={schedule}
                    roles={roles}
                    onEventClick={(event) => setEventDetailsModal({ isOpen: true, event })}
                />
            </div>
        )}

        {currentTab === 'schedule-editor' && isAdmin && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                           <Edit className="text-blue-600 dark:text-blue-500" size={32} /> 
                           Editor de Escala
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-base">
                            Gerencie a escala oficial de <span className="text-zinc-800 dark:text-zinc-200 font-bold capitalize">{getMonthName(currentMonth)}</span>.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <ToolsMenu 
                            onExportIndividual={() => {}} 
                            onExportFull={() => {}} 
                            onWhatsApp={() => {}} 
                            onCSV={() => {}} 
                            onImportCSV={() => {}} 
                            onClearMonth={() => {
                                if(confirm("Limpar toda a escala deste mês?")) {
                                    Supabase.clearScheduleForMonth(ministryId, currentMonth).then(loadData);
                                }
                            }}
                            onResetEvents={() => {
                                if(confirm("Restaurar eventos padrão?")) {
                                    Supabase.resetToDefaultEvents(ministryId, currentMonth).then(loadData);
                                }
                            }}
                            allMembers={publicMembers.map(m => m.name)}
                         />
                         
                         <div className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-700 shadow-sm text-white">
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-700 rounded-md transition-colors">
                                <ArrowLeft size={16} /> 
                            </button>
                            <div className="text-center min-w-[80px]">
                                <span className="block text-sm font-bold">{currentMonth}</span>
                            </div>
                            <button onClick={() => setCurrentMonth(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-700 rounded-md transition-colors">
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => setEventsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
                    >
                        <Clock size={18} /> Gerenciar Eventos
                    </button>
                    <button 
                        onClick={() => setAvailModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
                    >
                        <ShieldAlert size={18} /> Gerenciar Indisponibilidade
                    </button>
                    <button 
                        onClick={() => setRolesModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95"
                    >
                        <Settings size={18} /> Configurar Funções
                    </button>
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
                    onCellChange={handleCellChange}
                    onAttendanceToggle={handleAttendanceToggle}
                    onDeleteEvent={async (iso, title) => {
                         if(confirm(`Remover o evento "${title}"?`)) {
                             await Supabase.deleteMinistryEvent(ministryId, iso.split('T')[0] + 'T' + iso.split('T')[1]);
                             loadData();
                         }
                    }}
                    onEditEvent={(event) => setEventDetailsModal({ isOpen: true, event })}
                    memberStats={(() => {
                        const stats: Record<string, number> = {};
                        Object.values(schedule).forEach((val) => {
                            const name = val as string;
                            if (name) stats[name] = (stats[name] || 0) + 1;
                        });
                        return stats;
                    })()}
                    ministryId={ministryId}
                    readOnly={false}
                />
            </div>
        )}

        {currentTab === 'availability' && (
            <AvailabilityScreen 
                availability={availability}
                setAvailability={setAvailability}
                allMembersList={publicMembers.map(m => m.name)}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                currentUser={currentUser}
                onSaveAvailability={async (member, dates) => {
                     const p = publicMembers.find(pm => pm.name === member);
                     if (p) {
                        await Supabase.saveMemberAvailability(p.id, member, dates);
                        loadData();
                     }
                }}
            />
        )}

        {currentTab === 'swaps' && (
            <SwapRequestsScreen 
                schedule={schedule}
                currentUser={currentUser}
                requests={swapRequests}
                visibleEvents={events}
                onCreateRequest={async (role, iso, title) => {
                    const success = await Supabase.createSwapRequestSQL(ministryId, {
                         id: '',
                         ministryId,
                         requesterName: currentUser.name,
                         requesterId: currentUser.id,
                         role,
                         eventIso: iso,
                         eventTitle: title,
                         status: 'pending',
                         createdAt: new Date().toISOString()
                    });
                    if(success) {
                        addToast("Solicitação criada!", "success");
                        loadData();
                    }
                }}
                onAcceptRequest={async (reqId) => {
                    const result = await Supabase.performSwapSQL(ministryId, reqId, currentUser.name, currentUser.id!);
                    if(result.success) {
                        addToast(result.message, "success");
                        loadData();
                    } else {
                        addToast(result.message, "error");
                    }
                }}
            />
        )}

        {(currentTab === 'repertoire' || (currentTab === 'repertoire-manager' && isAdmin)) && (
            <RepertoireScreen 
                repertoire={repertoire}
                setRepertoire={async () => { await loadData(); }}
                currentUser={currentUser}
                mode={currentTab === 'repertoire-manager' ? 'manage' : 'view'}
            />
        )}

        {currentTab === 'announcements' && (
            <div className="space-y-8">
                <AnnouncementsScreen 
                    announcements={announcements}
                    currentUser={currentUser}
                    onMarkRead={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'read').then(loadData)}
                    onToggleLike={(id) => Supabase.interactAnnouncementSQL(id, currentUser.id!, currentUser.name, 'like').then(loadData)}
                />
            </div>
        )}

        {currentTab === 'send-announcements' && isAdmin && (
            <div className="space-y-8">
                <AlertsManager 
                    onSend={async (title, message, type, exp) => {
                            await Supabase.sendNotificationSQL(ministryId, { title, message, type });
                            await Supabase.createAnnouncementSQL(ministryId, { title, message, type, expirationDate: exp }, currentUser.name);
                            loadData();
                    }}
                />
            </div>
        )}

        {currentTab === 'members' && isAdmin && (
             <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
                 <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                            <Users className="text-indigo-500"/> Membros & Equipe
                        </h2>
                        <p className="text-zinc-500 text-sm mt-1">
                            Gerencie os integrantes, funções e permissões de acesso.
                        </p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {publicMembers.map(member => (
                        <div key={member.id} className="bg-[#18181b] rounded-2xl border border-zinc-800 p-5 flex flex-col gap-4 relative group shadow-sm transition-all hover:border-zinc-700">
                            
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    {member.avatar_url ? (
                                        <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700 shadow-sm" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold border-2 border-zinc-700 shadow-sm">
                                            {member.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="font-bold text-lg text-zinc-100 truncate max-w-[150px]" title={member.name}>{member.name}</h3>
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mt-0.5">
                                            {member.isAdmin ? 'Administrador' : 'Membro'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                     <button
                                        onClick={async () => {
                                            if (member.email) {
                                                const newStatus = !member.isAdmin;
                                                await Supabase.toggleAdminSQL(member.email, newStatus);
                                                loadData();
                                                addToast(`${member.name} agora é ${newStatus ? 'Admin' : 'Membro'}.`, 'success');
                                            } else {
                                                addToast("Este usuário não possui e-mail para ser admin.", "error");
                                            }
                                        }}
                                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors border ${
                                            member.isAdmin 
                                            ? 'bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700' 
                                            : 'bg-transparent border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                                        }`}
                                        title={member.isAdmin ? "Remover Admin" : "Tornar Admin"}
                                    >
                                        <ShieldCheck size={16} fill={member.isAdmin ? "currentColor" : "none"} />
                                    </button>
                                    
                                    <button
                                        onClick={async () => {
                                            if(confirm(`Remover ${member.name} da equipe? Esta ação não pode ser desfeita.`)) {
                                                await Supabase.deleteMember(ministryId, member.id, member.name);
                                                loadData();
                                                addToast(`${member.name} removido.`, "success");
                                            }
                                        }}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors border bg-transparent border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-900/50 hover:bg-red-900/10"
                                        title="Excluir Membro"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {member.roles && member.roles.length > 0 ? (
                                    member.roles.map(role => (
                                        <span key={role} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-900/20 text-blue-400 border border-blue-900/30">
                                            {role}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-zinc-600 italic px-2">Sem função definida</span>
                                )}
                            </div>

                            <hr className="border-zinc-800" />

                            <div className="space-y-2.5 text-sm">
                                <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors">
                                    <Mail size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/>
                                    <span className="truncate">{member.email || "Sem e-mail"}</span>
                                </div>
                                <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors">
                                    {member.whatsapp ? (
                                        <>
                                            <Phone size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/>
                                            <span className="truncate">{member.whatsapp}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Phone size={16} className="text-zinc-600 shrink-0"/>
                                            <span className="text-zinc-600 italic">Telefone não informado</span>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors">
                                    <Gift size={16} className="text-pink-500 group-hover/item:text-pink-400 transition-colors shrink-0"/>
                                    <span className="truncate text-pink-500 font-medium">
                                        Aniversário: {member.birthDate ? member.birthDate.split('-').reverse().slice(0, 2).join('/') : "Não informado"}
                                    </span>
                                </div>
                            </div>

                        </div>
                    ))}
                 </div>
             </div>
        )}

        {currentTab === 'events' && isAdmin && (
            <EventsScreen 
                customEvents={events}
                onCreateEvent={async (evt) => {
                    await Supabase.createMinistryEvent(ministryId, evt);
                    loadData();
                }}
                onDeleteEvent={async (iso) => {
                     const evt = events.find(e => `${e.date}T${e.time}` === iso || e.iso === iso);
                     if (evt) {
                         await Supabase.deleteMinistryEvent(ministryId, evt.iso || `${evt.date}T${evt.time}`);
                         loadData();
                     }
                }}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
            />
        )}

        {currentTab === 'report' && isAdmin && (
            <AvailabilityReportScreen 
                availability={availability}
                registeredMembers={publicMembers}
                membersMap={membersMap}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                availableRoles={roles}
                onRefresh={loadData}
            />
        )}

        {currentTab === 'settings' && isAdmin && (
             <SettingsScreen 
                 initialTitle={ministryTitle}
                 ministryId={ministryId}
                 theme={theme}
                 onToggleTheme={toggleTheme}
                 onSaveTitle={async (t) => {
                     await Supabase.saveMinistrySettings(ministryId, t);
                     setMinistryTitle(t);
                     addToast("Configurações salvas!", "success");
                 }}
                 onEnableNotifications={async () => {
                     const result = await Supabase.testPushNotification(ministryId);
                     if (!result.success) addToast(result.message, "error");
                 }}
                 onAnnounceUpdate={async () => {
                     await Supabase.sendNotificationSQL(ministryId, {
                         title: "Nova Versão 🚀",
                         message: "O sistema foi atualizado com melhorias. Atualize a página!",
                         type: "success"
                     });
                     addToast("Notificação de atualização enviada!", "success");
                 }}
             />
        )}

        {currentTab === 'profile' && (
             <ProfileScreen 
                 user={currentUser}
                 onUpdateProfile={async (name, whatsapp, avatar, functions, birth) => {
                      const res = await Supabase.updateUserProfile(name, whatsapp, avatar, functions, birth, ministryId);
                      if (res.success) {
                          addToast("Perfil atualizado!", "success");
                          setCurrentUser(prev => prev ? ({ ...prev, name, whatsapp, avatar_url: avatar, functions, birthDate: birth }) : null);
                          loadData();
                      } else {
                          addToast(res.message, "error");
                      }
                 }}
                 availableRoles={roles}
             />
        )}

        <InstallBanner isVisible={showInstallBanner} onInstall={handleInstallApp} onDismiss={() => setShowInstallBanner(false)} appName={ministryTitle} />
        <InstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
        <JoinMinistryModal 
            isOpen={showJoinModal} 
            onClose={() => setShowJoinModal(false)} 
            onJoin={handleJoinMinistry}
            alreadyJoined={currentUser.allowedMinistries || []}
        />
        <EventDetailsModal 
            isOpen={eventDetailsModal.isOpen} 
            onClose={() => setEventDetailsModal({ isOpen: false, event: null })}
            event={eventDetailsModal.event}
            schedule={schedule}
            roles={roles}
            allMembers={publicMembers}
            onSave={async (oldIso, newTitle, newTime, applyToAll) => {
                const newIso = `${oldIso.split('T')[0]}T${newTime}`;
                await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso);
                setEventDetailsModal({ isOpen: false, event: null });
                loadData();
                addToast("Evento atualizado!", "success");
            }}
            currentUser={currentUser}
            ministryId={ministryId}
            canEdit={isAdmin}
        />
        <StatsModal 
            isOpen={statsModalOpen} 
            onClose={() => setStatsModalOpen(false)}
            stats={(() => {
                const stats: Record<string, number> = {};
                Object.values(schedule).forEach((val) => {
                    const name = val as string;
                    if (name) stats[name] = (stats[name] || 0) + 1;
                });
                return stats;
            })()}
            monthName={getMonthName(currentMonth)}
        />
        <ConfirmationModal 
            isOpen={!!confirmModalData}
            data={confirmModalData}
            onClose={() => setConfirmModalData(null)}
            onConfirm={async () => {
                if (confirmModalData) {
                    await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key);
                    setConfirmModalData(null);
                    loadData();
                    addToast("Presença confirmada!", "success");
                }
            }}
        />

        <EventsModal 
            isOpen={isEventsModalOpen} 
            onClose={() => setEventsModalOpen(false)} 
            events={events.map(e => ({
                id: e.id,
                date: e.iso.split('T')[0],
                time: e.iso.split('T')[1],
                title: e.title,
                iso: e.iso
            }))}
            onAdd={async (e) => {
                await Supabase.createMinistryEvent(ministryId, { title: e.title, date: e.date, time: e.time });
                loadData();
            }}
            onRemove={async (id) => {
                const evt = events.find(ev => ev.id === id);
                if (evt) await Supabase.deleteMinistryEvent(ministryId, evt.iso);
                loadData();
            }}
        />
        <AvailabilityModal 
            isOpen={isAvailModalOpen} 
            onClose={() => setAvailModalOpen(false)} 
            members={publicMembers.map(m => m.name)}
            availability={availability}
            onUpdate={async (member, dates) => {
                const p = publicMembers.find(pm => pm.name === member);
                if (p) {
                   await Supabase.saveMemberAvailability(p.id, member, dates);
                   loadData();
                }
            }}
            currentMonth={currentMonth}
        />
        <RolesModal 
            isOpen={isRolesModalOpen} 
            onClose={() => setRolesModalOpen(false)} 
            roles={roles}
            onUpdate={async (newRoles) => {
                await Supabase.saveMinistrySettings(ministryId, undefined, newRoles);
                setRoles(newRoles);
                addToast("Funções atualizadas!", "success");
            }}
        />

    </DashboardLayout>
  );
};

const App = () => {
  return (
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  );
};

export default App;
