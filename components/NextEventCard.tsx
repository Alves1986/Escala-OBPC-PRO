
import React from 'react';
import { CalendarClock, User, CheckCircle2 } from 'lucide-react';
import { Role, AttendanceMap } from '../types';

interface Props {
  event: { iso: string; dateDisplay: string; title: string } | undefined;
  schedule: Record<string, string>;
  attendance: AttendanceMap;
  roles: Role[];
  onConfirm: (key: string) => void;
  ministryId: string | null;
}

export const NextEventCard: React.FC<Props> = ({ event, schedule, attendance, roles, onConfirm, ministryId }) => {
  if (!event) return null;

  const getAssignedMembers = () => {
    const assigned: { role: string; name: string; key: string }[] = [];
    
    roles.forEach(role => {
      // Special logic for Louvor Vocal expansion (Vocal 1-5)
      if (ministryId === 'louvor' && role === 'Vocal') {
          [1, 2, 3, 4, 5].forEach(i => {
              const key = `${event.iso}_Vocal_${i}`;
              const member = schedule[key];
              if (member) {
                  assigned.push({ role: `Vocal ${i}`, name: member, key });
              }
          });
      } else {
          // Standard logic
          const key = `${event.iso}_${role}`;
          const member = schedule[key];
          if (member) {
            assigned.push({ role, name: member, key });
          }
      }
    });
    return assigned;
  };

  const team = getAssignedMembers();

  // Checks if the event is today
  const isToday = () => {
     const today = new Date().toISOString().split('T')[0];
     const eventDate = event.iso.split('T')[0];
     return today === eventDate;
  };

  const eventIsToday = isToday();

  return (
    <div className={`mb-8 rounded-2xl overflow-hidden shadow-lg border transition-all duration-500 animate-slide-up ${eventIsToday ? 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900' : 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-800`}>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative overflow-hidden">
        {eventIsToday && (
          <div className="absolute top-4 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg">
            É HOJE!
          </div>
        )}
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <CalendarClock size={20} />
              <span className="text-sm font-semibold uppercase tracking-wider">Próximo Evento</span>
            </div>
            <h2 className="text-2xl font-bold leading-tight">{event.title}</h2>
            <p className="text-blue-100 mt-1 font-medium">{event.dateDisplay}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Escalados para este dia</h3>
          <span className="text-[10px] text-zinc-400">Clique no círculo para confirmar manual</span>
        </div>
        
        {team.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
             <p className="text-zinc-400 text-sm">Nenhum membro escalado para este evento ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((t, idx) => {
              const isConfirmed = attendance[t.key];
              return (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isConfirmed 
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30' 
                    : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-700/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isConfirmed ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    }`}>
                      <User size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500 uppercase font-semibold">{t.role}</span>
                      <span className={`text-sm font-medium ${isConfirmed ? 'text-green-800 dark:text-green-300' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {t.name}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onConfirm(t.key)}
                    className={`p-2 rounded-full transition-all active:scale-95 ${
                      isConfirmed 
                        ? 'text-green-600 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50' 
                        : 'text-zinc-300 hover:text-green-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                    title={isConfirmed ? "Presença Confirmada" : "Confirmar Presença"}
                  >
                    <CheckCircle2 size={20} className={isConfirmed ? "fill-green-600/10" : ""} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};