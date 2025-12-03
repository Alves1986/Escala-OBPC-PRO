
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { UserCircle, Save, X, Phone, Mail, Building2 } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  currentUser: User | null;
  onUpdateProfile: (name: string, whatsapp: string) => Promise<void>;
  isPage?: boolean;
}

export const ProfileModal: React.FC<Props> = ({ isOpen, onClose, currentUser, onUpdateProfile, isPage }) => {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setWhatsapp(currentUser.whatsapp || "");
    }
  }, [currentUser, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdateProfile(name, whatsapp);
      if (onClose) onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const content = (
    <>
      {/* Header */}
      <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center">
          {!isPage && onClose && (
            <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
            </button>
          )}
          
          <div className="w-24 h-24 mx-auto bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center text-blue-600 shadow-xl mb-4 border-4 border-white/20">
              <UserCircle size={64} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{currentUser.name}</h2>
          <p className="text-blue-100 font-medium">{currentUser.role === 'admin' ? 'Administrador / Líder' : 'Membro da Equipe'}</p>
      </div>

      {/* Form */}
      <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Nome de Exibição</label>
                  <div className="relative">
                      <UserCircle className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                      <input 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Seu nome completo"
                      />
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">WhatsApp</label>
                  <div className="relative">
                      <Phone className="absolute left-3 top-2.5 text-zinc-400" size={18} />
                      <input 
                          value={whatsapp}
                          onChange={e => setWhatsapp(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="(00) 00000-0000"
                      />
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">E-mail (Login)</label>
                      <div className="flex items-center gap-2 p-2.5 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 text-xs truncate">
                          <Mail size={16} className="shrink-0"/>
                          <span className="truncate">{currentUser.email}</span>
                      </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">ID Ministério</label>
                      <div className="flex items-center gap-2 p-2.5 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 text-xs truncate">
                          <Building2 size={16} className="shrink-0"/>
                          <span className="truncate">{currentUser.ministryId}</span>
                      </div>
                  </div>
              </div>

              <div className="pt-4">
                  <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                      {loading ? 'Salvando...' : <><Save size={18}/> Salvar Alterações</>}
                  </button>
              </div>
          </form>
      </div>
    </>
  );

  if (isPage) {
    return (
      <div className="w-full max-w-3xl mx-auto animate-fade-in pb-10">
         <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Meu Perfil</h2>
         </div>
         <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {content}
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="overflow-y-auto custom-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};
