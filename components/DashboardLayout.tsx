
import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { Menu, Sun, Moon, LogOut, Layout, Download, RefreshCw, X, ChevronRight, User as UserIcon, ChevronDown, Check, PlusCircle, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  
  // Estado para controlar se o menu está recolhido (apenas desktop)
  const [isCollapsed, setIsCollapsed] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('sidebar_collapsed') === 'true';
      }
      return false;
  });

  const ministryMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(ministryMenuRef, () => {
    if (ministryMenuOpen) setMinistryMenuOpen(false);
  });

  const toggleCollapse = () => {
      const newState = !isCollapsed;
      setIsCollapsed(newState);
      localStorage.setItem('sidebar_collapsed', String(newState));
  };

  const activeItem = [...mainNavItems, ...managementNavItems].find(item => item.id === currentTab);
  const activeLabel = activeItem ? activeItem.label : (currentTab === 'profile' ? 'Meu Perfil' : 'Visão Geral');
  const ActiveIcon = activeItem ? activeItem.icon : <Layout size={20}/>;

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

  // --- PROFESSIONAL NAV BUTTON DESIGN ---
  const renderNavButton = (item: NavItem) => {
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
        title={isCollapsed ? item.label : ''} // Tooltip nativo quando recolhido
        className={`relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group mb-1 ${
          isActive 
            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700' 
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
        } ${isCollapsed ? 'justify-center' : ''}`}
      >
        <span className={`transition-colors duration-200 shrink-0 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`}>
          {React.cloneElement(item.icon as React.ReactElement, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
        </span>
        
        {!isCollapsed && (
            <span className="flex-1 text-left tracking-tight animate-fade-in truncate">{item.label}</span>
        )}
        
        {isActive && !isCollapsed && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
        {isActive && isCollapsed && <div className="absolute left-0 w-1 h-6 bg-teal-500 rounded-r-full" />}
      </button>
    );
  };

  const renderUserAvatar = () => {
    if (currentUser?.avatar_url) {
      return (
        <img src={currentUser.avatar_url} alt={currentUser.name} className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0" />
      );
    }
    return (
      <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold text-xs border border-zinc-200 dark:border-zinc-700 shrink-0">
         {currentUser?.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderMobileAvatar = () => {
    return renderUserAvatar();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#09090b] font-sans text-zinc-900 dark:text-zinc-100 selection:bg-teal-500 selection:text-white">
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Clean & Professional & Collapsible */}
      <aside 
        className={`
            fixed inset-y-0 left-0 z-50 
            bg-zinc-50/90 dark:bg-[#0c0c0e]/95 backdrop-blur-xl 
            border-r border-zinc-200/80 dark:border-zinc-800/80 
            transform transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] 
            flex flex-col shadow-2xl lg:shadow-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
            lg:translate-x-0 lg:static lg:inset-0
            ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}
            w-72
        `}
      >
        
        {/* Header */}
        <div className={`px-4 py-5 shrink-0 flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'}`}>
           <div className="flex items-center gap-3 w-full relative">
               <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0 transition-transform hover:scale-105">
                  {imgError ? (
                      <Layout size={18} className="text-zinc-500" />
                  ) : (
                      <img 
                        src="https://i.ibb.co/jPKNYLQ2/icon.png" 
                        alt="Logo" 
                        className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" 
                        onError={() => setImgError(true)} 
                      />
                  )}
               </div>
               
               {/* Dropdown Menu - Só mostra se não estiver recolhido (Desktop) ou sempre no Mobile */}
               <div className={`flex-1 min-w-0 relative transition-opacity duration-200 ${isCollapsed ? 'lg:hidden opacity-0 w-0' : 'opacity-100'}`} ref={ministryMenuRef}>
                 <button 
                    onClick={() => setMinistryMenuOpen(!ministryMenuOpen)}
                    className="flex items-center justify-between w-full group cursor-pointer p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                 >
                     <div className="text-left overflow-hidden">
                        <h1 className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight truncate">{title}</h1>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">Gerenciamento</p>
                     </div>
                     <ChevronDown size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200" style={{ transform: ministryMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                 </button>

                 {/* Dropdown Content */}
                 {ministryMenuOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden animate-slide-up ring-1 ring-black/5 divide-y divide-zinc-100 dark:divide-zinc-800 min-w-[220px]">
                       <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50">
                           <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Meus Ministérios</p>
                       </div>
                       {currentUser?.allowedMinistries?.map(mid => {
                           const isCurrent = currentUser.ministryId === mid;
                           return (
                               <button
                                   key={mid}
                                   onClick={() => {
                                       if (onSwitchMinistry) onSwitchMinistry(mid);
                                       setMinistryMenuOpen(false);
                                   }}
                                   className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${isCurrent ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''}`}
                               >
                                   <span className={`${isCurrent ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>{getMinistryLabel(mid)}</span>
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
                               className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 text-zinc-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                           >
                               <PlusCircle size={14} /> Entrar em outro Ministério
                           </button>
                       )}
                   </div>
                 )}
               </div>
               
               {/* Mobile Close Button */}
               <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><X size={20}/></button>
           </div>
        </div>

        {/* Toggle Collapse Button (Desktop Only) - Located at top right of sidebar or bottom */}
        <button 
            onClick={toggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-teal-500 rounded-full p-1 shadow-sm hover:shadow-md transition-all items-center justify-center w-6 h-6"
            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
            {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        {/* Navigation */}
        <div className={`flex-1 overflow-y-auto py-2 custom-scrollbar space-y-6 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          <div>
            {!isCollapsed && <p className="px-3 text-[10px] font-bold text-zinc-400/80 uppercase tracking-widest mb-2 animate-fade-in">Principal</p>}
            <div className="space-y-0.5">
                {mainNavItems.map(item => renderNavButton(item))}
            </div>
          </div>

          {managementNavItems.length > 0 && (
            <div>
                {!isCollapsed && <p className="px-3 text-[10px] font-bold text-zinc-400/80 uppercase tracking-widest mb-2 animate-fade-in">Administração</p>}
                {isCollapsed && <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-2 mx-2"></div>}
                <div className="space-y-0.5">
                    {managementNavItems.map(item => renderNavButton(item))}
                </div>
            </div>
          )}
        </div>

        {/* Footer Profile */}
        <div className={`p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 transition-all ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            <button 
                onClick={() => onTabChange('profile')}
                title="Meu Perfil"
                className={`flex items-center gap-3 w-full p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-all group shadow-sm hover:shadow ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
                {renderUserAvatar()}
                {!isCollapsed && (
                    <>
                        <div className="flex-1 min-w-0 text-left animate-fade-in">
                            <p className="text-xs font-bold text-zinc-800 dark:text-white truncate">{currentUser?.name}</p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                                {currentUser?.role === 'admin' ? 'Administrador' : 'Membro'}
                            </p>
                        </div>
                        <Settings size={14} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                    </>
                )}
            </button>
            
            <div className={`grid gap-2 mt-2 ${isCollapsed ? 'grid-cols-1 w-full' : 'grid-cols-2'}`}>
                <button 
                    onClick={onLogout} 
                    title={isCollapsed ? "Sair" : ""}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-red-600 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-900/30 rounded-lg transition-colors shadow-sm`}
                >
                    <LogOut size={12} /> {!isCollapsed && "Sair"}
                </button>
                <button
                    onClick={toggleTheme}
                    title={isCollapsed ? "Alternar Tema" : ""}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg transition-colors shadow-sm`}
                >
                    {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />} {!isCollapsed && "Tema"}
                </button>
            </div>
            
            {onInstall && !isStandalone && !isCollapsed && (
                <button 
                    onClick={onInstall}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-[10px] font-bold shadow hover:opacity-90 transition-opacity animate-fade-in"
                >
                    <Download size={12} /> Instalar App
                </button>
            )}
            
            {isUpdating && !isCollapsed && (
                <div className="mt-2 text-center text-[9px] text-zinc-400 flex items-center justify-center gap-1 animate-pulse">
                    <RefreshCw size={8} className="animate-spin" /> Atualizando...
                </div>
            )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-w-0 bg-transparent transition-all duration-300 overflow-hidden relative`}>
        
        {/* Mobile Header - Sticky Glass */}
        <header className="lg:hidden h-16 px-4 flex items-center justify-between sticky top-0 z-30 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg active:scale-95 transition-all">
                    <Menu size={20} />
                </button>
                
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-zinc-300 dark:text-zinc-700 h-4 w-px bg-current block"></span>
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
                    {renderMobileAvatar()}
                </button>
            </div>
        </header>

        {/* Desktop Top Bar - Professional & Clean */}
        <header className="hidden lg:flex h-16 px-8 items-center justify-between sticky top-0 z-30 bg-[#f8fafc]/80 dark:bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/60 transition-all">
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:px-8 lg:py-6 custom-scrollbar">
            <div className="max-w-6xl mx-auto w-full h-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};
