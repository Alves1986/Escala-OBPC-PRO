
import React from 'react';
import { ScheduleMap, Role } from '../types';

interface Props {
  currentMonth: string;
  events: { iso: string; dateDisplay: string; title: string }[];
  schedule: ScheduleMap;
  roles: Role[];
  onEventClick?: (event: { iso: string; title: string; dateDisplay: string }) => void;
}

export const CalendarGrid: React.FC<Props> = ({ currentMonth, events, schedule, roles, onEventClick }) => {
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.iso.startsWith(dateStr));
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <div className="grid grid-cols-7 gap-4 mb-4">
        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
          <div key={d} className="text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 md:gap-4">
        {/* Blanks rendered always to maintain grid structure on all devices */}
        {blanks.map(i => <div key={`blank-${i}`} />)}
        
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
          const isToday = new Date().toISOString().split('T')[0] === dateStr;
          
          return (
             <div key={day} className={`min-h-[100px] bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 p-2 flex flex-col transition-all hover:border-zinc-300 dark:hover:border-zinc-600 ${isToday ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}>
                <span className={`text-sm font-bold mb-1 ${isToday ? 'text-blue-500' : 'text-zinc-500'}`}>{day}</span>
                <div className="flex-1 space-y-1.5">
                  {dayEvents.map(evt => (
                    <div 
                        key={evt.iso} 
                        onClick={() => onEventClick && onEventClick({ iso: evt.iso, title: evt.title, dateDisplay: evt.dateDisplay })}
                        className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 p-1.5 rounded-lg text-[10px] border-l-2 border-blue-500 cursor-pointer transition-colors"
                    >
                       <div className="font-bold text-blue-700 dark:text-blue-300 truncate">{evt.title}</div>
                       <div className="text-blue-600 dark:text-blue-400 opacity-80">{evt.iso.split('T')[1]}</div>
                       {/* Mini dots indicator for assigned roles */}
                       <div className="flex gap-0.5 mt-1 flex-wrap">
                          {roles.map(r => {
                             const assigned = schedule[`${evt.iso}_${r}`];
                             return assigned ? <div key={r} className="w-1.5 h-1.5 rounded-full bg-blue-500/60" title={`${r}: ${assigned}`} /> : null;
                          })}
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          );
        })}
      </div>
    </div>
  );
};
