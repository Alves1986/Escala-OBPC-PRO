
import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, Calendar, Save, User, Briefcase, RefreshCcw } from 'lucide-react';
import { Role, ScheduleMap, User as UserType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: { iso: string; title: string; dateDisplay: string } | null;
  schedule: ScheduleMap;
  roles: Role[];
  onSave: (oldIso: string, newTitle: string, newTime: string) => void;
  onSwapRequest?: (role: string, eventIso: string, eventTitle: string) => void;
  currentUser?: UserType | null;
  ministryId: string | null;
}

export const EventDetailsModal: React.FC<Props> = ({ isOpen, onClose, event, schedule, roles, onSave, onSwapRequest, currentUser, ministryId }) => {
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (event) {
        setTime(event.iso.split('T')[1]);
        setTitle(event.title);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden transform transition-all scale-100">
            {/* Header */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-start">
                <div>
                    <h2 className="font-bold text-lg text-zinc-800 dark:text-white leading-tight">Detalhes do Evento</h2>
                    <p className="text-xs text-zinc-500 mt-1">Visualize a escala ou edite as informações.</p>
                </div>
                <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                {/* Form Section */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nome do Evento</label>
                        <input 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                            placeholder="Ex: Culto da Vitória"
                        />
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
                                <input 
                                    type="time" 
                                    value={time} 
                                    onChange={e => setTime(e.target.value)} 
                                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                                />
                             </div>
                        </div>
                    </div>
                </div>

                {/* Team List Section */}
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-700 flex items-center gap-2">
                        <User size={14}/> Equipe Escalada
                    </h3>
                    <div className="space-y-3">
                        {expandedRoles.map(roleObj => {
                            const member = schedule[`${event.iso}_${roleObj.keySuffix}`];
                            return (
                                <div key={roleObj.keySuffix} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${member ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
                                            <Briefcase size={14} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{roleObj.display}</span>
                                            <span className={`text-sm font-medium ${member ? 'text-zinc-800 dark:text-zinc-200' : 'text-zinc-400 italic'}`}>
                                                {member || 'Vago'}
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
                    <button 
                        onClick={() => onSave(event.iso, title, time)} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                    >
                        <Save size={18} /> Salvar Alterações
                    </button>
                    
                    {onSwapRequest && currentUser && userAssignment && (
                        <button 
                            onClick={() => onSwapRequest(userAssignment.keySuffix, event.iso, title)}
                            className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
                        >
                            <RefreshCcw size={18} /> Solicitar Troca / Indisponibilidade
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  )
}
