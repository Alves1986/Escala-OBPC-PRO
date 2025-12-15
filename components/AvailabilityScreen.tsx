
import React, { useState, useEffect, useMemo } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth, getLocalDateISOString } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Save, ShieldAlert, CheckCircle2, Clock, Moon, Sun, Lock, FileText, Info, AlertTriangle } from 'lucide-react';
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
  setAvailability,
  allMembersList,
  currentMonth,
  onMonthChange,
  currentUser,
  onSaveAvailability,
  availabilityWindow
}) => {
  const { addToast } = useToast();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Verifica se a janela de disponibilidade está aberta
  const isWindowOpen = useMemo(() => {
      if (isAdmin) return true; // Admin sempre pode editar
      if (!availabilityWindow?.start && !availabilityWindow?.end) return true; // Se não tem config, está aberto
      
      const now = new Date();
      // Safe parsing
      let start = new Date(0);
      let end = new Date(8640000000000000); // Far future

      if (availabilityWindow.start && !availabilityWindow.start.includes('1970')) {
          start = new Date(availabilityWindow.start);
      }
      if (availabilityWindow.end && !availabilityWindow.end.includes('1970')) {
          end = new Date(availabilityWindow.end);
      }
      
      // Se start for 1970 explicitamente no banco, é bloqueio total
      if (availabilityWindow.start?.includes('1970')) return false;

      return now >= start && now <= end;
  }, [availabilityWindow, isAdmin]);

  // Inicializa membro selecionado
  useEffect(() => {
    if (currentUser && !selectedMember) {
      if (allMembersList.includes(currentUser.name)) {
        setSelectedMember(currentUser.name);
      } else if (allMembersList.length > 0) {
        setSelectedMember(allMembersList[0]);
      }
    }
  }, [currentUser, allMembersList]);

  // Sincroniza dados quando muda o membro ou o mês, mas respeita alterações não salvas
  useEffect(() => {
    if (hasUnsavedChanges) return;

    if (selectedMember) {
        const storedDates = availability[selectedMember] || [];
        // Filtra apenas datas do mês atual para edição (opcional, mas bom pra performance)
        // Aqui carregamos tudo para não perder dados de outros meses ao salvar, 
        // mas o onSaveAvailability deve lidar com merge se necessário.
        // O ideal é carregar tudo que está na prop availability.
        setTempDates([...storedDates]);
        
        const genKey = `${selectedMember}_${currentMonth}-00`;
        setGeneralNote(availabilityNotes?.[genKey] || "");
    } else {
        setTempDates([]);
        setGeneralNote("");
    }
  }, [selectedMember, currentMonth, availability, availabilityNotes, hasUnsavedChanges]);

  const handleToggleDate = (day: number) => {
      if (!isWindowOpen) {
          addToast("O período para edição está fechado.", "warning");
          return;
      }

      setHasUnsavedChanges(true);
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      // Cycle: None -> Full -> Morning -> Night -> None
      const full = dateBase;
      const morning = `${dateBase}_M`;
      const night = `${dateBase}_N`;

      let newDates = [...tempDates];
      
      if (newDates.includes(full)) {
          // Full -> Morning
          newDates = newDates.filter(d => d !== full);
          newDates.push(morning);
      } else if (newDates.includes(morning)) {
          // Morning -> Night
          newDates = newDates.filter(d => d !== morning);
          newDates.push(night);
      } else if (newDates.includes(night)) {
          // Night -> None
          newDates = newDates.filter(d => d !== night);
      } else {
          // None -> Full
          newDates.push(full);
      }
      
      setTempDates(newDates);
  };

  const handleSave = async () => {
      if (!selectedMember) return;
      setIsSaving(true);
      try {
          // Prepara objeto de notas
          const notesPayload: Record<string, string> = {};
          if (generalNote.trim()) {
              notesPayload[`${currentMonth}-00`] = generalNote;
          }
          
          await onSaveAvailability(selectedMember, tempDates, notesPayload, currentMonth);
          setHasUnsavedChanges(false);
          addToast("Disponibilidade salva com sucesso!", "success");
      } catch (e) {
          addToast("Erro ao salvar.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const getDayStatus = (day: number) => {
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      if (tempDates.includes(dateBase)) return 'full';
      if (tempDates.includes(`${dateBase}_M`)) return 'morning';
      if (tempDates.includes(`${dateBase}_N`)) return 'night';
      return 'none';
  };

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-green-500"/> Minha Disponibilidade
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Informe os dias em que você pode servir neste mês.
                </p>
            </div>
            
            <div className="flex items-center gap-3">
                {isAdmin && (
                    <select 
                        value={selectedMember} 
                        onChange={(e) => {
                            if(hasUnsavedChanges && !confirm("Descartar alterações não salvas?")) return;
                            setHasUnsavedChanges(false);
                            setSelectedMember(e.target.value);
                        }}
                        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                )}
                
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                    <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronLeft size={16}/></button>
                    <span className="text-sm font-bold min-w-[100px] text-center">{getMonthName(currentMonth)}</span>
                    <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md"><ChevronRight size={16}/></button>
                </div>
            </div>
        </div>

        {!isWindowOpen && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-200">
                <Lock size={20} />
                <div>
                    <p className="font-bold text-sm">Edição Fechada</p>
                    <p className="text-xs opacity-80">O período para envio de disponibilidade foi encerrado pela liderança.</p>
                </div>
            </div>
        )}

        <div className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6 transition-opacity ${!isWindowOpen ? 'opacity-70 pointer-events-none' : ''}`}>
            {/* Calendar Grid */}
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
                        btnClass = "bg-green-500 text-white border-green-600 shadow-md shadow-green-500/30";
                        icon = <CheckCircle2 size={14} className="mb-1" />;
                    } else if (status === 'morning') {
                        btnClass = "bg-orange-400 text-white border-orange-500 shadow-md shadow-orange-400/30";
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

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 justify-center">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-4 h-4 rounded bg-green-500 shadow-sm"></div> Livre (Dia Todo)
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-4 h-4 rounded bg-orange-400 shadow-sm"></div> Apenas Manhã
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-4 h-4 rounded bg-indigo-500 shadow-sm"></div> Apenas Noite
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-4 h-4 rounded bg-zinc-100 border border-zinc-300"></div> Indisponível
                </div>
            </div>
        </div>

        {/* Notes & Actions */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-2 mb-3">
                <FileText size={18} className="text-zinc-400" />
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Observações para {getMonthName(currentMonth)}</h3>
            </div>
            <textarea 
                value={generalNote}
                onChange={e => { setGeneralNote(e.target.value); setHasUnsavedChanges(true); }}
                placeholder="Ex: Prefiro não ser escalado no dia 15 pois tenho compromisso..."
                className="w-full h-24 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                disabled={!isWindowOpen}
            />
            
            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Info size={14} />
                    <span>Clique nos dias para alternar o status.</span>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving || !isWindowOpen}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                    <Save size={18} />
                    {isSaving ? "Salvando..." : "Salvar Disponibilidade"}
                </button>
            </div>
        </div>
    </div>
  );
};
