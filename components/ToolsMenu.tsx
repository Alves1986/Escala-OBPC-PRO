import React, { useState } from 'react';
import {
  Share2,
  FileText,
  Trash,
  ChevronDown,
  FileDown,
  RotateCcw,
  Sparkles,
  X,
  Calendar
} from 'lucide-react';

interface Props {
  onExportIndividual: (member: string) => void;
  onExportFull: () => void;
  onWhatsApp: () => void;
  onClearMonth: () => void;
  onResetEvents: () => void;
  onAiAutoFill?: () => void;
  onSyncCalendar?: () => void;
  allMembers: string[];
  isAdmin?: boolean; // 👈 CONTROLE REAL
}

export const ToolsMenu: React.FC<Props> = ({
  onExportIndividual,
  onExportFull,
  onWhatsApp,
  onClearMonth,
  onResetEvents,
  onAiAutoFill,
  onSyncCalendar,
  allMembers,
  isAdmin = false // padrão seguro
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');

  const handleIndividual = () => {
    if (!selectedMember) {
      alert('Selecione um membro primeiro');
      return;
    }
    onExportIndividual(selectedMember);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* BOTÃO PRINCIPAL */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg font-medium shadow-sm border border-zinc-200 dark:border-zinc-700 transition-all active:scale-95"
      >
        Ferramentas <ChevronDown size={16} />
      </button>

      {isOpen && (
        <>
          {/* BACKDROP */}
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* CONTAINER */}
          <div
            className={`
              fixed md:absolute z-[70] bg-white dark:bg-zinc-800 overflow-hidden animate-fade-in
              bottom-0 left-0 right-0 w-full rounded-t-2xl
              shadow-[0_-4px_20px_rgba(0,0,0,0.3)]
              border-t border-zinc-200 dark:border-zinc-700
              md:bottom-auto md:left-auto md:right-0 md:top-full md:mt-2 md:w-72 md:rounded-xl md:shadow-xl md:border
            `}
          >
            {/* HEADER MOBILE */}
            <div className="flex md:hidden justify-between items-center p-4 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
              <span className="font-bold text-zinc-800 dark:text-white">
                Ferramentas de Escala
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-1">
              {/* EXPORTAÇÃO INDIVIDUAL */}
              <div className="pb-3 border-b border-zinc-100 dark:border-zinc-700 mb-2">
                <p className="text-xs font-bold text-zinc-500 uppercase mb-2">
                  Exportar Individual
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedMember}
                    onChange={e => setSelectedMember(e.target.value)}
                    className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Selecione...</option>
                    {allMembers.map(member => (
                      <option key={member} value={member}>
                        {member}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleIndividual}
                    className="bg-zinc-100 dark:bg-zinc-700 p-2.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200"
                  >
                    <FileText size={18} />
                  </button>
                </div>
              </div>

              {/* AÇÕES COMUNS */}
              <button
                onClick={onWhatsApp}
                className="w-full text-left px-3 py-3 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg flex items-center gap-3 transition-colors"
              >
                <Share2 size={18} /> Copiar para WhatsApp
              </button>

              <button
                onClick={onExportFull}
                className="w-full text-left px-3 py-3 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center gap-3 transition-colors"
              >
                <FileDown size={18} /> Baixar PDF Completo
              </button>

              {/* GERENCIAMENTO — ADMIN ONLY */}
              {isAdmin && (
                <>
                  <div className="border-t border-zinc-100 dark:border-zinc-700 my-2" />

                  <p className="px-3 pt-1 text-xs font-bold text-zinc-500 uppercase">
                    Gerenciamento
                  </p>

                  {onAiAutoFill && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onAiAutoFill();
                      }}
                      className="w-full text-left px-3 py-3 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg flex items-center gap-3 font-bold transition-colors"
                    >
                      <Sparkles size={18} /> Auto-Escala com IA
                    </button>
                  )}

                  {onSyncCalendar && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onSyncCalendar();
                      }}
                      className="w-full text-left px-3 py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg flex items-center gap-3 transition-colors font-medium"
                    >
                      <Calendar size={18} /> Sincronizar Google Agenda
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onResetEvents();
                    }}
                    className="w-full text-left px-3 py-3 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg flex items-center gap-3 transition-colors"
                  >
                    <RotateCcw size={18} /> Restaurar Eventos Padrão
                  </button>

                  <button
                    onClick={onClearMonth}
                    className="w-full text-left px-3 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-3 transition-colors"
                  >
                    <Trash size={18} /> Limpar Escala do Mês
                  </button>
                </>
              )}
            </div>

            {/* ESPAÇO EXTRA MOBILE */}
            <div className="h-6 md:hidden" />
          </div>
        </>
      )}
    </div>
  );
};

