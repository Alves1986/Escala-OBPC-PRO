
import React, { useState, useEffect } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Monitor, Loader2, CalendarClock, Lock, Unlock, BellOff, Check, ShieldCheck, ArrowRight } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const { addToast } = useToast();

  const isBlockedDate = (isoString?: string) => {
      if (!isoString) return false;
      const d = new Date(isoString);
      return d.getFullYear() < 2000;
  };

  const toLocalInput = (isoString?: string) => {
      if (!isoString || isBlockedDate(isoString)) return "";
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
      const dbEnd = availabilityWindow?.end;

      if (isBlockedDate(dbStart) || isBlockedDate(dbEnd)) return false;
      if (!dbStart && !dbEnd && !availStart && !availEnd) return true;
      
      const startIso = availStart ? fromLocalInput(availStart) : dbStart;
      const endIso = availEnd ? fromLocalInput(availEnd) : dbEnd;

      if (!startIso || !endIso) return true;
      
      const now = new Date();
      const s = new Date(startIso);
      const e = new Date(endIso);
      
      if (s.getFullYear() < 2000) return false;

      return now >= s && now <= e;
  };

  const status = isWindowActive();

  const handleSaveAdvanced = async () => {
      if (onSaveAvailabilityWindow) {
          setIsProcessing(true);
          const startISO = fromLocalInput(availStart);
          const endISO = fromLocalInput(availEnd);
          await onSaveAvailabilityWindow(startISO, endISO);
          setIsProcessing(false);
          addToast("Período de disponibilidade atualizado!", "success");
      }
  };

  const handleQuickAction = async (action: 'block' | 'open') => {
      if (!onSaveAvailabilityWindow || !ministryId) return;
      setIsProcessing(true);
      
      const now = new Date();
      let newStartStr = "";
      let newEndStr = "";

      // Atualiza visualmente IMEDIATAMENTE (Optimistic UI)
      if (action === 'block') {
          newStartStr = "1970-01-01T00:00:00.000Z";
          newEndStr = "1970-01-01T00:00:00.000Z";
          setAvailStart("");
          setAvailEnd("");
          addToast("Bloqueando janela...", "info");
      } else {
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const startNow = new Date(now.getTime() - 60000); 
          newStartStr = startNow.toISOString();
          newEndStr = nextWeek.toISOString();
          setAvailStart(toLocalInput(newStartStr));
          setAvailEnd(toLocalInput(newEndStr));
          addToast("Liberando janela...", "info");
      }

      // Executa no background
      try {
          await onSaveAvailabilityWindow(newStartStr, newEndStr);
          
          if (action === 'open') {
              const endDateFormatted = new Date(newEndStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              await sendNotificationSQL(ministryId, {
                  title: "📅 Disponibilidade Liberada!",
                  message: `A agenda está aberta até ${endDateFormatted}. Marque seus dias agora!`,
                  type: "success",
                  actionLink: "availability"
              });
          } else {
              await sendNotificationSQL(ministryId, {
                  title: "🔒 Janela Fechada",
                  message: "O período para enviar disponibilidade foi encerrado.",
                  type: "warning"
              });
          }
          addToast(action === 'open' ? "Janela liberada com sucesso!" : "Janela bloqueada com sucesso!", "success");
      } catch (e) {
          addToast("Erro ao salvar no banco. Verifique sua conexão.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleNotificationClick = async () => {
    if (onEnableNotifications) {
      setIsNotifLoading(true);
      await onEnableNotifications();
      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      setIsNotifLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pb-24">
      
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <Settings className="text-zinc-500"/> Configurações
        </h2>
        <p className="text-zinc-500 text-sm mt-1">Gerencie preferências e controles do sistema.</p>
      </div>

      {/* --- AVAILABILITY WINDOW CONTROL (ADMIN ONLY) --- */}
      {isAdmin && (
      <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden relative group">
          
          {/* Status Header Area - Premium Gradient */}
          <div className={`relative px-6 py-8 transition-all duration-500 ${
              status 
                ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800' 
                : 'bg-gradient-to-br from-zinc-700 via-zinc-800 to-black'
          }`}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-5">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-md transition-all duration-500 ${status ? 'bg-emerald-500/30' : 'bg-red-500/20'}`}>
                          {isProcessing ? <Loader2 size={32} className="text-white animate-spin"/> : status ? <Unlock size={32} className="text-emerald-100"/> : <Lock size={32} className="text-red-100"/>}
                      </div>
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-white font-bold text-2xl tracking-tight">Janela de Disponibilidade</h3>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${status ? 'bg-emerald-400 text-emerald-950 border-emerald-300' : 'bg-red-500 text-white border-red-400'}`}>
                                  {status ? 'ABERTA' : 'FECHADA'}
                              </span>
                          </div>
                          <p className="text-white/80 text-sm font-medium">
                              {status 
                                ? 'Os membros estão habilitados a enviar datas.' 
                                : 'A agenda está bloqueada para novas edições.'}
                          </p>
                      </div>
                  </div>
              </div>
          </div>

          <div className="p-6 md:p-8 bg-white dark:bg-zinc-800">
              
              <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                          <CalendarClock size={16}/> Configuração de Período
                      </label>
                      
                      {status && (
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded animate-fade-in">
                              Edição Manual Ativa
                          </span>
                      )}
                  </div>
                  
                  <div className={`flex flex-col md:flex-row items-stretch md:items-center gap-0 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-2 shadow-inner transition-all duration-500 ${!status ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                      <div className="flex-1 relative group p-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Abertura</label>
                          <input 
                              type="datetime-local" 
                              value={availStart} 
                              onChange={e => setAvailStart(e.target.value)} 
                              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 px-3 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                      </div>

                      <div className="hidden md:flex items-center justify-center w-10 text-zinc-300 dark:text-zinc-600 mt-4"><ArrowRight size={20} /></div>
                      
                      <div className="flex-1 relative group p-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Fechamento</label>
                          <input 
                              type="datetime-local" 
                              value={availEnd} 
                              onChange={e => setAvailEnd(e.target.value)}
                              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl py-2 px-3 text-sm font-bold text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                      </div>
                  </div>
                  
                  {status && (
                      <div className="mt-3 flex justify-end">
                          <button 
                              onClick={handleSaveAdvanced}
                              disabled={isProcessing}
                              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                              <Save size={14}/> {isProcessing ? 'Salvando...' : 'Salvar Datas Manuais'}
                          </button>
                      </div>
                  )}
              </div>

              {/* Action Buttons - Professional Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                      onClick={() => handleQuickAction('open')}
                      className={`relative overflow-hidden group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${status ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 opacity-50 cursor-not-allowed' : 'bg-white dark:bg-zinc-800 border-emerald-200 dark:border-emerald-900 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10'}`}
                      disabled={status || isProcessing}
                  >
                      <div className="flex items-center gap-3 relative z-10">
                          <div className={`p-3 rounded-full ${status ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform'}`}>
                              <Unlock size={20} />
                          </div>
                          <div className="text-left">
                              <span className={`block font-bold text-sm ${status ? 'text-zinc-400' : 'text-zinc-800 dark:text-white'}`}>Liberar Acesso</span>
                              <span className="text-[10px] text-zinc-500 block">Abre por 7 dias e notifica</span>
                          </div>
                      </div>
                  </button>

                  <button 
                      onClick={() => handleQuickAction('block')}
                      className={`relative overflow-hidden group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${!status ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 opacity-50 cursor-not-allowed' : 'bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/10'}`}
                      disabled={!status || isProcessing}
                  >
                      <div className="flex items-center gap-3 relative z-10">
                          <div className={`p-3 rounded-full ${!status ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform'}`}>
                              <Lock size={20} />
                          </div>
                          <div className="text-left">
                              <span className={`block font-bold text-sm ${!status ? 'text-zinc-400' : 'text-zinc-800 dark:text-white'}`}>Bloquear Acesso</span>
                              <span className="text-[10px] text-zinc-500 block">Fecha a janela imediatamente</span>
                          </div>
                      </div>
                  </button>
              </div>
          </div>
      </div>
      )}

      {/* Aparência */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Monitor size={16}/> Aparência & Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Tema do App</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => onSetThemeMode(mode)}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                                themeMode === mode 
                                ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white scale-100' 
                                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5'
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
                        className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 transition-all font-medium"
                    />
                    <button 
                        onClick={() => onSaveTitle(tempTitle)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        <Save size={18}/>
                    </button>
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck size={16}/> Permissões
        </h3>
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${notifPermission === 'granted' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-zinc-200 text-zinc-500'}`}>
                    {notifPermission === 'granted' ? <BellRing size={20}/> : <BellOff size={20}/>}
                </div>
                <div>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Notificações Push</h4>
                    <p className="text-xs text-zinc-500">
                        {notifPermission === 'granted' ? 'Ativas e configuradas.' : 'Permita para receber avisos.'}
                    </p>
                </div>
            </div>
            {onEnableNotifications && notifPermission !== 'granted' && (
                <button 
                    onClick={handleNotificationClick} 
                    disabled={isNotifLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-md active:scale-95"
                >
                    {isNotifLoading ? <Loader2 size={14} className="animate-spin"/> : 'Ativar'}
                </button>
            )}
            {notifPermission === 'granted' && <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-2 rounded-full"><Check size={18} /></div>}
        </div>
      </div>

      <div className="flex justify-center gap-6 pt-4 opacity-70">
          <button onClick={() => setLegalDoc('terms')} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Termos de Uso</button>
          <button onClick={() => setLegalDoc('privacy')} className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Política de Privacidade</button>
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
};
