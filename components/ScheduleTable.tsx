import React, { useMemo, useCallback } from 'react';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis, GlobalConflictMap } from '../types';
import { CheckCircle2, AlertTriangle, Trash2, Edit, Clock } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  allMembers: string[]; 
  scheduleIssues: ScheduleAnalysis;
  globalConflicts: GlobalConflictMap; 
  onCellChange: (key: string, value: string) => void;
  onAttendanceToggle: (key: string) => void;
  onDeleteEvent: (iso: string, title: string) => void;
  onEditEvent: (event: { iso: string; title: string; dateDisplay: string }) => void; 
  memberStats: Record<string, number>;
  ministryId: string | null;
  readOnly?: boolean; 
}

// ----------------------------------------------------------------------
// SUB-COMPONENT: ROW (Memoized for Performance)
// ----------------------------------------------------------------------
const ScheduleRow = React.memo(({ 
    event, columns, schedule, attendance, availability, members, scheduleIssues, globalConflicts, 
    onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, readOnly 
}: any) => {

    const isUnavailable = useCallback((member: string, isoDateStr: string) => {
        const [datePart, timePart] = isoDateStr.split('T');
        const availableDates = availability[member];
        
        if (!availableDates || availableDates.length === 0) return false;

        if (availableDates.includes(datePart)) return false; 

        const hasMorning = availableDates.includes(`${datePart}_M`);
        const hasNight = availableDates.includes(`${datePart}_N`);
        
        const eventHour = parseInt(timePart.split(':')[0], 10);
        const isMorningEvent = eventHour < 13;

        if (isMorningEvent && hasMorning) return false; 
        if (!isMorningEvent && hasNight) return false; 

        return true; 
    }, [availability]);

    const sortMembers = useCallback((list: string[], isoDate: string) => {
        return list.sort((a, b) => {
            const unavailA = isUnavailable(a, isoDate);
            const unavailB = isUnavailable(b, isoDate);
            if (unavailA && !unavailB) return 1;
            if (!unavailA && unavailB) return -1;
            const statsDiff = (memberStats[a] || 0) - (memberStats[b] || 0);
            if (statsDiff !== 0) return statsDiff;
            return a.localeCompare(b);
        });
    }, [isUnavailable, memberStats]);

    const time = event.iso.split('T')[1];

    return (
        <tr className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
            <td className="px-6 py-4 sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-zinc-100 dark:border-zinc-700 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/80 transition-colors">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0 gap-1">
                        <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate text-base" title={event.title}>{event.title}</span>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="font-medium bg-zinc-100 dark:bg-zinc-700/50 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">{event.dateDisplay}</span>
                            <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/50"><Clock size={12}/> {time}</span>
                        </div>
                    </div>
                    {!readOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => onEditEvent(event)}
                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                                title="Editar Nome/Horário"
                            >
                                <Edit size={16} />
                            </button>
                            <button 
                                onClick={() => onDeleteEvent(event.iso, event.title)}
                                className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                title="Remover/Ocultar Evento"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </td>
            {columns.map((col: any) => {
                const key = `${event.iso}_${col.keySuffix}`;
                const currentValue = schedule[key] || "";
                
                const roleMembers = members[col.realRole] || [];
                // Only resort if members list changes (rare) or stats change (handled by parent prop change)
                const sortedRoleMembers = sortMembers([...roleMembers], event.iso);

                const isConfirmed = attendance[key];
                const issue = scheduleIssues[key];
                const hasLocalConflict = currentValue && isUnavailable(currentValue, event.iso);
                
                let globalConflictMsg = "";
                let hasGlobalConflict = false;
                
                if (currentValue && !readOnly) {
                    const normalized = currentValue.trim().toLowerCase();
                    const conflicts = globalConflicts[normalized];
                    if (conflicts) {
                        const conflict = conflicts.find((c: any) => c.eventIso === event.iso);
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
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate ${currentValue ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                        {currentValue || '-'}
                                    </span>
                                </div>
                            ) : (
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
                                        
                                        {currentValue && (
                                            <option value="" className="text-red-500 font-bold bg-red-50 dark:bg-red-900/20">-- Remover / Limpar --</option>
                                        )}
                                        
                                        {sortedRoleMembers.map((m: string) => {
                                            const unavail = isUnavailable(m, event.iso);
                                            return (
                                                <option key={m} value={m} className={unavail ? 'text-red-400 bg-red-50 dark:bg-zinc-800' : ''}>
                                                {m} ({memberStats[m] || 0}) {unavail ? '[Indisp.]' : ''}
                                                </option>
                                            );
                                        })}
                                        
                                        {currentValue && !roleMembers.includes(currentValue) && (
                                            <option value={currentValue} className="text-amber-500 bg-amber-50 dark:bg-zinc-800 italic">
                                                {currentValue} (Fora da Função)
                                            </option>
                                        )}
                                    </select>
                                    
                                    {hasLocalConflict && (
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 animate-pulse" title="CONFLITO: Membro indisponível neste horário!">
                                            <AlertTriangle size={16} />
                                        </div>
                                    )}

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
    );
}, (prevProps, nextProps) => {
    // Custom comparison for Memo
    // Only re-render if:
    // 1. The event itself changed (unlikely unless filtering)
    // 2. Schedule changed FOR THIS ROW (check keys)
    // 3. Attendance changed FOR THIS ROW
    // 4. Global props like ReadOnly or MemberStats changed
    
    if (prevProps.readOnly !== nextProps.readOnly) return false;
    if (prevProps.memberStats !== nextProps.memberStats) return false; // This is acceptable to trigger re-sort
    if (prevProps.event.iso !== nextProps.event.iso) return false;
    
    // Deep check schedule for this row only
    const keys = nextProps.columns.map((c: any) => `${nextProps.event.iso}_${c.keySuffix}`);
    const scheduleChanged = keys.some((k: string) => prevProps.schedule[k] !== nextProps.schedule[k]);
    const attendanceChanged = keys.some((k: string) => prevProps.attendance[k] !== nextProps.attendance[k]);
    
    return !scheduleChanged && !attendanceChanged; 
});


// ----------------------------------------------------------------------
// MAIN TABLE COMPONENT
// ----------------------------------------------------------------------
export const ScheduleTable: React.FC<Props> = React.memo(({
  events, roles, schedule, attendance, availability, members, scheduleIssues, globalConflicts, 
  onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, ministryId, readOnly = false
}) => {
  
  const columns = useMemo(() => {
      return roles.flatMap(role => {
          if (ministryId === 'louvor' && role === 'Vocal') {
              return [1, 2, 3, 4, 5].map(i => ({
                  displayRole: `Vocal ${i}`,
                  realRole: 'Vocal',
                  keySuffix: `Vocal_${i}`
              }));
          }
          return [{
              displayRole: role,
              realRole: role,
              keySuffix: role
          }];
      });
  }, [roles, ministryId]);

  return (
    <div className={`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-opacity duration-200 ${readOnly ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-64 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">Evento</th>
              {columns.map(col => (
                <th key={col.keySuffix} className="px-6 py-4 font-bold min-w-[180px]">{col.displayRole}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="p-8 text-center text-zinc-500">Nenhum evento para este mês.</td></tr>
            ) : events.map((event) => (
               <ScheduleRow
                  key={event.iso}
                  event={event}
                  columns={columns}
                  schedule={schedule}
                  attendance={attendance}
                  availability={availability}
                  members={members}
                  scheduleIssues={scheduleIssues}
                  globalConflicts={globalConflicts}
                  onCellChange={onCellChange}
                  onAttendanceToggle={onAttendanceToggle}
                  onDeleteEvent={onDeleteEvent}
                  onEditEvent={onEditEvent}
                  memberStats={memberStats}
                  readOnly={readOnly}
               />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});