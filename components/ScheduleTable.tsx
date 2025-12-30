import React from 'react';
import { Edit, Trash2, CheckCircle2 } from 'lucide-react';
import { MemberSelector } from './MemberSelector';

const checkIsAvailable = (availabilityLookup: any, memberName: string, eventIso: string) => {
    if (!availabilityLookup || !availabilityLookup[memberName]) return true;
    const dateStr = eventIso.split('T')[0];
    const unavailableDates = availabilityLookup[memberName];
    // If date is in list, member is NOT available (based on AvailabilityScreen logic)
    return !unavailableDates.some((d: string) => d.startsWith(dateStr));
};

// Simplified Row Component without strict memoization to ensure updates flow correctly
const ScheduleRow = ({ event, columns, schedule, attendance, availabilityLookup, availabilityNotes, members, memberProfiles, scheduleIssues, globalConflicts, onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, readOnly, onlineUsers }: any) => {
    const time = event.iso.split('T')[1];

    return (
        <tr className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
            <td className="px-6 py-4 sticky left-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm z-10 border-r border-zinc-200 dark:border-zinc-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-zinc-900 dark:text-white truncate text-sm" title={event.title}>{event.title}</span>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                            <span className="font-medium">{event.dateDisplay}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                            <span className="font-mono">{time}</span>
                        </div>
                    </div>
                    {!readOnly && (
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => onEditEvent(event)} className="text-zinc-400 hover:text-blue-500 p-1"><Edit size={14} /></button>
                            <button type="button" onClick={() => onDeleteEvent(event.iso, event.title)} className="text-zinc-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                        </div>
                    )}
                </div>
            </td>
            {columns.map((col: any) => {
                const key = `${event.iso}_${col.keySuffix}`;
                const currentValue = schedule[key] || "";
                const roleMembers = members[col.realRole] || [];
                const isConfirmed = attendance[key];
                
                const hasLocalConflict = currentValue && !checkIsAvailable(availabilityLookup, currentValue, event.iso);
                
                let globalConflictMsg = "";
                let hasGlobalConflict = false;
                if (currentValue && !readOnly) {
                    const normalized = currentValue.trim().toLowerCase();
                    const conflicts = globalConflicts[normalized];
                    if (conflicts) {
                        const conflict = conflicts.find((c: any) => c.eventIso === event.iso);
                        if (conflict) {
                            hasGlobalConflict = true;
                            globalConflictMsg = `${conflict.ministryId.toUpperCase()}`;
                        }
                    }
                }

                return (
                    <td key={key} className="px-3 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                            {readOnly ? (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate ${currentValue ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-600'}`}>{currentValue || '-'}</span>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <MemberSelector 
                                        value={currentValue} 
                                        onChange={(val: string) => {
                                            // FIX: Mapeia o Nome selecionado (val) para o UUID real usando memberProfiles
                                            if (!val) {
                                                onCellChange(key, ""); // Limpar
                                            } else {
                                                const targetMember = memberProfiles?.find((p: any) => p.name === val);
                                                if (targetMember) {
                                                    onCellChange(key, targetMember.id); // Envia UUID
                                                } else {
                                                    console.warn("Membro selecionado não encontrado na lista de perfis:", val);
                                                }
                                            }
                                        }} 
                                        options={roleMembers} 
                                        memberProfiles={memberProfiles} 
                                        memberStats={memberStats} 
                                        hasError={hasLocalConflict} 
                                        hasWarning={hasGlobalConflict} 
                                        warningMsg={globalConflictMsg} 
                                        eventIso={event.iso} 
                                        availabilityLookup={availabilityLookup} 
                                        availabilityNotes={availabilityNotes}
                                        onlineUsers={onlineUsers}
                                    />
                                    {hasLocalConflict && <div className="text-[9px] text-red-500 mt-1 flex items-center gap-1 font-medium ml-1">Indisponível</div>}
                                    {hasGlobalConflict && <div className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-bold ml-1">Em {globalConflictMsg}</div>}
                                </div>
                            )}
                            {currentValue && (
                                <button type="button" onClick={() => onAttendanceToggle(key)} className={`p-1 rounded-md transition-colors flex-shrink-0 ${isConfirmed ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-zinc-300 hover:text-zinc-400 bg-transparent'}`} title={isConfirmed ? "Confirmado" : "Pendente"}>
                                    <CheckCircle2 size={16} />
                                </button>
                            )}
                        </div>
                    </td>
                );
            })}
        </tr>
    );
};

export const ScheduleTable = ({ events, roles, schedule, attendance, availability, availabilityNotes, members, allMembers, memberProfiles, scheduleIssues, globalConflicts, onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, ministryId, readOnly, onlineUsers }: any) => {
    const columns = roles.map((role: any) => ({
        header: role,
        keySuffix: role,
        realRole: role
    }));

    return (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm bg-white dark:bg-zinc-900">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr>
                        <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky left-0 z-20 border-b border-zinc-200 dark:border-zinc-700">Evento</th>
                        {columns.map((col: any) => (
                            <th key={col.keySuffix} className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 min-w-[180px]">
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {events.map((event: any) => (
                        <ScheduleRow 
                            key={event.iso} 
                            event={event} 
                            columns={columns} 
                            schedule={schedule} 
                            attendance={attendance} 
                            availabilityLookup={availability}
                            availabilityNotes={availabilityNotes}
                            members={members}
                            memberProfiles={memberProfiles}
                            scheduleIssues={scheduleIssues}
                            globalConflicts={globalConflicts}
                            onCellChange={onCellChange}
                            onAttendanceToggle={onAttendanceToggle}
                            onDeleteEvent={onDeleteEvent}
                            onEditEvent={onEditEvent}
                            memberStats={memberStats}
                            readOnly={readOnly}
                            onlineUsers={onlineUsers}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
