
import React, { useState, useRef, useMemo } from 'react';
import { Check, ChevronDown, AlertTriangle, AlertCircle, Info, User, Search, Ban } from 'lucide-react';
import { useClickOutside } from '../hooks/useClickOutside';

interface Props {
    value: string;
    onChange: (value: string) => void;
    options: string[]; // List of names
    memberProfiles: any[]; // List of full profiles
    memberStats?: Record<string, number>;
    hasError?: boolean;
    hasWarning?: boolean;
    warningMsg?: string;
    eventIso: string;
    availabilityLookup: any;
    availabilityNotes: any;
    onlineUsers?: string[];
}

export const MemberSelector: React.FC<Props> = ({ 
    value, onChange, options = [], memberProfiles = [], memberStats = {},
    hasError, hasWarning, warningMsg, eventIso, availabilityLookup = {}, availabilityNotes = {}, onlineUsers = []
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useClickOutside(containerRef, () => setIsOpen(false));

    const handleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
            setSearchTerm("");
        }
    };

    const handleSelect = (name: string) => {
        onChange(name);
        setIsOpen(false);
    };

    const dateStr = eventIso.split('T')[0];

    const getAvailabilityStatus = (name: string) => {
        const dates = availabilityLookup[name];
        if (!dates) return 'unknown'; // No data sent
        
        // Check for full blockage
        if (dates.some((d: string) => d.includes('BLK') && d.startsWith(dateStr.slice(0, 7)))) return 'unavailable';

        const isUnavailable = dates.some((d: string) => d.startsWith(dateStr));
        return isUnavailable ? 'unavailable' : 'available';
    };

    const getNote = (name: string) => {
        return availabilityNotes[`${name}_${dateStr}`] || availabilityNotes[`${name}_${dateStr.slice(0, 7)}-00`];
    };

    // Merge options (roles) with current value if not present, and maybe allow searching all members
    const filteredOptions = useMemo(() => {
        const all = new Set([...options, value]);
        // Add anyone matching search from global list if searching
        if (searchTerm) {
            memberProfiles.forEach(p => {
                if (p.name.toLowerCase().includes(searchTerm.toLowerCase())) all.add(p.name);
            });
        }
        
        return Array.from(all)
            .filter(name => name && name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort();
    }, [options, value, searchTerm, memberProfiles]);

    const selectedProfile = memberProfiles.find(p => p.name === value);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={handleOpen}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-500 outline-none
                    ${hasError 
                        ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' 
                        : hasWarning
                            ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
                            : value 
                                ? 'bg-white border-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 shadow-sm'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }
                `}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {value ? (
                        <>
                            {selectedProfile?.avatar_url && (
                                <img src={selectedProfile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                            )}
                            <span className="truncate font-medium">{value}</span>
                        </>
                    ) : (
                        <span className="italic text-xs">Selecionar...</span>
                    )}
                </div>
                <div className="flex items-center">
                    {(hasError || hasWarning) && (
                        <AlertCircle size={14} className={`mr-1 ${hasError ? 'text-red-500' : 'text-amber-500'}`} />
                    )}
                    <ChevronDown size={14} className="opacity-50 shrink-0" />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 top-full left-0 w-full min-w-[240px] mt-1 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-slide-up">
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"/>
                            <input 
                                ref={searchInputRef}
                                type="text" 
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
                                placeholder="Buscar membro..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                        <button 
                            type="button"
                            onClick={() => handleSelect("")}
                            className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors italic flex items-center gap-2"
                        >
                            <Ban size={14}/> Remover Escala
                        </button>
                        
                        {filteredOptions.map((name) => {
                            const profile = memberProfiles.find(p => p.name === name);
                            const status = getAvailabilityStatus(name);
                            const note = getNote(name);
                            const count = memberStats[name] || 0;
                            const isOnline = profile && onlineUsers.includes(profile.id);
                            
                            let statusIcon = null;
                            let statusClass = "";
                            
                            if (status === 'unavailable') {
                                statusIcon = <AlertCircle size={12} />;
                                statusClass = "text-red-500 bg-red-50 dark:bg-red-900/20";
                            } else if (status === 'available') {
                                statusIcon = <Check size={12} />;
                                statusClass = "text-green-500 bg-green-50 dark:bg-green-900/20";
                            }

                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => handleSelect(name)}
                                    className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors group ${
                                        value === name 
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="relative shrink-0">
                                            {profile?.avatar_url ? (
                                                <img src={profile.avatar_url} className="w-6 h-6 rounded-full object-cover bg-zinc-200" />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                                    {name.charAt(0)}
                                                </div>
                                            )}
                                            {isOnline && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-zinc-900"></span>}
                                        </div>
                                        <div className="flex flex-col items-start min-w-0">
                                            <span className="font-medium truncate">{name}</span>
                                            {note && <span className="text-[10px] text-zinc-400 truncate max-w-[120px] flex items-center gap-1"><Info size={10}/> {note}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {status !== 'unknown' && (
                                            <div className={`p-1 rounded-full ${statusClass}`} title={status === 'unavailable' ? 'Indisponível' : 'Disponível'}>
                                                {statusIcon}
                                            </div>
                                        )}
                                        {count > 0 && (
                                            <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700 text-zinc-500 px-1.5 py-0.5 rounded-full">
                                                {count}x
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        
                        {filteredOptions.length === 0 && (
                            <div className="px-3 py-4 text-center text-zinc-400 text-xs">
                                Ninguém encontrado.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
