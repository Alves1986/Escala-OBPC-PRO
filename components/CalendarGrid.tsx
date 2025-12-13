
import React from 'react';
import { ScheduleMap, Role } from '../types';
import { getLocalDateISOString } from '../utils/dateUtils';

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

  const getAssignedStats = (eventIso: string) => {
      let assignedCount = 0;
      roles.forEach(r => {
          if (schedule[`${eventIso}_${r}`]) assignedCount++;
      });
      return { 
          count: assignedCount, 
          total: roles.length,
          percent: roles.length > 0 ? (assignedCount / roles.length) * 100 : 0
      };
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-2 md:p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
          <div key={d} className="text-center text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-3 auto-rows-fr">
        {blanks.map(i => <div key={`blank-${i}`} className="min-h-[80px] md:min-h-[120px]" />)}
        
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
          const isToday = getLocalDateISOString() === dateStr;
          
          return (
             <div 
                key={day} 
                className={`relative min-h-[85px] md:min-h-[120px] bg-zinc-50 dark:bg-zinc-900/50 rounded-lg md:rounded-xl border p-1 md:p-2 flex flex-col transition-all
                    ${isToday 
                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-400/30' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }
                `}
             >
                {/* Day Number */}
                <span className={`text-[10px] md:text-sm font-bold mb-1 block text-center md:text-left
                    ${isToday 
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-full w-5 h-5 md:w-auto md:h-auto flex items-center justify-center mx-auto md:mx-0' 
                        : 'text-zinc-500'
                    }`}
                >
                    {day}
                </span>

                {/* Events Container */}
                <div className="flex-1 flex flex-col gap-1 md:gap-1.5 overflow-hidden">
                  {dayEvents.map(evt => {
                    const stats = getAssignedStats(evt.iso);
                    const time = evt.iso.split('T')[1].slice(0, 5);
                    const isFullyStaffed = stats.percent >= 100;

                    return (
                        <button 
                            key={evt.iso} 
                            onClick={() => onEventClick && onEventClick({ iso: evt.iso, title: evt.title, dateDisplay: evt.dateDisplay })}
                            className="w-full text-left bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded md:rounded-lg p-1 md:p-2 shadow-sm transition-all active:scale-95 overflow-hidden group"
                        >
                           {/* Mobile: Compact Time Pill */}
                           <div className="md:hidden flex flex-col items-center justify-center gap-0.5">
                                <div className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm w-full text-center tracking-tight
                                    ${isFullyStaffed 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                    {time}
                                </div>
                                
                                {/* Tiny Dots for Staffing Status */}
                                <div className="flex justify-center gap-0.5 h-1 w-full px-0.5">
                                    {stats.count > 0 ? (
                                        Array.from({ length: Math.min(stats.count, 4) }).map((_, i) => (
                                            <div key={i} className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                                        ))
                                    ) : (
                                        <div className="w-1 h-1 rounded-full border border-zinc-300 dark:border-zinc-600"></div>
                                    )}
                                </div>
                           </div>

                           {/* Desktop: Detailed Card */}
                           <div className="hidden md:block">
                               <div className="flex justify-between items-center mb-1">
                                   <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 rounded">{time}</span>
                                   {isFullyStaffed && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Equipe completa"></div>}
                               </div>
                               <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate leading-tight mb-1" title={evt.title}>
                                   {evt.title}
                               </div>
                               {/* Progress Bar */}
                               <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                                   <div 
                                      className={`h-full rounded-full transition-all duration-500 ${isFullyStaffed ? 'bg-green-500' : 'bg-blue-500'}`}
                                      style={{ width: `${stats.percent}%` }}
                                   />
                               </div>
                           </div>
                        </button>
                    );
                  })}
                </div>
             </div>
          );
        })}
      </div>
    </div>
  );
};
