import React, { useState, useEffect, useMemo } from 'react';
import { 
    fetchRulesV2, 
    fetchAssignmentsV2, 
    fetchMembersV2, 
    fetchMinistryRoles,
    generateOccurrencesV2,
    saveAssignmentV2,
    removeAssignmentV2,
    AssignmentV2,
    MemberV2,
    OccurrenceV2
} from '../services/scheduleServiceV2';
import { Loader2, ChevronLeft, ChevronRight, Save, Trash2, AlertTriangle, Calendar } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
    ministryId: string;
    orgId: string;
}

export const ScheduleEditorV2: React.FC<Props> = ({ ministryId, orgId }) => {
    const { addToast } = useToast();
    
    // -- STATE --
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    
    const [roles, setRoles] = useState<string[]>([]);
    const [members, setMembers] = useState<MemberV2[]>([]);
    const [assignments, setAssignments] = useState<AssignmentV2[]>([]);
    const [occurrences, setOccurrences] = useState<OccurrenceV2[]>([]);

    // -- LOAD DATA --
    const loadData = async () => {
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;

            // Parallel Fetch
            const [fetchedRoles, fetchedMembers, fetchedRules, fetchedAssignments] = await Promise.all([
                fetchMinistryRoles(ministryId, orgId),
                fetchMembersV2(ministryId, orgId),
                fetchRulesV2(ministryId, orgId),
                fetchAssignmentsV2(ministryId, orgId, monthStr)
            ]);

            setRoles(fetchedRoles);
            setMembers(fetchedMembers);
            setAssignments(fetchedAssignments);
            
            // Logic Projection
            const generated = generateOccurrencesV2(fetchedRules, year, month);
            setOccurrences(generated);

        } catch (e) {
            console.error(e);
            addToast("Erro ao carregar dados da escala.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [ministryId, orgId, currentDate]);

    // -- ACTIONS --

    const handleCellChange = async (occurrence: OccurrenceV2, role: string, memberId: string) => {
        // Optimistic Update? No, let's stick to safe sync for now to ensure DB consistency first.
        // Or simple local state update for responsiveness.
        
        setProcessing(true);
        try {
            if (memberId === "") {
                // REMOVE
                await removeAssignmentV2(ministryId, orgId, {
                    event_key: occurrence.ruleId,
                    event_date: occurrence.date,
                    role: role
                });
                
                // Update Local State
                setAssignments(prev => prev.filter(a => !(a.event_key === occurrence.ruleId && a.event_date === occurrence.date && a.role === role)));
                addToast("Removido", "info");
            } else {
                // SAVE
                await saveAssignmentV2(ministryId, orgId, {
                    event_key: occurrence.ruleId, // STRICTLY UUID
                    event_date: occurrence.date,  // STRICTLY DATE
                    role: role,
                    member_id: memberId
                });

                // Update Local State (Refetch logic or Manual Push)
                const memberObj = members.find(m => m.id === memberId);
                const newAssignment: AssignmentV2 = {
                    event_key: occurrence.ruleId,
                    event_date: occurrence.date,
                    role: role,
                    member_id: memberId,
                    member_name: memberObj?.name,
                    confirmed: false
                };

                setAssignments(prev => {
                    // Remove existing for this cell if any
                    const filtered = prev.filter(a => !(a.event_key === occurrence.ruleId && a.event_date === occurrence.date && a.role === role));
                    return [...filtered, newAssignment];
                });
                
                addToast("Salvo", "success");
            }
        } catch (e: any) {
            console.error(e);
            addToast("Erro ao salvar: " + (e.message || "Erro desconhecido"), "error");
        } finally {
            setProcessing(false);
        }
    };

    // -- NAVIGATION --
    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    // -- HELPERS --
    const getAssignment = (ruleId: string, date: string, role: string) => {
        return assignments.find(a => a.event_key === ruleId && a.event_date === date && a.role === role);
    };

    // -- RENDER --
    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-zinc-400" size={32}/></div>;
    }

    const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"><ChevronLeft size={20}/></button>
                    <h2 className="text-lg font-bold capitalize text-zinc-800 dark:text-white min-w-[150px] text-center">{monthLabel}</h2>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"><ChevronRight size={20}/></button>
                </div>
                {processing && <span className="text-xs text-zinc-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Salvando...</span>}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 min-w-[150px] sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 border-r border-zinc-200 dark:border-zinc-700">Evento / Data</th>
                            {roles.map(role => (
                                <th key={role} className="px-4 py-3 min-w-[180px] text-center">{role}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {occurrences.length === 0 ? (
                            <tr>
                                <td colSpan={roles.length + 1} className="p-8 text-center text-zinc-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Calendar size={32} className="opacity-20"/>
                                        Nenhum evento programado para este mês.
                                        <span className="text-xs">Verifique as "Regras de Agenda".</span>
                                    </div>
                                </td>
                            </tr>
                        ) : occurrences.map(occ => (
                            <tr key={occ.iso} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                                <td className="px-4 py-3 sticky left-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700">
                                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{occ.title}</div>
                                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                                        {occ.date.split('-').reverse().slice(0, 2).join('/')} <span className="w-1 h-1 bg-zinc-300 rounded-full"/> {occ.time}
                                    </div>
                                </td>
                                {roles.map(role => {
                                    const assignment = getAssignment(occ.ruleId, occ.date, role);
                                    const value = assignment?.member_id || "";

                                    return (
                                        <td key={`${occ.iso}_${role}`} className="px-2 py-2">
                                            <div className="relative">
                                                <select
                                                    value={value}
                                                    onChange={(e) => handleCellChange(occ, role, e.target.value)}
                                                    className={`w-full text-xs p-2 rounded-lg border appearance-none outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer
                                                        ${value 
                                                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium' 
                                                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'
                                                        }
                                                    `}
                                                    disabled={processing}
                                                >
                                                    <option value="">-- Vazio --</option>
                                                    {members.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </select>
                                                {/* Visual Confirmation Indicator */}
                                                {assignment?.confirmed && (
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full pointer-events-none" title="Confirmado"/>
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
