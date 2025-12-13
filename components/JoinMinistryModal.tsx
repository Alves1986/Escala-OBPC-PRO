
import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Plus, Building2 } from 'lucide-react';
import { MINISTRIES, DEFAULT_ROLES } from '../types';
import { fetchMinistrySettings } from '../services/supabaseService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (ministryId: string, roles: string[]) => Promise<void>;
  alreadyJoined: string[]; // IDs dos ministérios que o usuário JÁ participa
}

export const JoinMinistryModal: React.FC<Props> = ({ isOpen, onClose, onJoin, alreadyJoined }) => {
  const [selectedMinistry, setSelectedMinistry] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filtra ministérios disponíveis (exclui os que o usuário já tem)
  const availableMinistries = MINISTRIES.filter(m => !alreadyJoined.includes(m.id));

  // Carrega as funções quando um ministério é selecionado
  useEffect(() => {
    async function fetchRoles() {
      if (!selectedMinistry) {
        setAvailableRoles([]);
        setSelectedRoles([]);
        return;
      }

      setLoadingRoles(true);
      const defaults = DEFAULT_ROLES[selectedMinistry] || [];
      
      try {
        const settings = await fetchMinistrySettings(selectedMinistry);
        const dynamicRoles = settings.roles;
        setAvailableRoles(dynamicRoles && dynamicRoles.length > 0 ? dynamicRoles : defaults);
      } catch (e) {
        setAvailableRoles(defaults);
      } finally {
        setLoadingRoles(false);
      }
    }

    fetchRoles();
  }, [selectedMinistry]);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleJoin = async () => {
    if (!selectedMinistry) return;
    setSubmitting(true);
    await onJoin(selectedMinistry, selectedRoles);
    setSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Entrar em Novo Ministério</h2>
            <p className="text-sm text-zinc-500">Expanda sua participação na equipe.</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* 1. Seleção de Ministério */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Escolha o Ministério</label>
            {availableMinistries.length === 0 ? (
                <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-center text-zinc-500 text-sm">
                    Você já participa de todos os ministérios disponíveis!
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {availableMinistries.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMinistry(m.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                selectedMinistry === m.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-blue-300 dark:hover:border-zinc-600'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Building2 size={18} className={selectedMinistry === m.id ? 'text-blue-500' : 'text-zinc-400'}/>
                                {m.label}
                            </span>
                            {selectedMinistry === m.id && <Check size={18} className="text-blue-500"/>}
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* 2. Seleção de Funções (Condicional) */}
          {selectedMinistry && (
              <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Suas Funções (Neste Ministério)</label>
                      {loadingRoles && <Loader2 size={14} className="animate-spin text-blue-500"/>}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                      {availableRoles.length > 0 ? availableRoles.map(role => {
                          const isSelected = selectedRoles.includes(role);
                          return (
                              <button
                                  key={role}
                                  onClick={() => toggleRole(role)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                      isSelected 
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                  }`}
                              >
                                  {role}
                                  {isSelected && <Check size={12} />}
                              </button>
                          );
                      }) : (
                          <p className="text-sm text-zinc-400 italic">Nenhuma função específica.</p>
                      )}
                  </div>
              </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleJoin}
                disabled={!selectedMinistry || submitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
            >
                {submitting ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />}
                Confirmar Entrada
            </button>
        </div>
      </div>
    </div>
  );
};
