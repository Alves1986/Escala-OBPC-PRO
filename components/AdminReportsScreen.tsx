
import React, { useState, useEffect } from 'react';
import { MemberMonthlyStat } from '../types';
import { fetchMonthlyStatsReport } from '../services/supabaseService';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { FileBarChart2, ArrowRight, ArrowLeft, Printer, RefreshCw, AlertTriangle, CheckCircle, Minus, TrendingUp, Users, RefreshCcw } from 'lucide-react';

interface Props {
  ministryId: string;
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
}

export const AdminReportsScreen: React.FC<Props> = ({ ministryId, currentMonth, onMonthChange }) => {
  const [stats, setStats] = useState<MemberMonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
        const data = await fetchMonthlyStatsReport(ministryId, currentMonth);
        setStats(data || []);
    } catch (e) {
        console.error(e);
        setStats([]);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [ministryId, currentMonth]);

  // Aggregates - Safe checks added
  const safeStats = Array.isArray(stats) ? stats : [];
  const totalScales = safeStats.reduce((acc, curr) => acc + (curr.totalScheduled || 0), 0);
  const totalAbsences = safeStats.reduce((acc, curr) => acc + ((curr.totalScheduled || 0) - (curr.totalConfirmed || 0)), 0);
  const totalSwaps = safeStats.reduce((acc, curr) => acc + (curr.swapsRequested || 0), 0);
  const globalAttendance = totalScales > 0 ? Math.round(((totalScales - totalAbsences) / totalScales) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const getScoreColor = (score: string) => {
      switch(score) {
          case 'High': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
          case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
          case 'Low': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
          default: return 'bg-zinc-100 text-zinc-500';
      }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12 print:p-0 print:max-w-none">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-6 gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <FileBarChart2 className="text-purple-600 dark:text-purple-400"/> Relatório Mensal
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Análise detalhada de performance e engajamento da equipe.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors"><ArrowLeft size={16}/></button>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 min-w-[100px] text-center capitalize">{getMonthName(currentMonth)}</span>
                <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors"><ArrowRight size={16}/></button>
            </div>
            <button onClick={handlePrint} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700" title="Imprimir">
                <Printer size={18}/>
            </button>
            <button onClick={loadReport} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-700">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Users size={20}/></div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Escalas Totais</span>
              </div>
              <p className="text-3xl font-black text-zinc-800 dark:text-white">{totalScales}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><CheckCircle size={20}/></div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Assiduidade Global</span>
              </div>
              <p className="text-3xl font-black text-zinc-800 dark:text-white">{globalAttendance}%</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><RefreshCcw size={20}/></div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Trocas Solicitadas</span>
              </div>
              <p className="text-3xl font-black text-zinc-800 dark:text-white">{totalSwaps}</p>
          </div>
          <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg"><AlertTriangle size={20}/></div>
                  <span className="text-xs font-bold text-zinc-500 uppercase">Faltas (Sem check-in)</span>
              </div>
              <p className="text-3xl font-black text-zinc-800 dark:text-white">{totalAbsences}</p>
          </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 uppercase font-bold">
                      <tr>
                          <th className="px-6 py-4">Membro</th>
                          <th className="px-6 py-4 text-center">Escalas</th>
                          <th className="px-6 py-4 text-center">Check-ins</th>
                          <th className="px-6 py-4 text-center">Trocas</th>
                          <th className="px-6 py-4 text-center">Assiduidade</th>
                          <th className="px-6 py-4 text-center">Engajamento</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {loading ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Carregando dados...</td></tr>
                      ) : safeStats.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Nenhum dado encontrado para este mês.</td></tr>
                      ) : (
                          safeStats.map((stat) => (
                              <tr key={stat.memberId} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/20 transition-colors">
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          {stat.avatar_url ? (
                                              <img src={stat.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                                          ) : (
                                              <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 font-bold text-xs">
                                                  {stat.name ? stat.name.charAt(0) : '?'}
                                              </div>
                                          )}
                                          <div>
                                              <p className="font-bold text-zinc-800 dark:text-zinc-200">{stat.name}</p>
                                              <p className="text-xs text-zinc-500">{stat.mainRole}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-medium text-zinc-700 dark:text-zinc-300">
                                      {stat.totalScheduled > 0 ? stat.totalScheduled : <span className="text-zinc-300">-</span>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {stat.totalScheduled > 0 ? (
                                          <span className="font-bold text-green-600 dark:text-green-400">{stat.totalConfirmed}</span>
                                      ) : <span className="text-zinc-300">-</span>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {stat.swapsRequested > 0 ? (
                                          <span className="font-bold text-amber-600 dark:text-amber-400">{stat.swapsRequested}</span>
                                      ) : <span className="text-zinc-300 dark:text-zinc-600"><Minus size={14} className="mx-auto"/></span>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {stat.totalScheduled > 0 ? (
                                          <div className="flex items-center justify-center gap-2">
                                              <div className="w-16 h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                  <div 
                                                    className={`h-full rounded-full ${stat.attendanceRate >= 90 ? 'bg-green-500' : stat.attendanceRate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                                    style={{ width: `${stat.attendanceRate}%` }}
                                                  />
                                              </div>
                                              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{stat.attendanceRate}%</span>
                                          </div>
                                      ) : <span className="text-zinc-300">-</span>}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {stat.totalScheduled > 0 ? (
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getScoreColor(stat.engagementScore)}`}>
                                              <TrendingUp size={12}/> {stat.engagementScore === 'High' ? 'Alto' : stat.engagementScore === 'Medium' ? 'Médio' : 'Baixo'}
                                          </span>
                                      ) : <span className="text-xs text-zinc-400 italic">Sem dados</span>}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
      
      <div className="text-center text-xs text-zinc-400 print:hidden">
          * O Score de Engajamento é calculado automaticamente com base na assiduidade e solicitações de troca.
      </div>
    </div>
  );
};
