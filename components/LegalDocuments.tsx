
import React from 'react';
import { X, Shield, FileText, ArrowLeft } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | null;

// --- CONTEÚDO PURO (Reutilizável) ---
const LegalContent: React.FC<{ type: LegalDocType }> = ({ type }) => {
  if (type === 'terms') {
      return (
        <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
          <p><strong>Última atualização: {new Date().toLocaleDateString('pt-BR')}</strong></p>
          
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Aceitação dos Termos</h3>
          <p>Ao acessar e utilizar o sistema <strong>Escala Mídia Pro</strong>, você concorda em cumprir e ficar vinculado aos seguintes termos e condições de uso. Se você não concordar com estes termos, não deverá utilizar o serviço.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Descrição do Serviço</h3>
          <p>O Escala Mídia Pro é uma ferramenta de gestão de escalas, disponibilidade e comunicação para equipes voluntárias e ministeriais. O serviço é fornecido "como está", sem garantias de que será ininterrupto ou livre de erros.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Responsabilidades do Usuário</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Você é responsável por manter a confidencialidade de sua senha e conta.</li>
            <li>Você concorda em fornecer informações verdadeiras e precisas sobre sua disponibilidade.</li>
            <li>É proibido usar o sistema para fins ilegais ou não autorizados pela liderança da equipe.</li>
          </ul>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Propriedade Intelectual</h3>
          <p>Todo o código-fonte, design, logotipos e funcionalidades do sistema são propriedade exclusiva dos desenvolvedores ou licenciados para a organização. O uso não autorizado de qualquer material é estritamente proibido.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Encerramento</h3>
          <p>A administração reserva-se o direito de suspender ou encerrar sua conta a qualquer momento, por qualquer motivo, incluindo, sem limitação, a violação destes Termos de Uso.</p>
        </div>
      );
    }

    if (type === 'privacy') {
      return (
        <div className="space-y-4 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify">
          <p><strong>Última atualização: {new Date().toLocaleDateString('pt-BR')}</strong></p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">1. Coleta de Informações</h3>
          <p>Para o funcionamento adequado das escalas, coletamos as seguintes informações pessoais:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nome completo (para identificação na escala).</li>
            <li>E-mail (para login e recuperação de senha).</li>
            <li>Telefone/WhatsApp (para comunicação urgente e notificações).</li>
            <li>Foto de perfil (opcional, para identificação visual).</li>
            <li>Dados de disponibilidade (datas em que você pode ou não servir).</li>
          </ul>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">2. Uso das Informações</h3>
          <p>Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Organização e geração de escalas de voluntários.</li>
            <li>Envio de notificações sobre eventos, trocas e avisos.</li>
            <li>Gestão administrativa da equipe.</li>
          </ul>
          <p>Nós <strong>não</strong> vendemos, trocamos ou transferimos suas informações pessoais para terceiros externos para fins de marketing.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">3. Segurança dos Dados</h3>
          <p>Implementamos medidas de segurança para manter suas informações pessoais protegidas. Os dados são armazenados em bancos de dados seguros (Supabase) com autenticação criptografada.</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">4. Seus Direitos</h3>
          <p>Você tem o direito de acessar, corrigir ou solicitar a exclusão de seus dados pessoais a qualquer momento. Para excluir sua conta, entre em contato com o administrador do sistema ou utilize a opção de exclusão nas configurações (se disponível).</p>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mt-4">5. Alterações nesta Política</h3>
          <p>Podemos atualizar nossa Política de Privacidade periodicamente. Recomendamos que você revise esta página regularmente para quaisquer alterações.</p>
        </div>
      );
    }
    return null;
};

// --- MODAL (Uso interno no App) ---
interface Props {
  isOpen: boolean;
  type: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<Props> = ({ isOpen, type, onClose }) => {
  if (!isOpen || !type) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${type === 'terms' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
               {type === 'terms' ? <FileText size={20}/> : <Shield size={20}/>}
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           <LegalContent type={type} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PÁGINA PÚBLICA (Uso Externo/Google Cloud) ---
export const PublicLegalPage: React.FC<{ type: LegalDocType }> = ({ type }) => {
    if (!type) return null;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center py-10 px-4">
            <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                     <button 
                        onClick={() => window.location.href = '/'}
                        className="p-2 -ml-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                        title="Voltar ao início"
                     >
                        <ArrowLeft size={24} className="text-zinc-500" />
                     </button>
                     <div>
                        <h1 className="text-2xl font-bold">
                            {type === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
                        </h1>
                        <p className="text-sm text-zinc-500">Gestão de Escala OBPC</p>
                     </div>
                </div>
                
                <div className="p-8 md:p-12">
                    <LegalContent type={type} />
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-800 text-center">
                    <p className="text-xs text-zinc-400">
                        &copy; {new Date().getFullYear()} Gestão Escala OBPC. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
};
