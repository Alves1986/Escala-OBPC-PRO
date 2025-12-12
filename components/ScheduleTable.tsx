
import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis, GlobalConflictMap, TeamMemberProfile } from '../types';
import { CheckCircle2, AlertTriangle, Trash2, Edit, Clock, User, ChevronDown, ChevronLeft, ChevronRight, X, Search, AlertOctagon, XCircle } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  members: Record<string, string[]>;
  allMembers: string[]; 
  memberProfiles?: TeamMemberProfile[];
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

const MemberSelector = ({ 
    value, 
    onChange, 
    options, 
    memberProfiles = [], 
    memberStats,
    hasError,
    hasWarning,
    eventIso,
    availability,
    warningMsg,
    label
}: { 
    value: string; 
    onChange: (val: string) => void; 
    options: string[]; 
    memberProfiles?: TeamMemberProfile[]; 
    memberStats: Record<string, number>;
    hasError: boolean;
    hasWarning: boolean;
    eventIso: string;
    availability: AvailabilityMap;
    warningMsg?: string;
    label?: string; // Para mostrar o nome da função no mobile
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const triggerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 200 });
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const selectedProfile = memberProfiles.find(p => p.name === value);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen && triggerRef.current && !isMobile) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 300; 
            
            setPosition({
                top: openUp ? rect.top - 300 : rect.bottom + 5,
                left: rect.left,
                width: rect.width
            });
        }
    }, [isOpen, isMobile]);

    // Foca no input de busca ao abrir
    const searchInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
            setSearch(""); // Limpa busca ao fechar
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            // No mobile, usamos um backdrop click handler separado
            if (isMobile) return;

            if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                const dropdown = document.getElementById('member-selector-portal');
                if (dropdown && !dropdown.contains(e.target as Node)) {
                    setIsOpen(false);
                }
            }
        };
        if (isOpen) window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [isOpen, isMobile]);

    const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

    const checkAvailability = (member: string) => {
        const [datePart, timePart] = eventIso.split('T');
        const availableDates = availability[member];
        
        if (!availableDates || availableDates.length === 0) return false;
        if (availableDates.includes(datePart)) return true;

        const hasMorning = availableDates.includes(`${datePart}_M`);
        const hasNight = availableDates.includes(`${datePart}_N`);
        const eventHour = parseInt(timePart.split(':')[0], 10);
        const isMorningEvent = eventHour < 13;

        if (isMorningEvent && hasMorning) return true;
        if (!isMorningEvent && hasNight) return true;

        return false;
    };

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
        const availA = checkAvailability(a);
        const availB = checkAvailability(b);
        if (availA && !availB) return -1; // A (Available) comes first
        if (!availA && availB) return 1;  // B (Available) comes first
        return 0;
    });

    return (
        <div className="relative w-full" ref={triggerRef}>
            <div 
                onClick={() => !isOpen && setIsOpen(true)}
                className={`flex items-center justify-between p-2.5 md:p-2 rounded-lg border cursor-pointer transition-all bg-white dark:bg-zinc-900 ${
                    hasError 
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10' 
                    : hasWarning
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-[0_0_0_1px_rgba(245,158,11,0.5)]'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                title={hasWarning ? warningMsg : undefined}
            >
                {value ? (
                    <div className="flex items-center gap-2 min-w-0">
                        {selectedProfile?.avatar_url ? (
                            <img src={selectedProfile.avatar_url} alt="" className="w-6 h-6 md:w-5 md:h-5 rounded-full object-cover shrink-0" />
                        ) : (
                            <div className={`w-6 h-6 md:w-5 md:h-5 rounded-full flex items-center justify-center text-[10px] md:text-[9px] font-bold text-white shrink-0 ${hasError ? 'bg-red-500' : hasWarning ? 'bg-amber-500' : 'bg-blue-600'}`}>
                                {getInitials(value)}
                            </div>
                        )}
                        <span className={`text-sm md:text-xs font-medium truncate ${hasError ? 'text-red-700 dark:text-red-400' : hasWarning ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {value}
                        </span>
                    </div>
                ) : (
                    <span className="text-sm md:text-xs text-zinc-400 italic">Selecionar...</span>
                )}
                <ChevronDown size={16} className={`text-zinc-400 shrink-0 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Warning Badge / Icon */}
            {hasWarning && (
                <div className="absolute -top-2 -right-2 z-20 animate-pulse">
                    <div className="bg-amber-500 text-white p-1 rounded-full shadow-md border-2 border-white dark:border-zinc-800" title={warningMsg}>
                        <AlertTriangle size={12} fill="currentColor" />
                    </div>
                </div>
            )}

            {/* Error Badge */}
            {hasError && !hasWarning && (
                <div className="absolute -top-2 -right-2 z-20">
                    <div className="bg-red-500 text-white p-1 rounded-full shadow-md border-2 border-white dark:border-zinc-800" title="Membro indisponível nesta data">
                        <AlertOctagon size={12} fill="currentColor" />
                    </div>
                </div>
            )}

            {isOpen && createPortal(
                <>
                    {/* Backdrop para mobile */}
                    {isMobile && (
                        <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
                    )}

                    <div 
                        id="member-selector-portal"
                        className={`fixed z-[9999] bg-white dark:bg-zinc-800 flex flex-col overflow-hidden animate-fade-in
                            ${isMobile 
                                ? 'bottom-0 left-0 w-full rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] max-h-[70vh] border-t border-zinc-200 dark:border-zinc-700' 
                                : 'rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 max-h-[300px]'
                            }
                        `}
                        style={isMobile ? {} : { 
                            top: position.top, 
                            left: position.left, 
                            width: Math.max(position.width, 240) 
                        }}
                    >
                        {/* Header do Seletor (Mobile) */}
                        {isMobile && (
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                                <span className="font-bold text-zinc-700 dark:text-zinc-200">{label || 'Selecionar Membro'}</span>
                                <button onClick={() => setIsOpen(false)} className="p-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-500">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {/* Campo de Busca */}
                        <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
                                <input 
                                    ref={searchInputRef}
                                    placeholder="Buscar membro..." 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 p-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Lista de Opções */}
                        <div className="overflow-y-auto custom-scrollbar p-1 flex-1">
                            <button 
                                onClick={() => { onChange(""); setIsOpen(false); }}
                                className="w-full text-left px-3 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 mb-1 border border-transparent"
                            >
                                <Trash2 size={16} /> Remover da Escala
                            </button>
                            
                            {filteredOptions.length === 0 && (
                                <div className="p-6 text-center text-sm text-zinc-400 flex flex-col items-center gap-2">
                                    <User size={24} className="opacity-20"/>
                                    Nenhum membro encontrado.
                                </div>
                            )}

                            {filteredOptions.map((opt, idx) => {
                                const profile = memberProfiles?.find(p => p.name === opt);
                                const count = memberStats[opt] || 0;
                                const isAvailable = checkAvailability(opt);
                                
                                // Separador visual (opcional se a lista for longa)
                                const prevIsAvailable = idx > 0 ? checkAvailability(filteredOptions[idx-1]) : true;
                                const showSeparator = !isAvailable && prevIsAvailable;

                                return (
                                    <React.Fragment key={opt}>
                                    {showSeparator && (
                                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 mt-1 mb-1 rounded">
                                            Indisponíveis
                                        </div>
                                    )}
                                    <button
                                        onClick={() => { onChange(opt); setIsOpen(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between group transition-colors mb-1 ${
                                            value === opt 
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30' 
                                            : isAvailable 
                                                ? 'hover:bg-zinc-100 dark:hover:bg-zinc-700/50 border border-transparent' 
                                                : 'opacity-50 hover:opacity-80 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {profile?.avatar_url ? (
                                                <img src={profile.avatar_url} alt="" className={`w-8 h-8 rounded-full object-cover border ${isAvailable ? 'border-green-400 shadow-sm' : 'border-zinc-200 dark:border-zinc-600 grayscale'}`} />
                                            ) : (
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAvailable ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-200 text-zinc-500'}`}>
                                                    {getInitials(opt)}
                                                </div>
                                            )}
                                            <div className="flex flex-col truncate text-left">
                                                <span className={`font-medium truncate text-sm ${isAvailable ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500 line-through decoration-zinc-400/50'}`}>{opt}</span>
                                                {isAvailable ? (
                                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1"><CheckCircle2 size={10}/> Disponível</span>
                                                ) : (
                                                    <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1"><XCircle size={10}/> Indisponível</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                            count === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            count > 4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                                        }`}>
                                            {count}x
                                        </span>
                                    </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

const ScheduleRow = React.memo(({ 
    event, columns, schedule, attendance, availability, members, memberProfiles, scheduleIssues, globalConflicts, 
    onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, readOnly 
}: any) => {

    const isUnavailable = useCallback((member: string, isoDateStr: string) => {
        const [datePart, timePart] = isoDateStr.split('T');
        const availableDates = availability[member];
        
        if (!availableDates || availableDates.length === 0) return true;

        if (availableDates.includes(datePart)) return false; 

        const hasMorning = availableDates.includes(`${datePart}_M`);
        const hasNight = availableDates.includes(`${datePart}_N`);
        
        const eventHour = parseInt(timePart.split(':')[0], 10);
        const isMorningEvent = eventHour < 13;

        if (isMorningEvent && hasMorning) return false; 
        if (!isMorningEvent && hasNight) return false; 

        return true; 
    }, [availability]);

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

                const isConfirmed = attendance[key];
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
                            globalConflictMsg = `Conflito: ${currentValue} já está em ${conflict.ministryId.toUpperCase()} como ${conflict.role}`;
                        }
                    }
                }

                return (
                    <td key={key} className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-center gap-2">
                            {readOnly ? (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate ${currentValue ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                        {currentValue || '-'}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <MemberSelector 
                                        value={currentValue}
                                        onChange={(val) => onCellChange(key, val)}
                                        options={roleMembers}
                                        memberProfiles={memberProfiles}
                                        memberStats={memberStats}
                                        hasError={hasLocalConflict}
                                        hasWarning={hasGlobalConflict}
                                        warningMsg={globalConflictMsg}
                                        eventIso={event.iso}
                                        availability={availability}
                                    />
                                    
                                    {hasLocalConflict && (
                                        <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium animate-pulse">
                                            <AlertOctagon size={10} /> Indisponível nesta data
                                        </div>
                                    )}

                                    {hasGlobalConflict && (
                                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-bold" title={globalConflictMsg}>
                                            <AlertTriangle size={10} /> Em outro ministério
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {currentValue && (
                                <button
                                    onClick={() => onAttendanceToggle(key)}
                                    className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                                        isConfirmed 
                                        ? 'text-green-600 bg-green-100 dark:bg-green-900/30' 
                                        : 'text-zinc-300 hover:text-zinc-400 bg-zinc-50 dark:bg-zinc-800'
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
    if (prevProps.readOnly !== nextProps.readOnly) return false;
    if (prevProps.memberStats !== nextProps.memberStats) return false;
    if (prevProps.event.iso !== nextProps.event.iso) return false;
    if (prevProps.memberProfiles !== nextProps.memberProfiles) return false;
    if (prevProps.globalConflicts !== nextProps.globalConflicts) return false;
    
    const keys = nextProps.columns.map((c: any) => `${nextProps.event.iso}_${c.keySuffix}`);
    const scheduleChanged = keys.some((k: string) => prevProps.schedule[k] !== nextProps.schedule[k]);
    const attendanceChanged = keys.some((k: string) => prevProps.attendance[k] !== nextProps.attendance[k]);
    
    return !scheduleChanged && !attendanceChanged; 
});

export const ScheduleTable: React.FC<Props> = React.memo(({
  events, roles, schedule, attendance, availability, members, allMembers, memberProfiles, scheduleIssues, globalConflicts, 
  onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, ministryId, readOnly = false
}) => {
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

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

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10); 
      setShowRightArrow(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, columns, events]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
        const { clientWidth } = scrollContainerRef.current;
        const scrollAmount = clientWidth * 0.6;
        scrollContainerRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }
  };

  const isUnavailable = (member: string, isoDateStr: string) => {
        const [datePart, timePart] = isoDateStr.split('T');
        const availableDates = availability[member];
        
        if (!availableDates || availableDates.length === 0) return true;
        if (availableDates.includes(datePart)) return false; 

        const hasMorning = availableDates.includes(`${datePart}_M`);
        const hasNight = availableDates.includes(`${datePart}_N`);
        
        const eventHour = parseInt(timePart.split(':')[0], 10);
        const isMorningEvent = eventHour < 13;

        if (isMorningEvent && hasMorning) return false; 
        if (!isMorningEvent && hasNight) return false; 

        return true; 
  };

  return (
    <div className={`relative group ${readOnly ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 transition-opacity duration-200 overflow-hidden relative">
          {/* Botões de Navegação Lateral (Desktop) */}
          {showLeftArrow && (
            <button 
                onClick={() => scroll('left')}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-zinc-800/90 shadow-xl border border-zinc-200 dark:border-zinc-700 p-2.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:scale-110 transition-all backdrop-blur-sm"
                title="Rolar para esquerda"
            >
                <ChevronLeft size={20} />
            </button>
          )}

          {showRightArrow && (
            <button 
                onClick={() => scroll('right')}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-zinc-800/90 shadow-xl border border-zinc-200 dark:border-zinc-700 p-2.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 hover:scale-110 transition-all backdrop-blur-sm"
                title="Rolar para direita"
            >
                <ChevronRight size={20} />
            </button>
          )}

          <div 
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="overflow-x-auto custom-scrollbar scroll-smooth"
          > 
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 w-64 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">Evento</th>
                  {columns.map(col => (
                    <th key={col.keySuffix} className="px-6 py-4 font-bold min-w-[200px]">{col.displayRole}</th>
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
                      memberProfiles={memberProfiles}
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

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-4 pb-24">
          {events.length === 0 ? (
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-8 text-center text-zinc-500">
                  Nenhum evento para este mês.
              </div>
          ) : events.map((event) => (
              <div key={event.iso} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden animate-slide-up">
                  {/* Card Header */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg truncate">{event.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">{event.dateDisplay}</span>
                              <span className="text-xs text-zinc-500 flex items-center gap-1"><Clock size={12}/> {event.iso.split('T')[1]}</span>
                          </div>
                      </div>
                      
                      {!readOnly && (
                          <div className="flex gap-1 ml-2">
                              <button onClick={() => onEditEvent(event)} className="p-2 text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 transition-colors"><Edit size={16}/></button>
                              <button onClick={() => onDeleteEvent(event.iso, event.title)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={16}/></button>
                          </div>
                      )}
                  </div>

                  {/* Card Body (Roles List) */}
                  <div className="p-4 space-y-4">
                      {columns.map(col => {
                          const key = `${event.iso}_${col.keySuffix}`;
                          const currentValue = schedule[key] || "";
                          const roleMembers = members[col.realRole] || [];
                          const isConfirmed = attendance[key];
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
                                      globalConflictMsg = `Conflito: ${currentValue} em ${conflict.ministryId.toUpperCase()}`;
                                  }
                              }
                          }

                          return (
                              <div key={key} className="flex items-start gap-3">
                                  <div className="flex-1">
                                      <span className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block tracking-wider">{col.displayRole}</span>
                                      
                                      <div className="flex items-center gap-2">
                                          <div className="flex-1">
                                              <MemberSelector 
                                                  value={currentValue}
                                                  onChange={(val) => onCellChange(key, val)}
                                                  options={roleMembers}
                                                  memberProfiles={memberProfiles}
                                                  memberStats={memberStats}
                                                  hasError={hasLocalConflict}
                                                  hasWarning={hasGlobalConflict}
                                                  warningMsg={globalConflictMsg}
                                                  eventIso={event.iso}
                                                  availability={availability}
                                                  label={`Selecionar ${col.displayRole}`}
                                              />
                                          </div>
                                          {currentValue && (
                                              <button
                                                  onClick={() => onAttendanceToggle(key)}
                                                  className={`p-2.5 rounded-lg transition-colors border ${
                                                      isConfirmed 
                                                      ? 'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                                                      : 'text-zinc-300 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'
                                                  }`}
                                              >
                                                  <CheckCircle2 size={18} />
                                              </button>
                                          )}
                                      </div>

                                      {hasLocalConflict && (
                                          <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium"><AlertOctagon size={10}/> Indisponível</p>
                                      )}
                                      {hasGlobalConflict && (
                                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-bold animate-pulse"><AlertTriangle size={10}/> {globalConflictMsg}</p>
                                      )}
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>
          ))}
      </div>

    </div>
  );
});
