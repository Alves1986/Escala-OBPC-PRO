
import React, { useState, useEffect } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Megaphone, Monitor, Loader2, CalendarClock, Lock, Unlock, BellOff, Check, Music, ShieldCheck, AlertCircle, Youtube, Link, Play, Ban } from 'lucide-react';
import { useToast } from './Toast';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { ThemeMode } from '../types';
import { sendNotificationSQL } from '../services/supabaseService';

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

  const hasSpotifyVars = (() => {
      try {
          // @ts-ignore
          return !!(import.meta.env && import.meta.env.VITE_SPOTIFY_CLIENT_ID);
      } catch (e) { return false; }
  })();

  const hasYoutubeKey = (() => {
      try {
          // @ts-ignore
          return !!(import.meta.env && import.meta.env.VITE_YOUTUBE_API_KEY);
      } catch (e) { return false; }
  })();

  // Helper para formatar ISO para input datetime-local (YYYY-MM-DDTHH:mm)
  const toLocalInput = (isoString?: string) => {
      if (!isoString) return "";
      try {
          const date = new Date(isoString);
          const offset = date.getTimezoneOffset() * 60000;
          const localTime = new Date(date.getTime() - offset);
          return localTime.toISOString().slice(0, 16);
      } catch (e) { return ""; }
  };

  // Helper para converter input local de volta para ISO string UTC
  const fromLocalInput = (localString: string) => {
      if (!localString) return "";
      return new Date(localString).toISOString();
  };

  useEffect(() => {
      if (availabilityWindow) {
          setAvailStart(toLocalInput(availabilityWindow.start));
          setAvailEnd(toLocalInput(availabilityWindow.end));
      }
  }, [availabilityWindow]);

  useEffect(() => {
      if ('Notification' in window) setNotifPermission(Notification.permission);
  }, []);

  // Verifica status atual da janela baseado nos inputs ou props
  const isWindowActive = () => {
      const s = availStart ? new Date(availStart) : (availabilityWindow?.start ? new Date(availabilityWindow.start) : null);
      const e = availEnd ? new Date(availEnd) : (availabilityWindow?.end ? new Date(availabilityWindow.end) : null);
      
      if (!s || !e) return true; 
      
      const now = new Date();
      return now >= s && now <= e;
  };

  const handleSaveAdvanced = async () => {
      if (onSaveAvailabilityWindow) {
          const startISO = fromLocalInput(availStart);
          const endISO = fromLocalInput(availEnd);
          
          await onSaveAvailabilityWindow(startISO, endISO);
          addToast("Período de disponibilidade atualizado!", "success");
      }
  };

  const handleQuickAction = async (action: 'block' | 'open') => {
      if (!onSaveAvailabilityWindow || !ministryId) return;
      
      const now = new Date();
      let newStartStr = "";
      let newEndStr = "";

      if (action === 'block') {
          // Bloquear: Define o Fim para o passado
          const past = new Date(now.getTime() - 60000); 
          newStartStr = availStart ? fromLocalInput(availStart) : new Date(now.getTime() - 86400000).toISOString();
          newEndStr = past.toISOString();
          
          addToast("Janela bloqueada.", "warning");
          
          // Notificar encerramento (Opcional, pode ser 'chato' se abusado)
          await sendNotificationSQL(ministryId, {
              title: "🔒 Disponibilidade Encerrada",
              message: "O período para marcar disponibilidade foi fechado.",
              type: "warning"
          });

      } else {
          // Abrir: Início agora, Fim +7 dias
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          newStartStr = now.toISOString();
          newEndStr = nextWeek.toISOString();
          
          addToast("Janela liberada por 7 dias.", "success");

          // Notificar Abertura
          const endDateFormatted = nextWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          await sendNotificationSQL(ministryId, {
              title: "📅 Disponibilidade Liberada!",
              message: `A agenda está aberta até ${endDateFormatted}. Marque seus dias agora!`,
              type: "success",
              actionLink: "availability"
          });
      }

      await onSaveAvailabilityWindow(newStartStr, newEndStr);
      setAvailStart(toLocalInput(newStartStr));
      setAvailEnd(toLocalInput(newEndStr));
  };

  const handleNotificationClick = async () => {
      if (!onEnableNotifications) return;
      if (notifPermission === 'denied') {
          alert("As notificações estão bloqueadas no seu navegador. Acesse as configurações do site para desbloquear.");
          return;
      }
      setIsNotifLoading(true);
      try {
          await onEnableNotifications();
          setNotifPermission(Notification.permission);
      } catch (e) { console.error(e); }
      finally { setIsNotifLoading(false); }
  };

  const status = isWindowActive();

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-10">
      
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <Settings className="text-zinc-500"/> Configurações
        </h2>
      </div>

      {/* --- AVAILABILITY WINDOW (ADMIN ONLY) --- */}
      {isAdmin && (
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-1 h-full ${status ? 'bg-green-500' : 'bg-red-500'}`}></div>
          
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-2">
              <CalendarClock size={18}/> Janela de Disponibilidade
          </h3>

          {/* Status Banner */}
          <div className={`p-4 rounded-xl border mb-6 flex items-center justify-between transition-colors ${status ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'}`}>
              <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full shadow-sm ${status ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'}`}>
                      {status ? <Unlock size={24}/> : <Lock size={24}/>}
                  </div>
                  <div>
                      <h4 className={`font-bold text-lg leading-tight ${status ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          {status ? 'Aberta para Edição' : 'Fechada para Edição'}
                      </h4>
                      <p className={`text-xs mt-1 ${status ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                          {status ? 'Membros podem alterar suas disponibilidades.' : 'Apenas administradores podem fazer alterações.'}
                      </p>
                  </div>
              </div>
          </div>

          {/* Manual Date Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase block ml-1">Data/Hora Abertura</label>
                  <input 
                      type="datetime-local" 
                      value={availStart} 
                      onChange={e => setAvailStart(e.target.value)} 
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                  />
              </div>
              <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase block ml-1">Data/Hora Fechamento</label>
                  <input 
                      type="datetime-local" 
                      value={availEnd} 
                      onChange={e => setAvailEnd(e.target.value)} 
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                  />
              </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                  onClick={handleSaveAdvanced}
                  className="flex-1 bg-zinc-800 dark:bg-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                  <Save size={18}/> Salvar Manualmente
              </button>
              
              <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-2 hidden sm:block"></div>

              <button 
                  onClick={() => handleQuickAction('open')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shadow-green-600/20"
              >
                  <Unlock size={18}/> Liberar e Notificar
              </button>
              <button 
                  onClick={() => handleQuickAction('block')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shadow-red-600/20"
              >
                  <Lock size={18}/> Bloquear Agora
              </button>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 text-center">
              * Ao usar "Liberar e Notificar", uma notificação push será enviada para todos os membros.
          </p>
      </div>
      )}

      {/* Identidade Visual */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Monitor size={16}/> Aparência
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Tema</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => onSetThemeMode(mode)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                themeMode === mode 
                                ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white' 
                                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            {mode === 'light' && <Sun size={14}/>}
                            {mode === 'dark' && <Moon size={14}/>}
                            {mode === 'system' && <Monitor size={14}/>}
                            {mode === 'light' ? 'Claro' : mode === 'dark' ? 'Escuro' : 'Auto'}
                        </button>
                    ))}
                </div>
            </div>

            {isAdmin && (
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Nome do Ministério</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                    />
                    <button 
                        onClick={() => onSaveTitle(tempTitle)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg transition-colors"
                    >
                        <Save size={18}/>
                    </button>
                </div>
            </div>
            )}
        </div>
        
        {onSaveTheme && (
            <div className="mt-4 flex justify-end">
                <button onClick={onSaveTheme} className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Salvar preferência de tema neste dispositivo
                </button>
            </div>
        )}
      </div>

      {/* Integrações */}
      {isAdmin && (
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Link size={16}/> Integrações
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${hasSpotifyVars ? 'bg-green-100 text-green-600' : 'bg-zinc-200 text-zinc-400'}`}>
                              <Music size={20}/>
                          </div>
                          <div>
                              <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Spotify API</h4>
                              <p className="text-xs text-zinc-500">{hasSpotifyVars ? 'Configurado via Variáveis de Ambiente (.env)' : 'Não detectado'}</p>
                          </div>
                      </div>
                      {hasSpotifyVars && <Check size={18} className="text-green-500"/>}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${hasYoutubeKey ? 'bg-red-100 text-red-600' : 'bg-zinc-200 text-zinc-400'}`}>
                              <Youtube size={20}/>
                          </div>
                          <div>
                              <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">YouTube API</h4>
                              <p className="text-xs text-zinc-500">{hasYoutubeKey ? 'Configurado via Variáveis de Ambiente (.env)' : 'Não detectado'}</p>
                          </div>
                      </div>
                      {hasYoutubeKey && <Check size={18} className="text-green-500"/>}
                  </div>
              </div>
          </div>
      )}

      {/* Sistema */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck size={16}/> Sistema
        </h3>

        <div className="space-y-3">
            {/* Notificações */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${notifPermission === 'granted' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-zinc-200 text-zinc-500'}`}>
                        {notifPermission === 'granted' ? <BellRing size={20}/> : <BellOff size={20}/>}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Notificações Push</h4>
                        <p className="text-xs text-zinc-500">
                            {notifPermission === 'granted' ? 'Ativas neste dispositivo.' : 'Permita para receber avisos.'}
                        </p>
                    </div>
                </div>
                {onEnableNotifications && notifPermission !== 'granted' && (
                    <button 
                        onClick={handleNotificationClick} 
                        disabled={isNotifLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        {isNotifLoading ? <Loader2 size={12} className="animate-spin"/> : 'Ativar'}
                    </button>
                )}
                {notifPermission === 'granted' && <Check size={18} className="text-green-500 mr-2"/>}
            </div>

            {isAdmin && onAnnounceUpdate && (
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/30 rounded-lg">
                            <Megaphone size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Anunciar Atualização</h4>
                            <p className="text-xs text-zinc-500">Envia alerta para todos recarregarem o app.</p>
                        </div>
                    </div>
                    <button onClick={onAnnounceUpdate} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-colors">
                        Enviar
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="flex justify-center gap-4 pt-4">
          <button onClick={() => setLegalDoc('terms')} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline">Termos de Uso</button>
          <button onClick={() => setLegalDoc('privacy')} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline">Política de Privacidade</button>
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
};
