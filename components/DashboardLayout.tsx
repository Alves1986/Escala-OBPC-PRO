
import React, { ReactNode, useState } from 'react';
import { Menu, Moon, Sun, LogOut, Cloud, CloudOff, Layout, Download, RefreshCw, Share, PlusSquare, X, User as UserIcon, Calendar, Edit, Users, BarChart2, Activity, Clock, CheckCircle } from 'lucide-react';
import { User, Tab } from '../types';

interface Props {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onLogout: () => void;
  title: string;
  isConnected: boolean;
  deferredPrompt?: any;
  onInstallAction?: () => void;
  currentUser?: User | null;
  isIOS?: boolean;
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
}

export const DashboardLayout: React.FC<Props> = ({ 
  children, sidebarOpen, setSidebarOpen, theme, toggleTheme, onLogout, title, isConnected, deferredPrompt, onInstallAction, currentUser, isIOS, activeTab, setActiveTab
}) => {
  const [imgError, setImgError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

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
    }, 100);
  };

  const handleInstallClick = () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (onInstallAction) {
      onInstallAction();
    }
  };

  const showInstallButton = !!deferredPrompt || isIOS;
  const isAdmin = currentUser?.role === 'admin';

  const NavItem = ({ tab, label, icon: Icon }: { tab: Tab, label: string, icon: any }) => (
      <button 
        onClick={() => { setActiveTab(tab); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
            activeTab === tab 
             ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
             : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'
        }`}
      >
          <Icon size={20} className={activeTab === tab ? "text-white" : "text-zinc-500"} />
          <span>{label}</span>
      </button>
  );

  return (
    <div className={`flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors duration-300`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex flex-col px-6 py-6 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
             <div className="flex items-center gap-3 mb-6">
                {imgError ? (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm"><Layout size={18} /></div>
                ) : (
                  <img src="/app-icon.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" onError={() => setImgError(true)} />
                )}
                <span className="text-lg font-bold tracking-tight truncate" title={title}>{title}</span>
             </div>
             
             {/* User Profile Summary */}
             {currentUser && (
                <div 
                  onClick={() => setActiveTab('profile')}
                  className="flex items-center gap-3 p-3 -mx-2 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700/50 cursor-pointer hover:border-blue-500/30 transition-colors group"
                >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                        <UserIcon size={20} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{currentUser.name}</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide truncate">{isAdmin ? 'Admin' : 'Membro'}</span>
                    </div>
                </div>
             )}
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-1">
             <div className="text-xs font-bold text-zinc-400 uppercase px-4 mb-2">Menu Principal</div>
             
             <NavItem tab="dashboard" label="Dashboard" icon={Layout} />
             <NavItem tab="calendar" label="Calendário" icon={Calendar} />
             {isAdmin && <NavItem tab="schedule_editor" label="Editor de Escala" icon={Edit} />}
             <NavItem tab="availability" label="Disponibilidade" icon={CheckCircle} />
             
             <div className="text-xs font-bold text-zinc-400 uppercase px-4 mb-2 mt-6">Gestão</div>
             <NavItem tab="events" label="Eventos" icon={Clock} />
             {isAdmin && <NavItem tab="team" label="Equipe & Funções" icon={Users} />}
             <NavItem tab="stats" label="Estatísticas" icon={BarChart2} />
             {isAdmin && <NavItem tab="logs" label="Logs do Sistema" icon={Activity} />}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-1 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/20">
             {showInstallButton && (
               <button onClick={handleInstallClick} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors mb-2">
                 <Download size={18} /> <span>Instalar App</span>
               </button>
             )}

             <div className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors mb-1 ${isConnected ? 'text-green-600 dark:text-green-500' : 'text-red-500'}`}>
                {isConnected ? <Cloud size={14}/> : <CloudOff size={14}/>}
                <span>{isConnected ? 'Online' : 'Offline'}</span>
             </div>

             <div className="grid grid-cols-2 gap-2">
                 <button onClick={toggleTheme} className="flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === 'dark' ? 'Claro' : 'Escuro'}
                 </button>
                 <button onClick={handleHardReload} disabled={isUpdating} className="flex items-center justify-center gap-2 px-2 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                    <RefreshCw size={16} className={isUpdating ? "animate-spin" : ""} />
                    Atualizar
                 </button>
             </div>
             
             <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                <LogOut size={16} /> <span>Sair da Conta</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-700 lg:hidden bg-white dark:bg-zinc-800 shrink-0 z-20">
           <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg active:bg-zinc-100 dark:active:bg-zinc-700">
                  <Menu size={24} />
              </button>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">{title}</span>
           </div>
           {showInstallButton && (
             <button onClick={handleInstallClick} className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors animate-fade-in"><Download size={20} /></button>
           )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar bg-zinc-50 dark:bg-zinc-900">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* iOS Modal - Mantido igual */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowIOSInstructions(false)}>
          <div className="bg-white dark:bg-zinc-800 w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
               <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Instalar no iPhone</h3>
               <button onClick={() => setShowIOSInstructions(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20}/></button>
            </div>
            <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
               <p>Para instalar este aplicativo no seu iPhone, siga estes passos:</p>
               <ol className="space-y-3">
                  <li className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 font-bold text-xs">1</span>
                     <span>Toque no botão <strong>Compartilhar</strong> <Share size={14} className="inline mx-1"/> na barra inferior.</span>
                  </li>
                  <li className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 font-bold text-xs">2</span>
                     <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare size={14} className="inline mx-1"/>.</span>
                  </li>
                  <li className="flex items-center gap-3">
                     <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 font-bold text-xs">3</span>
                     <span>Confirme tocando em <strong>Adicionar</strong> no canto superior.</span>
                  </li>
               </ol>
            </div>
            <button onClick={() => setShowIOSInstructions(false)} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Entendi</button>
          </div>
        </div>
      )}
    </div>
  );
};
