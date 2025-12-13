
import React, { useState, useEffect } from 'react';
import { CalendarClock, User, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, CalendarPlus } from 'lucide-react';
import { Role, AttendanceMap, User as UserType } from '../types';
import { getLocalDateISOString, generateGoogleCalendarUrl } from '../utils/dateUtils';

interface Props {
  event: { iso: string; dateDisplay: string; title: string } | undefined;
  schedule: Record<string, string>;
  attendance: AttendanceMap;
  roles: Role[];
  onConfirm: (key: string) => void;
  ministryId: string | null;
  currentUser: UserType | null;
}

type TimeStatus = 'early' | 'open' | 'closed';

export const NextEventCard: React.FC<Props> = ({ event, schedule, attendance, roles, onConfirm, ministryId, currentUser }) => {
  const [timeStatus, setTimeStatus] = useState<TimeStatus>('early');
  const [minutesToOpen, setMinutesToOpen] = useState(0);

  const checkTimeWindow = () => {
    if (!event) return;
    const now = new Date();
    const eventDate = new Date(event.iso);
    const diffInMinutes = (now.getTime() - eventDate.getTime()) / (1000 * 60);

    if (diffInMinutes < -60) {
      setTimeStatus('early');
      setMinutesToOpen(Math.abs(Math.floor(diffInMinutes + 60)));
    } else if (diffInMinutes > 60) {
      setTimeStatus('closed');
    } else {
      setTimeStatus('open');
    }
  };

  useEffect(() => {
    checkTimeWindow();
    const interval = setInterval(checkTimeWindow, 60000);
    return () => clearInterval(interval);
  }, [event]);

  if (!event) return null;

  const getAssignedMembers = () => {
    const assigned: { role: string; name: string; key: string }[] = [];
    roles.forEach(role => {
      if (ministryId === 'louvor' && role === 'Vocal') {
          [1, 2, 3, 4, 5].forEach(i => {
              const key = `${event.iso}_Vocal_${i}`;
              const member = schedule[key];
              if (member) assigned.push({ role: `Vocal ${i}`, name: member, key });
          });
      } else {
          const key = `${event.iso}_${role}`;
          const member = schedule[key];
          if (member) assigned.push({ role, name: member, key });
      }
    });
    return assigned;
  };

  const team = getAssignedMembers();
  const isToday = () => getLocalDateISOString() === event.iso.split('T')[0];
  const eventIsToday = isToday();
  const eventTime = event.iso.split('T')[1];

  const renderActionButton = (memberKey: string, isConfirmed: boolean, role: string) => {
      const googleCalUrl = generateGoogleCalendarUrl(
          `Escala: ${event.title}`,
          event.iso,
          `Você está escalado como: ${role}.\nMinistério: ${ministryId?.toUpperCase()}`
      );

      if (isConfirmed) {
          return (
              <div className="space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 rounded-xl text-sm font-bold border border-emerald-100 dark:border-emerald-800 w-full shadow-sm">
                      <ShieldCheck size={18} /> Presença Confirmada
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 py-2 transition-colors"
                  >
                      <CalendarPlus size={14} /> Adicionar ao Google Agenda
                  </a>
              </div>
          );
      }

      if (!eventIsToday) {
          return (
              <div className="space-y-3">
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl text-center border border-zinc-100 dark:border-zinc-700/50">
                      <span className="text-xs font-medium text-zinc-400">Check-in disponível no dia do evento</span>
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                      <CalendarPlus size={14} /> Salvar no Google Agenda
                  </a>
              </div>
          );
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-700/50 text-zinc-400 rounded-xl text-sm font-medium cursor-not-allowed w-full justify-center">
                      <Clock size={16} /> 
                      Abre em {minutesToOpen} min
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl text-sm font-medium cursor-not-allowed w-full justify-center">
                      <AlertCircle size={16} /> 
                      Check-in Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="group relative overflow-hidden w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all"
                  >
                      <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                      <MapPin size={18} /> 
                      CONFIRMAR PRESENÇA
                  </button>
              );
      }
  };

  return (
    <div className="relative mb-8 rounded-3xl overflow-hidden shadow-xl shadow-zinc-200/50 dark:shadow-black/50 border border-white/50 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 group animate-slide-up">
      {/* Hero Header with Mesh Gradient */}
      <div className="relative p-8 h-48 flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 opacity-90 dark:opacity-80"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white/90 text-xs font-bold uppercase tracking-wider mb-2">
                  <CalendarClock size={14} /> Próximo Evento
              </div>
              <h2 className="text-3xl font-bold text-white leading-tight drop-shadow-sm">{event.title}</h2>
          </div>

          <div className="relative z-10 flex items-end justify-between">
              <div className="text-white/90 font-medium text-lg flex items-center gap-2">
                  {event.dateDisplay} <span className="w-1 h-1 bg-white/50 rounded-full"></span> {eventTime}
              </div>
              {eventIsToday && (
                  <div className="bg-white text-indigo-600 text-xs font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse">
                      <Clock size={14} /> É HOJE
                  </div>
              )}
          </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Escala Oficial</h3>
            {timeStatus === 'open' && eventIsToday && (
                <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
            )}
        </div>
        
        {team.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30">
             <p className="text-zinc-400 text-sm font-medium">Escala ainda não definida.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((t, idx) => {
              const isConfirmed = attendance[t.key];
              const isMe = currentUser && t.name === currentUser.name;
              
              return (
                <div key={idx} className={`relative p-4 rounded-2xl border transition-all duration-300 ${
                    isMe 
                    ? 'bg-white dark:bg-zinc-800 border-indigo-100 dark:border-indigo-900/50 shadow-lg shadow-indigo-100/50 dark:shadow-none ring-1 ring-indigo-500/20' 
                    : 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800'
                }`}>
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm ${
                      isConfirmed 
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-emerald-200 dark:shadow-none' 
                        : 'bg-white dark:bg-zinc-700 text-zinc-300 dark:text-zinc-500 border border-zinc-100 dark:border-zinc-600'
                    }`}>
                      {isConfirmed ? <CheckCircle2 size={20} /> : <User size={20} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-0.5">{t.role}</span>
                      <span className={`text-sm font-bold truncate ${isConfirmed ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'} ${isMe ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                        {t.name} {isMe && "(Você)"}
                      </span>
                    </div>
                  </div>
                  
                  {isMe && (
                      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700/50">
                          {renderActionButton(t.key, !!isConfirmed, t.role)}
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
