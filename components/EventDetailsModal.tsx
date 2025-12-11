
import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Calendar, Save, User, RefreshCcw, Lock, CheckSquare, Square, UserPlus, CalendarPlus } from 'lucide-react';
import { Role, ScheduleMap, User as UserType, TeamMemberProfile } from '../types';
import { createGoogleCalendarLink } from '../utils/calendarUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: { iso: string; title: string; dateDisplay: string } | null;
  schedule: ScheduleMap;
  roles: Role[];
  allMembers?: TeamMemberProfile[]; // Added to lookup avatars
  onSave: (oldIso: string, newTitle: string, newTime: string, applyToAll: boolean) => void; 
  onSwapRequest?: (role: string, eventIso: string, eventTitle: string) => void;
  currentUser?: UserType | null;
  ministryId: string | null;
  canEdit?: boolean; 
}

export const EventDetailsModal: React.FC<Props> = ({ 
    isOpen, onClose, event, schedule, roles, allMembers = [], 
    onSave, onSwapRequest, currentUser, ministryId, canEdit = false 
}) => {
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (event) {
        setTime(event.iso.split('T')[1]);
        setTitle(event.title);
        setApplyToAll(false); 
    }
  }, [event]);

  const expandedRoles = useMemo(() => {
      return roles.flatMap(role => {
          if (ministryId === 'louvor' && role === 'Vocal') {
              return [1, 2, 3, 4, 5].map(i => ({
                  display: `Vocal ${i}`,
                  keySuffix: `Vocal_${i}`
              }));
          }
          return [{ display: role, keySuffix: role }];
      });
  }, [roles, ministryId]);

  if (!isOpen || !event) return null;

  // Determine if user is scheduled for this event
  const userAssignment = currentUser ? expandedRoles.find(r => schedule[`${event.iso}_${r.keySuffix}`] === currentUser.name) : null;

  const calendarLink = createGoogleCalendarLink(event, `Escala Ministério: ${event.title}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden transform transition-all scale-100 max-h-[90vh]">
            {/* Header */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-start">
                <div>
                    <h2 className="font-bold text-lg text-zinc-800 dark:text-white leading-tight">Detalhes do Evento</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                        {canEdit ? 'Edite as informações do evento.' : 'Visualize a escala e detalhes.'}
                    </p>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                {/* Form Section */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nome do Evento</label>
                        {canEdit ? (
                            <input 
                                value={title} 
                                onChange={e => setTitle(e.target.value)} 
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                placeholder="Ex: Culto da Vitória"
                            />
                        ) : (
                            <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                                {title}
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                             <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Data</label>
                             <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-100 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 cursor-not-allowed">
                                <Calendar size={16}/> 
                                <span className="text-sm font-medium">{event.dateDisplay}</span>
                             </div>
                        </div>
                        <div className="space-y-1.5">
                             <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Horário</label>
                             <div className="relative">
                                <Clock size={16} className="absolute left-3 top-3 text-zinc-400"/>
                                {canEdit ? (
                                    <input 
                                        type="time" 
                                        value={time} 
                                        onChange={e => setTime(e.target.value)} 
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                                    />
                                ) : (
                                    <div className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-700/50 rounded-xl pl-9 pr-3 py-2.5 text-zinc-700 dark:text-zinc-300 text-sm font-bold flex items-center">
                                        {time}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>

                    {/* Apply to All Checkbox */}
                    {canEdit && (
                        <div 
                            onClick={() => setApplyToAll(!applyToAll)}
                            className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                        >
                            <div className={`mt-0.5 ${applyToAll ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}>
                                {applyToAll ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Aplicar a todos os eventos iguais</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    Atualiza o nome e horário de todos os eventos <strong>"{event.title}"</strong> neste mês.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Team List Section */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
                        <User size={14}/> Equipe Escalada
                    </h3>
                    <div className="space-y-3">
                        {expandedRoles.map(roleObj => {
                            const memberName = schedule[`${event.iso}_${roleObj.keySuffix}`];
                            const memberProfile = allMembers.find(m => m.name === memberName);

                            return (
                                <div key={roleObj.keySuffix} className="flex items-center justify-between group p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700/50">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar / Placeholder */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border shrink-0 ${memberName ? 'border-zinc-200 dark:border-zinc-700' : 'border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800'}`}>
                                            {memberProfile?.avatar_url ? (
                                                <img src={memberProfile.avatar_url} alt={memberName} className="w-full h-full object-cover" />
                                            ) : memberName ? (
                                                <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {memberName.charAt(0).toUpperCase()}
                                                </div>
                                            ) : (
                                                <UserPlus size={16} className="text-zinc-300 dark:text-zinc-600" />
                                            )}
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{roleObj.display}</span>
                                            <span className={`text-sm font-medium ${memberName ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 italic'}`}>
                                                {memberName || 'Vago'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    {canEdit && (
                        <button 
                            onClick={() => onSave(event.iso, title, time, applyToAll)} 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                        >
                            <Save size={18} /> Salvar Alterações
                        </button>
                    )}
                    
                    {onSwapRequest && currentUser && userAssignment && (
                        <button 
                            onClick={() => onSwapRequest(userAssignment.keySuffix, event.iso, title)}
                            className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                        >
                            <RefreshCcw size={18} /> Solicitar Troca / Indisponibilidade
                        </button>
                    )}

                    {/* Google Calendar Link */}
                    <a 
                        href={calendarLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                    >
                        <CalendarPlus size={18} /> Adicionar à Agenda Google
                    </a>

                    {!canEdit && !userAssignment && (
                        <div className="text-center text-xs text-zinc-400 flex items-center justify-center gap-1 mt-2">
                            <Lock size={12} /> Edição restrita a administradores.
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  )
}
