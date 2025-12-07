
import React, { useState, useMemo, useEffect } from 'react';
import { AvailabilityMap, TeamMemberProfile, MemberMap } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarSearch, Search, Filter, CalendarX, RefreshCw } from 'lucide-react';

interface Props {
  availability: AvailabilityMap;
  registeredMembers: TeamMemberProfile[];
  membersMap: MemberMap; // Para fallback de funções manuais
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  availableRoles: string[];
  onRefresh?: () => Promise<void>;
}

export const AvailabilityReportScreen: React.FC<Props> = ({ 
  availability, 
  registeredMembers, 
  membersMap,
  currentMonth, 
  onMonthChange,
  availableRoles,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("Todos");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Removido o useEffect de auto-refresh para evitar que dados locais recentes 
  // sejam sobrescritos por dados antigos do servidor (flickering).
  // O app já tem os dados na memória. O refresh deve ser apenas manual.

  const handleManualRefresh = async () => {
      if (onRefresh) {
          setIsRefreshing(true);
          await onRefresh();
          setTimeout(() => setIsRefreshing(false), 500);
      }
  };

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(currentMonth, 1));
  };

  // Função auxiliar para normalizar nomes (ignora acentos, case e espaços extras)
  const normalizeString = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
  };

  // Processa e combina os dados
  const reportData = useMemo(() => {
    // 1. Pega todos os membros registrados
    // 2. Adiciona membros "fantasmas" que tem disponibilidade mas não registro
    const allMemberNames = new Set<string>(registeredMembers.map(m => m.name));
    Object.keys(availability).forEach(name => allMemberNames.add(name));

    const data = Array.from(allMemberNames).map((name: string) => {
      // Tenta achar o perfil completo
      const profile = registeredMembers.find(m => normalizeString(m.name) === normalizeString(name));
      
      // Determina as funções (Perfil > Mapa Manual)
      let roles: string[] = [];
      if (profile && profile.roles && profile.roles.length > 0) {
        roles = profile.roles;
      } else {
        // Fallback: Procura no mapa manual
        Object.entries(membersMap).forEach(([role, members]) => {
          if ((members as string[]).some(m => normalizeString(m) === normalizeString(name))) {
              roles.push(role);
          }
        });
      }

      // Pega dias disponíveis no mês atual com busca insensível a case/trim/acentos
      const normalizedName = normalizeString(name);
      let dates: string[] = [];
      
      // Tenta encontrar a chave no mapa de disponibilidade usando a string normalizada
      const availKey = Object.keys(availability).find(k => normalizeString(k) === normalizedName);
      
      if (availKey) {
          dates = availability[availKey] || [];
      }

      const monthDates = dates
        .filter(d => d.startsWith(currentMonth))
        .map(d => {
            const parts = d.split('_');
            const dayNum = parseInt(d.split('-')[2]);
            const type = parts.length > 1 ? parts[1] : 'BOTH'; // 'M', 'N' or 'BOTH'
            return { day: dayNum, type };
        })
        .sort((a, b) => a.day - b.day);

      return {
        name: profile ? profile.name : name, // Usa o nome oficial do perfil se existir
        avatar_url: profile?.avatar_url,
        roles,
        days: monthDates,
        count: monthDates.length
      };
    });

    // Filtragem
    return data
      .filter(item => {
        const matchesSearch = normalizeString(item.name).includes(normalizeString(searchTerm));
        const matchesRole = selectedRole === "Todos" || item.roles.includes(selectedRole);
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Ordem Alfabética

  }, [registeredMembers, availability, currentMonth, membersMap, searchTerm, selectedRole]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarSearch className="text-purple-500"/> Relatório de Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Visualize os apontamentos da equipe para o mês selecionado.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 self-end">
            <button 
                onClick={handleManualRefresh}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors"
                title="Sincronizar Dados (Nuvem)"
            >
                <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
            </button>

            {/* Month Selector */}
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
                <div className="text-center min-w-[120px]">
                    <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                    <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                </div>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
            </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
         <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
         </div>
         <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <select
               value={selectedRole}
               onChange={(e) => setSelectedRole(e.target.value)}
               className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-10 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500 appearance-none text-zinc-700 dark:text-zinc-200"
            >
               <option value="Todos">Todas as Funções</option>
               {availableRoles.map(role => (
                 <option key={role} value={role}>{role}</option>
               ))}
            </select>
         </div>
      </div>

      {/* Report Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400">
             <CalendarX size={48} className="mx-auto mb-3 opacity-20"/>
             <p>Nenhum membro encontrado com os filtros atuais.</p>
          </div>
        ) : (
          reportData.map((item) => (
            <div key={item.name} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                     {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                     ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                           {item.name.charAt(0).toUpperCase()}
                        </div>
                     )}
                     <div>
                        <h3 className="font-bold text-zinc-800 dark:text-white leading-tight">{item.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                           {item.roles.length > 0 ? item.roles.map(r => (
                              <span key={r} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 font-medium">
                                 {r}
                              </span>
                           )) : (
                             <span className="text-[10px] text-zinc-400 italic">Sem função</span>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${item.count > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                     {item.count} dias
                  </div>
               </div>

               <div className="pt-4 border-t border-zinc-100 dark:border-zinc-700/50">
                  {item.days.length > 0 ? (
                     <div className="flex flex-wrap gap-1.5">
                        {item.days.map(({day, type}) => {
                           let bgClass = "bg-green-500 text-white";
                           if(type === 'M') bgClass = "bg-orange-500 text-white";
                           if(type === 'N') bgClass = "bg-indigo-500 text-white";
                           
                           return (
                              <div key={day} className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg shadow-sm ${bgClass}`}>
                                 <span className="text-xs font-bold">{day}</span>
                                 {type === 'M' && <span className="text-[8px] leading-none opacity-80">M</span>}
                                 {type === 'N' && <span className="text-[8px] leading-none opacity-80">N</span>}
                              </div>
                           )
                        })}
                     </div>
                  ) : (
                     <div className="text-center py-2 text-zinc-400 text-xs italic flex items-center justify-center gap-2">
                        <CalendarX size={14}/> Nenhuma disponibilidade informada
                     </div>
                  )}
               </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
