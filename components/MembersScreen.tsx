
import React from 'react';
import { Users, Mail, Phone, Gift, ShieldCheck, Trash2 } from 'lucide-react';
import { TeamMemberProfile, User } from '../types';

interface Props {
  members: TeamMemberProfile[];
  onlineUsers: string[];
  currentUser: User; // Para verificar permissões extras se necessário
  onToggleAdmin: (email: string, currentStatus: boolean, name: string) => void;
  onRemoveMember: (id: string, name: string) => void;
}

export const MembersScreen: React.FC<Props> = ({ 
  members, 
  onlineUsers, 
  currentUser, 
  onToggleAdmin, 
  onRemoveMember 
}) => {
  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-10">
        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div>
               <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                   <Users className="text-indigo-500"/> Membros & Equipe
               </h2>
               <p className="text-zinc-500 text-sm mt-1">Gerencie os integrantes, funções e permissões de acesso.</p>
           </div>
           <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-xs font-medium text-zinc-500">
               Total: {members.length} membros
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           {members.map(member => {
               const isOnline = onlineUsers.includes(member.id);
               const isSelf = currentUser.id === member.id;

               return (
               <div key={member.id} className="bg-white dark:bg-[#18181b] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4 relative group shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up">
                   <div className="flex justify-between items-start">
                       <div className="flex gap-4">
                           <div className="relative">
                               {member.avatar_url ? (
                                   <img src={member.avatar_url} alt={member.name} className="w-14 h-14 rounded-full object-cover border-2 border-zinc-100 dark:border-zinc-700 shadow-sm" />
                               ) : (
                                   <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold border-2 border-zinc-100 dark:border-zinc-700 shadow-sm">
                                       {member.name.charAt(0).toUpperCase()}
                                   </div>
                               )}
                               {isOnline && (
                                   <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-[#18181b] animate-pulse shadow-sm" title="Online Agora"></div>
                               )}
                           </div>
                           <div>
                               <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 truncate max-w-[150px]" title={member.name}>
                                   {member.name} {isSelf && "(Você)"}
                               </h3>
                               <span className={`text-[10px] font-bold uppercase tracking-widest block mt-0.5 ${member.isAdmin ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'}`}>
                                   {member.isAdmin ? 'Administrador' : 'Membro'}
                               </span>
                           </div>
                       </div>
                       
                       {!isSelf && (
                           <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button 
                                   onClick={() => member.email && onToggleAdmin(member.email, !!member.isAdmin, member.name)} 
                                   className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors border ${member.isAdmin ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400' : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-indigo-500 hover:border-indigo-300'}`} 
                                   title={member.isAdmin ? "Remover Admin" : "Tornar Admin"}
                                >
                                   <ShieldCheck size={16} fill={member.isAdmin ? "currentColor" : "none"} />
                                </button>
                               
                               <button 
                                   onClick={() => onRemoveMember(member.id, member.name)} 
                                   className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors border bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/10"
                                   title="Remover da Equipe"
                               >
                                   <Trash2 size={16} />
                               </button>
                           </div>
                       )}
                   </div>

                   <div className="flex flex-wrap gap-2 min-h-[24px]">
                       {member.roles && member.roles.length > 0 ? (
                           member.roles.map(role => (
                               <span key={role} className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                   {role}
                               </span>
                           ))
                       ) : (
                           <span className="text-xs text-zinc-400 italic px-1">Sem função definida</span>
                       )}
                   </div>

                   <hr className="border-zinc-100 dark:border-zinc-800" />

                   <div className="space-y-2.5 text-sm">
                       <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                           <Mail size={16} className="text-zinc-400 shrink-0"/>
                           <span className="truncate">{member.email || "Sem e-mail"}</span>
                       </div>
                       <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                           <Phone size={16} className="text-zinc-400 shrink-0"/>
                           {member.whatsapp ? <span className="truncate">{member.whatsapp}</span> : <span className="text-zinc-400 italic text-xs">WhatsApp não informado</span>}
                       </div>
                       {member.birthDate && (
                           <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                               <Gift size={16} className="text-zinc-400 shrink-0"/>
                               <span className="truncate">{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                           </div>
                       )}
                   </div>
               </div>
               );
           })}
        </div>
    </div>
  );
};
