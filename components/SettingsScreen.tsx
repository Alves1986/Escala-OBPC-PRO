

import React, { useState } from 'react';
import { Settings, Save, Moon, Sun, BellRing, RefreshCw, FileText, Shield, Megaphone, Send, KeyRound, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from './Toast';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { VAPID_PUBLIC_KEY } from '../utils/pushUtils';
import { testPushNotification, getSupabase } from '../services/supabaseService';

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
  const [testingPush, setTestingPush] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const { addToast } = useToast();

  const handleTestPush = async () => {
    if(!ministryId) return;
    setTestingPush(true);
    const result = await testPushNotification(ministryId);
    setTestingPush(false);
    if(result.success) {
        addToast(result.message, "success");
    } else {
        addToast("Erro: " + result.message, "error");
    }
  };

  const handleGenerateKeys = async () => {
      setGeneratingKeys(true);
      try {
          const supabase = getSupabase();
          if(!supabase) return;
          
          // Chama a Edge Function com a ação especial para gerar chaves
          const { data, error } = await supabase.functions.invoke('push-notification', {
              body: { action: 'generate_keys' }
          });

          if (error) throw error;
          
          if (data && data.keys) {
              setGeneratedKeys(data.keys);
              addToast("Chaves geradas com sucesso!", "success");
          } else {
              throw new Error("Resposta inválida da função");
          }
      } catch (e: any) {
          console.error(e);
          addToast("Erro ao gerar chaves: " + e.message, "error");
      } finally {
          setGeneratingKeys(false);
      }
  };

  const copyToClipboard = (text: string, label: string) => {
      navigator.clipboard.writeText(text);
      addToast(`${label} copiada!`, "success");
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
                </div>
             </div>
         </div>

         {/* DIAGNÓSTICO E CORREÇÃO DE PUSH */}
         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-red-200 dark:border-red-900/30 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <KeyRound size={80} />
             </div>
             <h3 className="text-sm font-bold text-red-500 uppercase mb-4 flex items-center gap-2">
                 <AlertTriangle size={16}/> Diagnóstico de Notificações
             </h3>
             
             {!generatedKeys ? (
                 <>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                        Se você está recebendo o erro <strong>"Vapid private key should be 32 bytes"</strong> ou <strong>"non-2xx status code"</strong>, suas chaves de segurança no Supabase estão inválidas.
                    </p>
                    <button 
                        onClick={handleGenerateKeys}
                        disabled={generatingKeys}
                        className="w-full sm:w-auto px-4 py-3 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg text-sm font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-2 transition-colors border border-zinc-300 dark:border-zinc-600"
                    >
                        <KeyRound size={16}/> {generatingKeys ? 'Gerando...' : 'Gerar Novo Par de Chaves VAPID'}
                    </button>
                 </>
             ) : (
                 <div className="space-y-4 animate-fade-in bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                     <div className="flex items-center gap-2 text-green-600 font-bold mb-2">
                         <CheckCircle2 size={18}/> Chaves Geradas com Sucesso!
                     </div>
                     
                     <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">1. Chave Privada (Private Key)</label>
                         <div className="flex gap-2">
                             <input readOnly value={generatedKeys.privateKey} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-xs font-mono text-red-500" />
                             <button onClick={() => copyToClipboard(generatedKeys.privateKey, "Chave Privada")} className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300"><Copy size={16}/></button>
                         </div>
                         <p className="text-[10px] text-zinc-500 mt-1">Cole esta chave nos <strong>Secrets do Supabase</strong> com o nome <code>VAPID_PRIVATE_KEY</code>.</p>
                     </div>

                     <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">2. Chave Pública (Public Key)</label>
                         <div className="flex gap-2">
                             <input readOnly value={generatedKeys.publicKey} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-xs font-mono text-blue-500" />
                             <button onClick={() => copyToClipboard(generatedKeys.publicKey, "Chave Pública")} className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300"><Copy size={16}/></button>
                         </div>
                         <p className="text-[10px] text-zinc-500 mt-1">Me envie esta chave no chat para eu atualizar o código do App.</p>
                     </div>
                 </div>
             )}

             <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-4">
                 <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Teste de Envio</p>
                 <div className="flex gap-2">
                    <button 
                        onClick={handleTestPush}
                        disabled={testingPush}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-blue-600/20"
                    >
                        <Send size={16}/> {testingPush ? 'Enviando...' : 'Enviar Notificação de Teste'}
                    </button>
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
                             <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">Sincronizar Dispositivo</p>
                             <p className="text-xs text-zinc-500">Habilitar este aparelho para receber avisos.</p>
                         </div>
                     </div>
                     
                     <button 
                        onClick={() => {
                            if (onEnableNotifications) {
                                onEnableNotifications().then(() => addToast("Sincronizado!", "success"));
                            }
                        }}
                        className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg"
                     >
                        Ativar
                     </button>
                 </div>
             </div>
         </div>

         {/* SISTEMA & DADOS */}
         <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
             <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Sistema</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <button 
                     onClick={() => window.location.reload()}
                     className="flex items-center justify-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                 >
                     <RefreshCw size={18}/>
                     <span className="text-sm font-medium">Recarregar Aplicação</span>
                 </button>
                 
                 {onAnnounceUpdate && (
                     <div className="md:col-span-2">
                         <button 
                             onClick={onAnnounceUpdate}
                             className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 transition-colors"
                         >
                             <Megaphone size={18}/>
                             <span className="text-sm font-bold">Anunciar Nova Versão</span>
                         </button>
                     </div>
                 )}
             </div>
         </div>
    </div>
  );
};