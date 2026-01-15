
import React, { useState } from 'react';
import { Plus, Trash2, CalendarDays, Clock, Repeat } from 'lucide-react';
import { useToast } from './Toast';
import { useAppStore } from '../store/appStore';
import { createEventRule, deleteEventRule } from '../services/supabaseService';
import { useQueryClient } from '@tanstack/react-query';
import { EventRule } from '../domain/events/types';

const WEEKDAYS = [
    { id: 0, label: 'Domingo' },
    { id: 1, label: 'Segunda-feira' },
    { id: 2, label: 'Terça-feira' },
    { id: 3, label: 'Quarta-feira' },
    { id: 4, label: 'Quinta-feira' },
    { id: 5, label: 'Sexta-feira' },
    { id: 6, label: 'Sábado' },
];

interface Props {
  rules: EventRule[];
}

export const EventsScreen: React.FC<Props> = ({ rules }) => {
  const [weekday, setWeekday] = useState(0);
  const [time, setTime] = useState("19:30");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const { confirmAction } = useToast();
  
  const { ministryId, currentUser } = useAppStore();
  const queryClient = useQueryClient();
  const orgId = currentUser?.organizationId;

  const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ['rules', ministryId, orgId] });
      await queryClient.invalidateQueries({ queryKey: ['event_rules', ministryId, orgId] });
  };

  const handleAdd = async () => {
    if (title && time && orgId && ministryId) {
      setLoading(true);
      
      await createEventRule(orgId, { 
          title, 
          weekday, 
          time, 
          ministryId
      });
      
      await refresh();
      setTitle("");
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!orgId) return;
      confirmAction("Excluir Regra", "Deseja realmente excluir esta regra de evento? Isso afetará a geração automática futura.", async () => {
          setLoading(true);
          await deleteEventRule(orgId, id);
          await refresh();
          setLoading(false);
      });
  };

  const sortedRules = [...rules].sort((a, b) => {
      if (a.weekday !== b.weekday) return (a.weekday || 0) - (b.weekday || 0);
      return a.time.localeCompare(b.time);
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-28">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarDays className="text-blue-500"/> Regras de Agenda
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
             Defina regras semanais ou eventos únicos. Os eventos são projetados dinamicamente no calendário.
          </p>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mb-4">Nova Regra Semanal</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Dia da Semana</label>
            <select 
                value={weekday} 
                onChange={e => setWeekday(Number(e.target.value))} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
                {WEEKDAYS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Horário</label>
            <input 
                type="time" 
                value={time} 
                onChange={e => setTime(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Título</label>
            <input 
                type="text" 
                placeholder="Ex: Culto de Domingo" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
            />
          </div>
        </div>
        <button 
          onClick={handleAdd}
          disabled={!title || loading || !ministryId}
          className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
        >
          <Plus size={18}/> {loading ? 'Salvando...' : 'Adicionar Regra'}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-500 uppercase mt-6 mb-2 flex items-center gap-2">
            Regras Ativas ({sortedRules.length})
        </h3>
        
        {sortedRules.length === 0 ? (
           <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Repeat className="mx-auto mb-3 opacity-20" size={48}/>
                <p className="text-zinc-500 text-sm">Nenhuma regra definida.</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-3">
               {sortedRules.map(r => (
                    <div key={r.id} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow group animate-slide-up">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400">
                                <span className="text-[10px] font-bold uppercase">Semana</span>
                                <span className="text-xl font-bold leading-none">{r.weekday}</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">{r.title}</h4>
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <span className="flex items-center gap-1"><Clock size={14}/> {r.time.slice(0, 5)}</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></span>
                                    <span className="font-medium text-zinc-600 dark:text-zinc-400">{WEEKDAYS.find(d => d.id === r.weekday)?.label}</span>
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleDelete(r.id)} 
                            disabled={loading}
                            className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
                            title="Excluir Regra"
                        >
                            <Trash2 size={20}/>
                        </button>
                    </div>
               ))}
           </div>
        )}
      </div>
    </div>
  );
};
