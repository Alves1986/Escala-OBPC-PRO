
import React, { ReactNode, useState, useRef } from 'react';
import { Menu, Sun, Moon, LogOut, Layout, Download, RefreshCw, X, ChevronRight, User as UserIcon, ChevronDown, Check, PlusCircle, Settings, ShieldCheck } from 'lucide-react';
import { User, AppNotification } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { useClickOutside } from '../hooks/useClickOutside';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface Props {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onLogout: () => void;
  title: string;
  isConnected: boolean;
  currentUser?: User | null;
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
  children, sidebarOpen, setSidebarOpen, theme, toggleTheme, onLogout, title, isConnected, currentUser,
  currentTab, onTabChange, mainNavItems, managementNavItems, notifications, onNotificationsUpdate,
  onInstall, isStandalone, onSwitchMinistry, onOpenJoinMinistry
}) => {
  const [imgError, setImgError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ministryMenuOpen, setMinistryMenuOpen] = useState(false);
  const ministryMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(ministryMenuRef, () => {
    if (ministryMenuOpen) setMinistryMenuOpen(false);
  });

  const handleHardReload = async () => {
    setIsUpdating(true);
    setTimeout(async () => {
      try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) await registration.unregister();
        }
        if ('caches' in window) {
             const keys = await caches.keys();
             await Promise.all(keys.map(key => caches.delete(key)));
        }
      } catch (e) {
        console.error("Erro geral na atualização:", e);
      } finally {
        window.location.reload();
      }
    }, 500);
  };

  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group relative overflow-hidden mb-1.5 ${
          isActive 
            ? 'text-white shadow-lg shadow-teal-500/25 bg-gradient-to-r from-teal-600 to-emerald-600' 
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
        }`}
      >
        <span className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`}>
          {item.icon}
        </span>
        <span className="flex-1 text-left relative z-10">{item.label}</span>
      </button>
    );
  };

  const renderUserAvatar = () => {
    if (currentUser?.avatar_url) {
      return (
        <img src={currentUser.avatar_url} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-zinc-700 shadow-sm transition-transform group-hover:scale-105" />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white dark:border-zinc-700 transition-transform group-hover:scale-105">
         {currentUser?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderMobileAvatar = () => {
    if (currentUser?.avatar_url) {
        return (
          <img src={currentUser.avatar_url} alt={currentUser.name} className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm" />
        );
      }
      return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
           {currentUser?.name.charAt(0)}
        </div>
      );
    }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#09090b] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-teal-500 selection:text-white">
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-[2px] lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation - Glassmorphism Profissional */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/80 dark:bg-[#0c0c0e]/80 backdrop-blur-xl border-r border-zinc-200/60 dark:border-zinc-800/60 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-2xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        
        {/* Header */}
        <div className="relative px-6 py-6 shrink-0">
           <div className="flex items-center gap-3">
               {/* Updated Logo Container: Matches Loading Screen Style (Clean/Professional) */}
               <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-md border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
                  {imgError ? (
                      <div className="bg-gradient-to-br from-teal-500 to-emerald-600 w-full h-full flex items-center justify-center text-white">
                          <Layout size={20} />
                      </div>
                  ) : (
                      <img 
                        src={theme === 'dark' ? "https://i.ibb.co/jPKNYLQ2/icon.png" : "https://i.ibb.co/nsFR8zNG/icon1.png"} 
                        alt="Logo" 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)} 
                      />
                  )}
               </div>
               
               <div className="flex-1 min-w-0 relative" ref={ministryMenuRef}>
                 <button 
                    onClick={() => setMinistryMenuOpen(!ministryMenuOpen)}
                    className="flex items-center gap-1.5 w-full group cursor-pointer hover:opacity-80 transition-opacity"
                 >
                     <h1 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight leading-tight truncate">{title}</h1>
                     <ChevronDown size={14} className="text-zinc-400 transition-transform duration-200" style={{ transform: ministryMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                 </button>
                 <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] text-zinc-400 font-semibold tracking-wide uppercase">Online</span>
                 </div>

                 {/* Dropdown Menu - Ministry Switcher */}
                 {ministryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden animate-slide-up ring-1 ring-black/5 divide-y divide-zinc-100 dark:divide-zinc-800 min-w-[200px]">
                       <p className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/50 tracking-wider">Trocar Ministério</p>
                       {currentUser?.allowedMinistries?.map(mid => {
                           const isCurrent = currentUser.ministryId === mid;
                           return (
                               <button
                                   key={mid}
                                   onClick={() => {
                                       if (onSwitchMinistry) onSwitchMinistry(mid);
                                       setMinistryMenuOpen(false);
                                   }}
                                   className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${isCurrent ? 'text-teal-600 dark:text-teal-400 font-bold bg-teal-50/50 dark:bg-teal-900/10' : 'text-zinc-600 dark:text-zinc-300'}`}
                               >
                                   {getMinistryLabel(mid)}
                                   {isCurrent && <Check size={16} className="text-teal-500" />}
                               </button>
                           )
                       })}
                       
                       {onOpenJoinMinistry && (
                           <button
                               onClick={() => {
                                   setMinistryMenuOpen(false);
                                   onOpenJoinMinistry();
                               }}
                               className="w-full text-left px-4 py-3 text-sm flex items-center gap-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 font-bold transition-colors"
                           >
                               <PlusCircle size={16} /> Entrar em outro Ministério
                           </button>
                       )}
                   </div>
                 )}
               </div>
               
               <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X size={20}/></button>
           </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2 px-4 custom-scrollbar">
          <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 mt-2">Menu Principal</p>
          <div className="space-y-0.5 mb-6">
            {mainNavItems.map(item => renderNavButton(item))}
          </div>

          {managementNavItems.length > 0 && (
            <>
                <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Administração</p>
                <div className="space-y-0.5 mb-6">
                    {managementNavItems.map(item => renderNavButton(item))}
                </div>
            </>
          )}
        </div>

        {/* Footer Profile */}
        <div className="p-4 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/80 dark:bg-zinc-900/30 backdrop-blur-sm">
            <button 
                onClick={() => onTabChange('profile')}
                className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-white dark:hover:bg-zinc-800/80 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group"
            >
                {renderUserAvatar()}
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-zinc-800 dark:text-white truncate">{currentUser?.name}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1">
                        {currentUser?.role === 'admin' && <ShieldCheck size={10} className="text-teal-500"/>}
                        {currentUser?.email}
                    </p>
                </div>
                <div className="p-1.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
                    <Settings size={16} />
                </div>
            </button>
            <div className="flex gap-2 mt-3">
                <button 
                    onClick={onLogout} 
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                >
                    <LogOut size={14} /> Sair
                </button>
                <button
                    onClick={toggleTheme}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 shadow-sm hover:shadow"
                >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Tema
                </button>
            </div>
            
            {onInstall && !isStandalone && (
                <button 
                    onClick={onInstall}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold shadow-md hover:shadow-lg hover:translate-y-[-1px] transition-all"
                >
                    <Download size={14} /> Instalar App
                </button>
            )}
            
            {isUpdating && (
                <div className="mt-2 text-center text-[10px] text-zinc-400 flex items-center justify-center gap-1 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" /> Atualizando...
                </div>
            )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-w-0 bg-transparent transition-all duration-300 overflow-hidden relative`}>
        
        {/* Mobile Header - Sticky Glass */}
        <header className="lg:hidden h-16 px-4 flex items-center justify-between sticky top-0 z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg active:scale-95 transition-all">
                    <Menu size={24} />
                </button>
                <h1 className="font-bold text-lg text-zinc-900 dark:text-white truncate max-w-[180px]">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
                <NotificationCenter 
                    notifications={notifications} 
                    ministryId={currentUser?.ministryId || null} 
                    onNotificationsUpdate={onNotificationsUpdate} 
                    onNavigate={(tab) => onTabChange(tab)}
                />
                <button onClick={() => onTabChange('profile')}>
                    {renderMobileAvatar()}
                </button>
            </div>
        </header>

        {/* Desktop Top Bar - Minimalist */}
        <header className="hidden lg:flex h-20 px-8 items-center justify-between sticky top-0 z-30 bg-[#f8fafc]/90 dark:bg-[#09090b]/90 backdrop-blur-sm">
             <div className="flex flex-col justify-center">
                 <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">
                     <span>Painel</span>
                     <ChevronRight size={10} />
                     <span className="text-teal-600 dark:text-teal-400">{currentTab.replace('-', ' ')}</span>
                 </div>
                 <h2 className="text-xl font-bold text-zinc-900 dark:text-white capitalize tracking-tight">
                    {currentTab === 'dashboard' ? 'Visão Geral' : currentTab.replace('-', ' ')}
                 </h2>
             </div>
             
             <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-1.5 rounded-full shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 pr-4">
                 <div className="pl-2">
                    <NotificationCenter 
                        notifications={notifications} 
                        ministryId={currentUser?.ministryId || null} 
                        onNotificationsUpdate={onNotificationsUpdate}
                        onNavigate={(tab) => onTabChange(tab)}
                    />
                 </div>
                 <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800"></div>
                 <button 
                    onClick={handleHardReload} 
                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    title="Recarregar Sistema"
                 >
                    <RefreshCw size={18} className={isUpdating ? "animate-spin" : ""} />
                 </button>
             </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:px-8 lg:pb-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto w-full h-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};
