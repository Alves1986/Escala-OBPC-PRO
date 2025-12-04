import React from 'react';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis } from '../types';
import { CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  allMembers: string[];
  scheduleIssues: ScheduleAnalysis;
  onCellChange: (key: string, value: string) => void;
  onAttendanceToggle: (key: string) => void;
  onDeleteEvent: (iso: string, title: string) => void;
  memberStats: Record<string, number>;
}

export const ScheduleTable: React.FC<Props> = ({
  events, roles, schedule, attendance, availability, members, allMembers, scheduleIssues, onCellChange, onAttendanceToggle, onDeleteEvent, memberStats
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
                  
                  // Use allMembers for a flat list, allowing any registered member to be selected
                  // Sort by availability and then by usage count
                  const sortedMembers = [...allMembers].sort((a, b) => {
                        const unavailA = isUnavailable(a, event.iso);
                        const unavailB = isUnavailable(b, event.iso);
                        // Unavailable members go to bottom
                        if (unavailA && !unavailB) return 1;
                        if (!unavailA && unavailB) return -1;
                        // Then sort by usage count (least used first for balance, or most used if preferred)
                        return (memberStats[a] || 0) - (memberStats[b] || 0);
                  });

                  const isConfirmed = attendance[key];
                  const issue = scheduleIssues[key];
                  const hasLocalConflict = currentValue && isUnavailable(currentValue, event.iso);

                  return (
                    <td key={key} className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="relative w-full group/cell">
                          <select
                            value={currentValue}
                            onChange={(e) => onCellChange(key, e.target.value)}
                            className={`w-full bg-zinc-100 dark:bg-zinc-900/50 border-0 rounded-md py-1.5 pl-3 pr-8 text-xs ring-1 ring-inset focus:ring-2 sm:text-sm sm:leading-6 cursor-pointer transition-all
                              ${hasLocalConflict 
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
                                const unavail = isUnavailable(m, event.iso);
                                return (
                                    <option key={m} value={m} className={unavail ? 'text-red-400 bg-red-50 dark:bg-zinc-800' : ''}>
                                    {m} ({memberStats[m] || 0}) {unavail ? '[Indisp.]' : ''}
                                    </option>
                                );
                            })}
                          </select>
                          
                          {/* Indicador Visual de Conflito Local */}
                          {hasLocalConflict && (
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-red-500 animate-pulse" title="CONFLITO: Membro indisponível neste horário!">
                              <AlertTriangle size={16} />
                            </div>
                          )}
                        </div>
                        
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