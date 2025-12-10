import React, { useState } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Megaphone, Monitor, Loader2 } from 'lucide-react';
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
  isAdmin?: boolean;
}

export const SettingsScreen: React.FC<Props> = ({ initialTitle, ministryId, themeMode, onSetThemeMode, onSaveTheme, onSaveTitle, onAnnounceUpdate, onEnableNotifications, isAdmin = false }) => {
  const [tempTitle, setTempTitle] = useState(initialTitle);
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const { addToast } = useToast();

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
         
         {/* CONFIGURAÇÃO GERAL (ADMIN ONLY) */}
         {isAdmin && (
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Geral</h3>
                 <div className="space-y-4">
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
                 </div>
             </div>
         )}

         {/* PREFERÊNCIAS DE INTERFACE (TODOS) */}
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
                     <button
                        onClick={() => onSetThemeMode('light')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                            themeMode === 'light' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                     >
                        <Sun size={24} className="mb-2" />
                        <span className="text-sm font-bold">Modo Claro</span>
                     </button>

                     <button
                        onClick={() => onSetThemeMode('dark')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                            themeMode === 'dark' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                     >
                        <Moon size={24} className="mb-2" />
                        <span className="text-sm font-bold">Modo Escuro</span>
                     </button>

                     <button
                        onClick={() => onSetThemeMode('system')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                            themeMode === 'system' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                            : 'border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                     >
                        <Monitor size={24} className="mb-2" />
                        <span className="text-sm font-bold">Automático</span>
                        <span className="text-[10px] opacity-70 mt-1">Claro até 18h</span>
                     </button>
                 </div>

                 <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50 mt-4">
                     <div className="flex items-center gap-3">
                         <BellRing size={20} className="text-blue-500"/>
                         <div>
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Notificações Push</p>
                             <p className="text-xs text-zinc-500">Receber avisos e escalas neste dispositivo.</p>
                         </div>
                     </div>
                     
                     <button 
                        disabled={isNotifLoading || !onEnableNotifications}
                        onClick={async () => {
                            if (onEnableNotifications) {
                                setIsNotifLoading(true);
                                try {
                                    await onEnableNotifications();
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setIsNotifLoading(false);
                                }
                            }
                        }}
                        className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-50"
                     >
                        {isNotifLoading && <Loader2 size={12} className="animate-spin" />}
                        {isNotifLoading ? 'Ativando...' : 'Ativar'}
                     </button>
                 </div>
             </div>
         </div>

         {/* SISTEMA (ADMIN ONLY) */}
         {isAdmin && (
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Sistema</h3>
                 <div className="space-y-4">
                     {onAnnounceUpdate && (
                         <div>
                             <button 
                                 onClick={onAnnounceUpdate}
                                 className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 transition-colors"
                             >
                                 <Megaphone size={18}/>
                                 <span className="text-sm font-bold">Anunciar Nova Versão</span>
                             </button>
                             <p className="text-xs text-zinc-400 mt-2 text-center">Envia uma notificação para todos os membros recarregarem o app.</p>
                         </div>
                     )}
                     {!onAnnounceUpdate && <p className="text-zinc-400 text-sm italic">Nenhuma ação de sistema disponível.</p>}
                 </div>
             </div>
         )}
    </div>
  );
};