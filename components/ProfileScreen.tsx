

import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { User as UserIcon, Mail, Hash, Briefcase, Save, Key, Camera, Image as ImageIcon, Check, Calendar, Shield, Sparkles } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  user: User;
  onUpdateProfile: (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string) => Promise<void>;
  availableRoles?: string[];
}

export const ProfileScreen: React.FC<Props> = ({ user, onUpdateProfile, availableRoles = [] }) => {
  const [name, setName] = useState(user.name);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>(user.functions || []);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    setName(user.name);
    setWhatsapp(user.whatsapp || '');
    setAvatar(user.avatar_url || '');
    setBirthDate(user.birthDate || '');
    setSelectedFunctions(user.functions || []);
  }, [user]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        addToast("A imagem deve ter no máximo 5MB.", "error");
        return;
      }

      try {
        const compressedBase64 = await compressImage(file);
        setAvatar(compressedBase64);
        addToast("Nova foto carregada! Salve para confirmar.", "info");
      } catch (err) {
        addToast("Erro ao processar imagem.", "error");
      }
    }
  };

  const toggleFunction = (role: string) => {
      if (selectedFunctions.includes(role)) {
          setSelectedFunctions(selectedFunctions.filter(r => r !== role));
      } else {
          setSelectedFunctions([...selectedFunctions, role]);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return addToast("O nome é obrigatório", "error");
    
    setLoading(true);
    try {
      await onUpdateProfile(name, whatsapp, avatar, selectedFunctions, birthDate);
    } catch (e) {
      addToast("Erro ao atualizar perfil", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      
      {/* Profile Header Card */}
      <div className="relative bg-white dark:bg-zinc-800 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-6">
          {/* Cover Background */}
          <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>

          <div className="px-6 pb-6 relative">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-4 -mt-12 mb-4">
                  {/* Avatar Circle */}
                  <div className="relative group cursor-pointer shrink-0" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center relative z-10">
                        {avatar ? (
                          <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                            <UserIcon size={48} />
                          </div>
                        )}
                      </div>
                      
                      <div className="absolute inset-0 z-20 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                        <Camera className="text-white drop-shadow-md" size={28} />
                      </div>

                      <div className="absolute bottom-1 right-1 z-30 bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-zinc-800 pointer-events-none">
                        <Camera size={14} />
                      </div>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />

                  {/* Name & Title */}
                  <div className="flex-1 text-center md:text-left mb-2">
                      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
                          {user.name} 
                          {user.role === 'admin' && <Shield size={18} className="text-blue-500 fill-blue-500/20"/>}
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                          {user.role === 'admin' ? 'Administrador do Sistema' : 'Membro da Equipe'}
                      </p>
                  </div>
              </div>
          </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Personal Info */}
          <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                      <UserIcon size={16}/> Dados Pessoais
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-1">Nome Completo</label>
                          <div className="relative group">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                              <input 
                                  type="text" 
                                  value={name} 
                                  onChange={e => setName(e.target.value)}
                                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-sm font-medium placeholder:text-zinc-400"
                                  placeholder="Como gostaria de ser chamado?"
                              />
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-1">WhatsApp</label>
                          <div className="relative group">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" size={18} />
                              <input 
                                  type="text" 
                                  value={whatsapp} 
                                  onChange={e => setWhatsapp(e.target.value)}
                                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-sm font-medium placeholder:text-zinc-400"
                                  placeholder="(00) 00000-0000"
                              />
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-1">Data de Nascimento</label>
                          <div className="relative group">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-pink-500 transition-colors" size={18} />
                              <input 
                                  type="date" 
                                  value={birthDate} 
                                  onChange={e => setBirthDate(e.target.value)}
                                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all text-zinc-800 dark:text-zinc-100 text-sm font-medium placeholder:text-zinc-400"
                              />
                          </div>
                      </div>

                      <div className="space-y-1.5 opacity-70">
                          <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-1 flex items-center gap-1">E-mail (Login) <Key size={10}/></label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                              <input 
                                  type="email" 
                                  value={user.email || ''} 
                                  disabled
                                  className="w-full pl-10 pr-4 py-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 cursor-not-allowed text-sm"
                              />
                          </div>
                      </div>
                  </div>
              </div>

              {/* Botão Salvar (Desktop - Wide) */}
              <button 
                  type="submit" 
                  disabled={loading}
                  className="hidden lg:flex w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {loading ? 'Salvando Alterações...' : <><Save size={20}/> Salvar Perfil</>}
              </button>
          </div>

          {/* Column 2: Roles/Functions */}
          <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm h-full flex flex-col">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Briefcase size={16}/> Minhas Funções
                  </h3>
                  <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                      Selecione as funções que você exerce na equipe. Isso ajuda na organização automática da escala.
                  </p>
                  
                  <div className="flex-1">
                      <div className="flex flex-wrap gap-2">
                          {availableRoles.length === 0 ? (
                              <div className="w-full py-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                                  <p className="text-zinc-400 text-sm italic">Nenhuma função configurada.</p>
                              </div>
                          ) : availableRoles.map(role => {
                              const isSelected = selectedFunctions.includes(role);
                              return (
                                  <button
                                      key={role}
                                      type="button"
                                      onClick={() => toggleFunction(role)}
                                      className={`group relative px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                                          isSelected 
                                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500/20' 
                                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                      }`}
                                  >
                                      {role}
                                      {isSelected && <Check size={14} className="text-blue-500" />}
                                  </button>
                              );
                          })}
                      </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                      <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg">
                          <Sparkles size={14} className="text-amber-500 shrink-0" />
                          <span>Mantenha suas funções atualizadas para receber os convites corretos.</span>
                      </div>
                  </div>
              </div>

              {/* Botão Salvar (Mobile) */}
              <button 
                  type="submit" 
                  disabled={loading}
                  className="lg:hidden w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {loading ? 'Salvando...' : <><Save size={20}/> Salvar Perfil</>}
              </button>
          </div>
      </form>
    </div>
  );
};
