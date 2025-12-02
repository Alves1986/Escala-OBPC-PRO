import React, { ReactNode, useState } from 'react';
import { Menu, Moon, Sun, LogOut, Cloud, CloudOff, Layout } from 'lucide-react';

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
}

export const DashboardLayout: React.FC<Props> = ({ 
  children, sidebar, sidebarOpen, setSidebarOpen, theme, toggleTheme, onLogout, title, isConnected 
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 transition-colors duration-300`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center gap-3 h-16 px-6 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
            {imgError ? (
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Layout size={18} />
              </div>
            ) : (
              <img 
                src="/app-icon.png" 
                alt="Logo" 
                className="w-8 h-8 rounded-lg shadow-sm" 
                onError={() => setImgError(true)}
              />
            )}
            <span className="text-lg font-bold tracking-tight truncate" title={title}>{title}</span>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {sidebar}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2 shrink-0">
             {/* Connection Status */}
             <div className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded font-medium transition-colors ${isConnected ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20'}`}>
                {isConnected ? <Cloud size={14}/> : <CloudOff size={14}/>}
                <span>{isConnected ? 'Sincronizado' : 'Offline'}</span>
             </div>

             <button 
               onClick={toggleTheme} 
               className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
             >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
             </button>
             
             <button 
               onClick={onLogout} 
               className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
             >
                <LogOut size={18} />
                <span>Sair</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-700 lg:hidden bg-white dark:bg-zinc-800 shrink-0">
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="p-2 -ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg active:bg-zinc-100 dark:active:bg-zinc-700"
              >
                  <Menu size={24} />
              </button>
              <div className="flex items-center gap-2">
                 {imgError ? (
                   <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white">
                      <Layout size={14} />
                   </div>
                 ) : (
                   <img 
                      src="/app-icon.png" 
                      alt="Logo" 
                      className="w-6 h-6 rounded shadow-sm"
                      onError={() => setImgError(true)}
                   />
                 )}
                 <span className="font-bold text-zinc-900 dark:text-zinc-100">{title}</span>
              </div>
           </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};