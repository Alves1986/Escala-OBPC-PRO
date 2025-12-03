
import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { User as UserIcon, Mail, Hash, Briefcase, Save, Key, Camera, Image as ImageIcon } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  user: User;
  onUpdateProfile: (name: string, whatsapp: string, avatar_url?: string) => Promise<void>;
}

export const ProfileScreen: React.FC<Props> = ({ user, onUpdateProfile }) => {
  const [name, setName] = useState(user.name);
  const [whatsapp, setWhatsapp] = useState(user.whatsapp || '');
  const [avatar, setAvatar] = useState(user.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    setName(user.name);
    setWhatsapp(user.whatsapp || '');
    setAvatar(user.avatar_url || '');
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
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
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
          
          // Compress to JPEG with 0.7 quality to save space in metadata
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        addToast("A imagem deve ter no máximo 2MB.", "error");
        return;
      }

      try {
        const compressedBase64 = await compressImage(file);
        setAvatar(compressedBase64);
        addToast("Imagem carregada! Clique em Salvar.", "info");
      } catch (err) {
        addToast("Erro ao processar imagem.", "error");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return addToast("O nome é obrigatório", "error");
    
    setLoading(true);
    try {
      await onUpdateProfile(name, whatsapp, avatar);
    } catch (e) {
      addToast("Erro ao atualizar perfil", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Meu Perfil</h2>
        <p className="text-zinc-500 text-sm">Gerencie suas informações pessoais e de acesso.</p>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-700">
        
        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center mb-8 relative">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-zinc-700 shadow-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
               {avatar ? (
                 <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold">
                   {name.charAt(0).toUpperCase()}
                 </div>
               )}
            </div>
            
            {/* Overlay Icon */}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Camera className="text-white" size={32} />
            </div>

            {/* Small Badge Icon */}
            <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full shadow-md border-2 border-white dark:border-zinc-800">
               <Camera size={16} />
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          <h3 className="text-xl font-bold text-zinc-800 dark:text-white mt-4">{user.name}</h3>
          <span className="text-sm px-3 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-full text-zinc-500 mt-2 capitalize font-medium">
            {user.role === 'admin' ? 'Administrador / Líder' : 'Membro da Equipe'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nome de Exibição</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">WhatsApp</label>
              <div className="relative">
                <Hash size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  value={whatsapp} 
                  onChange={e => setWhatsapp(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="space-y-2 opacity-60">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">E-mail (Login) <Key size={12}/></label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="email" 
                  value={user.email || ''} 
                  disabled
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2 opacity-60">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">ID Ministério <Key size={12}/></label>
              <div className="relative">
                <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  type="text" 
                  value={user.ministryId || ''} 
                  disabled
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
             {loading ? 'Salvando...' : <><Save size={20}/> Salvar Alterações</>}
          </button>
        </form>
      </div>
    </div>
  );
};
