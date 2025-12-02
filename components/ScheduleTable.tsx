import React from 'react';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap } from '../types';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  onCellChange: (key: string, value: string) => void;
  onAttendanceToggle: (key: string) => void;
  memberStats: Record<string, number>;
}

export const ScheduleTable: React.FC<Props> = ({
  events, roles, schedule, attendance, availability, members, onCellChange, onAttendanceToggle, memberStats
}) => {
  
  // Calculate if member is unavailable for a specific date
  const isUnavailable = (member: string, isoDateStr: string) => {
    const datePart = isoDateStr.split('T')[0];
    return availability[member]?.includes(datePart);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-48">Evento</th>
              {roles.map(role => (
                <th key={role} className="px-6 py-4 font-bold min-w-[180px]">{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={roles.length + 1} className="p-8 text-center text-zinc-500">Nenhum evento para este mês.</td></tr>
            ) : events.map((event) => (
              <tr key={event.iso} className="border-b border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                <td className="px-6 py-4 sticky left-0 bg-white dark:bg-zinc-800 z-10 border-r border-zinc-100 dark:border-zinc-700">
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">{event.title}</span>
                    <span className="text-xs text-zinc-500">{event.dateDisplay}</span>
                  </div>
                </td>
                {roles.map(role => {
                  const key = `${event.iso}_${role}`;
                  const currentValue = schedule[key] || "";
                  const roleMembers = members[role] || [];
                  const isConfirmed = attendance[key];

                  // Sort members: Available first, then by least usage
                  const sortedMembers = [...roleMembers].sort((a, b) => {
                    const unavailA = isUnavailable(a, event.iso);
                    const unavailB = isUnavailable(b, event.iso);
                    if (unavailA && !unavailB) return 1;
                    if (!unavailA && unavailB) return -1;
                    return (memberStats[a] || 0) - (memberStats[b] || 0);
                  });

                  return (
                    <td key={key} className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="relative w-full group">
                          <select
                            value={currentValue}
                            onChange={(e) => onCellChange(key, e.target.value)}
                            className={`w-full bg-zinc-100 dark:bg-zinc-900/50 border-0 rounded-md py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6 cursor-pointer
                              ${currentValue ? 'text-zinc-900 dark:text-zinc-100 ring-zinc-300 dark:ring-zinc-600' : 'text-zinc-400 ring-zinc-200 dark:ring-zinc-700'}
                              focus:ring-brand-500
                            `}
                          >
                            <option value="">-- Selecionar --</option>
                            {sortedMembers.map(m => {
                              const unavail = isUnavailable(m, event.iso);
                              return (
                                <option key={m} value={m} disabled={unavail} className={unavail ? 'text-red-400' : ''}>
                                  {m} ({memberStats[m] || 0}) {unavail ? '[Indisp.]' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {/* Indicator for conflicts/availability if forced */}
                          {currentValue && isUnavailable(currentValue, event.iso) && (
                            <div className="absolute right-8 top-2 text-red-500" title="Conflito de Disponibilidade">
                              <AlertTriangle size={14} />
                            </div>
                          )}
                        </div>
                        
                        {currentValue && (
                          <button
                            onClick={() => onAttendanceToggle(key)}
                            className={`p-1 rounded-full transition-colors ${
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
