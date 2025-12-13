
import React, { useState, useEffect } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Megaphone, Monitor, Loader2, CalendarClock, Lock, Unlock, BellOff, Check, Music, ShieldCheck, AlertCircle, Youtube, Link, Play, Ban, ArrowRight, Calendar } from 'lucide-react';
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

  const toLocalInput = (isoString?: string) => {
      if (!isoString) return "";
      
      // Checagem robusta de 1970 (Bloqueio) independente de timezone
      if (isoString.includes('1970')) return "";
      const d = new Date(isoString);
      if(d.getFullYear() === 1970 || d.getUTCFullYear() === 1970) return "";
      
      try {
          const date = new Date(isoString);
          const offset = date.getTimezoneOffset() * 60000;
          const localTime = new Date(date.getTime() - offset);
          return localTime.toISOString().slice(0, 16);
      } catch (e) { return ""; }
  };

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

  const isWindowActive = () => {
      const dbStart = availabilityWindow?.start;
      
      // Checagem robusta de 1970 (Bloqueio)
      const isDbBlocked = dbStart && (dbStart.includes('1970') || new Date(dbStart).getUTCFullYear() === 1970);

      if (isDbBlocked) return false;

      if (!dbStart && !availabilityWindow?.end && !availStart && !availEnd) return true;
      
      const startIso = availStart ? fromLocalInput(availStart) : dbStart;
      const endIso = availEnd ? fromLocalInput(availEnd) : availabilityWindow?.end;

      if (!startIso || !endIso) return true;
      
      const now = new Date();
      const s = new Date(startIso);
      const e = new Date(endIso);
      
      if(s.getUTCFullYear() === 1970) return false;

      return now >= s && now <= e;
  };

  const status = isWindowActive();

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
          newStartStr = "1970-01-01T00:00:00.000Z";
          newEndStr = "1970-01-01T00:00:00.000Z";
          
          await sendNotificationSQL(ministryId, {
              title: "🔒 Janela Fechada",
              message: "O período para enviar disponibilidade foi encerrado.",
              type: "warning"
          });
          
          addToast("Janela bloqueada com sucesso.", "warning");

      } else {
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const startNow = new Date(now.getTime() - 60000); 

          newStartStr = startNow.toISOString();
          newEndStr = nextWeek.toISOString();
          
          addToast("Janela liberada por 7 dias.", "success");

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
      <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden relative group">
          
          {/* Status Header Area */}
          <div className={`relative px-6 py-8 transition-colors duration-500 ${
              status 
                ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800' 
                : 'bg-gradient-to-br from-zinc-700 via-zinc-800 to-black'
          }`}>
              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/20 backdrop-blur-md ${status ? 'bg-emerald-500/30' : 'bg-red-500/20'}`}>
                          {status ? <Unlock size={28} className="text-emerald-100"/> : <Lock size={28} className="text-red-100"/>}
                      </div>
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-white font-bold text-xl tracking-tight">Janela de Disponibilidade</h3>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${status ? 'bg-emerald-400 text-emerald-950 border-emerald-300' : 'bg-red-500 text-white border-red-400'}`}>
                                  {status ? 'Aberta' : 'Fechada'}
                              </span>
                          </div>
                          <p className="text-white/70 text-sm font-medium">
                              {status 
                                ? 'Os membros podem enviar suas datas.' 
                                : 'A agenda está bloqueada para edições.'}
                          </p>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-6">
              {/* Date Inputs */}
              <div className="mb-8">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                      <CalendarClock size={14}/> Configuração de Período
                  </label>
                  
                  <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-0 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-1 shadow-inner ${!status ? 'opacity-70' : ''}`}>
                      <div className="flex-1 relative group">
                          <label className="absolute left-4 top-2 text-[10px] font-bold text-zinc-400 uppercase">Abertura</label>
                          <input 
                              type="datetime-local" 
                              value={availStart} 
                              onChange={e => setAvailStart(e.target.value)} 
                              placeholder={!status ? "Bloqueado" : ""}
                              disabled={!status && !availStart} // Disable if currently locked and empty
                              className="w-full bg-transparent border-none rounded-xl pt-6 pb-2 px-4 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:bg-white dark:focus:bg-zinc-800 transition-colors placeholder:text-red-400 disabled:cursor-not-allowed"
                          />
                      </div>

                      <div className="hidden md:flex items-center justify-center w-8 text-zinc-300 dark:text-zinc-600"><ArrowRight size={16} /></div>
                      <div className="md:hidden h-px w-full bg-zinc-200 dark:bg-zinc-700 my-1"></div>

                      <div className="flex-1 relative group">
                          <label className="absolute left-4 top-2 text-[10px] font-bold text-zinc-400 uppercase">Fechamento</label>
                          <input 
                              type="datetime-local" 
                              value={availEnd} 
                              onChange={e => setAvailEnd(e.target.value)}
                              placeholder={!status ? "Bloqueado" : ""}
                              disabled={!status && !availEnd} 
                              className="w-full bg-transparent border-none rounded-xl pt-6 pb-2 px-4 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:bg-white dark:focus:bg-zinc-800 transition-colors text-right md:text-left placeholder:text-red-400 disabled:cursor-not-allowed"
                          />
                      </div>
                  </div>
                  {!status && (
                      <p className="text-[10px] text-red-400 mt-2 text-center">
                          A janela está bloqueada. Clique em "Liberar por 7 Dias" para reabrir.
                      </p>
                  )}
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                      onClick={handleSaveAdvanced}
                      disabled={!status} // Disable save if blocked, force user to use "Open"
                      className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-100 dark:bg-zinc-700/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl font-bold text-sm transition-all border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <Save size={18} />
                      Salvar Alterações
                  </button>

                  {status ? (
                      <button 
                          onClick={() => handleQuickAction('block')}
                          className="flex items-center justify-center gap-2 w-full py-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-bold text-sm transition-all shadow-sm hover:shadow active:scale-95"
                      >
                          <Lock size={18} />
                          Bloquear Imediatamente
                      </button>
                  ) : (
                      <button 
                          onClick={() => handleQuickAction('open')}
                          className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40 active:scale-95 group"
                      >
                          <Unlock size={18} className="group-hover:rotate-12 transition-transform" />
                          Liberar por 7 Dias
                      </button>
                  )}
              </div>
          </div>
      </div>
      )}

      {/* Restante da UI (Aparência, Integrações, etc) */}
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

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck size={16}/> Sistema
        </h3>
        <div className="space-y-3">
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
