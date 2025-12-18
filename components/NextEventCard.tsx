
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
                  <div className="flex-1 flex items-center justify-center gap-2 text-white bg-white/20 px-4 py-2.5 rounded-lg text-sm font-bold border border-white/20 backdrop-blur-sm shadow-inner">
                      <ShieldCheck size={16} /> Presença Confirmada
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors border border-white/10"
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
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-white text-teal-700 rounded-lg text-xs font-bold hover:bg-teal-50 transition-colors shadow-lg shadow-black/10"
              >
                  <CalendarPlus size={14} /> Salvar no Agenda
              </a>
          );
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 bg-black/20 text-white/60 rounded-lg text-xs font-bold cursor-not-allowed border border-white/10">
                      <Clock size={14} /> Check-in em {minutesToOpen} min
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-500/20 text-red-100 rounded-lg text-xs font-bold cursor-not-allowed border border-red-500/20">
                      <AlertCircle size={14} /> Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-teal-50 text-teal-700 rounded-lg text-sm font-bold shadow-xl active:scale-95 transition-all"
                  >
                      <MapPin size={16} /> Confirmar Presença
                  </button>
              );
      }
  };

  return (
    <div className="relative mb-8 rounded-[2rem] overflow-hidden bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-slide-up group ring-1 ring-black/5">
      
      <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Header Info - COM GRADIENTE PREMIUM */}
          <div className="p-6 lg:p-10 lg:col-span-1 bg-gradient-to-br from-zinc-900 via-zinc-800 to-teal-900 relative overflow-hidden flex flex-col justify-between text-white">
              
              {/* Texture/Pattern Overlay */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
              
              {/* Glow Effect */}
              <div className="absolute -top-10 -left-10 w-48 h-48 bg-teal-500/10 rounded-full blur-[80px]"></div>

              <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Próximo Evento</span>
                      {eventIsToday && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500 text-white text-[9px] font-black uppercase shadow-lg shadow-teal-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> Hoje
                          </span>
                      )}
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3 tracking-tight drop-shadow-md">
                      {event.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-zinc-300 text-sm font-medium">
                      <span className="bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">{event.dateDisplay}</span>
                      <span className="w-1 h-1 rounded-full bg-teal-500/50"></span>
                      <span className="flex items-center gap-1.5"><Clock size={14} className="text-teal-400"/> {eventTime}</span>
                  </div>
              </div>
              
              <div className="hidden lg:block mt-10 relative z-10">
                  <div className="text-[10px] text-zinc-400 mb-2 font-black uppercase tracking-widest">Sua Ação:</div>
                  {/* Find current user status */}
                  {(() => {
                      const myRole = team.find(t => currentUser && t.name === currentUser.name);
                      if (myRole) {
                          const isConfirmed = attendance[myRole.key];
                          return renderActionButton(myRole.key, !!isConfirmed, myRole.role);
                      }
                      return <div className="text-xs text-white/40 italic bg-black/30 p-3 rounded-xl border border-white/5 backdrop-blur-md">Você não está escalado para este evento.</div>;
                  })()}
              </div>
          </div>

          {/* Team List - Mantém Fundo Claro/Escuro para contraste */}
          <div className="p-6 lg:p-10 lg:col-span-2 bg-white dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Escala Oficial</h3>
                  <div className="text-[10px] font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-full border border-zinc-100 dark:border-zinc-700">{team.length} Integrantes</div>
              </div>

              {team.length === 0 ? (
                  <div className="flex-1 py-12 text-center text-zinc-400 text-sm bg-zinc-50 dark:bg-zinc-800/30 rounded-[1.5rem] border-2 border-zinc-100 dark:border-zinc-800 border-dashed flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center opacity-40">
                        <CalendarClock size={32} />
                      </div>
                      <span className="font-medium">Nenhuma escala definida ainda.</span>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {team.map((t, idx) => {
                          const isConfirmed = attendance[t.key];
                          const isMe = currentUser && t.name === currentUser.name;
                          
                          return (
                              <div key={idx} className={`group/card flex items-center p-4 rounded-2xl border transition-all duration-300 ${
                                  isMe 
                                  ? 'bg-teal-50/50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800 ring-2 ring-teal-500/10 shadow-lg shadow-teal-500/5' 
                                  : 'bg-white dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-800 shadow-sm'
                              }`}>
                                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                                      isConfirmed 
                                      ? 'bg-emerald-500 text-white' 
                                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500'
                                  }`}>
                                      {isConfirmed ? <CheckCircle2 size={20} /> : <User size={20} />}
                                  </div>
                                  
                                  <div className="ml-4 flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">{t.role}</p>
                                      <p className={`text-sm font-bold truncate ${isConfirmed ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                          {t.name} {isMe && <span className="text-teal-600 dark:text-teal-400 font-black text-[9px] ml-1 bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.5 rounded-full">(VOCÊ)</span>}
                                      </p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* Mobile Only Action Button */}
              <div className="lg:hidden mt-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Seu Status</div>
                  {(() => {
                      const myRole = team.find(t => currentUser && t.name === currentUser.name);
                      if (myRole) {
                          const isConfirmed = attendance[myRole.key];
                          const googleCalUrl = generateGoogleCalendarUrl(`Escala: ${event.title}`, event.iso, `Função: ${myRole.role}`);
                          
                          if (isConfirmed) {
                              return (
                                <div className="flex gap-3 w-full">
                                    <div className="flex-1 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-4 rounded-2xl text-sm font-black border border-emerald-200 dark:border-emerald-800 shadow-inner">
                                        <ShieldCheck size={18} /> Confirmado
                                    </div>
                                    <a href={googleCalUrl} target="_blank" className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                        <CalendarPlus size={24} />
                                    </a>
                                </div>
                              );
                          }
                          if (!eventIsToday) {
                              return <a href={googleCalUrl} target="_blank" className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl text-xs font-black hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm"><CalendarPlus size={18} /> Salvar no Agenda</a>;
                          }
                          switch (timeStatus) {
                              case 'early': return <button disabled className="flex items-center justify-center gap-2 w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-2xl text-xs font-black cursor-not-allowed border border-zinc-200 dark:border-zinc-700"><Clock size={18} /> Check-in em {minutesToOpen} min</button>;
                              case 'closed': return <button disabled className="flex items-center justify-center gap-2 w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-xs font-black cursor-not-allowed border border-red-100 dark:border-red-900/30"><AlertCircle size={18} /> Encerrado</button>;
                              case 'open': return <button onClick={() => onConfirm(myRole.key)} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-teal-600/20 active:scale-95 transition-all"><MapPin size={20} /> Confirmar Agora</button>;
                          }
                      }
                      return <div className="text-center text-xs text-zinc-400 font-bold italic py-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">Você não está escalado.</div>;
                  })()}
              </div>
          </div>
      </div>
    </div>
  );
};
