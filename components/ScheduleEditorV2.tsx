import React, { useState, useEffect, useRef } from 'react';
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
import { 
    Loader2, 
    ChevronLeft, 
    ChevronRight, 
    Search, 
    Trash2, 
    AlertTriangle, 
    Calendar,
    ChevronDown,
    Check
} from 'lucide-react';
import { useToast } from './Toast';

// --- COMPONENTES AUXILIARES ---

const Avatar = ({ name, color }: { name: string; color?: string }) => {
    const initials = name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    
    // Cores padrão para avatares
    const bgColors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 
        'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
        'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 
        'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 
        'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    
    const safeColor = color || bgColors[name.length % bgColors.length];

    return (
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${safeColor}`}>
            {initials}
        </div>
    );
};

// --- CÉLULA DE ESCALA (CORRIGIDA E ROBUSTA) ---
interface ScheduleCellProps {
    occurrence: OccurrenceV2;
    role: string;
    currentMemberId: string | null;
    members: MemberV2[];
    onAssign: (date: string, role: string, memberId: string | null, ruleId: string) => void;
    processing: boolean;
}

const ScheduleCell: React.FC<ScheduleCellProps> = ({ 
    occurrence, 
    role, 
    currentMemberId, 
    members, 
    onAssign,
    processing
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Click Outside Robusto
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen) return;
            // Se o clique for dentro do componente, não faz nada
            if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
                return;
            }
            // Se for fora, fecha
            setIsOpen(false);
        };

        // Usa mousedown para garantir captura antes de qualquer blur
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Foca no input ao abrir
    useEffect(() => {
        if (isOpen) {
            setSearchTerm(''); // Limpa busca ao abrir
            // Pequeno delay para garantir renderização
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const currentMember = members.find(m => m.id === currentMemberId);
    
    const filteredMembers = members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // CORREÇÃO PRINCIPAL: 
    // Usar a lógica de seleção diretamente sem depender apenas do onClick padrão
    const handleSelect = (memberId: string) => {
        onAssign(occurrence.date, role, memberId, occurrence.ruleId);
        setIsOpen(false);
    };

    const handleRemove = () => {
        onAssign(occurrence.date, role, null, occurrence.ruleId);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full h-full min-h-[42px]" ref={dropdownRef}>
            {/* Botão Principal (Gatilho) */}
            <button
                type="button" // Importante: type button para evitar submits acidentais
                onClick={() => !processing && setIsOpen(!isOpen)}
                disabled={processing}
                className={`w-full h-full px-2 py-1.5 flex items-center justify-between text-sm transition-all rounded border 
                    ${currentMember 
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30' 
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }
                    ${processing ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-400 z-10' : ''}
                `}
            >
                {currentMember ? (
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Avatar name={currentMember.name} />
                        <span className="truncate text-xs font-medium">{currentMember.name.split(' ')[0]}</span>
                    </div>
                ) : (
                    <span className="text-xs opacity-50">Vazio</span>
                )}
                <ChevronDown size={12} className={`opacity-50 transition-transform ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col z-[9999] animate-in fade-in zoom-in-95 duration-100">
                    
                    {/* Campo de Busca */}
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-700/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Buscar membro..."
                                className="w-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs rounded py-2 pl-8 pr-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-zinc-200 dark:border-zinc-700 placeholder:text-zinc-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                // Impede que clicar no input feche o menu
                                onClick={(e) => e.stopPropagation()} 
                            />
                        </div>
                    </div>

                    {/* Botão Remover */}
                    {currentMember && (
                        <div className="p-1 border-b border-zinc-100 dark:border-zinc-700/50">
                            <button
                                type="button"
                                // onMouseDown dispara ANTES do blur do input, garantindo a ação
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Impede perda de foco
                                    handleRemove();
                                }}
                                className="w-full text-left px-2 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded flex items-center gap-2 font-medium transition-colors"
                            >
                                <Trash2 size={12} />
                                REMOVER DA ESCALA
                            </button>
                        </div>
                    )}

                    {/* Lista de Membros */}
                    <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredMembers.length > 0 ? (
                            filteredMembers.map(member => (
                                <button
                                    key={member.id}
                                    type="button"
                                    // A MÁGICA ACONTECE AQUI: onMouseDown previne que o input perca o foco antes da hora
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Impede o blur
                                        handleSelect(member.id); // Executa a ação
                                    }}
                                    className={`w-full text-left px-2 py-2 flex items-center gap-2 rounded text-xs transition-all border border-transparent
                                        ${currentMemberId === member.id 
                                            ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-500/30' 
                                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:border-zinc-200 dark:hover:border-zinc-700'}
                                    `}
                                >
                                    <Avatar name={member.name} />
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="truncate font-medium">{member.name}</span>
                                    </div>
                                    {currentMemberId === member.id && <Check size={12} className="text-indigo-500" />}
                                </button>
                            ))
                        ) : (
                            <div className="py-8 flex flex-col items-center justify-center text-zinc-400 gap-2">
                                <Search size={16} className="opacity-20" />
                                <span className="text-xs">Nenhum membro encontrado</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

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

    const normalizeDate = (value?: string) => (value ? value.split('T')[0] : '');

    // -- LOAD DATA --
    const loadData = async () => {
        setLoading(true);
        try {
            const [rolesData, membersData, rules] = await Promise.all([
                fetchMinistryRoles(ministryId, orgId),
                fetchMembersV2(ministryId, orgId),
                fetchRulesV2(ministryId, orgId)
            ]);

            setRoles(rolesData);
            setMembers(membersData);

            // Gerar ocorrências do mês
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const generatedOccurrences = generateOccurrencesV2(rules, year, month);
            setOccurrences(generatedOccurrences);

            // Buscar escalas existentes (Passa YYYY-MM como string)
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;
            
            const existingAssignments = await fetchAssignmentsV2(ministryId, orgId, monthStr);
            setAssignments(existingAssignments);

        } catch (error) {
            console.error(error);
            addToast('Erro ao carregar dados da escala', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDate, ministryId, orgId]);

    // -- HANDLERS --
    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleAssignmentChange = async (date: string, role: string, memberId: string | null, ruleId: string) => {
        setProcessing(true);
        
        const tempId = `temp-${Date.now()}`;
        const previousAssignments = [...assignments];
        
        // Atualização Otimista
        setAssignments(prev => {
            const normalizedDate = normalizeDate(date);
            const filtered = prev.filter(a => !(normalizeDate(a.event_date) === normalizedDate && a.role === role && a.event_rule_id === ruleId));
            const next = memberId
                ? [...filtered, {
                    id: tempId,
                    event_rule_id: ruleId, 
                    event_date: normalizeDate(date),
                    role,
                    member_id: memberId,
                    confirmed: false,
                    event_key: ruleId
                }]
                : filtered;
            return next;
        });

        try {
            if (memberId) {
                await saveAssignmentV2(ministryId, orgId, {
                    event_rule_id: ruleId,
                    event_date: normalizeDate(date),
                    role,
                    member_id: memberId
                });
                
                addToast('Membro escalado', 'success');
            } else {
                await removeAssignmentV2(ministryId, orgId, {
                    event_rule_id: ruleId,
                    event_date: normalizeDate(date),
                    role
                });
                addToast('Removido da escala', 'success');
            }
        } catch (error) {
            console.error(error);
            addToast('Erro ao salvar alteração', 'error');
            setAssignments(previousAssignments); // Reverte em caso de erro
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Loader2 className="animate-spin mb-2" />
                <p>Carregando escala...</p>
            </div>
        );
    }

    const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
            {/* HEADER */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-100 dark:bg-indigo-500/10 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 capitalize">
                            {monthLabel}
                        </h2>
                        <p className="text-xs text-zinc-500">
                            {occurrences.length} eventos • {members.length} membros ativos
                        </p>
                    </div>
                </div>

                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button 
                        onClick={handlePrevMonth}
                        className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="w-32 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300 capitalize">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                    <button 
                        onClick={handleNextMonth}
                        className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* AREA DA TABELA */}
            <div className="flex-1 overflow-auto custom-scrollbar p-1 pb-40"> 
                <table className="w-full text-sm border-separate border-spacing-0">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-3 text-left font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-700 min-w-[150px] bg-zinc-50 dark:bg-zinc-900 sticky left-0 z-30">
                                Data / Evento
                            </th>
                            {roles.map(role => (
                                <th key={role} className="p-3 text-center font-semibold text-zinc-500 border-b border-l border-zinc-200 dark:border-zinc-700 min-w-[160px] bg-zinc-50 dark:bg-zinc-900">
                                    {role.toUpperCase()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {occurrences.map((occurrence) => (
                            <tr key={`${occurrence.date}-${occurrence.time}-${occurrence.ruleId}`} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                {/* Coluna Fixa de Data */}
                                <td className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800/30 sticky left-0 z-10 border-r border-zinc-200 dark:border-zinc-800">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                            {new Date(`${occurrence.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 rounded">
                                                {occurrence.time.substring(0, 5)}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 truncate max-w-[80px]" title={occurrence.title}>
                                                {occurrence.title}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                
                                {/* Células de Escala */}
                                {roles.map(role => {
                                    const assignment = assignments.find(a => {
                                        return normalizeDate(a.event_date) === normalizeDate(occurrence.date)
                                            && a.event_rule_id === occurrence.ruleId
                                            && a.role === role;
                                    });

                                    return (
                                        <td key={`${occurrence.date}-${role}`} className="p-2 border-b border-l border-zinc-100 dark:border-zinc-800/50 relative">
                                            <ScheduleCell 
                                                occurrence={occurrence}
                                                role={role}
                                                currentMemberId={assignment?.member_id || null}
                                                members={members}
                                                onAssign={handleAssignmentChange}
                                                processing={processing}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Estilos Globais para Scrollbar */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e4e4e7;
                    border-radius: 3px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #3f3f46;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d4d4d8;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #52525b;
                }
            `}</style>
        </div>
    );
};
