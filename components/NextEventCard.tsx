
import React from 'react';
import { CalendarClock, User, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { Role, AttendanceMap } from '../types';

interface Props {
  event: { iso: string; dateDisplay: string; title: string } | undefined;
  schedule: Record<string, string>;
  attendance: AttendanceMap;
  roles: Role[];
  onShare: (text: string) => void;
  onConfirm: (key: string) => void;
}

export const NextEventCard: React.FC<Props> = ({ event, schedule, attendance, roles, onShare, onConfirm }) => {
  if (!event) return null;

  const getAssignedMembers = () => {
    const assigned: { role: string; name: string; key: string }[] = [];
    roles.forEach(role => {
      const key = `${event.iso}_${role}`;
      const member = schedule[key];
      if (member) {
        assigned.push({ role, name: member, key });
      }
    });
    return assigned;
  };

  const team = getAssignedMembers();

  const handleShare = () => {
    // Usa classe URL para garantir construção segura sem erros de path
    const url = new URL(window.location.href);
    // Limpa a query string atual e define os novos parametros
    url.search = ''; 
    url.hash = '';
    
    // Extrai a hora do formato ISO (YYYY-MM-DDTHH:mm)
    const time = event.iso.split('T')[1];

    // Montagem da mensagem EXATAMENTE conforme o modelo aprovado
    let text = `📢 PRÓXIMO EVENTO - MINISTÉRIO DE MÍDIA 📢\n\n`;
    text += `🗓 ${event.title}\n`;
    text += `🕒 Data: ${event.dateDisplay} às ${time}\n\n`;
    text += `👥 Equipe Escalada:\n`;
    
    if (team.length === 0) {
      text += `_(Ninguém escalado ainda)_\n`;
    } else {
      team.forEach(t => {
        // Define parâmetros limpos
        url.searchParams.set('a', 'c');
        url.searchParams.set('k', t.key);
        url.searchParams.set('n', t.name);
        
        const confirmLink = url.toString();
        
        // Formatação visual específica
        text += `▪ ${t.role}: ${t.name}\n`;
        text += `   🔗 Confirme: <${confirmLink}>\n\n`;
      });
    }
    
    text += `🙏🏻 Deus Abençoe a Todos, tenham um ótimo culto.`;
    
    onShare(text);
  };

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
          <div className="absolute top-4 right-16 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg">
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
          <button 
            onClick={handleShare}
            className={`p-3 rounded-xl backdrop-blur-sm transition-all shadow-lg active:scale-95 flex items-center justify-center ${eventIsToday ? 'animate-bounce' : ''} bg-green-500 hover:bg-green-600 text-white`}
            title="Enviar Escala no WhatsApp"
          >
            {/* WhatsApp Icon SVG */}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </button>
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
