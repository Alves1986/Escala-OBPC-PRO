
import React from 'react';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis, GlobalConflictMap } from '../types';
import { CheckCircle2, AlertTriangle, Trash2, User } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  allMembers: string[]; 
  scheduleIssues: ScheduleAnalysis;
  globalConflicts: GlobalConflictMap; // Mapa de conflitos globais
  onCellChange: (key: string, value: string) => void;
  onAttendanceToggle: (key: string) => void;
  onDeleteEvent: (iso: string, title: string) => void;
  memberStats: Record<string, number>;
  ministryId: string | null;
  readOnly?: boolean; // Novo modo de leitura
}

export const ScheduleTable: React.FC<Props> = ({
  events, roles, schedule, attendance, availability, members, scheduleIssues, globalConflicts, onCellChange, onAttendanceToggle, onDeleteEvent, memberStats, ministryId, readOnly = false
}) => {
  
  // Calculate if member is unavailable for a specific date AND Time
  const isUnavailable = (member: string, isoDateStr: string) => {
    // isoDateStr format: YYYY-MM-DDTHH:mm
    const [datePart, timePart] = isoDateStr.split('T');
    const availableDates = availability[member];
    
    if (!availableDates || availableDates.length === 0) return false;

    // 1. Check Full Day Availability (legacy standard: just the date string)
    if (availableDates.includes(datePart)) return false; // Available all day

    // 2. Check Specific Periods
    const hasMorning = availableDates.includes(`${datePart}_M`);
    const hasNight = availableDates.includes(`${datePart}_N`);
    
    // Determine Event Period based on hour (Simple logic: < 13:00 is Morning)
    const eventHour = parseInt(timePart.split(':')[0], 10);
    const isMorningEvent = eventHour < 13;

    if (isMorningEvent && hasMorning) return false; // Available for Morning
    if (!isMorningEvent && hasNight) return false; // Available for Night

    // If none of the above matched, the user is NOT available for this specific slot
    return true; 
  };

  // Sorting function to keep consistency
  const sortMembers = (list: string[], isoDate: string) => {
      return list.sort((a, b) => {
        const unavailA = isUnavailable(a, isoDate);
        const unavailB = isUnavailable(b, isoDate);
        // Unavailable members go to bottom
        if (unavailA && !unavailB) return 1;
        if (!unavailA && unavailB) return -1;
        // Then sort by usage count (least used first for balance)
        const statsDiff = (memberStats[a] || 0) - (memberStats[b] || 0);
        if (statsDiff !== 0) return statsDiff;
        // Alphabetical as tie-breaker
        return a.localeCompare(b);
      });
  };

  // Generate expanded columns based on ministry logic
  const columns = React.useMemo(() => {
      return roles.flatMap(role => {
          // Special logic for Louvor Vocal expansion
          if (ministryId === 'louvor' && role === 'Vocal') {
              return [1, 2, 3, 4, 5].map(i => ({
                  displayRole: `Vocal ${i}`,
                  realRole: 'Vocal',
                  keySuffix: `Vocal_${i}`
              }));
          }
          // Default behavior
          return [{
              displayRole: role,
              realRole: role,
              keySuffix: role
          }];
      });
  }, [roles, ministryId]);

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">Evento</th>
              {columns.map(col => (
                <th key={col.keySuffix} className="px-6 py-4 font-bold min-w-[180px]">{col.displayRole}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="p-8 text-center text-zinc-500">Nenhum evento para este mês.</td></tr>
            ) : events.map((event) => (
              <tr key={event.iso} className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                <td className="px-6 py-4 sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-zinc-100 dark:border-zinc-700 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{event.title}</span>
                      <span className="text-xs text-zinc-500">{event.dateDisplay}</span>
                    </div>
                    {!readOnly && (
                        <button 
                        onClick={() => onDeleteEvent(event.iso, event.title)}
                        className="text-zinc-300 hover:text-red-500 p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        title="Remover/Ocultar Evento"
                        >
                        <Trash2 size={16} />
                        </button>
                    )}
                  </div>
                </td>
                {columns.map(col => {
                  const key = `${event.iso}_${col.keySuffix}`;
                  const currentValue = schedule[key] || "";
                  
                  // Only get members explicitly assigned to this role (use realRole, e.g., 'Vocal')
                  const roleMembers = members[col.realRole] || [];
                  const sortedRoleMembers = sortMembers([...roleMembers], event.iso);

                  const isConfirmed = attendance[key];
                  const issue = scheduleIssues[key];
                  const hasLocalConflict = currentValue && isUnavailable(currentValue, event.iso);
                  
                  // Verificação de Conflito Global (Outros Ministérios)
                  let globalConflictMsg = "";
                  let hasGlobalConflict = false;
                  
                  if (currentValue && !readOnly) {
                      const normalized = currentValue.trim().toLowerCase();
                      const conflicts = globalConflicts[normalized];
                      if (conflicts) {
                          const conflict = conflicts.find(c => c.eventIso === event.iso);
                          if (conflict) {
                              hasGlobalConflict = true;
                              globalConflictMsg = `Conflito: Já escalado em ${conflict.ministryId.toUpperCase()} (${conflict.role})`;
                          }
                      }
                  }

                  return (
                    <td key={key} className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {readOnly ? (
                            // MODO LEITURA (Dashboard)
                            <div className="flex-1 flex items-center gap-2">
                                <span className={`text-sm font-medium truncate ${currentValue ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                    {currentValue || '-'}
                                </span>
                            </div>
                        ) : (
                            // MODO EDIÇÃO (Gestão)
                            <div className="relative w-full group/cell">
                            <select
                                value={currentValue}
                                onChange={(e) => onCellChange(key, e.target.value)}
                                className={`w-full bg-zinc-100 dark:bg-zinc-900/50 border-0 rounded-md py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6 cursor-pointer transition-all appearance-none
                                ${hasLocalConflict 
                                    ? 'text-red-700 dark:text-red-400 ring-red-300 dark:ring-red-900 focus:ring-red-500 bg-red-50 dark:bg-red-900/20 font-medium' 
                                    : hasGlobalConflict
                                    ? 'text-orange-700 dark:text-orange-400 ring-orange-300 dark:ring-orange-900 focus:ring-orange-500 bg-orange-50 dark:bg-orange-900/20 font-medium'
                                    : issue?.type === 'warning'
                                        ? 'text-amber-700 dark:text-amber-400 ring-amber-300 dark:ring-amber-900 focus:ring-amber-500 bg-amber-50 dark:bg-amber-900/20'
                                        : currentValue 
                                        ? 'text-zinc-900 dark:text-zinc-100 ring-zinc-300 dark:ring-zinc-600 focus:ring-brand-500' 
                                        : 'text-zinc-400 ring-zinc-200 dark:ring-zinc-700 focus:ring-brand-500'}
                                `}
                            >
                                <option value="">-- Selecionar --</option>
                                
                                {sortedRoleMembers.map(m => {
                                    const unavail = isUnavailable(m, event.iso);
                                    return (
                                        <option key={m} value={m} className={unavail ? 'text-red-400 bg-red-50 dark:bg-zinc-800' : ''}>
                                        {m} ({memberStats[m] || 0}) {unavail ? '[Indisp.]' : ''}
                                        </option>
                                    );
                                })}
                                
                                {/* If current value is not in the list (legacy/removed role), show it as an option so it's not invisible */}
                                {currentValue && !roleMembers.includes(currentValue) && (
                                    <option value={currentValue} className="text-amber-500 bg-amber-50 dark:bg-zinc-800 italic">
                                        {currentValue} (Fora da Função)
                                    </option>
                                )}
                            </select>
                            
                            {/* Indicador Visual de Conflito Local */}
                            {hasLocalConflict && (
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 animate-pulse" title="CONFLITO: Membro indisponível neste horário!">
                                <AlertTriangle size={16} />
                                </div>
                            )}

                            {/* Indicador Visual de Conflito Global (Inter-ministérios) */}
                            {hasGlobalConflict && (
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-orange-500" title={globalConflictMsg}>
                                <AlertTriangle size={16} />
                                </div>
                            )}
                            </div>
                        )}
                        
                        {currentValue && (
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
                        )}
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
