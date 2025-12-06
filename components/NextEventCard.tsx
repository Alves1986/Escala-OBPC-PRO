
import React, { useState, useEffect } from 'react';
import { CalendarClock, User, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck } from 'lucide-react';
import { Role, AttendanceMap, User as UserType } from '../types';

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

  // Helper para verificar a janela de tempo (1h antes e 1h depois)
  const checkTimeWindow = () => {
    if (!event) return;
    
    const now = new Date();
    const eventDate = new Date(event.iso);
    
    // Diferença em minutos (Agora - Evento)
    // Se evento é 19:30 e agora é 18:00 -> diff é -90 minutos
    const diffInMinutes = (now.getTime() - eventDate.getTime()) / (1000 * 60);

    // Janela: 60 minutos antes (-60) até 60 minutos depois (+60)
    if (diffInMinutes < -60) {
      setTimeStatus('early');
      setMinutesToOpen(Math.abs(Math.floor(diffInMinutes + 60))); // Quantos mins faltam para abrir (-60)
    } else if (diffInMinutes > 60) {
      setTimeStatus('closed');
    } else {
      setTimeStatus('open');
    }
  };

  // Atualiza o status do tempo a cada minuto
  useEffect(() => {
    checkTimeWindow();
    const interval = setInterval(checkTimeWindow, 60000);
    return () => clearInterval(interval);
  }, [event]);

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
  const eventTime = event.iso.split('T')[1];

  // Renderiza o botão de ação baseado no estado
  const renderActionButton = (memberKey: string, isConfirmed: boolean) => {
      if (isConfirmed) {
          return (
              <div className="flex items-center gap-1 text-green-600 bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                  <ShieldCheck size={14} /> Presença Confirmada
              </div>
          );
      }

      if (!eventIsToday) {
          return <span className="text-[10px] text-zinc-400">Aguarde o dia do evento</span>;
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-zinc-400 rounded-lg text-xs font-medium cursor-not-allowed w-full justify-center">
                      <Clock size={14} /> 
                      Liberado em {minutesToOpen} min
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 text-red-400 rounded-lg text-xs font-medium cursor-not-allowed w-full justify-center">
                      <AlertCircle size={14} /> 
                      Check-in Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-green-600/20 animate-pulse w-full justify-center active:scale-95 transition-transform"
                  >
                      <MapPin size={14} /> 
                      ESTOU PRESENTE
                  </button>
              );
      }
  };

  return (
    <div className={`mb-8 rounded-2xl overflow-hidden shadow-lg border transition-all duration-500 animate-slide-up ${eventIsToday ? 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900' : 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-800`}>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative overflow-hidden">
        {eventIsToday && (
          <div className="absolute top-4 right-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1">
            <Clock size={12} /> É HOJE
          </div>
        )}
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <CalendarClock size={20} />
              <span className="text-sm font-semibold uppercase tracking-wider">Próximo Evento</span>
            </div>
            <h2 className="text-2xl font-bold leading-tight">{event.title}</h2>
            <p className="text-blue-100 mt-1 font-medium flex items-center gap-2">
                {event.dateDisplay} às {eventTime}
                {timeStatus === 'open' && eventIsToday && (
                    <span className="text-[10px] bg-green-500/20 px-2 py-0.5 rounded border border-green-400/50 text-green-100">Check-in Aberto</span>
                )}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Escala do Dia</h3>
          {timeStatus === 'open' && eventIsToday && (
             <span className="text-[10px] text-green-600 font-bold animate-pulse">● Check-in Disponível</span>
          )}
        </div>
        
        {team.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
             <p className="text-zinc-400 text-sm">Nenhum membro escalado para este evento ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((t, idx) => {
              const isConfirmed = attendance[t.key];
              const isMe = currentUser && t.name === currentUser.name;
              
              // Se sou eu, mostro o card em destaque
              const cardClass = isMe 
                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900' 
                : isConfirmed 
                    ? 'bg-green-50 dark:bg-green-900/5 border-green-100 dark:border-green-900/20 opacity-70' 
                    : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-700/50 opacity-70';

              return (
                <div key={idx} className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${cardClass}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${
                      isConfirmed ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-white dark:bg-zinc-800 text-zinc-400'
                    }`}>
                      {isConfirmed ? <CheckCircle2 size={20} /> : <User size={20} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wide">{t.role}</span>
                      <span className={`text-sm font-bold truncate ${isConfirmed ? 'text-green-700 dark:text-green-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                        {t.name} {isMe && "(Você)"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Área de Ação - Só aparece para o próprio usuário */}
                  {isMe && (
                      <div className="pt-2 border-t border-black/5 dark:border-white/5">
                          {renderActionButton(t.key, !!isConfirmed)}
                      </div>
                  )}

                  {/* Status visual para outros usuários (apenas texto) */}
                  {!isMe && isConfirmed && (
                      <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium ml-1">
                          <CheckCircle2 size={10} /> Confirmado
                      </div>
                  )}
                  {!isMe && !isConfirmed && (
                       <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium ml-1">
                          <Clock size={10} /> Pendente
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
