
import React, { useMemo, useState } from 'react';
import { 
  FileText, TrendingUp, AlertCircle, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, User, Download, 
  Calendar, RefreshCcw, Filter
} from 'lucide-react';
import { ScheduleMap, AttendanceMap, SwapRequest, TeamMemberProfile } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';

interface Props {
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  swapRequests: SwapRequest[];
  members: TeamMemberProfile[];
  events: { iso: string }[];
}

export const MonthlyReportScreen: React.FC<Props> = ({ 
  currentMonth, onMonthChange, schedule, attendance, 
  swapRequests, members, events 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'name' | 'rate' | 'scheduled'>('name');

  // Cálculo das Métricas
  const reportData = useMemo(() => {
    // 1. Filtrar eventos do mês
    const monthEventIsos = events
      .filter(e => e.iso.startsWith(currentMonth))
      .map(e => e.iso);

    // 2. Processar dados por membro
    const data = members.map(member => {
      let scheduledCount = 0;
      let confirmedCount = 0;
      
      // Analisar Escala e Presença
      Object.entries(schedule).forEach(([key, assignedName]) => {
        // A chave é "ISO_Role". Verificamos se o ISO pertence ao mês atual.
        const eventIso = key.split('_')[0] + '_' + key.split('_')[1]; // Ajuste para formato ISO complexo se houver, ou apenas pegar substring
        const isThisMonth = monthEventIsos.some(iso => key.startsWith(iso));

        if (isThisMonth && assignedName === member.name) {
          scheduledCount++;
          if (attendance[key]) {
            confirmedCount++;
          }
        }
      });

      // Analisar Trocas (Engajamento)
      // Solicitou troca (Ponto de atenção)
      const swapsRequested = swapRequests.filter(req => 
        req.requesterName === member.name && 
        req.eventIso.startsWith(currentMonth)
      ).length;

      // Cobriu alguém (Ponto positivo)
      const swapsCovered = swapRequests.filter(req => 
        req.takenByName === member.name && 
        req.eventIso.startsWith(currentMonth) &&
        req.status === 'completed'
      ).length;

      const attendanceRate = scheduledCount > 0 
        ? Math.round((confirmedCount / scheduledCount) * 100) 
        : 0;

      // Score simples de Engajamento (0 a 100)
      // Base: Taxa de presença. 
      // Bônus: +5 por cobertura. 
      // Penalidade: -5 por solicitação de troca.
      let engagementScore = attendanceRate;
      engagementScore += (swapsCovered * 5);
      engagementScore -= (swapsRequested * 5);
      engagementScore = Math.min(Math.max(engagementScore, 0), 100); // Clamp 0-100

      return {
        id: member.id,
        name: member.name,
        avatar_url: member.avatar_url,
        scheduled: scheduledCount,
        confirmed: confirmedCount,
        absent: scheduledCount - confirmedCount,
        rate: attendanceRate,
        swapsRequested,
        swapsCovered,
        score: engagementScore
      };
    });

    // 3. Filtragem e Ordenação
    return data
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'rate') return b.rate - a.rate; // Maior taxa primeiro
        if (sortBy === 'scheduled') return b.scheduled - a.scheduled; // Mais escalado primeiro
        return a.name.localeCompare(b.name); // Alfabético
      });

  }, [schedule, attendance, swapRequests, members, currentMonth, events, searchTerm, sortBy]);

  // Totais Gerais
  const totalScales = reportData.reduce((acc, curr) => acc + curr.scheduled, 0);
  const totalConfirmed = reportData.reduce((acc, curr) => acc + curr.confirmed, 0);
  const totalRate = totalScales > 0 ? Math.round((totalConfirmed / totalScales) * 100) : 0;
  const activeMembers = reportData.filter(d => d.scheduled > 0).length;

  const handlePrevMonth = () => onMonthChange(adjustMonth(currentMonth, -1));
  const handleNextMonth = () => onMonthChange(adjustMonth(currentMonth, 1));

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-10">
      
      {/* Header e Controles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <FileText className="text-indigo-500"/> Relatório Mensal
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Análise de rendimento e engajamento da equipe.
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-end">
            <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" title="Exportar (Em breve)">
                <Download size={16}/> Exportar PDF
            </button>
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500">←</button>
                <div className="text-center min-w-[100px]">
                    <span className="block text-xs font-medium text-zinc-400 uppercase">Referência</span>
                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                </div>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500">→</button>
            </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><Calendar size={20}/></div>
                  <span className="text-xs font-bold text-zinc-400 uppercase">Total Escalas</span>
              </div>
              <div>
                  <span className="text-2xl font-bold text-zinc-800 dark:text-white">{totalScales}</span>
                  <p className="text-xs text-zinc-500">Posições preenchidas</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className={`p-2 rounded-lg ${totalRate >= 80 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'}`}>
                      <TrendingUp size={20}/>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 uppercase">Taxa de Presença</span>
              </div>
              <div>
                  <div className="flex items-end gap-2">
                      <span className={`text-2xl font-bold ${totalRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{totalRate}%</span>
                      {totalRate >= 90 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded mb-1 font-bold">Excelente</span>}
                  </div>
                  <p className="text-xs text-zinc-500">{totalConfirmed} confirmações</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg"><User size={20}/></div>
                  <span className="text-xs font-bold text-zinc-400 uppercase">Membros Ativos</span>
              </div>
              <div>
                  <span className="text-2xl font-bold text-zinc-800 dark:text-white">{activeMembers}</span>
                  <p className="text-xs text-zinc-500">Escalados neste mês</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg"><RefreshCcw size={20}/></div>
                  <span className="text-xs font-bold text-zinc-400 uppercase">Movimentações</span>
              </div>
              <div>
                  <span className="text-2xl font-bold text-zinc-800 dark:text-white">{swapRequests.filter(r => r.eventIso.startsWith(currentMonth)).length}</span>
                  <p className="text-xs text-zinc-500">Trocas solicitadas</p>
              </div>
          </div>
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          {/* Toolbar da Tabela */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-4 justify-between">
              <input 
                  type="text" 
                  placeholder="Filtrar membro..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
              />
              <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-1"><Filter size={12}/> Ordenar:</span>
                  <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                      <option value="name">Nome (A-Z)</option>
                      <option value="rate">Melhor Rendimento</option>
                      <option value="scheduled">Mais Escalados</option>
                  </select>
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                          <th className="px-6 py-4 font-bold">Membro</th>
                          <th className="px-6 py-4 font-bold text-center">Escalas</th>
                          <th className="px-6 py-4 font-bold text-center">Presença</th>
                          <th className="px-6 py-4 font-bold text-center">Trocas (Ped/Cob)</th>
                          <th className="px-6 py-4 font-bold text-right">Rendimento</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {reportData.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      {row.avatar_url ? (
                                          <img src={row.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                                      ) : (
                                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">
                                              {row.name.charAt(0)}
                                          </div>
                                      )}
                                      <div>
                                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{row.name}</p>
                                          {row.scheduled === 0 && <span className="text-[10px] text-zinc-400">Não escalado</span>}
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className="font-bold text-zinc-700 dark:text-zinc-300">{row.scheduled}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                      <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1" title="Confirmado">
                                          <CheckCircle2 size={14}/> {row.confirmed}
                                      </span>
                                      {row.absent > 0 && (
                                          <span className="text-red-400 font-bold flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded" title="Não confirmado">
                                              <AlertCircle size={12}/> {row.absent}
                                          </span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex flex-col items-center gap-1 text-xs">
                                      {row.swapsRequested > 0 ? (
                                          <span className="text-amber-600 flex items-center gap-1"><ArrowUpRight size={12}/> Pediu: {row.swapsRequested}</span>
                                      ) : <span className="text-zinc-300">-</span>}
                                      
                                      {row.swapsCovered > 0 && (
                                          <span className="text-indigo-500 flex items-center gap-1"><ArrowDownRight size={12}/> Cobriu: {row.swapsCovered}</span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                      {row.scheduled > 0 ? (
                                          <>
                                              <div className="flex items-center gap-2">
                                                  <span className={`text-sm font-black ${row.rate >= 90 ? 'text-emerald-500' : row.rate >= 70 ? 'text-blue-500' : 'text-red-500'}`}>
                                                      {row.rate}%
                                                  </span>
                                                  <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                      <div 
                                                          className={`h-full rounded-full ${row.rate >= 90 ? 'bg-emerald-500' : row.rate >= 70 ? 'bg-blue-500' : 'bg-red-500'}`} 
                                                          style={{ width: `${row.rate}%` }}
                                                      ></div>
                                                  </div>
                                              </div>
                                              <span className="text-[10px] text-zinc-400">Score: {row.score}</span>
                                          </>
                                      ) : (
                                          <span className="text-xs text-zinc-300 dark:text-zinc-600 font-medium">N/A</span>
                                      )}
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          {reportData.length === 0 && (
              <div className="p-8 text-center text-zinc-400">
                  Nenhum dado encontrado para o período selecionado.
              </div>
          )}
      </div>
    </div>
  );
};
