
import React from 'react';
import { ScheduleMap, Role, AttendanceMap } from '../types';
import { User, CheckCircle2, Clock, MapPin } from 'lucide-react';

interface Props {
  events: { iso: string; dateDisplay: string; title: string }[];
  roles: Role[];
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  currentUser: any;
}

export const ScheduleCalendarView: React.FC<Props> = ({ events, roles, schedule, attendance, currentUser }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">Calendário da Escala</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((evt) => {
           const time = evt.iso.split('T')[1];
           const isToday = new Date().toISOString().split('T')[0] === evt.iso.split('T')[0];

           return (
             <div key={evt.iso} className={`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border ${isToday ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200 dark:border-zinc-700'} overflow-hidden flex flex-col`}>
                <div className={`p-4 border-b border-zinc-100 dark:border-zinc-700 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-zinc-50 dark:bg-zinc-900/50'}`}>
                   <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{evt.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                           <span className="flex items-center gap-1"><Clock size={12}/> {evt.dateDisplay} - {time}</span>
                        </div>
                      </div>
                      {isToday && <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HOJE</span>}
                   </div>
                </div>

                <div className="p-4 flex-1">
                   <div className="space-y-3">
                      {roles.map(role => {
                         const key = `${evt.iso}_${role}`;
                         const memberName = schedule[key];
                         const isConfirmed = attendance[key];
                         const isMe = currentUser?.name === memberName;

                         if (!memberName) return null;

                         return (
                           <div key={role} className={`flex items-center gap-3 p-2 rounded-lg ${isMe ? 'bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-100 dark:ring-blue-900/30' : ''}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                 isConfirmed ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400'
                              }`}>
                                 <User size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-[10px] uppercase font-bold text-zinc-400">{role}</p>
                                 <p className={`text-sm font-medium truncate ${isMe ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                   {memberName}
                                 </p>
                              </div>
                              {isConfirmed && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                           </div>
                         );
                      })}
                      {roles.every(r => !schedule[`${evt.iso}_${r}`]) && (
                         <div className="text-center text-zinc-400 text-sm py-2 italic">Ninguém escalado ainda.</div>
                      )}
                   </div>
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
};
