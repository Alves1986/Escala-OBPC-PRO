
import React, { useState, useMemo } from 'react';
import { Users, Mail, Phone, Gift, ShieldCheck, Trash2, Search, Filter, Shield, Zap } from 'lucide-react';
import { TeamMemberProfile, User } from '../types';

interface Props {
  members: TeamMemberProfile[];
  onlineUsers: string[];
  currentUser: User;
  onToggleAdmin: (email: string, currentStatus: boolean, name: string) => void;
  onRemoveMember: (id: string, name: string) => void;
  availableRoles: string[];
}

export const MembersScreen: React.FC<Props> = ({ 
  members, 
  onlineUsers, 
  currentUser, 
  onToggleAdmin, 
  onRemoveMember,
  availableRoles
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("Todos");
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);

  const filteredMembers = useMemo(() => {
      return members.filter(member => {
          const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()));
          
          const matchesRole = selectedRole === "Todos" || (member.roles && member.roles.includes(selectedRole));
          
          const matchesOnline = showOnlineOnly ? onlineUsers.includes(member.id) : true;

          return matchesSearch && matchesRole && matchesOnline;
      });
  }, [members, searchTerm, selectedRole, showOnlineOnly, onlineUsers]);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-10">
        {/* Header com Controles Profissionais */}
        <div className="flex flex-col gap-6 border-b border-zinc-200 dark:border-zinc-700 pb-6">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                   <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                       <Users className="text-indigo-500"/> Membros & Equipe
                   </h2>
                   <p className="text-zinc-500 text-sm mt-1">Gerencie os integrantes, funções e permissões de acesso.</p>
               </div>
               <div className="flex items-center gap-2">
                   <button 
                       onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${showOnlineOnly ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}
                   >
                       <span className={`w-2 h-2 rounded-full ${showOnlineOnly ? 'bg-green-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`}></span>
                       {showOnlineOnly ? 'Apenas Online' : 'Mostrar Online'}
                   </button>
                   <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-1.5 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 shadow-sm">
                       Total: {filteredMembers.length} <span className="text-zinc-400 font-normal">/ {members.length}</span>
                   </div>
               </div>
           </div>

           {/* Barra de Ferramentas (Search & Filter) */}
           <div className="flex flex-col md:flex-row gap-3">
               <div className="relative flex-1">
                   <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                   <input 
                        type="text" 
                        placeholder="Buscar por nome ou e-mail..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
                   />
               </div>
               <div className="relative min-w-[200px]">
                   <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                   <select 
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium"
                   >
                       <option value="Todos">Todas as Funções</option>
                       {availableRoles.map(role => (
                           <option key={role} value={role}>{role}</option>
                       ))}
                   </select>
               </div>
           </div>
        </div>

        {/* Grid de Cards */}
        {filteredMembers.length === 0 ? (
            <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Users className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" size={48} />
                <p className="text-zinc-500 font-medium">Nenhum membro encontrado.</p>
                <p className="text-xs text-zinc-400 mt-1">Tente ajustar os filtros de busca.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredMembers.map(member => {
                const isOnline = onlineUsers.includes(member.id);
                const isSelf = currentUser.id === member.id;
                
                // Filter roles to show only those belonging to the current ministry
                const relevantRoles = member.roles?.filter(role => availableRoles.includes(role)) || [];

                return (
                <div key={member.id} className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4 relative group shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 animate-slide-up">
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
                                    {member.name} {isSelf && <span className="text-indigo-500 text-xs">(Você)</span>}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    {member.isAdmin ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50">
                                            <ShieldCheck size={10} /> Admin
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                            Membro
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {!isSelf && (
                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => member.email && onToggleAdmin(member.email, !!member.isAdmin, member.name)} 
                                    className={`p-2 rounded-lg transition-colors ${member.isAdmin ? 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20' : 'text-zinc-400 hover:text-indigo-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`} 
                                    title={member.isAdmin ? "Remover Admin" : "Tornar Admin"}
                                >
                                    <Shield size={16} fill={member.isAdmin ? "currentColor" : "none"} />
                                </button>
                                
                                <button 
                                    onClick={() => onRemoveMember(member.id, member.name)} 
                                    className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Remover da Equipe"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[26px]">
                        {relevantRoles.length > 0 ? (
                            relevantRoles.map(role => (
                                <span key={role} className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/50">
                                    {role}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-zinc-400 italic px-1">
                                {member.roles && member.roles.length > 0 ? 'Outras funções' : 'Sem função definida'}
                            </span>
                        )}
                    </div>

                    <hr className="border-zinc-100 dark:border-zinc-800/50" />

                    <div className="space-y-2.5 text-sm">
                        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                            <Mail size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                            <span className="truncate">{member.email || "Sem e-mail"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                            <Phone size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                            {member.whatsapp ? <span className="truncate">{member.whatsapp}</span> : <span className="text-zinc-400 italic text-xs">WhatsApp não informado</span>}
                        </div>
                        {member.birthDate && (
                            <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 group/item hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                                <Gift size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0"/>
                                <span className="truncate">{new Date(member.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                            </div>
                        )}
                    </div>
                </div>
                );
            })}
            </div>
        )}
    </div>
  );
};
