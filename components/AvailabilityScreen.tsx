import React, { useState, useEffect, useMemo } from 'react';
import { AvailabilityMap, User, AvailabilityNotesMap } from '../types';
import { ChevronLeft, ChevronRight, Save, Lock, AlertCircle, CheckCircle, Calendar as CalendarIcon, FileText, User as UserIcon } from 'lucide-react';
import { getMonthName, adjustMonth, getLocalDateISOString } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes: AvailabilityNotesMap;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityMap>>;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (month: string) => void;
  currentUser: User | null;
  onSaveAvailability: (ministryId: string, member: string, dates: string[], notes: Record<string, string>, targetMonth: string) => Promise<any>;
  availabilityWindow?: { start?: string; end?: string };
  ministryId: string | null;
}

export const AvailabilityScreen: React.FC<Props> = ({
  availability,
  availabilityNotes,
  setAvailability,
  allMembersList,
  currentMonth,
  onMonthChange,
  currentUser,
  onSaveAvailability,
  availabilityWindow,
  ministryId
}) => {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  // Initialize selected member
  useEffect(() => {
    if (currentUser && !selectedMember) {
      setSelectedMember(currentUser.name);
    }
  }, [currentUser]);

  // Load data when member or month changes
  useEffect(() => {
    if (selectedMember) {
      const dates = availability[selectedMember] || [];
      const monthDates = dates.filter(d => d.startsWith(currentMonth));
      setTempDates(monthDates);
      
      const noteKey = `${selectedMember}_${currentMonth}-00`;
      setGeneralNote(availabilityNotes[noteKey] || "");
      
      setHasUnsavedChanges(false);
      setSaveSuccess(false);
    }
  }, [selectedMember, currentMonth, availability, availabilityNotes]);

  const isWindowOpen = useMemo(() => {
    if (isAdmin) return true; // Admins always bypass
    if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
    
    const now = new Date();
    // Valid dates check
    if (availabilityWindow.start && availabilityWindow.start.includes('1970')) return false; // Blocked manually
    
    const start = availabilityWindow.start ? new Date(availabilityWindow.start) : new Date(0);
    const end = availabilityWindow.end ? new Date(availabilityWindow.end) : new Date(8640000000000000);
    
    return now >= start && now <= end;
  }, [availabilityWindow, isAdmin]);

  const handleDateToggle = (day: number) => {
    if (!isWindowOpen && !isAdmin) return;
    
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    setTempDates(prev => {
      const newDates = prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr];
      setHasUnsavedChanges(true);
      return newDates;
    });
  };

  const handleSave = async () => {
      if (!selectedMember || !ministryId) return;

      setIsSaving(true);
      try {
          const notesPayload: Record<string, string> = {};
          if (generalNote.trim()) {
              notesPayload[`${currentMonth}-00`] = generalNote.trim();
          }

          const result = await onSaveAvailability(
              ministryId, 
              selectedMember, 
              tempDates, 
              notesPayload, 
              currentMonth
          );
          
          if (result && 'error' in result && result.error) {
              // @ts-ignore
              throw new Error(result.error.message);
          }

          setHasUnsavedChanges(false);
          setSaveSuccess(true);
          
          // Optimistic update
          setAvailability(prev => ({
              ...prev,
              [selectedMember]: [
                  ...(prev[selectedMember] || []).filter(d => !d.startsWith(currentMonth)), 
                  ...tempDates
              ]
          }));

          setTimeout(() => setSaveSuccess(false), 3000);
          addToast("Disponibilidade salva!", "success");
          
      } catch (e: any) {
          console.error(e);
          const msg = e.message || "Erro desconhecido ao salvar";
          addToast(`Erro: ${msg}`, "error");
      } finally {
          setIsSaving(false);
      }
  };

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarIcon className="text-emerald-500"/> Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Marque os dias que você <span className="font-bold text-red-500">NÃO</span> poderá servir.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronLeft size={20}/></button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Mês</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* Member Selector (Admin) or Info */}
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="p-2 bg-zinc-100 dark:bg-zinc-700 rounded-full text-zinc-500 dark:text-zinc-400">
                  <UserIcon size={20} />
              </div>
              <div className="flex-1">
                  {isAdmin ? (
                      <select 
                          value={selectedMember} 
                          onChange={e => setSelectedMember(e.target.value)}
                          className="w-full md:w-64 bg-transparent font-bold text-zinc-800 dark:text-zinc-100 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 pb-1"
                      >
                          {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                  ) : (
                      <span className="font-bold text-zinc-800 dark:text-zinc-100">{selectedMember}</span>
                  )}
                  <p className="text-xs text-zinc-500">Editando disponibilidade</p>
              </div>
          </div>

          {!isWindowOpen && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-bold border border-red-100 dark:border-red-900/30">
                  <Lock size={16} /> Período Fechado
              </div>
          )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 md:p-6 shadow-sm border border-zinc-200 dark:border-zinc-700 select-none">
          <div className="grid grid-cols-7 mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-zinc-400 uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2 md:gap-3">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
            
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
              const isSelected = tempDates.includes(dateStr);
              const isToday = getLocalDateISOString() === dateStr;
              
              return (
                <button
                  key={day}
                  onClick={() => handleDateToggle(day)}
                  disabled={!isWindowOpen && !isAdmin}
                  className={`
                    aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all duration-200
                    ${isSelected 
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-95 font-bold ring-2 ring-red-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-800' 
                        : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }
                    ${isToday && !isSelected ? 'border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border border-transparent'}
                    ${(!isWindowOpen && !isAdmin) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-90'}
                  `}
                >
                  <span className="text-sm md:text-lg">{day}</span>
                  {isSelected && <span className="text-[10px] uppercase font-bold mt-1">OFF</span>}
                </button>
              );
            })}
          </div>
      </div>

      {/* Notes & Save */}
      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm space-y-4">
          <div>
              <label className="text-xs font-bold text-zinc-500 uppercase flex items-center gap-2 mb-2">
                  <FileText size={14}/> Observações do Mês
              </label>
              <textarea 
                  value={generalNote}
                  onChange={(e) => { setGeneralNote(e.target.value); setHasUnsavedChanges(true); }}
                  placeholder="Ex: Viajarei a partir do dia 15..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] resize-none text-zinc-800 dark:text-zinc-200"
                  disabled={!isWindowOpen && !isAdmin}
              />
          </div>

          <button 
              onClick={handleSave}
              disabled={(!hasUnsavedChanges && !saveSuccess) || isSaving || (!isWindowOpen && !isAdmin)}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg
                  ${saveSuccess 
                      ? 'bg-green-500 text-white shadow-green-500/30' 
                      : hasUnsavedChanges 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95' 
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  }
              `}
          >
              {isSaving ? 'Salvando...' : saveSuccess ? <><CheckCircle size={20}/> Salvo com Sucesso</> : <><Save size={20}/> Salvar Disponibilidade</>}
          </button>
          
          {!isWindowOpen && !isAdmin && (
              <p className="text-center text-xs text-red-500 font-medium flex items-center justify-center gap-1">
                  <Lock size={12}/> Edição bloqueada temporariamente.
              </p>
          )}
      </div>
    </div>
  );
};