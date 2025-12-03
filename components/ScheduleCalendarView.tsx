
import React, { useState } from 'react';
import { ScheduleMap, Role, AttendanceMap, CustomEvent } from '../types';
import { User, CheckCircle2, ChevronLeft, ChevronRight, X, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { getMonthName } from '../utils/dateUtils';
import { NextEventCard } from './NextEventCard';

interface Props {
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  currentUser: any;
  currentMonth: string;
  onMonthChange: (month: string) => void;
  customEvents: CustomEvent[]; // Recebe eventos para gerar o calendário localmente
}

export const ScheduleCalendarView: React.FC<Props> = ({ roles, schedule, attendance, currentUser, currentMonth, onMonthChange, customEvents }) => {
  const [selectedEvent, setSelectedEvent] = useState<{ iso: string, title: string, dateDisplay: string } | null>(null);

  const [year, month] = currentMonth.split('-').map(Number);
  
  // Lógica de Geração de Dias (Cópia simplificada da utils para renderizar o grid)
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 (Dom) a 6 (Sab)

  const changeMonth = (delta: number) => {
      const d = new Date(year, month - 1 + delta, 1);
      const iso = d.toISOString().slice(0, 7);
      onMonthChange(iso);
  };

  const getEventsForDay = (day: number) => {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const dayEvents: { iso: string, title: string, time: string, dateDisplay: string }[] = [];

      // Eventos Customizados
      customEvents.forEach(evt => {
          if (evt.date === dateStr) {
              dayEvents.push({ iso: `${dateStr}T${evt.time}`, title: evt.title, time: evt.time, dateDisplay: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}` });
          }
      });

      // Eventos Padrão (Hardcoded como na utils)
      const date = new Date(year, month - 1, day);
      const dow = date.getDay();
      if (dow === 3) dayEvents.push({ iso: `${dateStr}T19:30`, title: "Culto (Quarta)", time: "19:30", dateDisplay: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}` });
      if (dow === 0) {
          dayEvents.push({ iso: `${dateStr}T09:00`, title: "Domingo (Manhã)", time: "09:00", dateDisplay: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}` });
          dayEvents.push({ iso: `${dateStr}T18:00`, title: "Domingo (Noite)", time: "18:00", dateDisplay: `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}` });
      }

      return dayEvents;
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header Navegação */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <CalendarIcon size={24} className="text-blue-500"/> Calendário
        </h2>
        <div className="flex items-center bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-1">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"><ChevronLeft size={20}/></button>
            <span className="w-32 text-center font-bold text-zinc-800 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg"><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* Grid de Calendário */}
      <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
          {/* Dias da Semana */}
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
             {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                 <div key={d} className="py-3 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">{d}</div>
             ))}
          </div>
          
          {/* Dias */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr">
             {/* Empty slots for start of month */}
             {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                 <div key={`empty-${i}`} className="bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-r border-zinc-100 dark:border-zinc-700/50" />
             ))}

             {/* Actual Days */}
             {Array.from({ length: daysInMonth }).map((_, i) => {
                 const day = i + 1;
                 const dayEvents = getEventsForDay(day);
                 const isToday = new Date().toISOString().slice(0,10) === `${currentMonth}-${String(day).padStart(2,'0')}`;

                 return (
                     <div key={day} className={`min-h-[100px] border-b border-r border-zinc-100 dark:border-zinc-700/50 p-2 relative flex flex-col gap-1 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-900/10 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                         <span className={`text-sm font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-500'}`}>{day}</span>
                         
                         {/* Lista de Eventos no Dia */}
                         <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                            {dayEvents.map(evt => {
                                // Verifica quem está escalado neste evento
                                const membersInEvent = roles.map(r => schedule[`${evt.iso}_${r}`]).filter(Boolean);
                                
                                return (
                                    <button 
                                        key={evt.iso}
                                        onClick={() => setSelectedEvent(evt)}
                                        className="text-left bg-zinc-100 dark:bg-zinc-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-zinc-200 dark:border-zinc-600 rounded px-1.5 py-1 transition-all group"
                                    >
                                        <div className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate mb-1">{evt.time} - {evt.title}</div>
                                        {/* Bolinhas dos Escalados */}
                                        <div className="flex -space-x-1 overflow-hidden">
                                            {membersInEvent.length > 0 ? membersInEvent.map((m, idx) => (
                                                <div key={idx} className="w-3 h-3 rounded-full bg-blue-500 ring-1 ring-white dark:ring-zinc-800" title={m}></div>
                                            )) : (
                                                <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600 ring-1 ring-white dark:ring-zinc-800"></div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                         </div>
                     </div>
                 );
             })}

             {/* Fill remaining cells if needed to make grid square-ish */}
             {Array.from({ length: (42 - (daysInMonth + firstDayOfWeek)) % 7 }).map((_, i) => (
                <div key={`end-empty-${i}`} className="bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-r border-zinc-100 dark:border-zinc-700/50" />
             ))}
          </div>
      </div>

      {/* Modal de Detalhes (Pop-up) */}
      {selectedEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedEvent(null)}>
              <div className="w-full max-w-md bg-transparent" onClick={e => e.stopPropagation()}>
                  <div className="relative">
                      <button 
                        onClick={() => setSelectedEvent(null)}
                        className="absolute -top-12 right-0 text-white hover:text-zinc-200 p-2"
                      >
                          <X size={32} />
                      </button>
                      <NextEventCard 
                          event={selectedEvent} 
                          schedule={schedule} 
                          attendance={attendance} 
                          roles={roles} 
                          onShare={() => {}} // Não precisa compartilhar daqui, só visualizar
                          onConfirm={() => {}} // Visualização apenas, ou poderia implementar confirmação
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
