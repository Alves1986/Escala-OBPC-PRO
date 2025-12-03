
import React, { ReactNode, useState } from 'react';
import { Menu, Moon, Sun, LogOut, Cloud, CloudOff, Layout, Download, RefreshCw, Share, PlusSquare, X, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface Props {
  children: ReactNode;
  sidebar: ReactNode;
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
  onOpenProfile?: () => void;
}

export const DashboardLayout: React.FC<Props> = ({ 
  children, sidebar, sidebarOpen, setSidebarOpen, theme, toggleTheme, onLogout, title, isConnected, deferredPrompt, onInstallAction, currentUser, isIOS, onOpenProfile
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

  // Mostrar botão se tiver o prompt do Android OU se for iOS
  const showInstallButton = !!deferredPrompt || isIOS;

  return (
    <div className={`flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors duration-300`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex flex-col px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
             <div className="flex items-center gap-3 mb-4">
                {imgError ? (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm"><Layout size={18} /></div>
                ) : (
                  <img src="/app-icon.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-sm" onError={() => setImgError(true)} />
                )}
                <span className="text-lg font-bold tracking-tight truncate" title={title}>{title}</span>
             </div>
             {currentUser && (
                <button 
                  onClick={onOpenProfile}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors group text-left"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                        <UserIcon size={20} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{currentUser.name}</span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide truncate">{currentUser.role === 'admin' ? 'Líder / Admin' : 'Membro'}</span>
                    </div>
                </button>
             )}
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {sidebar}
            
            {onOpenProfile && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/50">
                 <button onClick={onOpenProfile} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                    <UserIcon size={16} /> <span>Meu Perfil</span>
                 </button>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-1 shrink-0">
             {showInstallButton && (
               <button onClick={handleInstallClick} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                 <Download size={18} /> <span>Instalar App</span>
               </button>
             )}

             <div className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg font-medium transition-colors mb-1 ${isConnected ? 'text-green-600 dark:text-green-500' : 'text-red-500'}`}>
                {isConnected ? <Cloud size={14}/> : <CloudOff size={14}/>}
                <span>{isConnected ? 'Sincronizado' : 'Offline'}</span>
             </div>

             <button onClick={toggleTheme} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
             </button>

             <button onClick={handleHardReload} disabled={isUpdating} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg transition-colors">
                <RefreshCw size={18} className={isUpdating ? "animate-spin" : ""} />
                <span>{isUpdating ? 'Atualizando...' : 'Atualizar Sistema'}</span>
             </button>
             
             <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                <LogOut size={18} /> <span>Sair</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-700 lg:hidden bg-white dark:bg-zinc-800 shrink-0">
           <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg active:bg-zinc-100 dark:active:bg-zinc-700">
                  <Menu size={24} />
              </button>
              <div className="flex items-center gap-2">
                 {imgError ? (
                   <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white"><Layout size={14} /></div>
                 ) : (
                   <img src="/app-icon.png" alt="Logo" className="w-6 h-6 rounded shadow-sm" onError={() => setImgError(true)} />
                 )}
                 <span className="font-bold text-zinc-900 dark:text-zinc-100">{title}</span>
              </div>
           </div>
           {showInstallButton && (
             <button onClick={handleInstallClick} className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors animate-fade-in"><Download size={20} /></button>
           )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>

      {/* iOS Installation Instructions Modal */}
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
