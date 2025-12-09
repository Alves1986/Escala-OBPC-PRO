
import React, { useState, useRef } from 'react';
import { Share2, FileText, FileSpreadsheet, Trash, ChevronDown, Upload, FileDown, RotateCcw } from 'lucide-react';

interface Props {
  onExportIndividual: (member: string) => void;
  onExportFull: () => void;
  onWhatsApp: () => void;
  onCSV: () => void;
  onImportCSV: (file: File) => void;
  onClearMonth: () => void;
  onResetEvents: () => void;
  allMembers: string[];
}

export const ToolsMenu: React.FC<Props> = ({ 
  onExportIndividual, 
  onExportFull, 
  onWhatsApp, 
  onCSV, 
  onImportCSV, 
  onClearMonth,
  onResetEvents,
  allMembers 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIndividual = () => {
    if (!selectedMember) return alert("Selecione um membro primeiro");
    onExportIndividual(selectedMember);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportCSV(e.target.files[0]);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg font-medium shadow-sm border border-zinc-200 dark:border-zinc-700 transition-all"
      >
        Ferramentas <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden animate-fade-in">
          
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700">
            <p className="text-xs font-bold text-zinc-500 uppercase px-2 mb-2">Exportar Individual</p>
            <div className="flex gap-2">
              <select 
                value={selectedMember} 
                onChange={e => setSelectedMember(e.target.value)}
                className="w-full text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 rounded p-1"
              >
                <option value="">Selecione...</option>
                {allMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <button onClick={handleIndividual} className="bg-zinc-200 dark:bg-zinc-700 p-1 rounded hover:bg-zinc-300">
                <FileText size={16} />
              </button>
            </div>
          </div>

          <div className="p-2 space-y-1">
            <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded flex items-center gap-2">
              <Upload size={16} /> Importar CSV (Membros)
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileChange} 
            />
            
            <button onClick={onWhatsApp} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded flex items-center gap-2">
              <Share2 size={16} /> Copiar para WhatsApp
            </button>
            
            <button onClick={onExportFull} className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded flex items-center gap-2">
              <FileDown size={16} /> Baixar PDF Completo
            </button>

            <button onClick={onCSV} className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded flex items-center gap-2">
              <FileSpreadsheet size={16} /> Baixar Tabela CSV
            </button>
            
            <div className="border-t border-zinc-100 dark:border-zinc-700 my-1"></div>
            
            {/* Botão Restaurar Padrão */}
            <button onClick={() => { setIsOpen(false); onResetEvents(); }} className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded flex items-center gap-2">
              <RotateCcw size={16} /> Restaurar Eventos Padrão
            </button>

            <button onClick={onClearMonth} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2">
              <Trash size={16} /> Limpar Escala do Mês
            </button>
          </div>
        </div>
      )}
      
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
};
