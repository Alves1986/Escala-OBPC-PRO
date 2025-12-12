
import React, { useState, useEffect } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Megaphone, Monitor, Loader2, CalendarClock, Lock, Unlock, BellOff, Check, Music, ShieldCheck, AlertCircle, Youtube, Link } from 'lucide-react';
import { useToast } from './Toast';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { ThemeMode } from '../types';

interface Props {
  initialTitle: string;
  ministryId: string | null;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSaveTheme?: () => void;
  onSaveTitle: (newTitle: string) => Promise<void>;
  onAnnounceUpdate?: () => Promise<void>;
  onEnableNotifications?: () => Promise<void>;
  onSaveAvailabilityWindow?: (start: string, end: string) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
  isAdmin?: boolean;
}

export const SettingsScreen: React.FC<Props> = ({ 
    initialTitle, ministryId, themeMode, onSetThemeMode, onSaveTheme, 
    onSaveTitle, onAnnounceUpdate, onEnableNotifications, 
    onSaveAvailabilityWindow, availabilityWindow, isAdmin = false 
}) => {
  const [tempTitle, setTempTitle] = useState(initialTitle);
  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");
  
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const { addToast } = useToast();

  // Verifica se as variáveis de ambiente estão presentes de forma segura
  const hasSpotifyVars = (() => {
      try {
          // @ts-ignore
          return !!(import.meta.env && import.meta.env.VITE_SPOTIFY_CLIENT_ID);
      } catch (e) {
          return false;
      }
  })();

  const hasYoutubeKey = (() => {
      try {
          // @ts-ignore
          return !!(import.meta.env && import.meta.env.VITE_YOUTUBE_API_KEY);
      } catch (e) {
          return false;
      }
  })();

  // Efeito: Sincroniza Janela de Disponibilidade
  useEffect(() => {
      if (availabilityWindow) {
          setAvailStart(availabilityWindow.start || "");
          setAvailEnd(availabilityWindow.end || "");
      }
  }, [availabilityWindow]);

  useEffect(() => {
      if ('Notification' in window) {
          setNotifPermission(Notification.permission);
      }
  }, []);

  const handleSaveAdvanced = async () => {
      if (onSaveAvailabilityWindow) {
          await onSaveAvailabilityWindow(availStart, availEnd);
          addToast("Configurações salvas!", "success");
      }
  };

  const handleNotificationClick = async () => {
      if (!onEnableNotifications) return;

      if (notifPermission === 'denied') {
          alert("As notificações estão bloqueadas no seu navegador. Para ativar, clique no ícone de cadeado/configurações na barra de endereço e permita as notificações para este site.");
          return;
      }

      setIsNotifLoading(true);
      try {
          await onEnableNotifications();
          setNotifPermission(Notification.permission);
      } catch (e) {
          console.error(e);
      } finally {
          setIsNotifLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
         <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

         <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
           <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
             <Settings className="text-zinc-500"/> Configurações
           </h2>
           <p className="text-zinc-500 text-sm mt-1">
             Personalize o sistema e ajuste preferências.
           </p>
         </div>
         
         {isAdmin && (
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Geral</h3>
                 <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Nome de Exibição do Ministério</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Equipe de Louvor"
                            />
                            <button 
                                onClick={() => onSaveTitle(tempTitle)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-sm font-bold flex items-center gap-2"
                            >
                                <Save size={16}/> Salvar
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarClock size={18} className="text-purple-500"/>
                            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase">Janela de Disponibilidade</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1 flex items-center gap-1">
                                    <Unlock size={10} className="text-green-500"/> Abertura
                                </label>
                                <input 
                                    type="datetime-local"
                                    value={availStart}
                                    onChange={(e) => setAvailStart(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1 flex items-center gap-1">
                                    <Lock size={10} className="text-red-500"/> Fechamento
                                </label>
                                <input 
                                    type="datetime-local"
                                    value={availEnd}
                                    onChange={(e) => setAvailEnd(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleSaveAdvanced}
                            className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Save size={16}/> Salvar Datas
                        </button>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Link size={18} className="text-blue-500"/>
                            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-200 uppercase">Integrações de Mídia</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Spotify Status */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${hasSpotifyVars ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'}`}>
                                <div className={`p-2 rounded-full ${hasSpotifyVars ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                    {hasSpotifyVars ? <Music size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${hasSpotifyVars ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                        Spotify
                                    </p>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                        {hasSpotifyVars ? 'Conectado (Client ID)' : 'Não configurado (.env)'}
                                    </p>
                                </div>
                                {hasSpotifyVars && <ShieldCheck size={16} className="ml-auto text-green-500" />}
                            </div>

                            {/* YouTube Status */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${hasYoutubeKey ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'}`}>
                                <div className={`p-2 rounded-full ${hasYoutubeKey ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                    {hasYoutubeKey ? <Youtube size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${hasYoutubeKey ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                        YouTube
                                    </p>
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                        {hasYoutubeKey ? 'Conectado (API Key)' : 'Não configurado (.env)'}
                                    </p>
                                </div>
                                {hasYoutubeKey && <ShieldCheck size={16} className="ml-auto text-green-500" />}
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-zinc-400 mt-2 text-center">
                            Configure VITE_SPOTIFY_CLIENT_ID e VITE_YOUTUBE_API_KEY no arquivo .env para ativar.
                        </p>
                    </div>
                 </div>
             </div>
         )}

         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase">Preferências de Tema</h3>
                 {onSaveTheme && (
                     <button 
                        onClick={onSaveTheme}
                        className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1"
                     >
                        <Save size={14} /> Salvar Preferência
                     </button>
                 )}
             </div>
             <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <button onClick={() => onSetThemeMode('light')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${themeMode === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                        <Sun size={24} className="mb-2" />
                        <span className="text-sm font-bold">Modo Claro</span>
                     </button>
                     <button onClick={() => onSetThemeMode('dark')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${themeMode === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                        <Moon size={24} className="mb-2" />
                        <span className="text-sm font-bold">Modo Escuro</span>
                     </button>
                     <button onClick={() => onSetThemeMode('system')} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${themeMode === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                        <Monitor size={24} className="mb-2" />
                        <span className="text-sm font-bold">Automático</span>
                        <span className="text-[10px] opacity-70 mt-1">Claro até 18h</span>
                     </button>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50 mt-4">
                     <div className="flex items-center gap-3">
                         {notifPermission === 'granted' ? <BellRing size={20} className="text-green-500"/> : notifPermission === 'denied' ? <BellOff size={20} className="text-red-500"/> : <BellRing size={20} className="text-blue-500"/>}
                         <div>
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Notificações Push</p>
                             <p className="text-xs text-zinc-500">
                                 {notifPermission === 'granted' ? 'Ativas neste dispositivo.' : notifPermission === 'denied' ? 'Bloqueadas pelo navegador.' : 'Receber avisos e escalas.'}
                             </p>
                         </div>
                     </div>
                     <button 
                        disabled={isNotifLoading || notifPermission === 'granted'}
                        onClick={handleNotificationClick}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-opacity flex items-center gap-2 disabled:opacity-50 ${
                            notifPermission === 'granted' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default' 
                            : notifPermission === 'denied'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:opacity-80'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:opacity-80'
                        }`}
                     >
                        {isNotifLoading && <Loader2 size={12} className="animate-spin" />}
                        {notifPermission === 'granted' ? <><Check size={12}/> Ativado</> : notifPermission === 'denied' ? 'Bloqueado (Ajuda)' : 'Ativar'}
                     </button>
                 </div>
             </div>
         </div>

         {isAdmin && (
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Sistema</h3>
                 <div className="space-y-4">
                     {onAnnounceUpdate && (
                         <div>
                             <button onClick={onAnnounceUpdate} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 transition-colors">
                                 <Megaphone size={18}/> <span className="text-sm font-bold">Anunciar Nova Versão</span>
                             </button>
                             <p className="text-xs text-zinc-400 mt-2 text-center">Envia uma notificação para todos os membros recarregarem o app.</p>
                         </div>
                     )}
                 </div>
             </div>
         )}
    </div>
  );
};
