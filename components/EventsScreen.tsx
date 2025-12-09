
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CustomEvent } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';

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

  const handleDelete = async (iso: string) => {
      // In strict SQL mode we often delete by ID, but customEvents from fetchMinistrySchedule might map ISO.
      // If parent passes generic delete handler, assume it handles logic.
      if (confirm("Deseja realmente excluir este evento?")) {
          setLoading(true);
          // Passing ISO as ID for now since that's often how it's keyed in the list view
          await onDeleteEvent(iso); 
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Gerenciar Eventos</h2>
          <p className="text-zinc-500 text-sm">Adicione cultos extras ou eventos especiais.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4">Adicionar Novo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input 
            type="date" 
            value={newDate} 
            onChange={e => setNewDate(e.target.value)} 
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <input 
            type="time" 
            value={newTime} 
            onChange={e => setNewTime(e.target.value)} 
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <input 
            type="text" 
            placeholder="Nome do Evento" 
            value={newTitle} 
            onChange={e => setNewTitle(e.target.value)} 
            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        <button 
          onClick={handleAdd}
          disabled={!newDate || !newTitle || loading}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={18}/> {loading ? 'Salvando...' : 'Adicionar Evento'}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mt-8 mb-2">Eventos Criados</h3>
        {customEvents.length === 0 && <p className="text-zinc-400 italic">Nenhum evento extra adicionado.</p>}
        {customEvents.map(evt => (
          <div key={evt.id} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in">
            <div>
              <h4 className="font-bold text-zinc-800 dark:text-zinc-100">{evt.title}</h4>
              <p className="text-sm text-zinc-500">{evt.date.split('-').reverse().join('/')} às {evt.time}</p>
            </div>
            <button 
                onClick={() => handleDelete(evt.date ? `${evt.date}T${evt.time}` : evt.id)} 
                disabled={loading}
                className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
                <Trash2 size={18}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
