
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CalendarDays, Clock } from 'lucide-react';
import { CustomEvent } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  customEvents: CustomEvent[];
  onCreateEvent: (event: { title: string, date: string, time: string }) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
}

export const EventsScreen: React.FC<Props> = ({ customEvents, onCreateEvent, onDeleteEvent, currentMonth, onMonthChange }) => {
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:30");
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const { confirmAction } = useToast();

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(currentMonth, 1));
  };

  const handleAdd = async () => {
    if (newDate && newTitle) {
      setLoading(true);
      await onCreateEvent({ title: newTitle, date: newDate, time: newTime });
      setNewTitle("");
      setLoading(false);
    }
  };

  const handleDelete = async (identifier: string) => {
      confirmAction("Excluir Evento", "Deseja realmente excluir este evento?", async () => {
          setLoading(true);
          await onDeleteEvent(identifier); 
          setLoading(false);
      });
  };

  const displayedEvents = useMemo(() => {
      if (!customEvents || !Array.isArray(customEvents)) return [];
      return [...customEvents].sort((a, b) => {
            const dateA = a.iso || `${a.date}T${a.time}`;
            const dateB = b.iso || `${b.date}T${b.time}`;
            return dateA.localeCompare(dateB);
      });
  }, [customEvents]);

  const formatDateDisplay = (dateStr: string) => {
      if (!dateStr) return '--/--';
      try {
          return dateStr.split('-').reverse().join('/');
      } catch (e) {
          return dateStr;
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarDays className="text-blue-500"/> Gerenciar Eventos
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
             Adicione cultos extras ou remova eventos existentes da escala.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm self-end md:self-auto">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4">Adicionar Novo Evento</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Data</label>
            <input 
                type="date" 
                value={newDate} 
                onChange={e => setNewDate(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Horário</label>
            <input 
                type="time" 
                value={newTime} 
                onChange={e => setNewTime(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Título</label>
            <input 
                type="text" 
                placeholder="Ex: Culto Especial" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
          </div>
        </div>
        <button 
          onClick={handleAdd}
          disabled={!newDate || !newTitle || loading}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
        >
          <Plus size={18}/> {loading ? 'Salvando...' : 'Adicionar Evento'}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mt-6 mb-2 flex items-center gap-2">
            Eventos Agendados ({displayedEvents.length})
        </h3>
        
        {displayedEvents.length === 0 ? (
           <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <CalendarDays className="mx-auto mb-3 opacity-20" size={48}/>
                <p className="text-zinc-500 text-sm">Nenhum evento encontrado para {getMonthName(currentMonth)}.</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-3">
               {displayedEvents.map(evt => {
                  const eventDateStr = evt.date || (evt.iso ? evt.iso.split('T')[0] : '');
                  return (
                    <div key={evt.id || evt.iso} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group animate-slide-up">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400">
                                <span className="text-xs font-bold uppercase">{eventDateStr ? new Date(eventDateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : 'Dia'}</span>
                                <span className="text-xl font-bold leading-none">{eventDateStr ? eventDateStr.split('-')[2] : '--'}</span>
                            </div>
                            <div>
                            <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">{evt.title}</h4>
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <span className="flex items-center gap-1"><Clock size={14}/> {evt.time}</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>
                                <span>{formatDateDisplay(eventDateStr)}</span>
                            </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleDelete(evt.iso ? evt.iso : evt.id)} 
                            disabled={loading}
                            className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                            title="Excluir Evento"
                        >
                            <Trash2 size={20}/>
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
