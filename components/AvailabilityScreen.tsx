
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarCheck, CheckCircle2, Lock, Save, MessageSquare, Sun, Moon } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes?: AvailabilityNotesMap;
  setAvailability: (av: AvailabilityMap) => void;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  onNotify?: (message: string) => void;
  currentUser: User | null;
  onSaveAvailability: (member: string, dates: string[], notes: Record<string, string>, targetMonth: string) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
}

export const AvailabilityScreen: React.FC<Props> = ({ 
    availability, availabilityNotes, setAvailability, allMembersList, currentMonth, 
    onMonthChange, currentUser, onSaveAvailability, availabilityWindow 
}) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState(""); 
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isAdmin = currentUser?.role === 'admin';

  const isWindowOpen = () => {
      if (isAdmin) return true;
      if (!availabilityWindow?.start || !availabilityWindow?.end) return true;
      const now = new Date();
      return now >= new Date(availabilityWindow.start) && now <= new Date(availabilityWindow.end);
  };

  const isEditable = isWindowOpen();

  useEffect(() => {
    if (currentUser && currentUser.name) setSelectedMember(currentUser.name);
  }, [currentUser]);

  // Load Data into Temp State
  useEffect(() => {
    if (selectedMember) {
        const storedDates = availability[selectedMember] || [];
        setTempDates(storedDates);
        
        // Note key format: Name_YYYY-MM-00 (General)
        const genKey = `${selectedMember}_${currentMonth}-00`;
        setGeneralNote(availabilityNotes?.[genKey] || "");
        
        setHasChanges(false);
    }
  }, [selectedMember, availability, availabilityNotes, currentMonth]);

  const handlePrevMonth = () => onMonthChange(adjustMonth(currentMonth, -1));
  const handleNextMonth = () => onMonthChange(adjustMonth(currentMonth, 1));

  const handleDayClick = (day: number) => {
      if (!isEditable) return;
      
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const existing = tempDates.find(d => d.startsWith(dateStr));

      // Verifica se é Domingo
      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      if (isSunday) {
          // Lógica para Domingo: Ciclo Completo (Dia Todo -> Manhã -> Noite -> Nada)
          if (!existing) {
              setTempDates(prev => [...prev, dateStr]); // Full Day
          } else if (existing === dateStr) {
              setTempDates(prev => prev.map(d => d === dateStr ? `${dateStr}_M` : d)); // Morning
          } else if (existing.endsWith('_M')) {
              setTempDates(prev => prev.map(d => d === existing ? `${dateStr}_N` : d)); // Night
          } else {
              setTempDates(prev => prev.filter(d => !d.startsWith(dateStr))); // Remove
          }
      } else {
          // Lógica para outros dias: Alternar Simples (Dia Todo <-> Nada)
          if (!existing) {
              setTempDates(prev => [...prev, dateStr]); // Add Full
          } else {
              setTempDates(prev => prev.filter(d => !d.startsWith(dateStr))); // Remove
          }
      }
      
      setHasChanges(true);
  };

  const getDayStatus = (day: number) => {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const found = tempDates.find(d => d.startsWith(dateStr));
      if (!found) return 'NONE';
      if (found.endsWith('_M')) return 'MORNING';
      if (found.endsWith('_N')) return 'NIGHT';
      return 'FULL';
  };

  const handleSave = async () => {
      if (!selectedMember) return;
      setIsSaving(true);

      const notesToSave: Record<string, string> = {};
      if (generalNote.trim()) {
          // Always use '00' for general notes
          notesToSave[`${currentMonth}-00`] = generalNote.trim();
      }

      await onSaveAvailability(selectedMember, tempDates, notesToSave, currentMonth);
      
      setIsSaving(false);
      setHasChanges(false);
      addToast("Disponibilidade salva com sucesso!", "success");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-20">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <CalendarCheck size={20} />
              </div>
              <div>
                  <h2 className="font-bold text-zinc-800 dark:text-white">Disponibilidade</h2>
                  <p className="text-xs text-zinc-500">Informe quando você pode servir.</p>
              </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-colors shadow-sm">←</button>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[100px] text-center capitalize">{getMonthName(currentMonth)}</span>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-colors shadow-sm">→</button>
          </div>
      </div>

      {!isEditable && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
              <Lock size={20} />
              <span className="text-sm font-bold">Período de edição encerrado. Contate o líder.</span>
          </div>
      )}

      {/* Admin User Selector */}
      {isAdmin && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Editando como:</label>
              <select 
                  value={selectedMember} 
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              >
                  <option value="" className="text-zinc-500">Selecione...</option>
                  {allMembersList.map(m => <option key={m} value={m} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800">{m}</option>)}
              </select>
          </div>
      )}

      {selectedMember ? (
          <div className="relative">
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-6">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-xs font-bold text-zinc-400 py-2">{d}</div>
                  ))}
                  
                  {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                  ))}

                  {days.map(day => {
                      const status = getDayStatus(day);
                      let styles = "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700";
                      let icon = null;

                      if (status === 'FULL') {
                          styles = "bg-green-500 text-white shadow-md ring-2 ring-green-400 ring-offset-1 dark:ring-offset-zinc-900";
                          icon = <CheckCircle2 size={12} className="absolute top-1 right-1 opacity-75"/>;
                      } else if (status === 'MORNING') {
                          styles = "bg-orange-400 text-white shadow-md ring-2 ring-orange-300 ring-offset-1 dark:ring-offset-zinc-900";
                          icon = <Sun size={12} className="absolute top-1 right-1 opacity-75"/>;
                      } else if (status === 'NIGHT') {
                          styles = "bg-indigo-500 text-white shadow-md ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-zinc-900";
                          icon = <Moon size={12} className="absolute top-1 right-1 opacity-75"/>;
                      }

                      return (
                          <button
                              key={day}
                              onClick={() => handleDayClick(day)}
                              disabled={!isEditable}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${styles} ${!isEditable ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                              <span className="text-sm sm:text-base font-bold">{day}</span>
                              {icon}
                          </button>
                      );
                  })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 text-[10px] text-zinc-500 uppercase font-bold tracking-wide mb-6">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"/> Dia Todo</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-400"/> Manhã (Dom)</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-500"/> Noite (Dom)</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700"/> Indisp.</div>
              </div>

              {/* Note Section */}
              <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-20">
                  <div className="flex items-center gap-2 mb-2 text-zinc-500">
                      <MessageSquare size={16} />
                      <span className="text-xs font-bold uppercase">Observações do Mês</span>
                  </div>
                  <textarea 
                      value={generalNote}
                      onChange={(e) => { setGeneralNote(e.target.value); setHasChanges(true); }}
                      disabled={!isEditable}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                      placeholder="Ex: Viajarei do dia 10 ao 20..."
                  />
              </div>

              {/* Floating Save Button */}
              <div className={`fixed bottom-6 right-6 left-6 md:left-auto flex justify-end z-50 transition-all duration-300 ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                  <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
                  >
                      <Save size={20} className={isSaving ? "animate-spin" : ""} />
                      {isSaving ? "Salvando..." : "Salvar Alterações"}
                  </button>
              </div>
          </div>
      ) : (
          <div className="text-center py-10 text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
              Selecione um membro para editar.
          </div>
      )}
    </div>
  );
};
