
import React, { useState } from 'react';
import { Settings, Save, Moon, Sun, BellRing, Megaphone } from 'lucide-react';
import { useToast } from './Toast';
import { LegalModal, LegalDocType } from './LegalDocuments';

interface Props {
  initialTitle: string;
  ministryId: string | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSaveTitle: (newTitle: string) => Promise<void>;
  onAnnounceUpdate?: () => Promise<void>;
  onEnableNotifications?: () => Promise<void>;
}

export const SettingsScreen: React.FC<Props> = ({ initialTitle, ministryId, theme, onToggleTheme, onSaveTitle, onAnnounceUpdate, onEnableNotifications }) => {
  const [tempTitle, setTempTitle] = useState(initialTitle);
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
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
         
         {/* CONFIGURAÇÃO GERAL */}
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

         {/* PREFERÊNCIAS DE INTERFACE */}
         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Preferências</h3>
             <div className="space-y-4">
                 <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                     <div className="flex items-center gap-3">
                         {theme === 'dark' ? <Moon size={20} className="text-indigo-400"/> : <Sun size={20} className="text-orange-400"/>}
                         <div>
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Tema do Sistema</p>
                             <p className="text-xs text-zinc-500">Alternar entre modo Claro e Escuro</p>
                         </div>
                     </div>
                     <button 
                        onClick={onToggleTheme}
                        className="text-xs font-bold bg-zinc-200 dark:bg-zinc-700 px-3 py-1.5 rounded-lg text-zinc-700 dark:text-zinc-300"
                     >
                         {theme === 'dark' ? 'Mudar p/ Claro' : 'Mudar p/ Escuro'}
                     </button>
                 </div>

                 <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                     <div className="flex items-center gap-3">
                         <BellRing size={20} className="text-blue-500"/>
                         <div>
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Notificações Push</p>
                             <p className="text-xs text-zinc-500">Receber avisos e escalas neste dispositivo.</p>
                         </div>
                     </div>
                     
                     <button 
                        onClick={() => {
                            if (onEnableNotifications) {
                                onEnableNotifications().then(() => addToast("Dispositivo Sincronizado!", "success"));
                            }
                        }}
                        className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
                     >
                        Ativar
                     </button>
                 </div>
             </div>
         </div>

         {/* SISTEMA */}
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
    </div>
  );
};
