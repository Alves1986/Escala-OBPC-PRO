
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { CalendarCheck, ChevronLeft, ChevronRight, Save, ShieldAlert, Loader2 } from 'lucide-react';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes?: AvailabilityNotesMap;
  setAvailability: (data: any) => void;
  allMembersList: string[];
  currentMonth: string; // YYYY-MM
  onMonthChange: (newMonth: string) => void;
  currentUser: User | null;
  onSaveAvailability: (ministryId: string, memberId: string, dates: string[], notes: Record<string, string>, targetMonth: string) => Promise<any>;
  availabilityWindow?: { start?: string; end?: string };
  ministryId: string | null;
  members?: any[];
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
  ministryId,
  members
}) => {
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const { addToast } = useToast();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (currentUser && !selectedMember) {
      setSelectedMember(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedMember) {
      const memberDates = availability[selectedMember] || [];
      const currentMonthDates = memberDates.filter(d => d.startsWith(currentMonth));
      setTempDates(currentMonthDates);
      
      const noteKey = `${selectedMember}_${currentMonth}-00`;
      setGeneralNote(availabilityNotes?.[noteKey] || "");
      
      setHasUnsavedChanges(false);
    }
  }, [selectedMember, currentMonth, availability, availabilityNotes]);

  const toggleDate = (day: number) => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    let newDates = [...tempDates];
    
    if (newDates.includes(dateStr)) {
        newDates = newDates.filter(d => d !== dateStr);
    } else {
        newDates.push(dateStr);
    }
    
    setTempDates(newDates);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
      if (!selectedMember || !ministryId) return;

      let memberId = "";
      if (currentUser?.name === selectedMember) {
          memberId = currentUser.id || "";
      } else {
          // If admin, we rely on the service to lookup by name if ID isn't available
          // or we check if we have member objects (not passed in this context usually)
          memberId = selectedMember;
      }

      setIsSaving(true);
      try {
          const notesPayload: Record<string, string> = {};
          if (generalNote.trim()) {
              notesPayload[`${currentMonth}-00`] = generalNote.trim();
          }

          const result = await onSaveAvailability(
              ministryId, 
              memberId, 
              tempDates, 
              notesPayload, 
              currentMonth
          );
          
          if (result && result.error) {
              throw new Error(result.error.message);
          }

          setHasUnsavedChanges(false);
          setSaveSuccess(true);
          
          setAvailability((prev: any) => ({
              ...prev,
              [selectedMember]: [
                  ...(prev[selectedMember] || []).filter((d: string) => !d.startsWith(currentMonth)),
                  ...tempDates
              ]
          }));

          setTimeout(() => setSaveSuccess(false), 3000);
          addToast("Disponibilidade salva!", "success");
          
      } catch (e: any) {
          console.error(e);
          addToast(`Erro: ${e.message || "Falha ao salvar"}`, "error");
      } finally {
          setIsSaving(false);
      }
  };

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDay = new Date(year, month - 1, 1).getDay();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarCheck className="text-emerald-500"/> Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Informe os dias em que você <strong>NÃO</strong> poderá servir.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm w-full md:w-auto justify-center">
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"><ChevronLeft size={20}/></button>
            <div className="text-center min-w-[100px]">
                <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100 capitalize">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500"><ChevronRight size={20}/></button>
        </div>
      </div>

      {isAdmin && (
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Editando para:</label>
              <select 
                  value={selectedMember} 
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                  {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
          </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-start gap-3">
          <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20}/>
          <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-bold mb-1">Como preencher:</p>
              <p>Clique nos dias em que você estará <strong>INDISPONÍVEL</strong> (viajando, trabalhando, etc). Dias em branco serão considerados livres para escala.</p>
          </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-700">
          <div className="grid grid-cols-7 mb-2">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-zinc-400 uppercase py-2">{d}</div>
              ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                  const isSelected = tempDates.includes(dateStr);
                  
                  return (
                      <button
                          key={day}
                          onClick={() => toggleDate(day)}
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all relative group
                              ${isSelected 
                                  ? 'bg-red-500 text-white shadow-md shadow-red-500/30' 
                                  : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800'
                              }
                          `}
                      >
                          <span className="text-sm font-bold">{day}</span>
                          {isSelected && <span className="text-[10px] font-medium mt-1">OFF</span>}
                      </button>
                  );
              })}
          </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700">
          <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Observações Gerais (Opcional)</label>
          <textarea
              value={generalNote}
              onChange={e => { setGeneralNote(e.target.value); setHasUnsavedChanges(true); }}
              placeholder="Ex: Chegarei atrasado no dia 15..."
              className="w-full h-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          
          <button 
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`w-full mt-4 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg
                  ${saveSuccess ? 'bg-green-600' : hasUnsavedChanges ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-emerald-600/20' : 'bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed'}
              `}
          >
              {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
              {saveSuccess ? 'Salvo com Sucesso!' : isSaving ? 'Salvando...' : 'Salvar Disponibilidade'}
          </button>
      </div>
    </div>
  );
};
