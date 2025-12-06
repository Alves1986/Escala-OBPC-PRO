
import React, { ReactNode, useState } from 'react';
import { Menu, Sun, Moon, LogOut, Layout, Download, RefreshCw, X, ChevronRight, User as UserIcon } from 'lucide-react';
import { User, AppNotification } from '../types';
import { NotificationCenter } from './NotificationCenter';

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
  // Props de Notificação
  notifications: AppNotification[];
  onNotificationsUpdate: (n: AppNotification[]) => void;
  // Props de PWA
  onInstall?: () => void;
  isStandalone?: boolean;
}

export const DashboardLayout: React.FC<Props> = ({ 
  children, sidebarOpen, setSidebarOpen, theme, toggleTheme, onLogout, title, isConnected, currentUser,
  currentTab, onTabChange, mainNavItems, managementNavItems, notifications, onNotificationsUpdate,
  onInstall, isStandalone
}) => {
  const [imgError, setImgError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
        }`}
      >
        <span className={isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-500 group-hover:text-zinc-800 dark:group-hover:text-white transition-colors'}>
          {item.icon}
        </span>
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <ChevronRight size={14} className="opacity-50" />}
      </button>
    );
  };

  const renderUserAvatar = () => {
    if (currentUser?.avatar_url) {
      return (
        <img src={currentUser.avatar_url} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700" />
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
         {currentUser?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderMobileAvatar = () => {
    if (currentUser?.avatar_url) {
        return (
          <img src={currentUser.avatar_url} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-zinc-300 dark:border-zinc-700" />
        );
      }
      return (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
           {currentUser?.name.charAt(0)}
        </div>
      );
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 font-sans`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-xl lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-zinc-200 dark:border-zinc-800/50 shrink-0">
           {imgError ? (
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/20"><Layout size={20} /></div>
           ) : (
             <img src="/app-icon.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-lg" onError={() => setImgError(true)} />
           )}
           <div>
             <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight leading-none">{title}</h1>
             <span className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">Painel Administrativo</span>
           </div>
           <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-zinc-500"><X size={24}/></button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar space-y-6">
          
          {/* MENU PRINCIPAL */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider mb-2">Menu Principal</p>
            {mainNavItems.map(renderNavButton)}
          </div>

          {/* GESTÃO (Apenas Admin) */}
          {currentUser?.role === 'admin' && (
            <div className="space-y-1">
              <p className="px-3 text-xs font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider mb-2">Gestão</p>
              {managementNavItems.map(renderNavButton)}
            </div>
          )}

        </div>

        {/* Footer User Profile & Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-3 shrink-0">
           
           {/* Install App Button - Only if NOT standalone and Available */}
           {!isStandalone && onInstall && (
             <button 
               onClick={onInstall}
               className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xs font-bold mb-2"
             >
               <Download size={16} /> Instalar Aplicativo
             </button>
           )}

           {/* User Card (Clickable to Profile) */}
           {currentUser && (
             <button 
               onClick={() => { onTabChange('profile'); setSidebarOpen(false); }}
               className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                 currentTab === 'profile' 
                   ? 'bg-white dark:bg-zinc-800 border-blue-500/50 shadow-md' 
                   : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-700'
               }`}
             >
                {renderUserAvatar()}
                <div className="flex-1 min-w-0 text-left">
                   <p className="text-sm font-bold text-zinc-800 dark:text-white truncate">{currentUser.name}</p>
                   <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{currentUser.role === 'admin' ? 'Administrador' : 'Membro'}</p>
                </div>
                {currentTab !== 'profile' && <ChevronRight size={14} className="text-zinc-400" />}
             </button>
           )}

           <div className="grid grid-cols-2 gap-2">
              <button onClick={toggleTheme} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                 {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                 <span className="text-[10px] mt-1">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
              </button>
              
              <button onClick={onLogout} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400">
                 <LogOut size={18} />
                 <span className="text-[10px] mt-1">Sair</span>
              </button>
           </div>

           {/* System Status Row */}
           <div className="flex items-center justify-between px-1 pt-1">
              <div className={`flex items-center gap-1.5 text-[10px] font-medium ${isConnected ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                 <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                 {isConnected ? 'Online' : 'Offline'}
              </div>
              
              <button onClick={handleHardReload} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-blue-500 transition-colors">
                  <RefreshCw size={10} className={isUpdating ? 'animate-spin' : ''} />
                  {isUpdating ? 'v2.0' : 'v2.0'}
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 lg:hidden bg-white dark:bg-zinc-900 shrink-0 transition-colors duration-300">
           <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <Menu size={24} />
              </button>
              <span className="font-bold text-zinc-800 dark:text-zinc-100">{title}</span>
           </div>
           
           <div className="flex items-center gap-2">
               {/* Install Button Mobile Header */}
               {!isStandalone && onInstall && (
                 <button onClick={onInstall} className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-1 animate-pulse" title="Instalar App">
                    <Download size={20} />
                 </button>
               )}

               {/* Notificações Mobile */}
               {currentUser && (
                 <NotificationCenter 
                    notifications={notifications} 
                    ministryId={currentUser.ministryId || null} 
                    onNotificationsUpdate={onNotificationsUpdate} 
                    onNavigate={onTabChange}
                 />
               )}
               
               {currentUser && (
                <button onClick={() => onTabChange('profile')} className="flex items-center justify-center ml-2">
                    {renderMobileAvatar()}
                </button>
               )}
           </div>
        </header>

        {/* Desktop Top Bar (Optional, for notifications) */}
        <div className="hidden lg:flex justify-end items-center px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
             {currentUser && (
               <NotificationCenter 
                  notifications={notifications} 
                  ministryId={currentUser.ministryId || null} 
                  onNotificationsUpdate={onNotificationsUpdate} 
                  onNavigate={onTabChange}
               />
             )}
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};
