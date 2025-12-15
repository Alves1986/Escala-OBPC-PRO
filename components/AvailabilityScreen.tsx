
import React, { useState, useEffect, useRef } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, Moon, Sun, Lock, FileText, Info, Ban, Unlock, AlertCircle } from 'lucide-react';
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
  
  // State
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [tempDates, setTempDates] = useState<string[]>([]); 
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const isAdmin = currentUser?.role === 'admin';
  const isBlockedMonth = tempDates.includes(`${currentMonth}-BLK`);

  // Parse Month for Calculations
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Verifica janela de disponibilidade
  const isWindowOpen = React.useMemo(() => {
      if (isAdmin) return true;
      if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
      
      const now = new Date();
      let start = new Date(0);
      let end = new Date(8640000000000000); 

      if (availabilityWindow.start && !availabilityWindow.start.includes('1970')) {
          start = new Date(availabilityWindow.start);
      }
      if (availabilityWindow.end && !availabilityWindow.end.includes('1970')) {
          end = new Date(availabilityWindow.end);
      }
      
      if (availabilityWindow.start?.includes('1970')) return false;

      return now >= start && now <= end;
  }, [availabilityWindow, isAdmin]);

  // Inicialização do Membro
  useEffect(() => {
    if (currentUser && !selectedMember) {
      if (allMembersList.includes(currentUser.name)) {
        setSelectedMember(currentUser.name);
      } else if (allMembersList.length > 0) {
        setSelectedMember(allMembersList[0]);
      }
    }
  }, [currentUser, allMembersList]);

  // Carregamento de Dados
  useEffect(() => {
    if (!selectedMember) return;

    // Reseta estado local ao mudar mês ou membro, mas preserva se houver mudanças não salvas? 
    // Para simplificar, sempre recarrega do estado global quando muda o contexto.
    const storedDates = availability[selectedMember] || [];
    const monthDates = storedDates.filter(d => d.startsWith(currentMonth));
    setTempDates(monthDates);
    
    // Busca nota do mês (armazenada com chave especial dia '00')
    // A chave no notes global é "NomeMembro_YYYY-MM-00"
    const noteKey = `${selectedMember}_${currentMonth}-00`;
    setGeneralNote(availabilityNotes?.[noteKey] || "");
    
    setHasUnsavedChanges(false);
  }, [selectedMember, currentMonth, availability, availabilityNotes]);

  const handleToggleBlockMonth = () => {
      if (!isWindowOpen) return;
      setHasUnsavedChanges(true);

      if (isBlockedMonth) {
          setTempDates([]);
      } else {
          setTempDates([`${currentMonth}-BLK`]);
      }
  };

  const handleToggleDate = (day: number) => {
      if (!isWindowOpen) {
          addToast("O período para edição está fechado.", "warning");
          return;
      }

      setHasUnsavedChanges(true);
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      const full = dateBase;
      const morning = `${dateBase}_M`;
      const night = `${dateBase}_N`;

      // Se estava bloqueado, limpa o bloqueio ao clicar numa data
      let newDates = isBlockedMonth ? [] : [...tempDates];
      
      const hasFull = newDates.includes(full);
      const hasMorning = newDates.includes(morning);
      const hasNight = newDates.includes(night);

      // Remove qualquer estado anterior para este dia
      newDates = newDates.filter(d => d !== full && d !== morning && d !== night);

      if (isSunday) {
          // Cycle: None -> Full -> Morning -> Night -> None
          if (!hasFull && !hasMorning && !hasNight) {
              newDates.push(full);
          } else if (hasFull) {
              newDates.push(morning);
          } else if (hasMorning) {
              newDates.push(night);
          }
          // Se era Night, remove tudo (já removido no filtro acima)
      } else {
          // Cycle: None -> Full -> None
          if (!hasFull) {
              newDates.push(full);
          }
      }
      
      setTempDates(newDates);
  };

  const handleSave = async () => {
      if (!selectedMember) return;
      setIsSaving(true);
      try {
          // Precisamos construir o objeto de notas APENAS para este mês
          const notesPayload: Record<string, string> = {};
          
          if (generalNote.trim()) {
              notesPayload[`${currentMonth}-00`] = generalNote.trim();
          }

          // Salva chamando a função principal
          await onSaveAvailability(selectedMember, tempDates, notesPayload, currentMonth);
          
          setHasUnsavedChanges(false);
          addToast("Disponibilidade enviada com sucesso!", "success");
      } catch (e) {
          console.error(e);
          addToast("Erro ao salvar. Tente novamente.", "error");
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
          if (!window.confirm("Você tem alterações não salvas. Deseja descartá-las?")) return;
      }
      onMonthChange(adjustMonth(currentMonth, dir));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-green-500"/> Minha Disponibilidade
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
                    <span className="text-sm font-bold min-w-[100px] text-center">{getMonthName(currentMonth)}</span>
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
                    <p className="text-xs opacity-80">O período para envio de disponibilidade foi encerrado pela liderança.</p>
                </div>
            </div>
        )}

        {/* Main Interface */}
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
                        <span className="font-medium text-sm">Não me escale neste mês</span>
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
                        <div className="w-3 h-3 rounded bg-green-500 shadow-sm"></div> Livre (Dia Todo)
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <div className="w-3 h-3 rounded bg-orange-400 shadow-sm"></div> Apenas Manhã
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <div className="w-3 h-3 rounded bg-indigo-500 shadow-sm"></div> Apenas Noite
                    </div>
                </div>
            </div>

            {/* Notes Section */}
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
                    <span>Clique nos dias para alternar status. Opções de turno (Manhã/Noite) disponíveis apenas aos <strong>Domingos</strong>.</span>
                </div>
            </div>
        </div>

        {/* Floating Save Bar - Appears ONLY when has unsaved changes */}
        <div className={`fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-300 ease-out ${hasUnsavedChanges ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <div className="bg-zinc-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-zinc-900 rounded-2xl shadow-2xl p-3 pl-5 w-[90%] max-w-md flex items-center justify-between pointer-events-auto border border-zinc-700/50 dark:border-zinc-200/50 ring-1 ring-black/5">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold">Alterações pendentes</span>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            Salvando
                        </>
                    ) : (
                        <><Save size={18} /> Salvar</>
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};
