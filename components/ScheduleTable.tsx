import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ScheduleMap, Role, AttendanceMap, AvailabilityMap, ScheduleAnalysis, GlobalConflictMap, TeamMemberProfile, AvailabilityNotesMap } from '../types';
import { CheckCircle2, AlertTriangle, Trash2, Edit, Clock, User, ChevronDown, ChevronLeft, ChevronRight, X, Search, AlertOctagon, Settings, FileText } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

interface Props {
  events: { id: string; iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  availability: AvailabilityMap;
  availabilityNotes?: AvailabilityNotesMap; 
  members: Record<string, string[]>;
  allMembers: string[]; 
  memberProfiles?: TeamMemberProfile[];
  scheduleIssues: ScheduleAnalysis;
  globalConflicts: GlobalConflictMap; 
  onCellChange: (eventId: string, role: string, memberId: string | null, memberName?: string) => void;
  onAttendanceToggle: (key: string) => void;
  onDeleteEvent: (iso: string, title: string) => void;
  onEditEvent: (event: { iso: string; title: string; dateDisplay: string }) => void; 
  memberStats: Record<string, number>;
  ministryId: string | null;
  readOnly?: boolean; 
  onlineUsers?: string[];
}

const checkIsAvailable = (lookupSet: Set<string>, member: string, eventIso: string): boolean => {
    const datePart = eventIso.slice(0, 10);
    const hour = parseInt(eventIso.slice(11, 13), 10);
    if (lookupSet.has(`${member}_${datePart}`)) return true;
    const isMorning = hour < 13;
    if (isMorning && lookupSet.has(`${member}_${datePart}_M`)) return true;
    if (!isMorning && lookupSet.has(`${member}_${datePart}_N`)) return true;
    return false;
};

// Componente isolado para a lista do dropdown (Renderizado apenas quando aberto)
const SelectorDropdown = ({ 
    options, onClose, onChange, position, memberProfiles, memberStats, availabilityLookup, availabilityNotes, eventIso, onlineUsers, label, value
}: any) => {
    const [search, setSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const profileById = useMemo(() => {
        const map: Record<string, any> = {};
        (memberProfiles || []).forEach((p: any) => { map[p.id] = p; });
        return map;
    }, [memberProfiles]);

    useClickOutside(dropdownRef, () => {
        onClose();
    });

    useEffect(() => {
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);

    const filteredOptions = useMemo(() => {
        return options
            .filter((opt: string) => {
                const profile = profileById[opt];
                const labelName = (profile?.name || opt).toLowerCase();
                return labelName.includes(search.toLowerCase());
            })
            .sort((a: string, b: string) => {
                const availA = checkIsAvailable(availabilityLookup, a, eventIso);
                const availB = checkIsAvailable(availabilityLookup, b, eventIso);
                if (availA && !availB) return -1;
                if (!availA && availB) return 1;
                return 0;
            });
    }, [options, search, availabilityLookup, eventIso, profileById]);

    const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

    const getMemberNote = (memberId: string) => {
        if (!availabilityNotes) return null;
        const monthKey = eventIso.slice(0, 7) + '-00';
        const key = `${memberId}_${monthKey}`;
        return availabilityNotes[key];
    };

    const handleSelect = (memberId: string) => {
        if (!memberId) {
            onChange(null, "");
        } else {
            const profile = profileById[memberId];
            onChange(memberId, profile?.name || "");
        }
        onClose();
    };

    return createPortal(
        <>
            {isMobile && <div className="fixed inset-0 z-[99998] bg-black/60 backdrop-blur-sm transition-opacity" onMouseDown={onClose} />}
            <div 
                ref={dropdownRef}
                id="member-selector-portal"
                className={`fixed z-[99999] bg-white dark:bg-zinc-800 flex flex-col overflow-hidden animate-fade-in
                    ${isMobile 
                        ? 'bottom-0 left-0 w-full rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.3)] max-h-[85vh] border-t border-zinc-200 dark:border-zinc-700' 
                        : 'rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 max-h-[320px] ring-1 ring-black/5'
                    }
                `}
                style={isMobile ? {} : { top: position.top, left: position.left, width: position.width }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {isMobile && (
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                        <span className="font-bold text-zinc-700 dark:text-zinc-200">{label || 'Selecionar Membro'}</span>
                        <button type="button" onClick={onClose} className="p-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-500"><X size={16} /></button>
                    </div>
                )}
                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800 z-10">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
                        <input 
                            ref={searchInputRef} 
                            placeholder="Buscar membro..." 
                            className="w-full pl-8 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') onClose();
                            }}
                        />
                    </div>
                </div>

                <div className={`overflow-y-auto ${isMobile ? 'p-4 space-y-2' : 'p-2 space-y-1'} custom-scrollbar`}>
                    <button
                        type="button"
                        onClick={() => handleSelect("")}
                        className={`w-full flex items-center justify-between rounded-lg transition-all p-2 text-left ${!value ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 border border-transparent'}`}
                    >
                        <span className="text-sm italic text-zinc-500">(Vazio)</span>
                    </button>

                    {filteredOptions.map((opt: string, idx: number) => {
                        const profile = profileById[opt];
                        const displayName = profile?.name || opt;
                        const count = memberStats[displayName] || 0;
                        const isAvailable = checkIsAvailable(availabilityLookup, opt, eventIso);
                        const prevIsAvailable = idx > 0 ? checkIsAvailable(availabilityLookup, filteredOptions[idx-1], eventIso) : true;
                        const isOnline = profile?.id ? onlineUsers.includes(profile.id) : false;
                        const note = getMemberNote(opt);

                        return (
                            <React.Fragment key={opt}>
                            {idx > 0 && isAvailable !== prevIsAvailable && (
                                <div className="my-1 border-t border-dashed border-zinc-200 dark:border-zinc-700" />
                            )}
                            <button 
                                type="button"
                                onClick={() => handleSelect(opt)}
                                className={`w-full flex items-center justify-between rounded-lg transition-all p-2 text-left ${value === opt ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50 border border-transparent'} ${!isAvailable ? 'opacity-80' : ''}`}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="relative shrink-0">
                                        {profile?.avatar_url ? (
                                            <img src={profile.avatar_url} alt="" className={`w-8 h-8 rounded-full object-cover border ${isAvailable ? 'border-zinc-200 dark:border-zinc-700' : 'border-zinc-200 dark:border-zinc-600'}`} />
                                        ) : (
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isAvailable ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-200 text-zinc-500'}`}>{getInitials(displayName)}</div>
                                        )}
                                        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-800 rounded-full" />}
                                    </div>
                                    <div className="flex flex-col truncate text-left flex-1 min-w-0">
                                        <span className={`font-medium truncate text-sm ${isAvailable ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 line-through decoration-zinc-400/50'}`}>{displayName}</span>
                                        {!isAvailable && <span className="text-[10px] text-zinc-400 font-medium">Indisponível</span>}
                                        {note && (
                                            <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5 font-medium truncate">
                                                <FileText size={10} className="shrink-0"/> "{note}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {count > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 pointer-events-none ${count > 4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>{count}x</span>}
                            </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </>,
        document.body
    );
};

const MemberSelector = ({ 
    value, onChange, options, memberProfiles = [], memberStats, hasError, hasWarning, eventIso, availabilityLookup, availabilityNotes, warningMsg, label, onlineUsers = []
}: { 
    value: string; onChange: (id: string | null, name?: string) => void; options: string[]; memberProfiles?: TeamMemberProfile[]; memberStats: Record<string, number>; hasError: boolean; hasWarning: boolean; eventIso: string; availabilityLookup: Set<string>; availabilityNotes?: AvailabilityNotesMap; warningMsg?: string; label?: string; onlineUsers?: string[];
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 200 });

    const profileById = useMemo(() => {
        const map: Record<string, TeamMemberProfile> = {};
        memberProfiles.forEach((p) => { map[p.id] = p; });
        return map;
    }, [memberProfiles]);

    const selectedProfile = profileById[value];
    const displayValue = selectedProfile?.name || value;
    const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : '?';

    useEffect(() => {
        if (isOpen && triggerRef.current && window.innerWidth >= 768) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < 320; 

            let leftPos = rect.left;
            const minWidth = Math.max(rect.width, 240);
            if (leftPos + minWidth > window.innerWidth) {
                leftPos = window.innerWidth - minWidth - 20;
            }

            setPosition({
                top: openUp ? rect.top - 320 : rect.bottom + 5,
                left: leftPos,
                width: minWidth
            });
        }
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={triggerRef}>
            <div 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    setIsOpen(!isOpen); 
                }}
                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all bg-white dark:bg-zinc-900 shadow-sm ${
                    hasError 
                    ? 'border-red-300 bg-red-50 dark:bg-red-900/10' 
                    : hasWarning
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
            >
                {value ? (
                    <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                        {selectedProfile?.avatar_url ? (
                            <img src={selectedProfile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700" />
                        ) : (
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 shrink-0`}>
                                {getInitials(displayValue)}
                            </div>
                        )}
                        <span className={`text-xs font-medium truncate ${hasError ? 'text-red-700 dark:text-red-400' : hasWarning ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {displayValue}
                        </span>
                    </div>
                ) : (
                    <span className="text-xs text-zinc-400 italic pl-1 pointer-events-none">Vazio</span>
                )}
                <ChevronDown size={12} className={`text-zinc-400 shrink-0 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            <div className="absolute -top-1.5 -right-1.5 flex gap-1 pointer-events-none">
                {hasWarning && <div className="bg-amber-500 text-white p-0.5 rounded-full shadow-md"><AlertTriangle size={8} fill="currentColor" /></div>}
                {hasError && <div className="bg-red-500 text-white p-0.5 rounded-full shadow-md"><AlertOctagon size={8} fill="currentColor" /></div>}
            </div>

            {isOpen && (
                <SelectorDropdown 
                    options={options} 
                    onClose={() => setIsOpen(false)} 
                    onChange={onChange} 
                    position={position}
                    memberProfiles={memberProfiles}
                    memberStats={memberStats}
                    availabilityLookup={availabilityLookup}
                    availabilityNotes={availabilityNotes}
                    eventIso={eventIso}
                    onlineUsers={onlineUsers}
                    label={label}
                    value={value}
                />
            )}
        </div>
    );
};

const ScheduleRow = ({ event, columns, schedule, attendance, availabilityLookup, availabilityNotes, members, memberProfiles, scheduleIssues, globalConflicts, onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, readOnly, onlineUsers }: any) => {
    const time = event.iso.split('T')[1];
    const memberNameById = useMemo(() => {
        const map: Record<string, string> = {};
        (memberProfiles || []).forEach((p: any) => { map[p.id] = p.name; });
        return map;
    }, [memberProfiles]);

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
                // CORREÇÃO CRÍTICA: Identidade Única Obrigatória = RuleID + Date + Role
                // event.id JÁ VEM como "ruleId_date" do useEvents/generateEvents
                // Então uniqueKey = ruleId_date_role
                const uniqueKey = `${event.id}_${col.keySuffix}`;
                console.log("[EDITOR_RENDER_KEY]", {
                    uniqueKey,
                    value: schedule[uniqueKey]
                });
                console.log("[EDITOR_UI_KEY_CHECK]", {
                    uniqueKey,
                    exists: schedule[uniqueKey] !== undefined,
                    value: schedule[uniqueKey]
                });
                
                // NUNCA usar fallbacks soltos como schedule[ruleKey] ou schedule[isoKey]
                // Isso que causava a mistura de cultos do mesmo dia.
                console.log("[EDITOR_UI_LOOKUP]", {
                    eventId: event.id,
                    role: col.keySuffix,
                    key: `${event.id}_${col.keySuffix}`,
                    exists: schedule[`${event.id}_${col.keySuffix}`]
                });

                const rawValue = schedule[uniqueKey];
                let currentValue = rawValue;

                if (!currentValue) {
                    const eventDate = event.id.split("_")[1];

                    let fallbackKey = Object.keys(schedule).find(k =>
                        k.endsWith(`_${eventDate}_${col.keySuffix}`)
                    );

                    if (!fallbackKey && col.realRole !== col.keySuffix) {
                        fallbackKey = Object.keys(schedule).find(k =>
                            k.endsWith(`_${eventDate}_${col.realRole}`)
                        );
                    }

                    if (fallbackKey) {
                        currentValue = schedule[fallbackKey];
                        console.log("[EDITOR_FALLBACK_MATCH]", {
                            uniqueKey,
                            fallbackKey
                        });
                    }
                }

                currentValue =
                  currentValue && currentValue !== "__MISSING_NAME__"
                    ? currentValue
                    : "";
                console.log("[EDITOR_RENDER_RESOLVE]", {
                    uniqueKey,
                    rawValue,
                    currentValue
                });
                const isConfirmed = attendance[uniqueKey] || false;
                
                const roleMembers = members[col.realRole] || [];
                
                const hasLocalConflict = currentValue && !checkIsAvailable(availabilityLookup, currentValue, event.iso);
                const currentName = (memberProfiles || []).find((p: any) => p.id === currentValue)?.name || currentValue;
                
                let globalConflictMsg = "";
                let hasGlobalConflict = false;
                if (currentValue && !readOnly) {
                    const normalized = currentName.trim().toLowerCase();
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
                    <td key={uniqueKey} className="px-3 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                            {readOnly ? (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`text-sm font-medium truncate ${currentValue ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-300 dark:text-zinc-600'}`}>{currentValue || '-'}</span>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <MemberSelector 
                                        value={currentValue} 
                                        onChange={(memberId, memberName) => {
                                            // event.id = ruleId_date
                                            const safeEventId = event.id;
                                            onCellChange(safeEventId, col.keySuffix, memberId, memberName);
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
                                <button type="button" onClick={() => onAttendanceToggle(uniqueKey)} className={`p-1 rounded-md transition-colors flex-shrink-0 ${isConfirmed ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-zinc-300 hover:text-zinc-400 bg-transparent'}`} title={isConfirmed ? "Confirmado" : "Pendente"}>
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

export const ScheduleTable: React.FC<Props> = ({ events, roles, schedule, attendance, availability, availabilityNotes, members, allMembers, memberProfiles, scheduleIssues, globalConflicts, onCellChange, onAttendanceToggle, onDeleteEvent, onEditEvent, memberStats, ministryId, readOnly = false, onlineUsers = [] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const availabilityLookup = useMemo(() => {
      const set = new Set<string>();
      Object.entries(availability).forEach(([member, dates]) => {
          (dates as string[]).forEach((date) => {
              set.add(`${member}_${date}`);
          });
      });
      return set;
  }, [availability]);

  const columns = useMemo(() => {
      return roles.flatMap(role => {
          if (ministryId === 'louvor' && role === 'Vocal') {
              return [1, 2, 3, 4, 5].map(i => ({ displayRole: `Vocal ${i}`, realRole: 'Vocal', keySuffix: `Vocal_${i}` }));
          }
          return [{ displayRole: role, realRole: role, keySuffix: role }];
      });
  }, [roles, ministryId]);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 10); 
      setShowRightArrow(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 10);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => { clearTimeout(timer); window.removeEventListener('resize', checkScroll); };
  }, [columns, events]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
        const { clientWidth } = scrollContainerRef.current;
        const scrollAmount = clientWidth * 0.6;
        scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative group ${readOnly ? 'opacity-70 pointer-events-none' : 'opacity-100'}`}>
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 transition-opacity duration-200 overflow-hidden relative">
          
          {showLeftArrow && (
            <>
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white dark:from-zinc-900 to-transparent z-20 pointer-events-none" />
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2.5 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-110 transition-all active:scale-95"
                    title="Rolar para esquerda"
                >
                    <ChevronLeft size={20} />
                </button>
            </>
          )}

          {showRightArrow && (
            <>
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent z-20 pointer-events-none" />
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 bg-white dark:bg-zinc-800 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-110 transition-all active:scale-95"
                    title="Rolar para direita"
                >
                    <ChevronRight size={20} />
                </button>
            </>
          )}

          <div ref={scrollContainerRef} onScroll={checkScroll} className="overflow-x-auto custom-scrollbar scroll-smooth"> 
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-bold sticky left-0 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-md z-20 w-64 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Evento</th>
                  {columns.map(col => <th key={col.keySuffix} className="px-3 py-4 font-bold min-w-[180px] text-zinc-400">{col.displayRole}</th>)}
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? <tr><td colSpan={columns.length + 1} className="p-12 text-center text-zinc-400">Nenhum evento para este mês.</td></tr> : events.map((event) => (
                    <ScheduleRow 
                        key={event.id} // UUID Stable Key (ruleId_date)
                        event={event} 
                        columns={columns} 
                        schedule={schedule} 
                        attendance={attendance} 
                        availabilityLookup={availabilityLookup}
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
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4 pb-24">
          {events.length === 0 ? (
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500">Nenhum evento para este mês.</div>
          ) : events.map((event) => (
              <div key={event.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-slide-up">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg truncate">{event.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                              <span className="font-bold">{event.dateDisplay}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                              <span className="flex items-center gap-1"><Clock size={12}/> {event.iso.split('T')[1]}</span>
                          </div>
                      </div>
                      {!readOnly && <div className="flex gap-1 ml-2"><button type="button" onClick={() => onEditEvent(event)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Edit size={16}/></button><button type="button" onClick={() => onDeleteEvent(event.iso, event.title)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"><Trash2 size={16}/></button></div>}
                  </div>
                  
                  {columns.length === 0 ? (
                      <div className="p-6 text-center">
                          <p className="text-sm text-zinc-400 italic mb-2">Nenhuma função configurada.</p>
                          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-lg">
                              <Settings size={14}/>
                              <span>Vá em <strong>Funções</strong> para configurar.</span>
                          </div>
                      </div>
                  ) : (
                      <div className="p-4 space-y-4">
                          {columns.map(col => {
                              // CORREÇÃO CRÍTICA MOBILE: Usar chave composta única (RuleID_Date_Role)
                              const uniqueKey = `${event.id}_${col.keySuffix}`;
                              console.log("[EDITOR_RENDER_KEY]", {
                                  uniqueKey,
                                  value: schedule[uniqueKey]
                              });
                              console.log("[EDITOR_UI_KEY_CHECK]", {
                                  uniqueKey,
                                  exists: schedule[uniqueKey] !== undefined,
                                  value: schedule[uniqueKey]
                              });
                              
                              console.log("[EDITOR_UI_LOOKUP]", {
                                  eventId: event.id,
                                  role: col.keySuffix,
                                  key: `${event.id}_${col.keySuffix}`,
                                  exists: schedule[`${event.id}_${col.keySuffix}`]
                              });

                              const rawValue = schedule[uniqueKey];
                              let currentValue = rawValue;

                              if (!currentValue) {
                                  const eventDate = event.id.split("_")[1];

                                  let fallbackKey = Object.keys(schedule).find(k =>
                                      k.endsWith(`_${eventDate}_${col.keySuffix}`)
                                  );

                                  if (!fallbackKey && col.realRole !== col.keySuffix) {
                                      fallbackKey = Object.keys(schedule).find(k =>
                                          k.endsWith(`_${eventDate}_${col.realRole}`)
                                      );
                                  }

                                  if (fallbackKey) {
                                      currentValue = schedule[fallbackKey];
                                      console.log("[EDITOR_FALLBACK_MATCH]", {
                                          uniqueKey,
                                          fallbackKey
                                      });
                                  }
                              }

                              currentValue =
                                currentValue && currentValue !== "__MISSING_NAME__"
                                  ? currentValue
                                  : "";
                              console.log("[EDITOR_RENDER_RESOLVE]", {
                                  uniqueKey,
                                  rawValue,
                                  currentValue
                              });
                              const isConfirmed = attendance[uniqueKey] || false;
                              
                              const roleMembers = members[col.realRole] || [];
                              
                              const hasLocalConflict = currentValue && !checkIsAvailable(availabilityLookup, currentValue, event.iso);
                              const currentName = (memberProfiles || []).find((p: any) => p.id === currentValue)?.name || currentValue;
                              
                              let globalConflictMsg = "";
                              let hasGlobalConflict = false;
                              if (currentValue && !readOnly) {
                                  const normalized = currentName.trim().toLowerCase();
                                  const conflicts = globalConflicts[normalized];
                                  if (conflicts) {
                                      const conflict = conflicts.find((c: any) => c.eventIso === event.iso);
                                      if (conflict) { hasGlobalConflict = true; globalConflictMsg = `Conflito: ${currentName} em ${conflict.ministryId.toUpperCase()}`; }
                                  }
                              }
                              return (
                                  <div key={uniqueKey} className="flex items-start gap-3">
                                      <div className="flex-1">
                                          <span className="text-[10px] uppercase font-bold text-zinc-400 mb-1 block tracking-wider">{col.displayRole}</span>
                                          <div className="flex items-center gap-2">
                                              <div className="flex-1">
                                                  <MemberSelector 
                                                        value={currentValue} 
                                                        onChange={(memberId, memberName) => {
                                                            const safeEventId = event.id;
                                                            onCellChange(safeEventId, col.keySuffix, memberId, memberName);
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
                                                    label={`Selecionar ${col.displayRole}`} 
                                                    onlineUsers={onlineUsers} 
                                                  />
                                              </div>
                                              {currentValue && <button type="button" onClick={() => onAttendanceToggle(uniqueKey)} className={`p-2.5 rounded-lg transition-colors border ${isConfirmed ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'text-zinc-300 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'}`}><CheckCircle2 size={18} /></button>}
                                          </div>
                                          {hasLocalConflict && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium"><AlertOctagon size={10}/> Indisponível</p>}
                                          {hasGlobalConflict && <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-bold animate-pulse"><AlertTriangle size={10}/> {globalConflictMsg}</div>}
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  )}
              </div>
          ))}
      </div>
    </div>
  );
};
