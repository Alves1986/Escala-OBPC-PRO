
import React from 'react';
import { X, Shield } from 'lucide-react';

export type LegalDocType = 'terms' | 'privacy' | null;

// --- CONTEÚDO PURO (Reutilizável) ---
const LegalContent: React.FC<{ type: LegalDocType }> = ({ type }) => {
  const lastUpdate = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  if (type === 'terms') {
      return (
        <div className="space-y-6 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify animate-fade-in">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg text-xs text-zinc-500 mb-6">
            <strong>Última atualização:</strong> {lastUpdate} <br/>
            Por favor, leia estes termos atentamente antes de utilizar a plataforma.
          </div>
          
          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
              1. Aceitação dos Termos
            </h3>
            <p>
              Ao criar uma conta, acessar ou utilizar o sistema <strong>Gestão de Escala OBPC</strong> ("Plataforma"), você concorda expressamente em cumprir e vincular-se aos presentes Termos e Condições de Uso. Caso não concorde com qualquer disposição, você deve interromper o uso imediatamente.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              2. Natureza do Serviço e Voluntariado
            </h3>
            <p>
              A Plataforma tem como objetivo exclusivo a organização logística, comunicação e gestão de escalas de equipes ministeriais.
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-zinc-400">
              <li><strong>Inexistência de Vínculo Empregatício:</strong> O uso desta ferramenta para gestão de escalas não constitui, em hipótese alguma, vínculo empregatício, promessa de remuneração ou obrigatoriedade de prestação de serviços.</li>
              <li><strong>Caráter Voluntário:</strong> A participação nas escalas geridas por este sistema é de natureza estritamente voluntária, religiosa e beneficente.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              3. Responsabilidades do Usuário
            </h3>
            <p>Ao utilizar o sistema, você se compromete a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-zinc-400">
              <li>Manter a confidencialidade de suas credenciais de acesso (login e senha).</li>
              <li>Fornecer informações verdadeiras, exatas e atualizadas sobre sua disponibilidade.</li>
              <li>Utilizar os canais de comunicação (Avisos/Chats) de forma respeitosa, ética e condizente com os princípios da organização.</li>
              <li>Não tentar violar a segurança da plataforma ou extrair dados de outros membros sem autorização.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              4. Disponibilidade e Modificações
            </h3>
            <p>
              A administração da Plataforma envidará os melhores esforços para manter o sistema disponível 24/7. No entanto, o serviço é fornecido "como está", podendo ocorrer interrupções para manutenção, atualizações ou devido a falhas de terceiros (servidores, APIs). Reservamo-nos o direito de modificar ou descontinuar funcionalidades a qualquer momento.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              5. Propriedade Intelectual
            </h3>
            <p>
              Todo o código-fonte, design, interfaces visuais, logotipos e funcionalidades são de propriedade exclusiva dos desenvolvedores ou licenciados para a organização. É proibida a reprodução, engenharia reversa ou distribuição não autorizada.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              6. Disposições Finais
            </h3>
            <p>
              A administração reserva-se o direito de suspender ou encerrar contas que violem estes termos, causem danos à comunidade ou utilizem a plataforma para fins ilícitos.
            </p>
          </section>
        </div>
      );
    }

    if (type === 'privacy') {
      return (
        <div className="space-y-6 text-zinc-700 dark:text-zinc-300 text-sm leading-relaxed text-justify animate-fade-in">
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-lg text-xs text-zinc-500 mb-6 flex gap-3">
             <Shield className="shrink-0 text-teal-500" size={16} />
             <div>
               <strong>Compromisso com a Privacidade:</strong> Seus dados são utilizados estritamente para a organização das atividades ministeriais e nunca serão vendidos a terceiros.
             </div>
          </div>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              1. Coleta de Dados
            </h3>
            <p>Para o funcionamento das escalas e comunicação, coletamos e processamos os seguintes dados pessoais:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <strong className="block text-zinc-900 dark:text-white text-xs uppercase mb-1">Identificação</strong>
                    Nome completo, E-mail e Foto de Perfil.
                </div>
                <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <strong className="block text-zinc-900 dark:text-white text-xs uppercase mb-1">Contato</strong>
                    Número de telefone/WhatsApp (para urgências).
                </div>
                <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <strong className="block text-zinc-900 dark:text-white text-xs uppercase mb-1">Operacional</strong>
                    Datas de disponibilidade, funções exercidas e histórico de participação.
                </div>
                <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                    <strong className="block text-zinc-900 dark:text-white text-xs uppercase mb-1">Técnico</strong>
                    Logs de acesso, IP e interações no sistema (para auditoria).
                </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              2. Finalidade do Tratamento
            </h3>
            <p>Os dados coletados têm como base legal o legítimo interesse e a execução de atividades voluntárias, sendo utilizados para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 marker:text-zinc-400">
              <li>Criação e gerenciamento de escalas de serviço.</li>
              <li>Envio de notificações automáticas (lembretes, trocas, avisos).</li>
              <li>Identificação visual dos membros nas equipes.</li>
              <li>Geração de métricas de engajamento (Ranking).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">
              3. Armazenamento e Segurança
            </h3>
            <p>
              Adotamos práticas de segurança alinhadas ao mercado (criptografia em repouso e em trânsito) e utilizamos infraestrutura de nuvem confiável (Supabase/Google).
            </p>
          </section>
        </div>
      );
    }
    
    return null;
};

interface LegalModalProps {
  isOpen: boolean;
  type: LegalDocType;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ isOpen, type, onClose }) => {
  if (!isOpen || !type) return null;

  const titles = {
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            {titles[type]}
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <LegalContent type={type} />
        </div>

        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-opacity active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
