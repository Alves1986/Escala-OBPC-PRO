import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, CalendarPlus, Sparkles } from 'lucide-react';
import { Role, AttendanceMap, User as UserType, TeamMemberProfile } from '../types';
import { getLocalDateISOString, generateGoogleCalendarUrl } from '../utils/dateUtils';

interface Props {
  event: { iso: string; dateDisplay: string; title: string; ruleId?: string; date?: string } | undefined;
  schedule: Record<string, string>;
  attendance: AttendanceMap;
  roles: Role[];
  members: TeamMemberProfile[];
  team: { role: string; name: string; key: string }[];
  loadingTeam: boolean;
  onConfirm: (payload: { key: string; memberName: string; eventName: string; date: string; role: string }) => void;
  ministryId: string | null;
  currentUser: UserType | null;
}

type TimeStatus = 'early' | 'open' | 'closed';

export const NextEventCard: React.FC<Props> = ({ event, schedule, attendance, roles, members, team, loadingTeam, onConfirm, ministryId, currentUser }) => {
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
    } else if (diffInMinutes > 150) {
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

  // Usa dados do banco se disponíveis, senão fallback (que provavelmente estará vazio se o mês virou)
  const getAssignedMembers = () => {
    if (team.length > 0) return team;

    // Fallback original (prop schedule)
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
  const eventIsToday = getLocalDateISOString() === event.iso.split('T')[0];
  const eventTime = event.iso.split('T')[1];

  const renderActionButton = (memberKey: string, isConfirmed: boolean, role: string, memberName: string) => {
      const googleCalUrl = generateGoogleCalendarUrl(
          `Escala: ${event.title}`,
          event.iso,
          `Você está escalado como: ${role}.\nMinistério: ${ministryId?.toUpperCase()}`
      );

      if (isConfirmed) {
          return (
              <div className="flex gap-3 w-full">
                  <div className="flex-1 flex items-center justify-center gap-3 text-white bg-emerald-500/20 px-6 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest border border-emerald-500/30 backdrop-blur-md shadow-lg shadow-emerald-500/10">
                      <ShieldCheck size={20} className="text-emerald-400" /> Presença Confirmada
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 bg-white/10 text-white rounded-[1.5rem] hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center"
                      title="Google Agenda"
                  >
                      <CalendarPlus size={24} />
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
                  className="flex items-center justify-center gap-3 w-full py-4 bg-white text-emerald-950 rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-2xl active:scale-95"
              >
                  <CalendarPlus size={18} /> Salvar no Agenda
              </a>
          );
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-black/40 text-white/40 rounded-[1.5rem] text-xs font-black uppercase tracking-widest cursor-not-allowed border border-white/5">
                      <Clock size={18} /> Check-in em {minutesToOpen} min
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-rose-500/20 text-rose-200 rounded-[1.5rem] text-xs font-black uppercase tracking-widest cursor-not-allowed border border-rose-500/30">
                      <AlertCircle size={18} /> Período Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm({ key: memberKey, memberName, eventName: event.title, date: event.dateDisplay, role })}
                      className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-emerald-950 rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all"
                  >
                      <MapPin size={20} /> Confirmar Presença Agora
                  </button>
              );
      }
  };

  return (
    <div className="relative mb-12 rounded-[3rem] overflow-hidden bg-white dark:bg-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-200 dark:border-slate-800 animate-slide-up ring-1 ring-black/5">
      
      <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Main Info - High Fidelity Sidebar */}
          <div className="lg:col-span-4 p-8 lg:p-12 bg-slate-950 relative overflow-hidden flex flex-col justify-between text-white">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-slate-950 to-violet-600/10"></div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay"></div>
              
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 flex items-center gap-1.5">
                          <Sparkles size={12} fill="currentColor" /> Próximo
                      </div>
                      {eventIsToday && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Hoje
                          </div>
                      )}
                  </div>
                  
                  <h2 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-6 tracking-tighter">
                      {event.title}
                  </h2>
                  
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 text-emerald-400">
                          <CalendarClock size={20} />
                          <span className="text-lg font-bold tracking-tight">{event.dateDisplay}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-300">
                          <Clock size={20} />
                          <span className="text-lg font-bold tracking-tight">{eventTime}</span>
                      </div>
                  </div>
              </div>
              
              <div className="mt-12 relative z-10">
                  {(() => {
                      // Usa props para verificação de presença pois o fetch simplificado não traz 'confirmed'
                      // Tenta achar match pelo nome
                      const myRole = team.find(t => currentUser && t.name === currentUser.name);
                      
                      // Check fallback na prop schedule original se dbTeam não tiver a info completa
                      let isConfirmed = false;
                      if (myRole && !myRole.key.startsWith('db_')) {
                          isConfirmed = !!attendance[myRole.key];
                      }

                      if (myRole) {
                          return renderActionButton(myRole.key, isConfirmed, myRole.role, myRole.name);
                      }
                      return (
                          <div className="p-5 rounded-[1.5rem] bg-white/5 border border-white/10 backdrop-blur-md text-center">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Status</p>
                              <p className="text-xs font-bold text-slate-300">Você não está escalado neste evento.</p>
                          </div>
                      );
                  })()}
              </div>
          </div>

          {/* Team Detail List */}
          <div className="lg:col-span-8 p-8 lg:p-12 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Equipe Escalada</h3>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">{team.length} Integrantes</span>
              </div>

              {team.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                      <CalendarClock size={48} className="text-slate-200 dark:text-slate-800 mb-4" />
                      <p className="text-slate-400 font-bold text-sm">
                        {loadingTeam ? 'Escala em processamento...' : 'Nenhum escalado encontrado.'}
                      </p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {team.map((t, idx) => {
                          const isMe = currentUser && t.name === currentUser.name;
                          const memberProfile = members.find(m => m.name === t.name);
                          
                          // Confirmação visual só funciona se vier da prop original por enquanto
                          const isConfirmed = !t.key.startsWith('db_') && attendance[t.key];
                          
                          return (
                              <div key={idx} className={`group flex items-center p-4 rounded-[2rem] border transition-all duration-500 ${
                                  isMe 
                                  ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/50 ring-2 ring-emerald-500/10' 
                                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl'
                              }`}>
                                  <div className="relative shrink-0">
                                      <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all duration-500 ${isConfirmed ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                          {memberProfile?.avatar_url ? (
                                              <img src={memberProfile.avatar_url} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className={`w-full h-full flex items-center justify-center font-black text-xl ${isConfirmed ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                                  {t.name.charAt(0)}
                                              </div>
                                          )}
                                      </div>
                                      {isConfirmed && (
                                          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-4 border-white dark:border-slate-900 shadow-lg scale-110">
                                              <CheckCircle2 size={12} />
                                          </div>
                                      )}
                                  </div>
                                  
                                  <div className="ml-5 flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-0.5">{t.role}</p>
                                      <p className={`text-base font-black truncate tracking-tight ${isConfirmed ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                          {t.name}
                                      </p>
                                      {isMe && <span className="inline-block mt-1 text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Você</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
