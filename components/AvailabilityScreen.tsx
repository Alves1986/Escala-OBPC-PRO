
import React, { useState } from 'react';
import { AvailabilityMap } from '../types';
import { getMonthName } from '../utils/dateUtils';

interface Props {
  availability: AvailabilityMap;
  setAvailability: (av: AvailabilityMap) => void;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
}

export const AvailabilityScreen: React.FC<Props> = ({ availability, setAvailability, allMembersList, currentMonth, onMonthChange }) => {
  const [selectedMember, setSelectedMember] = useState("");
  
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    onMonthChange(prev.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    onMonthChange(next.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white">Marcar Disponibilidade</h2>
          <p className="text-zinc-500 text-sm">Selecione os dias em que você <strong>ESTÁ DISPONÍVEL</strong> para servir. Dias não marcados são indisponíveis.</p>
        </div>
        
        {/* Month Selector Reuse */}
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
        </div>
      </div>
      
      <div className="space-y-4">
        <label className="block text-sm font-medium text-zinc-500 uppercase">Membro</label>
        <select 
          value={selectedMember} 
          onChange={e => setSelectedMember(e.target.value)}
          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100"
        >
            <option value="">Selecione o Membro...</option>
            {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {selectedMember && (
          <div className="grid grid-cols-7 gap-2 mt-6">
            {days.map(day => {
              const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
              const currentUnavailableDates = availability[selectedMember] || [];
              
              // Se a data NÃO está no array, significa que está DISPONÍVEL (Visual Verde)
              // Se a data ESTÁ no array, significa que está INDISPONÍVEL (Visual Cinza)
              const isAvailable = !currentUnavailableDates.includes(dateStr);

              return (
                <button
                  key={day}
                  onClick={() => {
                    const newUnavailableDates = isAvailable 
                      ? [...currentUnavailableDates, dateStr] // Torna indisponível (adiciona ao array de bloqueios)
                      : currentUnavailableDates.filter(d => d !== dateStr); // Torna disponível (remove do array)
                    setAvailability({ ...availability, [selectedMember]: newUnavailableDates });
                  }}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-lg font-bold transition-all shadow-sm ${
                    isAvailable 
                      ? 'bg-green-500 text-white shadow-green-500/30 scale-100 ring-2 ring-green-400 dark:ring-green-600' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 scale-95 opacity-60 hover:opacity-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        )}
        
        {selectedMember && (
          <div className="flex gap-4 justify-center mt-4 text-sm font-medium">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300"><div className="w-3 h-3 bg-green-500 rounded-full"/> Disponível</div>
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300"><div className="w-3 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-full"/> Indisponível</div>
          </div>
        )}
      </div>
    </div>
  );
};
