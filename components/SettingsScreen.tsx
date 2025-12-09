import React, { useState } from 'react';
import { Settings, Save, Moon, Sun, BellRing, RefreshCw, FileText, Shield, Megaphone, Database, CheckCircle2, UserX } from 'lucide-react';
import { useToast } from './Toast';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { migrateLegacyData, removeDuplicateProfiles } from '../services/supabaseService';

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
  const [migrating, setMigrating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const { addToast, confirmAction } = useToast();

  const handleMigration = async () => {
      if (!ministryId) return;
      confirmAction(
          "Migrar Dados Antigos?",
          "Essa ação irá buscar membros e disponibilidades que estavam salvos no sistema antigo (V1) e movê-los para o novo banco de dados (V2). Use isso se seus membros sumiram após a atualização.",
          async () => {
              setMigrating(true);
              const result = await migrateLegacyData(ministryId);
              setMigrating(false);
              addToast(result.message, result.success ? 'success' : 'error');
              if (result.success) {
                  setTimeout(() => window.location.reload(), 2000);
              }
          }
      );
  };

  const handleDeduplicate = async () => {
      if (!ministryId) return;
      confirmAction(
          "Corrigir Duplicatas?",
          "Isso irá buscar membros com o mesmo E-mail e fundi-los em um único perfil, mantendo todas as escalas, disponibilidades e permissões de ministérios (Ex: Comunicação + Louvor).",
          async () => {
              setCleaning(true);
              const result = await removeDuplicateProfiles();
              setCleaning(false);
              addToast(result.message, result.success ? 'success' : 'error');
              if (result.success) {
                  setTimeout(() => window.location.reload(), 2000);
              }
          }
      );
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
                    <p className="text-xs text-zinc-400 mt-1">Esse nome aparecerá no topo do menu lateral para todos os usuários.</p>
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
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Notificações do Navegador</p>
                             <p className="text-xs text-zinc-500">Permitir que o sistema envie alertas.</p>
                         </div>
                     </div>
                     <button 
                        onClick={() => {
                            Notification.requestPermission().then(async (perm) => {
                                if(perm === 'granted') {
                                    addToast("Permissão concedida! Registrando...", "success");
                                    if (onEnableNotifications) await onEnableNotifications();
                                    new Notification("Notificações Ativas", { body: "Você receberá alertas de todos os seus ministérios.", icon: "/icon.png" });
                                } else {
                                    addToast("Permissão negada pelo navegador.", "error");
                                }
                            })
                        }}
                        className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg"
                     >
                         Testar / Ativar
                     </button>
                 </div>
             </div>
         </div>

         {/* SOBRE E LEGAL */}
         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Sobre e Legal</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <button 
                    onClick={() => setLegalDoc('terms')}
                    className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                 >
                    <div className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                        <FileText size={18} />
                    </div>
                    <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Termos de Uso</p>
                        <p className="text-xs text-zinc-500">Regras de utilização do serviço.</p>
                    </div>
                 </button>

                 <button 
                    onClick={() => setLegalDoc('privacy')}
                    className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                 >
                    <div className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                        <Shield size={18} />
                    </div>
                    <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Política de Privacidade</p>
                        <p className="text-xs text-zinc-500">Como tratamos seus dados.</p>
                    </div>
                 </button>
             </div>
         </div>

         {/* SISTEMA & DADOS */}
         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Sistema & Dados</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <button 
                     onClick={() => {
                         window.location.reload();
                     }}
                     className="flex items-center justify-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                 >
                     <RefreshCw size={18}/>
                     <span className="text-sm font-medium">Recarregar Aplicação (Hard Reload)</span>
                 </button>
                 
                 <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/30 text-center flex flex-col justify-center">
                     <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                         Problemas com atualização?
                     </p>
                     <button 
                         onClick={async () => {
                             if ('serviceWorker' in navigator) {
                                 const registrations = await navigator.serviceWorker.getRegistrations();
                                 for (let registration of registrations) await registration.unregister();
                             }
                             window.location.reload();
                         }}
                         className="text-xs font-bold underline text-amber-700 dark:text-amber-400"
                     >
                         Limpar Cache do Service Worker
                     </button>
                 </div>

                 {/* Botão de Migração de Dados (V1 -> V2) */}
                 <div className="md:col-span-2 mt-2 pt-4 border-t border-zinc-100 dark:border-zinc-700 space-y-3">
                     <button 
                         onClick={handleMigration}
                         disabled={migrating || cleaning}
                         className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 transition-colors"
                     >
                         {migrating ? <RefreshCw size={18} className="animate-spin"/> : <Database size={18}/>}
                         <span className="text-sm font-bold">
                             {migrating ? "Migrando..." : "Migrar Dados Antigos (V1 -> V2)"}
                         </span>
                     </button>

                     {/* Botão de Limpeza de Duplicatas */}
                     <button 
                         onClick={handleDeduplicate}
                         disabled={migrating || cleaning}
                         className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 transition-colors"
                     >
                         {cleaning ? <RefreshCw size={18} className="animate-spin"/> : <UserX size={18}/>}
                         <span className="text-sm font-bold">
                             {cleaning ? "Corrigindo..." : "Corrigir Duplicatas de E-mail"}
                         </span>
                     </button>
                     <p className="text-[10px] text-zinc-400 text-center">
                         Use se um membro tem dois perfis (email + google) para mesclá-los.
                     </p>
                 </div>

                 {/* Botão de Anunciar Atualização (Apenas Admin) */}
                 {onAnnounceUpdate && (
                     <div className="md:col-span-2 mt-2">
                         <button 
                             onClick={onAnnounceUpdate}
                             className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 transition-colors"
                         >
                             <Megaphone size={18}/>
                             <span className="text-sm font-bold">Anunciar Nova Versão do App</span>
                         </button>
                     </div>
                 )}
             </div>
         </div>
    </div>
  );
};