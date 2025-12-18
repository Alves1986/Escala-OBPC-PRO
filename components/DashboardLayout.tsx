
import React, { ReactNode, useState, useRef } from 'react';
import { Menu, Sun, Moon, LogOut, Layout, Download, RefreshCw, X, ChevronRight, User as UserIcon, ChevronDown, Check, PlusCircle, Settings, ShieldCheck, Sparkles, Building2, Home, Calendar, Megaphone, CalendarCheck } from 'lucide-react';
import { User, AppNotification } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAppStore } from '../store/appStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  children: ReactNode;
  onLogout: () => void;
  title: string;
  currentTab: string;
  onTabChange: (tab: string) => void;
  mainNavItems: NavItem[];
  managementNavItems: NavItem[];
  notifications: AppNotification[];
  onNotificationsUpdate: (n: AppNotification[]) => void;
  onInstall?: () => void;
  isStandalone?: boolean;
  onSwitchMinistry?: (id: string) => void;
  onOpenJoinMinistry?: () => void; 
}

const getMinistryLabel = (id: string) => {
    const clean = id.trim().toLowerCase();
    if (clean === 'midia') return 'Mídia / Comunicação';
    if (clean === 'louvor') return 'Louvor / Adoração';
    if (clean === 'infantil') return 'Ministério Infantil';
    if (clean === 'recepcao') return 'Recepção / Diaconia';
    return id.charAt(0).toUpperCase() + id.slice(1);
};

