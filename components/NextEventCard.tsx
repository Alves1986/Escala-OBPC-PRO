import React, { useState, useEffect } from 'react';
import { CalendarClock, User, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, CalendarPlus, ChevronRight } from 'lucide-react';
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

  // Helper render for primary action button
  const renderActionButton = (memberKey: string, isConfirmed: boolean, role: string) => {
      const googleCalUrl = generateGoogleCalendarUrl(
          `Escala: ${event.title}`,
          event.iso,
          `Você está escalado como: ${role}.\nMinistério: ${ministryId?.toUpperCase()}`
      );

      if (isConfirmed) {
          return (
              <div className="flex gap-2 w-full">
                  <div className="flex-1 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2.5 rounded-lg text-sm font-bold border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck size={16} /> Presença Confirmada
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Adicionar ao Google Agenda"
                  >
                      <CalendarPlus size={20} />
                  </a>
              </div>
          );
      }

      if (!eventIsToday) {
          return (
              <a 
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
              >
                  <CalendarPlus size={14} /> Salvar no Agenda
              </a>
          );
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 rounded-lg text-xs font-bold cursor-not-allowed border border-zinc-100 dark:border-zinc-800">
                      <Clock size={14} /> Check-in em {minutesToOpen} min
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-50 dark:bg-red-900/10 text-red-400 rounded-lg text-xs font-bold cursor-not-allowed">
                      <AlertCircle size={14} /> Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white hover:bg-black dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all"
                  >
                      <MapPin size={16} /> Confirmar Presença
                  </button>
              );
      }
  };

  return (
    <div className="relative mb-8 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.1)] border border-zinc-200 dark:border-zinc-800 animate-slide-up group">
      
      {/* Top Banner Status */}
      {eventIsToday && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Header Info */}
          <div className="p-6 lg:p-8 lg:col-span-1 border-b lg:border-b-0 lg:border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Próximo Evento</span>
                      {eventIsToday && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-[9px] font-black uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span> Hoje
                          </span>
                      )}
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white leading-tight mb-2 tracking-tight">
                      {event.title}
                  </h2>
                  <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                      <span>{event.dateDisplay}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
                      <span className="flex items-center gap-1"><Clock size={14}/> {eventTime}</span>
                  </div>
              </div>
              
              <div className="hidden lg:block mt-8">
                  <div className="text-xs text-zinc-400 mb-2">Seu Status:</div>
                  {/* Find current user status */}
                  {(() => {
                      const myRole = team.find(t => currentUser && t.name === currentUser.name);
                      if (myRole) {
                          const isConfirmed = attendance[myRole.key];
                          return renderActionButton(myRole.key, !!isConfirmed, myRole.role);
                      }
                      return <div className="text-xs text-zinc-400 italic">Você não está escalado.</div>;
                  })()}
              </div>
          </div>

          {/* Team List */}
          <div className="p-6 lg:p-8 lg:col-span-2">
              <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Escala Oficial</h3>
                  <div className="text-xs text-zinc-400">{team.length} membros</div>
              </div>

              {team.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 border-dashed">
                      Nenhuma escala definida.
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {team.map((t, idx) => {
                          const isConfirmed = attendance[t.key];
                          const isMe = currentUser && t.name === currentUser.name;
                          
                          return (
                              <div key={idx} className={`group/card flex items-center p-3 rounded-xl border transition-all duration-200 ${
                                  isMe 
                                  ? 'bg-white dark:bg-zinc-800 border-teal-200 dark:border-teal-900 ring-1 ring-teal-500/10 shadow-sm' 
                                  : 'bg-white dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                              }`}>
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                      isConfirmed 
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500'
                                  }`}>
                                      {isConfirmed ? <CheckCircle2 size={18} /> : <User size={18} />}
                                  </div>
                                  
                                  <div className="ml-3 flex-1 min-w-0">
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-0.5">{t.role}</p>
                                      <p className={`text-sm font-bold truncate ${isConfirmed ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                          {t.name} {isMe && <span className="text-teal-600 dark:text-teal-400 text-[10px] ml-1">(Você)</span>}
                                      </p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* Mobile Only Action Button */}
              <div className="lg:hidden mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  {(() => {
                      const myRole = team.find(t => currentUser && t.name === currentUser.name);
                      if (myRole) {
                          const isConfirmed = attendance[myRole.key];
                          return renderActionButton(myRole.key, !!isConfirmed, myRole.role);
                      }
                      return null;
                  })()}
              </div>
          </div>
      </div>
    </div>
  );
};