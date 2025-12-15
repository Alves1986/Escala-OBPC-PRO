
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, Moon, Sun, Lock, FileText, Info, Ban, Unlock, RefreshCw } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes: AvailabilityNotesMap;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityMap>>;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  currentUser: User | null;
  onSaveAvailability: (member: string, dates: string[], notes: Record<string, string>, targetMonth: string) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
}

export const AvailabilityScreen: React.FC<Props> = ({
  availability,
  availabilityNotes,
  allMembersList,
  currentMonth,
  onMonthChange,
  currentUser,
  onSaveAvailability,
  availabilityWindow
}) => {
  const { addToast } = useToast();
  
  // States
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [tempDates, setTempDates] = useState<string[]>([]); 
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const isAdmin = currentUser?.role === 'admin';
  const isBlockedMonth = tempDates.includes(`${currentMonth}-BLK`);

  // Calendar Props
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Check Window Status
  const isWindowOpen = React.useMemo(() => {
      if (isAdmin) return true;
      if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
      
      const now = new Date();
      let start = new Date(0);
      let end = new Date(8640000000000000); 

      if (availabilityWindow.start && !availabilityWindow.start.includes('1970')) start = new Date(availabilityWindow.start);
      if (availabilityWindow.end && !availabilityWindow.end.includes('1970')) end = new Date(availabilityWindow.end);
      
      if (availabilityWindow.start?.includes('1970')) return false; // Bloqueio manual

      return now >= start && now <= end;
  }, [availabilityWindow, isAdmin]);

  // Init Member Selection
  useEffect(() => {
    if (currentUser && !selectedMember) {
      if (allMembersList.includes(currentUser.name)) {
        setSelectedMember(currentUser.name);
      } else if (allMembersList.length > 0) {
        setSelectedMember(allMembersList[0]);
      }
    }
  }, [currentUser, allMembersList]);

  // Load Data on Mount or Change
  useEffect(() => {
    if (!selectedMember) return;

    const storedDates = availability[selectedMember] || [];
    // Filtra apenas datas deste mês para o estado local
    const monthDates = storedDates.filter(d => d.startsWith(currentMonth));
    setTempDates(monthDates);
    
    // Key: Nome_YYYY-MM-00
    const noteKey = `${selectedMember}_${currentMonth}-00`;
    setGeneralNote(availabilityNotes?.[noteKey] || "");
    
    setHasUnsavedChanges(false);
  }, [selectedMember, currentMonth, availability, availabilityNotes]);

  const handleToggleBlockMonth = () => {
      if (!isWindowOpen) return;
      setHasUnsavedChanges(true);

      if (isBlockedMonth) {
          setTempDates([]); // Clear block
      } else {
          setTempDates([`${currentMonth}-BLK`]); // Set block
      }
  };

  const handleToggleDate = (day: number) => {
      if (!isWindowOpen) {
          addToast("Edição fechada pela liderança.", "warning");
          return;
      }

      setHasUnsavedChanges(true);
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      const full = dateBase;
      const morning = `${dateBase}_M`;
      const night = `${dateBase}_N`;

      let newDates = isBlockedMonth ? [] : [...tempDates];
      
      // Remove any existing entry for this day
      const hadFull = newDates.includes(full);
      const hadMorning = newDates.includes(morning);
      const hadNight = newDates.includes(night);
      
      newDates = newDates.filter(d => !d.startsWith(dateBase));

      if (isSunday) {
          // Cycle: Empty -> Full -> Morning -> Night -> Empty
          if (!hadFull && !hadMorning && !hadNight) newDates.push(full);
          else if (hadFull) newDates.push(morning);
          else if (hadMorning) newDates.push(night);
          // else if (hadNight) -> Empty (already filtered)
      } else {
          // Cycle: Empty -> Full -> Empty
          if (!hadFull) newDates.push(full);
      }
      
      setTempDates(newDates);
  };

  const handleSave = async () => {
      if (!selectedMember) return;
      setIsSaving(true);
      try {
          const notesPayload: Record<string, string> = {};
          if (generalNote.trim()) {
              notesPayload[`${currentMonth}-00`] = generalNote.trim();
          }

          await onSaveAvailability(selectedMember, tempDates, notesPayload, currentMonth);
          setHasUnsavedChanges(false);
          addToast("Disponibilidade salva com sucesso!", "success");
      } catch (e) {
          console.error(e);
          addToast("Erro ao salvar. Verifique sua conexão.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const getDayStatus = (day: number) => {
      if (isBlockedMonth) return 'blocked';
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      if (tempDates.includes(dateBase)) return 'full';
      if (tempDates.includes(`${dateBase}_M`)) return 'morning';
      if (tempDates.includes(`${dateBase}_N`)) return 'night';
      return 'none';
  };

  const handleMonthNav = (dir: number) => {
      if (hasUnsavedChanges) {
          if (!window.confirm("Há alterações não salvas. Descartar?")) return;
      }
      onMonthChange(adjustMonth(currentMonth, dir));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500"/> Minha Disponibilidade
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Informe os dias em que você pode servir neste mês.
                </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                {isAdmin && (
                    <select 
                        value={selectedMember} 
                        onChange={(e) => {
                            if(hasUnsavedChanges && !confirm("Descartar alterações?")) return;
                            setSelectedMember(e.target.value);
                        }}
                        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                )}
                
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <button onClick={() => handleMonthNav(-1)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-bold min-w-[100px] text-center capitalize">{getMonthName(currentMonth)}</span>
                    <button onClick={() => handleMonthNav(1)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronRight size={16}/></button>
                </div>
            </div>
        </div>

        {/* Lock Status */}
        {!isWindowOpen && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-200 animate-slide-up">
                <Lock size={20} />
                <div>
                    <p className="font-bold text-sm">Edição Fechada</p>
                    <p className="text-xs opacity-80">O período para envio foi encerrado pela liderança.</p>
                </div>
            </div>
        )}

        {/* Calendar Area */}
        <div className={`transition-opacity duration-300 ${!isWindowOpen ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
            
            {/* Block Month Toggle */}
            <button 
                onClick={handleToggleBlockMonth}
                className={`w-full mb-6 p-4 rounded-xl border-2 flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] ${
                    isBlockedMonth 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400 shadow-inner'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-800/50 text-zinc-500'
                }`}
            >
                {isBlockedMonth ? (
                    <>
                        <Ban size={20} />
                        <span className="font-bold text-sm">VOCÊ NÃO ESTÁ DISPONÍVEL NESTE MÊS</span>
                    </>
                ) : (
                    <>
                        <Ban size={20} />
                        <span className="font-medium text-sm">Marcar mês inteiro como indisponível</span>
                    </>
                )}
            </button>

            <div className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6 relative overflow-hidden transition-all duration-300 ${isBlockedMonth ? 'ring-2 ring-red-500/20' : ''}`}>
                
                {/* Blocked Overlay */}
                {isBlockedMonth && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                        <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-3 text-red-500">
                            <Ban size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Mês Bloqueado</h3>
                        <p className="text-sm text-zinc-500 max-w-xs mb-4">Você sinalizou que não pode servir em nenhuma data de {getMonthName(currentMonth)}.</p>
                        <button 
                            onClick={handleToggleBlockMonth}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        >
                            <Unlock size={14}/> Desbloquear e Selecionar Datas
                        </button>
                    </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-zinc-400 py-2">{d}</div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                    {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                    {days.map(day => {
                        const status = getDayStatus(day);
                        let btnClass = "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600";
                        let icon = null;

                        if (status === 'full') {
                            btnClass = "bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-500/30";
                            icon = <CheckCircle2 size={14} className="mb-1" />;
                        } else if (status === 'morning') {
                            btnClass = "bg-amber-400 text-white border-amber-500 shadow-md shadow-amber-400/30";
                            icon = <Sun size={14} className="mb-1" />;
                        } else if (status === 'night') {
                            btnClass = "bg-indigo-500 text-white border-indigo-600 shadow-md shadow-indigo-500/30";
                            icon = <Moon size={14} className="mb-1" />;
                        }

                        return (
                            <button
                                key={day}
                                onClick={() => handleToggleDate(day)}
                                className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95 ${btnClass}`}
                            >
                                {icon}
                                <span className="text-sm font-bold">{day}</span>
                                {status === 'morning' && <span className="text-[9px] uppercase font-bold">Manhã</span>}
                                {status === 'night' && <span className="text-[9px] uppercase font-bold">Noite</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-4 mt-6 justify-center bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div> Livre (Dia Todo)
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></div> Apenas Manhã
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm"></div> Apenas Noite
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mt-6">
                <div className="flex items-center gap-2 mb-3">
                    <FileText size={18} className="text-zinc-400" />
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Observações (Opcional)</h3>
                </div>
                <textarea 
                    value={generalNote}
                    onChange={e => { setGeneralNote(e.target.value); setHasUnsavedChanges(true); }}
                    placeholder="Ex: Chego atrasado no dia 15..."
                    className="w-full h-20 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
                    disabled={!isWindowOpen}
                />
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                    <Info size={14} />
                    <span>Clique repetidamente nos <strong>Domingos</strong> para alternar entre Manhã/Noite/Dia Todo.</span>
                </div>
            </div>
        </div>

        {/* Floating Save Button */}
        <div className={`fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-300 ${hasUnsavedChanges ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <div className="bg-zinc-900/90 dark:bg-white/95 backdrop-blur-md text-white dark:text-zinc-900 rounded-2xl shadow-2xl p-2 pl-5 pr-2 w-[90%] max-w-sm flex items-center justify-between pointer-events-auto border border-zinc-700/50 dark:border-zinc-200/50 ring-1 ring-black/10">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold uppercase tracking-wider">Não salvo</span>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18} />}
                    Salvar
                </button>
            </div>
        </div>
    </div>
  );
};