export const DashboardLayout: React.FC<Props> = ({ 
  children, onLogout, title,
  currentTab, onTabChange, mainNavItems, managementNavItems, notifications, onNotificationsUpdate,
  onInstall, isStandalone, onSwitchMinistry, onOpenJoinMinistry
}) => {
  const { currentUser, themeMode, setThemeMode, sidebarOpen, setSidebarOpen, ministryId: activeMinistryId } = useAppStore();
  const [imgError, setImgError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ministryMenuOpen, setMinistryMenuOpen] = useState(false);
  const ministryMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(ministryMenuRef, () => {
    if (ministryMenuOpen) setMinistryMenuOpen(false);
  });

  const activeItem = [...mainNavItems, ...managementNavItems].find(item => item.id === currentTab);
  const activeLabel = activeItem ? activeItem.label : (currentTab === 'profile' ? 'Meu Perfil' : 'Visão Geral');
  const ActiveIcon = activeItem ? activeItem.icon : <Layout size={20}/>;

  const toggleTheme = () => {
      if (themeMode === 'system') setThemeMode('light');
      else if (themeMode === 'light') setThemeMode('dark');
      else setThemeMode('system');
  };

  const handleHardReload = async () => {
    setIsUpdating(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // --- MODERN NAV BUTTON DESIGN (Pill Style) ---
  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group mb-1 ${
          isActive 
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' 
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
        }`}
      >
        <span className={`transition-colors duration-200 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`}>
          {React.cloneElement(item.icon as React.ReactElement, { size: 18, strokeWidth: isActive ? 2.5 : 2 })}
        </span>
        <span className="flex-1 text-left tracking-tight">{item.label}</span>
        {isActive && (
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50" />
        )}
      </button>
    );
  };

  const renderUserAvatar = (size: string = "w-8 h-8") => {
    if (currentUser?.avatar_url) {
      return (
        <img src={currentUser.avatar_url} alt={currentUser.name} className={`${size} rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm`} />
      );
    }
    return (
      <div className={`${size} rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold text-xs border border-zinc-200 dark:border-zinc-700`}>
         {currentUser?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // --- MOBILE BOTTOM NAV COMPONENT ---
  const MobileBottomNav = () => {
    const isDashboard = currentTab === 'dashboard';
    const isCalendar = currentTab === 'calendar';
    const isAvailability = currentTab === 'availability';
    const isAnnouncements = currentTab === 'announcements';

    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-2xl border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-end h-[68px] pb-2 px-1">
          
          <button onClick={() => onTabChange('dashboard')} className="flex flex-col items-center justify-end w-full h-full pb-1 group">
             <div className={`p-1.5 rounded-2xl transition-all duration-300 mb-0.5 ${isDashboard ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 -translate-y-1' : 'text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'}`}>
                <Home size={24} strokeWidth={isDashboard ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] transition-colors duration-300 ${isDashboard ? 'font-bold text-teal-700 dark:text-teal-400 translate-y-[-2px]' : 'font-medium text-zinc-400 dark:text-zinc-500'}`}>Início</span>
          </button>

          <button onClick={() => onTabChange('calendar')} className="flex flex-col items-center justify-end w-full h-full pb-1 group">
             <div className={`p-1.5 rounded-2xl transition-all duration-300 mb-0.5 ${isCalendar ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 -translate-y-1' : 'text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'}`}>
                <Calendar size={24} strokeWidth={isCalendar ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] transition-colors duration-300 ${isCalendar ? 'font-bold text-teal-700 dark:text-teal-400 translate-y-[-2px]' : 'font-medium text-zinc-400 dark:text-zinc-500'}`}>Escala</span>
          </button>

          {/* Central Action Button */}
          <div className="relative -top-6 group">
            <button 
                onClick={() => onTabChange('availability')}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-teal-600/30 transition-all duration-300 active:scale-95 border-[4px] border-[#f8fafc] dark:border-[#09090b] ${
                    isAvailability 
                    ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white scale-110 ring-2 ring-teal-500/20' 
                    : 'bg-zinc-800 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-400 hover:bg-zinc-700'
                }`}
            >
                <CalendarCheck size={26} strokeWidth={2.5} />
            </button>
            <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold transition-colors ${isAvailability ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                Dispo
            </span>
          </div>

          <button onClick={() => onTabChange('announcements')} className="flex flex-col items-center justify-end w-full h-full pb-1 group">
             <div className={`p-1.5 rounded-2xl transition-all duration-300 mb-0.5 ${isAnnouncements ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 -translate-y-1' : 'text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'}`}>
                <Megaphone size={24} strokeWidth={isAnnouncements ? 2.5 : 2} />
             </div>
             <span className={`text-[10px] transition-colors duration-300 ${isAnnouncements ? 'font-bold text-teal-700 dark:text-teal-400 translate-y-[-2px]' : 'font-medium text-zinc-400 dark:text-zinc-500'}`}>Avisos</span>
          </button>

          <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center justify-end w-full h-full pb-1 group">
             <div className="p-1.5 rounded-2xl text-zinc-400 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors mb-0.5">
                <Menu size={24} />
             </div>
             <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 transition-colors">Menu</span>
          </button>

        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#09090b] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-teal-500/20 selection:text-teal-700 dark:selection:text-teal-300">
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[95] bg-zinc-900/40 backdrop-blur-sm lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Modern & Minimalist */}
      <aside 
        className={`fixed inset-y-0 left-0 z-[100] w-72 bg-white/95 dark:bg-[#0c0c0e]/95 backdrop-blur-2xl border-r border-zinc-200/60 dark:border-zinc-800/60 transform transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-2xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        
        {/* Sidebar Header */}
        <div className="px-5 py-6 shrink-0">
           <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white shrink-0">
                  {imgError ? (
                      <Layout size={20} />
                  ) : (
                      <img 
                        src="https://i.ibb.co/jPKNYLQ2/icon.png" 
                        alt="Logo" 
                        className="w-full h-full object-cover opacity-90 rounded-xl" 
                        onError={() => setImgError(true)} 
                      />
                  )}
               </div>
               
               <div className="flex-1 min-w-0 relative" ref={ministryMenuRef}>
                 <button 
                    onClick={() => setMinistryMenuOpen(!ministryMenuOpen)}
                    className="flex items-center justify-between w-full group cursor-pointer p-1 -ml-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                 >
                     <div className="text-left overflow-hidden">
                        <h1 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight truncate leading-tight">{title}</h1>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-medium">Espaço de Trabalho</p>
                     </div>
                     <ChevronDown size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200" style={{ transform: ministryMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                 </button>

                 {/* Dropdown Menu - Ministry Switcher */}
                 {ministryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#121214] rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden animate-slide-up ring-1 ring-black/5 divide-y divide-zinc-100 dark:divide-zinc-800/50 min-w-[240px]">
                       <div className="px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/50">
                           <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Meus Ministérios</p>
                       </div>
                       {currentUser?.allowedMinistries?.map(mid => {
                           const isCurrent = activeMinistryId === mid;
                           return (
                               <button
                                   key={mid}
                                   onClick={() => {
                                       if (onSwitchMinistry) onSwitchMinistry(mid);
                                       setMinistryMenuOpen(false);
                                   }}
                                   className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${isCurrent ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}`}
                               >
                                   <span className={`${isCurrent ? 'text-zinc-900 dark:text-white font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>{getMinistryLabel(mid)}</span>
                                   {isCurrent && <Check size={14} className="text-teal-600 dark:text-teal-400" />}
                               </button>
                           )
                       })}
                       
                       {onOpenJoinMinistry && (
                           <button
                               onClick={() => {
                                   setMinistryMenuOpen(false);
                                   onOpenJoinMinistry();
                               }}
                               className="w-full text-left px-4 py-3 text-xs flex items-center gap-2 text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition-colors border-t border-zinc-100 dark:border-zinc-800"
                           >
                               <PlusCircle size={14} /> Entrar em outro Ministério
                           </button>
                       )}
                   </div>
                 )}
               </div>
               
               <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X size={20}/></button>
           </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-8">
          <div>
            <p className="px-3 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Menu Principal</p>
            <div className="space-y-0.5">
                {mainNavItems.map(item => renderNavButton(item))}
            </div>
          </div>

          {managementNavItems.length > 0 && (
            <div>
                <p className="px-3 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Gerenciamento</p>
                <div className="space-y-0.5">
                    {managementNavItems.map(item => renderNavButton(item))}
                </div>
            </div>
          )}
        </div>

        {/* Footer Profile - Refined */}
        <div className="p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/10 backdrop-blur-sm">
            <button 
                onClick={() => onTabChange('profile')}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800/80 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50 transition-all group"
            >
                {renderUserAvatar("w-9 h-9")}
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-zinc-800 dark:text-white truncate">{currentUser?.name}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        {currentUser?.role === 'admin' ? 'Admin' : 'Membro'} <span className="w-1 h-1 rounded-full bg-green-500"></span>
                    </p>
                </div>
                <Settings size={16} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
            </button>
            
            <div className="grid grid-cols-2 gap-2 mt-3">
                <button 
                    onClick={onLogout} 
                    className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-red-600 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-900/30 rounded-lg transition-colors"
                >
                    <LogOut size={12} /> Sair
                </button>
                <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-colors"
                >
                    {themeMode === 'dark' ? <Sun size={12} /> : <Moon size={12} />} Tema
                </button>
            </div>
            
            {onInstall && !isStandalone && (
                <button 
                    onClick={onInstall}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-[10px] font-bold shadow hover:opacity-90 transition-opacity"
                >
                    <Download size={12} /> Instalar App
                </button>
            )}
            
            {isUpdating && (
                <div className="mt-2 text-center text-[9px] text-zinc-400 flex items-center justify-center gap-1 animate-pulse">
                    <RefreshCw size={8} className="animate-spin" /> Atualizando...
                </div>
            )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-w-0 max-w-full bg-transparent transition-all duration-300 overflow-hidden relative`}>
        
        {/* Mobile Header - Sticky Glass */}
        <header className="lg:hidden h-16 px-4 flex items-center justify-between sticky top-0 z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md text-white">
                    <Layout size={16} />
                </div>
                
                <div className="flex items-center gap-2 overflow-hidden">
                    <h1 className="font-bold text-sm text-zinc-800 dark:text-white truncate">{activeLabel}</h1>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <NotificationCenter 
                    notifications={notifications} 
                    ministryId={currentUser?.ministryId || null} 
                    onNotificationsUpdate={onNotificationsUpdate} 
                    onNavigate={(tab) => onTabChange(tab)}
                    onSwitchMinistry={onSwitchMinistry}
                />
                <button onClick={() => onTabChange('profile')}>
                    {renderUserAvatar("w-8 h-8")}
                </button>
            </div>
        </header>

        {/* Desktop Top Bar - Minimalist */}
        <header className="hidden lg:flex h-16 px-8 items-center justify-between sticky top-0 z-30 bg-[#f8fafc]/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all">
             <div className="flex items-center gap-3">
                 <div className="text-zinc-400 dark:text-zinc-500">
                    {ActiveIcon}
                 </div>
                 <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                 <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-none tracking-tight">
                    {activeLabel}
                 </h2>
             </div>
             
             <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                    <NotificationCenter 
                        notifications={notifications} 
                        ministryId={currentUser?.ministryId || null} 
                        onNotificationsUpdate={onNotificationsUpdate}
                        onNavigate={(tab) => onTabChange(tab)}
                        onSwitchMinistry={onSwitchMinistry}
                    />
                    <button 
                        onClick={handleHardReload} 
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Recarregar Sistema"
                    >
                        <RefreshCw size={18} className={isUpdating ? "animate-spin" : ""} />
                    </button>
                 </div>
             </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 custom-scrollbar relative w-full">
            <div className="max-w-6xl mx-auto w-full min-h-full pb-32 lg:pb-12">
                {children}
            </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

      </main>
    </div>
  );
};
