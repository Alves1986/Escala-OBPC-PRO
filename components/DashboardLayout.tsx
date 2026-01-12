
import React, { ReactNode, useState, useRef } from 'react';
import { Menu, Sun, Moon, LogOut, Layout, Download, RefreshCw, X, ChevronRight, User as UserIcon, ChevronDown, Check, PlusCircle, Settings, ShieldCheck, Sparkles, Building2, Home, Calendar, Megaphone, CalendarCheck, Shield } from 'lucide-react';
import { User, AppNotification } from '../types'; 
import { NotificationCenter } from './NotificationCenter';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppStore } from '../store/appStore';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface Props {
  children: ReactNode;
  onLogout: () => void;
  title: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  mainNavItems: NavItem[];
  managementNavItems: NavItem[];
  notifications: AppNotification[];
  onNotificationsUpdate: (notifications: AppNotification[]) => void;
  onInstall?: () => void;
  isStandalone?: boolean;
  onSwitchMinistry?: (id: string) => void;
  onOpenJoinMinistry?: () => void;
  activeMinistryId?: string;
}

const isValidMinistryId = (id: string) => id && id !== 'undefined' && id !== 'null';

export const DashboardLayout: React.FC<Props> = ({ 
  children, onLogout, title,
  currentTab, onTabChange, mainNavItems, managementNavItems, notifications, onNotificationsUpdate,
  onInstall, isStandalone, onSwitchMinistry, onOpenJoinMinistry, activeMinistryId
}) => {
  const { currentUser, themeMode, setThemeMode, sidebarOpen, setSidebarOpen, ministryId: storeMinistryId, availableMinistries } = useAppStore(); 
  
  const [imgError, setImgError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ministryMenuOpen, setMinistryMenuOpen] = useState(false);
  const ministryMenuRef = useRef<HTMLDivElement>(null);

  const currentMinistryId = activeMinistryId || storeMinistryId;

  useClickOutside(ministryMenuRef, () => {
      if (ministryMenuOpen) setMinistryMenuOpen(false);
  });

  const activeItem = [...mainNavItems, ...managementNavItems].find(item => item.id === currentTab);
  const activeLabel = activeItem ? activeItem.label : (currentTab === 'profile' ? 'Meu Perfil' : currentTab === 'super-admin' ? 'Super Admin' : 'Visão Geral');
  const ActiveIcon = activeItem ? activeItem.icon : (currentTab === 'super-admin' ? <Shield size={20}/> : <Layout size={20}/>);

  const toggleTheme = () => {
      setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  };

  const handleHardReload = () => {
      setIsUpdating(true);
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
              for(let registration of registrations) {
                  registration.unregister();
              }
              window.location.reload();
          });
      } else {
          window.location.reload();
      }
  };

  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 group mb-1 ${
          isActive 
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <span className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
          {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { size: 18, strokeWidth: isActive ? 2.5 : 2 }) : item.icon}
        </span>
        <span className="flex-1 text-left tracking-tight">{item.label}</span>
        {isActive && (
            <ChevronRight size={14} className="opacity-60" />
        )}
      </button>
    );
  };

  const renderUserAvatar = (size: string = "w-8 h-8") => {
    if (currentUser?.avatar_url) {
      return (
        <img src={currentUser.avatar_url} alt={currentUser.name} className={`${size} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md ring-1 ring-slate-200 dark:ring-slate-700`} />
      );
    }
    return (
      <div className={`${size} rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-xs border-2 border-white dark:border-slate-800 shadow-md`}>
         {currentUser?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const MobileBottomNav = () => {
    const isDashboard = currentTab === 'dashboard';
    const isCalendar = currentTab === 'calendar';
    const isAvailability = currentTab === 'availability';
    const isAnnouncements = currentTab === 'announcements';

    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_30px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-[72px] px-2">
          
          <button onClick={() => onTabChange('dashboard')} className="flex flex-col items-center justify-center flex-1 h-full gap-1 group">
             <div className={`p-2 rounded-2xl transition-all duration-400 ${isDashboard ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 -translate-y-1' : 'text-slate-400'}`}>
                <Home size={22} strokeWidth={isDashboard ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] uppercase tracking-widest transition-all duration-300 ${isDashboard ? 'font-black text-emerald-600 dark:text-emerald-400 scale-105' : 'font-bold text-slate-400'}`}>Início</span>
          </button>

          <button onClick={() => onTabChange('calendar')} className="flex flex-col items-center justify-center flex-1 h-full gap-1 group">
             <div className={`p-2 rounded-2xl transition-all duration-400 ${isCalendar ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 -translate-y-1' : 'text-slate-400'}`}>
                <Calendar size={22} strokeWidth={isCalendar ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] uppercase tracking-widest transition-all duration-300 ${isCalendar ? 'font-black text-emerald-600 dark:text-emerald-400 scale-105' : 'font-bold text-slate-400'}`}>Escala</span>
          </button>

          <div className="relative flex-1 flex flex-col items-center -top-4">
            <button 
                onClick={() => onTabChange('availability')}
                className={`w-14 h-14 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-all duration-300 active:scale-90 border-4 border-[#f8fafc] dark:border-[#020617] ${
                    isAvailability 
                    ? 'bg-emerald-500 text-white rotate-6' 
                    : 'bg-slate-800 dark:bg-slate-700 text-slate-400'
                }`}
            >
                <CalendarCheck size={28} strokeWidth={2.5} />
            </button>
            <span className={`text-[10px] uppercase tracking-widest mt-2 font-black transition-colors ${isAvailability ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                Agenda
            </span>
          </div>

          <button onClick={() => onTabChange('announcements')} className="flex flex-col items-center justify-center flex-1 h-full gap-1 group">
             <div className={`p-2 rounded-2xl transition-all duration-400 ${isAnnouncements ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 -translate-y-1' : 'text-slate-400'}`}>
                <Megaphone size={22} strokeWidth={isAnnouncements ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] uppercase tracking-widest transition-all duration-300 ${isAnnouncements ? 'font-black text-emerald-600 dark:text-emerald-400 scale-105' : 'font-bold text-slate-400'}`}>Avisos</span>
          </button>

          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center justify-center flex-1 h-full gap-1 group">
             <div className="p-2 rounded-2xl text-slate-400 transition-colors">
                <Menu size={22} />
             </div>
             <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Menu</span>
          </button>

        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      
      {sidebarOpen && (
        <div className="fixed inset-0 z-[95] bg-slate-950/40 backdrop-blur-sm lg:hidden transition-opacity duration-500" onClick={() => setSidebarOpen(false)} />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-[100] w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-r border-slate-200/50 dark:border-slate-800/50 transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-2xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-6 py-8 shrink-0">
           <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20 text-white shrink-0 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
                  {imgError ? (
                      <Layout size={24} className="relative z-10" />
                  ) : (
                      <img 
                        src="https://i.ibb.co/jPKNYLQ2/icon.png" 
                        alt="Logo" 
                        className="w-full h-full object-cover relative z-10 scale-90" 
                        onError={() => setImgError(true)} 
                      />
                  )}
               </div>
               
               <div className="flex-1 min-w-0 relative" ref={ministryMenuRef}>
                 <button 
                    onClick={() => setMinistryMenuOpen(!ministryMenuOpen)}
                    className="flex flex-col items-start w-full group cursor-pointer transition-all"
                 >
                     <div className="flex items-center gap-1 w-full overflow-hidden">
                        {title ? (
                            <h1 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight uppercase">{title}</h1>
                        ) : (
                            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
                        )}
                        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 shrink-0 ${ministryMenuOpen ? 'rotate-180' : ''}`} />
                     </div>
                     <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Plataforma Pro</p>
                 </button>

                 {ministryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-slide-up ring-1 ring-black/5 divide-y divide-slate-100 dark:divide-slate-700">
                       <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/50">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meus Ministérios</p>
                       </div>
                       
                       <div className="max-h-60 overflow-y-auto custom-scrollbar">
                         {currentUser?.allowedMinistries?.filter(isValidMinistryId).map(mid => {
                             const isCurrent = currentMinistryId === mid;
                             const config = availableMinistries.find(m => m.id === mid);
                             const displayLabel = config ? config.label : 'Carregando...';

                             return (
                                 <button
                                     key={mid}
                                     onClick={() => {
                                         if (onSwitchMinistry) onSwitchMinistry(mid);
                                         setMinistryMenuOpen(false);
                                     }}
                                     className={`w-full text-left px-5 py-3.5 text-sm font-bold flex items-center justify-between transition-colors ${isCurrent ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                 >
                                     <span className="truncate pr-2">{displayLabel}</span>
                                     {isCurrent && <Check size={16} strokeWidth={3} />}
                                 </button>
                             )
                         })}
                       </div>
                       
                       {onOpenJoinMinistry && (
                           <button
                               onClick={() => {
                                   setMinistryMenuOpen(false);
                                   onOpenJoinMinistry();
                               }}
                               className="w-full text-left px-5 py-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                           >
                               <PlusCircle size={14} /> Novo Ministério
                           </button>
                       )}
                   </div>
                 )}
               </div>
               
               <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-8">
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Essenciais</p>
            <div className="space-y-1">
                {mainNavItems.map(item => renderNavButton(item))}
            </div>
          </div>

          {managementNavItems.length > 0 && (
            <div>
                <p className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Administração</p>
                <div className="space-y-1">
                    {managementNavItems.map(item => renderNavButton(item))}
                </div>
            </div>
          )}

          {currentUser?.isSuperAdmin && (
              <div>
                  <p className="px-3 text-[10px] font-black text-violet-500 uppercase tracking-[0.2em] mb-4">Global</p>
                  <button
                    onClick={() => { onTabChange('super-admin'); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 text-sm font-black uppercase tracking-tight rounded-2xl transition-all duration-300 ${
                      currentTab === 'super-admin'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 hover:text-violet-600'
                    }`}
                  >
                    <Shield size={18} />
                    <span className="flex-1 text-left">Super Admin</span>
                  </button>
              </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-md m-4 rounded-[2rem]">
            <button 
                onClick={() => onTabChange('profile')}
                className="flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all group"
            >
                {renderUserAvatar("w-10 h-10")}
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-black text-slate-800 dark:text-white truncate uppercase tracking-tight">{currentUser?.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        {currentUser?.role === 'admin' ? 'Administrador' : 'Membro'}
                    </p>
                </div>
                <Settings size={16} className="text-slate-400 group-hover:rotate-45 transition-transform" />
            </button>
            
            <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                    onClick={onLogout} 
                    className="flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors"
                >
                    <LogOut size={12} /> Sair
                </button>
                <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-500/10 hover:bg-slate-500/20 rounded-xl transition-colors"
                >
                    {themeMode === 'dark' ? <Sun size={12} /> : <Moon size={12} />} Modo
                </button>
            </div>
            
            {onInstall && !isStandalone && (
                <button 
                    onClick={onInstall}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                    <Download size={12} /> Instalar
                </button>
            )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 max-w-full bg-transparent overflow-hidden relative">
        
        <header className="lg:hidden h-16 px-4 flex items-center justify-between sticky top-0 z-30 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg text-white">
                    <Layout size={18} />
                </div>
                <h1 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tighter truncate max-w-[120px]">{activeLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
                <NotificationCenter 
                    notifications={notifications} 
                    ministryId={currentUser?.ministryId || null} 
                    onNotificationsUpdate={onNotificationsUpdate} 
                    onNavigate={(tab) => onTabChange(tab)}
                    onSwitchMinistry={onSwitchMinistry}
                />
                <button onClick={() => onTabChange('profile')}>
                    {renderUserAvatar("w-9 h-9")}
                </button>
            </div>
        </header>

        <header className="hidden lg:flex h-20 px-10 items-center justify-between sticky top-0 z-30 bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50">
             <div className="flex items-center gap-4">
                 <div className="text-slate-400 p-2.5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    {ActiveIcon}
                 </div>
                 <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
                 <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider leading-none">
                        {activeLabel}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">{title || 'OBPC Gestão'}</p>
                 </div>
             </div>
             
             <div className="flex items-center gap-6">
                 <div className="flex items-center gap-3">
                    <NotificationCenter 
                        notifications={notifications} 
                        ministryId={currentUser?.ministryId || null} 
                        onNotificationsUpdate={onNotificationsUpdate}
                        onNavigate={(tab) => onTabChange(tab)}
                        onSwitchMinistry={onSwitchMinistry}
                    />
                    <button 
                        onClick={handleHardReload} 
                        className="p-3 text-slate-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-slate-900 rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                        title="Sincronizar Dados"
                    >
                        <RefreshCw size={20} className={isUpdating ? "animate-spin" : ""} />
                    </button>
                 </div>
                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>
                 <button onClick={() => onTabChange('profile')} className="flex items-center gap-3 group">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">{currentUser?.name}</p>
                        <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">Perfil Ativo</p>
                    </div>
                    {renderUserAvatar("w-10 h-10")}
                 </button>
             </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-10 custom-scrollbar relative">
            <div className="max-w-6xl mx-auto w-full min-h-full pb-32">
                {children}
            </div>
        </div>

        <MobileBottomNav />

      </main>
    </div>
  );
};
