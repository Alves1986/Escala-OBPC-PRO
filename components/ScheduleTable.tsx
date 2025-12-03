import React from 'react';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis, SwapRequest, User } from '../types';
import { CheckCircle2, AlertTriangle, Trash2, BrainCircuit, AlertCircle, RefreshCw, XCircle, ArrowRightLeft } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  scheduleIssues: ScheduleAnalysis;
  onCellChange: (key: string, value: string) => void;
  onAttendanceToggle: (key: string) => void;
  onDeleteEvent: (iso: string, title: string) => void;
  memberStats: Record<string, number>;
  currentUser: User | null;
  swaps: SwapRequest[];
  onRequestSwap: (key: string, eventTitle: string, dateDisplay: string) => void;
  onCancelSwap: (swapId: string) => void;
  onAcceptSwap: (swapId: string) => void;
}

export const ScheduleTable: React.FC<Props> = ({
  events, roles, schedule, attendance, availability, members, scheduleIssues, onCellChange, onAttendanceToggle, onDeleteEvent, memberStats, currentUser, swaps, onRequestSwap, onCancelSwap, onAcceptSwap
}) => {
  
  // Calculate if member is unavailable for a specific date
  // NOVA LÓGICA: hasConflict retorna TRUE se o membro definiu disponibilidade e a data NÃO está nela.
  const hasConflict = (member: string, isoDateStr: string) => {
    const datePart = isoDateStr.split('T')[0];
    const memberAvailability = availability[member];

    // Se a lista de disponibilidade for indefinida ou vazia, assumimos que está livre (sem conflito).
    if (!memberAvailability || memberAvailability.length === 0) {
      return false;
    }
    
    // Se tem lista, verifica se a data está nela. Se NÃO estiver, é conflito.
    return !memberAvailability.includes(datePart);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">Evento</th>
              {roles.map(role => (
                <th key={role} className="px-6 py-4 font-bold min-w-[180px]">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={roles.length + 1} className="p-8 text-center text-zinc-500">Nenhum evento para este mês.</td></tr>
            ) : events.map((event) => (
              <tr key={event.iso} className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                <td className="px-6 py-4 sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-zinc-100 dark:border-zinc-700 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{event.title}</span>
                      <span className="text-xs text-zinc-500">{event.dateDisplay}</span>
                    </div>
                    <button 
                      onClick={() => onDeleteEvent(event.iso, event.title)}
                      className="text-zinc-300 hover:text-red-500 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title="Remover/Ocultar Evento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
                {roles.map(role => {
                  const key = `${event.iso}_${role}`;
                  const currentValue = schedule[key] || "";
                  const roleMembers = members[role] || [];
                  const isConfirmed = attendance[key];
                  const issue = scheduleIssues[key];
                  
                  // Swap Logic
                  const activeSwap = swaps.find(s => s.key === key && s.status === 'pending');
                  const isMyShift = currentValue === currentUser?.name;
                  // Pode aceitar se: não é minha escala, sou admin OU sou membro desta função
                  const canAcceptSwap = !isMyShift && (currentUser?.role === 'admin' || roleMembers.includes(currentUser?.name || ''));
                  const isSwapRequester = activeSwap?.requesterName === currentUser?.name;

                  // Verifica se há conflito usando a nova lógica (Data não permitida)
                  const hasLocalConflict = currentValue && hasConflict(currentValue, event.iso);

                  // Sort members: Available first (no conflict), then by least usage
                  const sortedMembers = [...roleMembers].sort((a, b) => {
                    const conflictA = hasConflict(a, event.iso);
                    const conflictB = hasConflict(b, event.iso);
                    // Quem tem conflito vai para o final
                    if (conflictA && !conflictB) return 1;
                    if (!conflictA && conflictB) return -1;
                    return (memberStats[a] || 0) - (memberStats[b] || 0);
                  });

                  return (
                    <td key={key} className={`px-6 py-4 relative ${activeSwap ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className="relative w-full group/cell">
                          <select
                            value={currentValue}
                            onChange={(e) => onCellChange(key, e.target.value)}
                            disabled={!!activeSwap && currentUser?.role !== 'admin'}
                            className={`w-full bg-zinc-100 dark:bg-zinc-900/50 border-0 rounded-md py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6 cursor-pointer transition-all
                              ${activeSwap 
                                ? 'text-amber-700 dark:text-amber-400 ring-amber-300 dark:ring-amber-900' 
                                : hasLocalConflict 
                                  ? 'text-red-700 dark:text-red-400 ring-red-300 dark:ring-red-900 focus:ring-red-500 bg-red-50 dark:bg-red-900/20 font-medium' 
                                  : issue?.type === 'warning'
                                    ? 'text-amber-700 dark:text-amber-400 ring-amber-300 dark:ring-amber-900 focus:ring-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                    : currentValue 
                                      ? 'text-zinc-900 dark:text-zinc-100 ring-zinc-300 dark:ring-zinc-600 focus:ring-brand-500' 
                                      : 'text-zinc-400 ring-zinc-200 dark:ring-zinc-700 focus:ring-brand-500'}
                            `}
                          >
                            <option value="">-- Selecionar --</option>
                            {sortedMembers.map(m => {
                              const conflict = hasConflict(m, event.iso);
                              return (
                                <option key={m} value={m} className={conflict ? 'text-red-400' : ''}>
                                  {m} ({memberStats[m] || 0}) {conflict ? '[Indisp.]' : ''}
                                </option>
                              );
                            })}
                          </select>
                          
                          {/* Swap Indicator Badge */}
                          {activeSwap && (
                             <div className="absolute left-0 -top-5 text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                               <RefreshCw size={10} className="animate-spin-slow"/> Em Troca
                             </div>
                          )}
                          
                          {/* Indicador Visual de Conflito Local (Data Bloqueada) */}
                          {hasLocalConflict && !activeSwap && (
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 animate-pulse" title="CONFLITO: Membro não marcou disponibilidade neste dia!">
                              <AlertTriangle size={16} />
                            </div>
                          )}

                          {/* Indicador de Análise da IA */}
                          {!hasLocalConflict && !activeSwap && issue && (
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500">
                               {issue.type === 'error' ? <AlertCircle size={16} /> : <BrainCircuit size={16} />}
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-1">
                            {currentValue && !activeSwap && (
                              <>
                                <button
                                  onClick={() => onAttendanceToggle(key)}
                                  className={`p-1 rounded-full transition-colors flex-shrink-0 ${
                                    isConfirmed 
                                      ? 'text-green-600 bg-green-100 dark:bg-green-900/30' 
                                      : 'text-zinc-300 hover:text-zinc-400'
                                  }`}
                                  title={isConfirmed ? "Presença Confirmada" : "Confirmar Presença"}
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                
                                {(isMyShift || currentUser?.role === 'admin') && (
                                    <button
                                      onClick={() => onRequestSwap(key, event.title, event.dateDisplay)}
                                      className="p-1 rounded-full text-zinc-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex-shrink-0"
                                      title="Solicitar Troca"
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                )}
                              </>
                            )}

                            {activeSwap && (
                                <>
                                   {isSwapRequester ? (
                                     <button
                                       onClick={() => onCancelSwap(activeSwap.id)}
                                       className="p-1 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                                       title="Cancelar Troca"
                                     >
                                       <XCircle size={16} />
                                     </button>
                                   ) : canAcceptSwap ? (
                                     <button
                                       onClick={() => onAcceptSwap(activeSwap.id)}
                                       className="p-1 rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors flex-shrink-0 animate-bounce"
                                       title="ASSUMIR ESCALA (Aceitar Troca)"
                                     >
                                       <ArrowRightLeft size={16} />
                                     </button>
                                   ) : null}
                                </>
                            )}
                        </div>

                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};