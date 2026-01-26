import React, { useMemo } from 'react';
import { 
  ScheduleMap, 
  AttendanceMap, 
  AvailabilityMap, 
  AvailabilityNotesMap, 
  MemberMap, 
  TeamMemberProfile, 
  ScheduleAnalysis, 
  GlobalConflictMap, 
  Role 
} from '../types';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2,
  Edit2
} from 'lucide-react';

interface Props {
  events: { id: string; iso: string; dateDisplay: string; title: string; weekday?: number }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  availabilityNotes: AvailabilityNotesMap;
  members: MemberMap;
  allMembers: string[];
  memberProfiles: TeamMemberProfile[];
  scheduleIssues: ScheduleAnalysis;
  globalConflicts: GlobalConflictMap;
  onCellChange: (key: string, role: string, memberId: string | null, memberName: string | null) => Promise<void>;
  onAttendanceToggle: (key: string) => Promise<void>;
  onDeleteEvent: (iso: string, title: string) => Promise<void>;
  onEditEvent: (event: any) => void;
  memberStats: Record<string, number>;
  ministryId: string;
  readOnly: boolean;
  onlineUsers: string[];
}

export const ScheduleTable: React.FC<Props> = ({
  events,
  roles,
  schedule,
  attendance,
  availability,
  availabilityNotes,
  members,
  allMembers,
  memberProfiles,
  scheduleIssues,
  globalConflicts,
  onCellChange,
  onAttendanceToggle,
  onDeleteEvent,
  onEditEvent,
  memberStats,
  ministryId,
  readOnly,
  onlineUsers
}) => {

  const columns = useMemo(() => {
    return roles.flatMap(role => {
      if (ministryId === 'louvor' && role === 'Vocal') {
        return [1, 2, 3, 4, 5].map(i => ({
          display: `Vocal ${i}`,
          keySuffix: `Vocal_${i}`,
          originalRole: 'Vocal'
        }));
      }
      return [{ display: role, keySuffix: role, originalRole: role }];
    });
  }, [roles, ministryId]);

  const getAvailabilityStatus = (memberName: string, dateIso: string) => {
    // dateIso is YYYY-MM-DDTHH:mm
    const datePart = dateIso.split('T')[0];
    const userAvailability = availability[memberName] || [];
    
    if (userAvailability.includes(`${datePart}-BLK`)) return 'unavailable'; // Month block
    if (userAvailability.includes(datePart)) return 'unavailable'; // Full day
    
    // Check specific shifts if needed (Morning/Night)
    const hour = parseInt(dateIso.split('T')[1].split(':')[0], 10);
    const isMorningEvent = hour < 12; // Simple heuristic
    
    if (isMorningEvent && userAvailability.includes(`${datePart}_M`)) return 'unavailable';
    if (!isMorningEvent && userAvailability.includes(`${datePart}_N`)) return 'unavailable';

    return 'available';
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm bg-white dark:bg-zinc-800">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 uppercase text-xs font-bold border-b border-zinc-200 dark:border-zinc-700">
          <tr>
            <th className="px-4 py-3 sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-[200px] min-w-[150px]">Data / Evento</th>
            {columns.map(col => (
              <th key={col.keySuffix} className="px-4 py-3 min-w-[160px] whitespace-nowrap">
                {col.display}
              </th>
            ))}
            {!readOnly && <th className="px-4 py-3 text-right w-[100px]">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
          {events.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-zinc-400">
                Nenhum evento agendado para este período.
              </td>
            </tr>
          ) : (
            events.map(event => {
              const dateObj = new Date(event.iso);
              const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
              const time = event.iso.split('T')[1];

              return (
                <tr key={event.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                  <td className="px-4 py-3 sticky left-0 bg-white dark:bg-zinc-800 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-700/30 transition-colors border-r border-zinc-100 dark:border-zinc-700/50 z-10 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-1.5">
                        <span className="text-zinc-400">{weekDay.replace('.', '')}</span> {event.dateDisplay}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm leading-tight">
                        {event.title}
                      </span>
                      <span className="text-zinc-400 text-xs flex items-center gap-1">
                        <Clock size={10} /> {time}
                      </span>
                    </div>
                  </td>

                  {columns.map(col => {
                    const uniqueKey = `${event.id}_${col.keySuffix}`;
                    const currentValue = schedule[uniqueKey] || '';
                    const isConfirmed = attendance[uniqueKey];
                    
                    const availabilityStatus = currentValue ? getAvailabilityStatus(currentValue, event.iso) : 'available';
                    const hasConflict = currentValue && availabilityStatus === 'unavailable';
                    
                    const availableOptions = members[col.originalRole] || allMembers;

                    return (
                      <td key={uniqueKey} className="px-4 py-3 align-top">
                        <div className="relative group/cell">
                          {readOnly ? (
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${currentValue ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400 italic'}`}>
                                    {currentValue || 'Vago'}
                                </span>
                                {isConfirmed && <CheckCircle2 size={14} className="text-emerald-500" />}
                            </div>
                          ) : (
                            <div className="relative">
                                <select
                                    value={currentValue}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        const member = memberProfiles.find(m => m.name === newVal);
                                        onCellChange(event.id, col.keySuffix, member ? member.id : null, newVal || null);
                                    }}
                                    className={`w-full bg-zinc-50 dark:bg-zinc-900 border text-sm rounded-lg pl-2 pr-7 py-2 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer text-ellipsis overflow-hidden
                                        ${hasConflict 
                                            ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10' 
                                            : isConfirmed 
                                                ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' 
                                                : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
                                        }
                                    `}
                                >
                                    <option value="">--</option>
                                    {availableOptions.map(m => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>
                                
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                                    {isConfirmed ? (
                                        <CheckCircle2 size={14} className="text-emerald-500" />
                                    ) : hasConflict ? (
                                        <AlertCircle size={14} className="text-red-500" />
                                    ) : null}
                                </div>
                            </div>
                          )}
                          
                          {!readOnly && currentValue && (
                              <div className="flex gap-1 mt-1 justify-end opacity-0 group-hover/cell:opacity-100 transition-opacity absolute right-0 -bottom-3 bg-white dark:bg-zinc-800 shadow-md rounded p-0.5 border border-zinc-100 dark:border-zinc-700 z-20">
                                  <button 
                                    onClick={() => onAttendanceToggle(uniqueKey)}
                                    className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 ${isConfirmed ? 'text-emerald-500' : 'text-zinc-400'}`}
                                    title={isConfirmed ? "Remover confirmação" : "Confirmar presença"}
                                  >
                                      <CheckCircle2 size={12} />
                                  </button>
                              </div>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {!readOnly && (
                    <td className="px-4 py-3 text-right align-top sticky right-0 bg-white dark:bg-zinc-800 border-l border-zinc-100 dark:border-zinc-700/50">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => onEditEvent(event)}
                            className="p-2 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Editar evento"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => onDeleteEvent(event.iso, event.title)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir evento"
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};