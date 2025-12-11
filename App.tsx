
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
  GlobalConflictMap, ThemeMode
} from './types';
import { adjustMonth, getMonthName } from './utils/dateUtils';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from './utils/pushUtils';

const InnerApp = () => {
  // --- AUTH & USER STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // --- APP STATE ---
  const [ministryId, setMinistryId] = useState<string>('midia');
  
  // Inicializa a aba baseada na URL ou padrão 'dashboard'
  const [currentTab, setCurrentTab] = useState(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('tab') || 'dashboard';
      }
      return 'dashboard';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // --- THEME STATE ---
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
      try {
          const saved = localStorage.getItem('themeMode');
          return (saved as ThemeMode) || 'system';
      } catch (e) {
          console.warn("LocalStorage access denied for themeMode");
          return 'system';
      }
  });
  const [visualTheme, setVisualTheme] = useState<'light' | 'dark'>('light');
  
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

  const { addToast, confirmAction } = useToast();

  // --- SYNC TAB WITH URL ---
  useEffect(() => {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== currentTab) {
          url.searchParams.set('tab', currentTab);
          // FIX: Wrap in try-catch to avoid Uncaught errors in restricted environments
          try {
            window.history.replaceState({}, '', url.toString());
          } catch (e) {
            // Ignore history update errors
          }
      }
  }, [currentTab]);

  // --- THEME LOGIC ---
  useEffect(() => {
    const applyTheme = () => {
        let targetTheme: 'light' | 'dark' = 'light';

        if (themeMode === 'system') {
            const hour = new Date().getHours();
            // Regra: Até as 18h (e após as 6h) é light, caso contrário dark
            if (hour >= 6 && hour < 18) {
                targetTheme = 'light';
            } else {
                targetTheme = 'dark';
            }
        } else {
            targetTheme = themeMode;
        }

        setVisualTheme(targetTheme);
        
        if (targetTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    applyTheme();

    let interval: any;
    if (themeMode === 'system') {
        interval = setInterval(applyTheme, 60000);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [themeMode]);

  const handleSetThemeMode = (mode: ThemeMode) => {
      setThemeMode(mode);
  };

  const handleSaveTheme = () => {
      try {
          localStorage.setItem('themeMode', themeMode);
          addToast("Preferência de tema salva com sucesso!", "success");
      } catch (e) {
          addToast("Erro ao salvar preferência (storage bloqueado).", "warning");
      }
  };

  const toggleVisualTheme = () => {
      if (themeMode === 'system') {
          setThemeMode(visualTheme === 'light' ? 'dark' : 'light');
      } else {
          setThemeMode(themeMode === 'light' ? 'dark' : 'light');
      }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const sb = Supabase.getSupabase();
    if (!sb) {
        setLoadingAuth(false);
        return;
    }

    const handleUserSession = async (session: any) => {
        const user = session?.user;

        if (!user) {
            setCurrentUser(null);
            setLoadingAuth(false);
            return;
        }

        try {
            // Tenta buscar o perfil
            let { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
            
            // FIX CRÍTICO: Se o perfil não existir (ex: primeiro login Google), cria um na hora.
            // Isso impede que o usuário fique num "limbo" logado mas sem acesso.
            if (!profile) {
                console.log("Perfil não encontrado, criando novo para:", user.email);
                
                const defaultMinistry = 'midia';
                const newProfile = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Novo Membro',
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
                    ministry_id: defaultMinistry,
                    allowed_ministries: [defaultMinistry],
                    role: 'member',
                    created_at: new Date().toISOString()
                };

                const { error: insertError } = await sb.from('profiles').insert(newProfile);
                
                if (!insertError) {
                    profile = newProfile;
                } else {
                    console.error("Falha ao criar perfil automático:", insertError);
                    // Fallback visual para não bloquear o acesso
                    profile = newProfile;
                }
            }

            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                
                let isUserAdmin = profile.is_admin;
                if (user.email === 'cassia.andinho@gmail.com') {
                    isUserAdmin = true;
                    if (!profile.is_admin) {
                         Supabase.toggleAdminSQL(user.email, true).catch(console.error);
                    }
                }

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

    // 1. Check Session directly (Faster & Handles Redirect URL hash)
    sb.auth.getSession().then(({ data: { session } }) => {
        handleUserSession(session);
    });

    // 2. Listen for changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setLoadingAuth(true); 
            handleUserSession(session);
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setLoadingAuth(false);
        }
    });
      
    window.addEventListener('pwa-ready', () => setShowInstallBanner(true));

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!currentUser || !ministryId) return;

    // Chave única para o cache baseada no ministério e mês atual
    const CACHE_KEY = `offline_data_${ministryId}_${currentMonth}`;

    try {
        // Carregamento paralelo de dados otimizado com Promise.all
        const [
            settings,
            schedData,
            membersData,
            availData,
            notifs,
            ann,
            swaps,
            rep,
            conflicts
        ] = await Promise.all([
            Supabase.fetchMinistrySettings(ministryId),
            Supabase.fetchMinistrySchedule(ministryId, currentMonth),
            Supabase.fetchMinistryMembers(ministryId),
            Supabase.fetchMinistryAvailability(ministryId),
            Supabase.fetchNotificationsSQL(ministryId, currentUser.id!),
            Supabase.fetchAnnouncementsSQL(ministryId),
            Supabase.fetchSwapRequests(ministryId),
            Supabase.fetchRepertoire(ministryId),
            Supabase.fetchGlobalSchedules(currentMonth, ministryId)
        ]);

        // 1. Atualização de estado em lote (Dados da Nuvem)
        setMinistryTitle(settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
        setRoles(settings.roles);

        setEvents(schedData.events);
        setSchedule(schedData.schedule);
        setAttendance(schedData.attendance);

        setMembersMap(membersData.memberMap);
        setPublicMembers(membersData.publicList);

        setAvailability(availData);

        setNotifications(notifs);
        setAnnouncements(ann);

        setSwapRequests(swaps);
        setRepertoire(rep);
        
        setGlobalConflicts(conflicts);

        // 2. Salvar no Cache Local (Sucesso)
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                settings,
                schedData,
                membersData,
                availData,
                notifs,
                ann,
                swaps,
                rep,
                conflicts
            }));
        } catch (e) {
            console.warn("Não foi possível salvar cache offline.");
        }

    } catch (error) {
        console.error("Erro ao carregar dados online:", error);

        // 3. Fallback: Tentar carregar do Cache
        try {
            const cachedRaw = localStorage.getItem(CACHE_KEY);
            
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                
                setMinistryTitle(cached.settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
                setRoles(cached.settings.roles);

                setEvents(cached.schedData.events);
                setSchedule(cached.schedData.schedule);
                setAttendance(cached.schedData.attendance);

                setMembersMap(cached.membersData.memberMap);
                setPublicMembers(cached.membersData.publicList);

                setAvailability(cached.availData);

                setNotifications(cached.notifs);
                setAnnouncements(cached.ann);

                setSwapRequests(cached.swaps);
                setRepertoire(cached.rep);
                
                setGlobalConflicts(cached.conflicts);

                addToast("Modo Offline: Exibindo dados salvos localmente.", "warning");
                return; 
            }
        } catch (e) {
            console.error("Erro ao acessar cache:", e);
        }

        addToast("Erro de conexão e sem dados locais.", "error");
    }

  }, [currentUser, ministryId, currentMonth, addToast]);

  useEffect(() => {
     loadData();
  }, [loadData]);

  const handleLogout = () => {
    confirmAction(
      "Sair",
      "Deseja realmente sair do sistema?",
      async () => {
        await Supabase.logout();
        setCurrentUser(null);
        try {
            window.history.replaceState(null, '', '/');
        } catch(e) {}
      }
    );
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
      let keyToRemove: string | null = null;
      
      // Lógica de Deslocamento: Se membro já está em outra função neste evento, removemos da anterior
      if (value) {
          // Extrai o ISO do evento (YYYY-MM-DDTHH:mm sempre tem 16 caracteres)
          const eventIso = key.substring(0, 16);

          // Procura se esse membro já está escalado em OUTRA função neste MESMO evento
          Object.entries(schedule).forEach(([k, val]) => {
              if (k.startsWith(eventIso) && k !== key) {
                  if (val === value) {
                      keyToRemove = k; // Encontrou duplicidade no mesmo evento
                  }
              }
          });
      }

      // Atualização Otimista da UI
      setSchedule(prev => {
          const next = { ...prev };
          
          if (keyToRemove) {
              delete next[keyToRemove];
          }

          if (value) {
              next[key] = value;
          } else {
              delete next[key];
          }
          return next;
      });

      // Executa remoção no banco se houver deslocamento
      if (keyToRemove) {
          await Supabase.saveScheduleAssignment(ministryId, keyToRemove, "");
      }

      // Salva a nova atribuição
      const success = await Supabase.saveScheduleAssignment(ministryId, key, value);
      if (!success) {
          addToast("Erro ao salvar escala.", "error");
          loadData(); // Reverte em caso de falha
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

  const handleEnableNotifications = async () => {
      // 1. Verificação básica de suporte
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          throw new Error("Seu navegador não suporta notificações Push.");
      }

      // 2. Verificação de Permissão Bloqueada (Falha rápida com instrução clara)
      if (Notification.permission === 'denied') {
          throw new Error("Permissão bloqueada. 1. Clique no cadeado na URL. 2. Permita Notificações. 3. RECARREGUE a página.");
      }

      try {
          // 3. Garantir que o Service Worker está registrado e ATIVO
          // Se já existir, pegamos. Se não, registramos.
          let registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
             registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          }

          // 4. Aguardar o SW estar PRONTO (Ativo)
          // navigator.serviceWorker.ready resolve quando há um SW ativo para a página.
          // Usamos um timeout de segurança para não travar a UI se o browser encrencar.
          const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Service Worker demorou para responder. Verifique sua conexão.")), 10000)
          );

          const readyRegistration = await Promise.race([
              navigator.serviceWorker.ready,
              timeoutPromise
          ]) as ServiceWorkerRegistration;

          // 5. Solicitar Permissão ao Usuário (se ainda não concedida)
          if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                  throw new Error("Permissão negada pelo usuário.");
              }
          }

          // Verificação dupla
          if (Notification.permission !== 'granted') {
              throw new Error("Permissão não concedida.");
          }

          // 6. Criar ou Recuperar Inscrição (Subscription)
          let subscription = await readyRegistration.pushManager.getSubscription();
          
          if (!subscription) {
              subscription = await readyRegistration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
              });
          }

          // 7. Salvar no Banco de Dados
          if (subscription) {
              await Supabase.saveSubscriptionSQL(ministryId, subscription);
              
              // Tenta enviar notificação de teste imediatamente
              try {
                  const testRes = await Supabase.testPushNotification(ministryId);
                  if (testRes.success) {
                      addToast("Notificações ativadas com sucesso!", "success");
                  } else {
                      addToast("Ativado, mas o teste falhou: " + testRes.message, "warning");
                  }
              } catch (e) {
                  addToast("Notificações ativadas! (Teste ignorado)", "success");
              }
          }

      } catch(e: any) {
          console.error("Push Error:", e);
          let msg = e.message || "Erro desconhecido ao ativar notificações.";
          if (msg.includes("no active Service Worker")) msg = "Erro interno no navegador. Tente recarregar a página.";
          addToast(msg, "error");
          throw e; // Lança o erro para parar o spinner no componente SettingsScreen
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
    { id: 'settings', label: 'Configurações', icon: <Settings size={20}/> },
  ];

  const MANAGEMENT_NAV = [
    { id: 'schedule-editor', label: 'Editor de Escala', icon: <Edit size={20}/> },
    { id: 'repertoire-manager', label: 'Gerenciar Repertório', icon: <ListMusic size={20}/> },
    { id: 'report', label: 'Relat. Disponibilidade', icon: <FileBarChart size={20}/> },
    { id: 'events', label: 'Eventos', icon: <CalendarDays size={20}/> },
    { id: 'send-announcements', label: 'Enviar Avisos', icon: <Send size={20}/> },
    { id: 'members', label: 'Membros & Equipe', icon: <Users size={20}/> },
  ];

  const isAdmin = currentUser.role === 'admin';

  return (
    <DashboardLayout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        theme={visualTheme}
        toggleTheme={toggleVisualTheme}
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
                          Bem-vindo a {ministryTitle}.
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

        {currentTab === 'events' && isAdmin && (
            <EventsScreen 
                customEvents={events.map(e => ({ ...e, iso: e.iso }))}
                onCreateEvent={async (evt) => {
                    await Supabase.createMinistryEvent(ministryId, evt);
                    loadData();
                }}
                onDeleteEvent={async (iso) => {
                    await Supabase.deleteMinistryEvent(ministryId, iso);
                    loadData();
                }}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
            />
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
                                        <span className="text-zinc-600 italic text-xs pl-7">WhatsApp não informado</span>
                                    )}
                                </div>
                                {member.birthDate && (
                                     <div className="flex items-center gap-3 text-zinc-400 group/item hover:text-zinc-300 transition-colors">
                                        <Gift size={16} className="text-zinc-600 group-hover/item:text-zinc-400 transition-colors shrink-0"/>
                                        <span className="truncate">
                                            {new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
        )}

        {currentTab === 'settings' && (
            <SettingsScreen 
                initialTitle={ministryTitle} 
                ministryId={ministryId}
                themeMode={themeMode}
                onSetThemeMode={handleSetThemeMode}
                onSaveTheme={handleSaveTheme}
                onSaveTitle={async (newTitle) => {
                    await Supabase.saveMinistrySettings(ministryId, newTitle);
                    setMinistryTitle(newTitle);
                    addToast("Nome do ministério atualizado!", "success");
                }}
                onAnnounceUpdate={async () => {
                    await Supabase.sendNotificationSQL(ministryId, {
                        title: "Atualização de Sistema",
                        message: "Uma nova versão do app está disponível. Recarregue a página para aplicar.",
                        type: "warning"
                    });
                    addToast("Notificação de atualização enviada.", "success");
                }}
                onEnableNotifications={handleEnableNotifications}
                isAdmin={isAdmin}
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
                onRefresh={async () => {
                    await loadData();
                    addToast("Dados atualizados!", "success");
                }}
            />
        )}

        {currentTab === 'profile' && currentUser && (
             <ProfileScreen 
                user={currentUser}
                availableRoles={roles}
                onUpdateProfile={async (name, whatsapp, avatar_url, functions, birthDate) => {
                    const res = await Supabase.updateUserProfile(name, whatsapp, avatar_url, functions, birthDate, ministryId);
                    if (res.success) {
                        addToast(res.message, "success");
                        setCurrentUser({ ...currentUser, name, whatsapp, avatar_url, functions, birthDate });
                        await loadData();
                    } else {
                        addToast(res.message, "error");
                    }
                }}
             />
        )}

        {/* MODAIS GLOBAIS */}
        <EventsModal 
          isOpen={isEventsModalOpen} 
          onClose={() => setEventsModalOpen(false)} 
          events={events.map(e => ({ ...e, iso: e.iso }))} 
          onAdd={async (e) => { 
              await Supabase.createMinistryEvent(ministryId, e);
              loadData();
          }}
          onRemove={async (id) => {
             // Implementation depends on how we track ID in EventsModal, assume we reload
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
              loadData();
          }}
        />

        <InstallBanner 
          isVisible={showInstallBanner} 
          onInstall={handleInstallApp} 
          onDismiss={() => setShowInstallBanner(false)}
          appName={ministryTitle || "Gestão Escala"}
        />

        <InstallModal 
            isOpen={showInstallModal}
            onClose={() => setShowInstallModal(false)}
        />

        <JoinMinistryModal
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            onJoin={handleJoinMinistry}
            alreadyJoined={currentUser.allowedMinistries || []}
        />

        {eventDetailsModal.isOpen && (
            <EventDetailsModal 
                isOpen={eventDetailsModal.isOpen}
                onClose={() => setEventDetailsModal({ isOpen: false, event: null })}
                event={eventDetailsModal.event}
                schedule={schedule}
                roles={roles}
                allMembers={publicMembers}
                onSave={async (oldIso, newTitle, newTime, applyToAll) => {
                    const newIso = oldIso.split('T')[0] + 'T' + newTime;
                    await Supabase.updateMinistryEvent(ministryId, oldIso, newTitle, newIso, applyToAll);
                    loadData();
                    setEventDetailsModal({ isOpen: false, event: null });
                    addToast("Evento atualizado.", "success");
                }}
                onSwapRequest={async (role, iso, title) => {
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
                    if (success) {
                        addToast("Troca solicitada!", "success");
                        loadData();
                        setEventDetailsModal({ isOpen: false, event: null });
                    }
                }}
                currentUser={currentUser}
                ministryId={ministryId}
                canEdit={isAdmin}
            />
        )}

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
            onClose={() => setConfirmModalData(null)}
            data={confirmModalData}
            onConfirm={async () => {
                if (confirmModalData) {
                    await Supabase.toggleAssignmentConfirmation(ministryId, confirmModalData.key);
                    loadData();
                    setConfirmModalData(null);
                    addToast("Presença confirmada!", "success");
                }
            }}
        />
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <InnerApp />
    </ToastProvider>
  );
}
