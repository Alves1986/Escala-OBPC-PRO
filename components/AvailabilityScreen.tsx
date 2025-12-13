
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarCheck, Lock, Save, MessageSquare, Sun, Moon, ShieldCheck, Unlock, ThumbsUp, Check, AlertTriangle, CalendarX } from 'lucide-react';
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

  // --- LÓGICA DE JANELA DE DISPONIBILIDADE ---
  const getWindowState = () => {
      if (!availabilityWindow?.start && !availabilityWindow?.end) return 'OPEN';
      
      const startStr = availabilityWindow.start;
      const endStr = availabilityWindow.end;

      if (startStr?.includes('1970') || endStr?.includes('1970')) return 'CLOSED';

      const start = new Date(startStr || '');
      const end = new Date(endStr || '');
      const now = new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'OPEN';
      
      return (now >= start && now <= end) ? 'OPEN' : 'CLOSED';
  };

  const windowState = getWindowState();
  // Admins always have access, otherwise depend on window
  const isEditable = isAdmin || windowState === 'OPEN';

  useEffect(() => {
    if (currentUser && currentUser.name && !isAdmin) {
        setSelectedMember(currentUser.name);
    } else if (isAdmin && !selectedMember && currentUser) {
        setSelectedMember(currentUser.name);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    if (selectedMember) {
        const storedDates = availability[selectedMember] || [];
        setTempDates([...storedDates]);
        
        const genKey = `${selectedMember}_${currentMonth}-00`;
        setGeneralNote(availabilityNotes?.[genKey] || "");
        
        setHasChanges(false);
    } else {
        setTempDates([]);
        setGeneralNote("");
    }
  }, [selectedMember, availability, availabilityNotes, currentMonth]);

  const handlePrevMonth = () => onMonthChange(adjustMonth(currentMonth, -1));
  const handleNextMonth = () => onMonthChange(adjustMonth(currentMonth, 1));

  const handleDayClick = (day: number) => {
      if (!isEditable) {
          addToast("O período de marcação de disponibilidade está encerrado.", "error");
          return;
      }
      
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const existingEntry = tempDates.find(d => d.startsWith(dateStr));

      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      let newDates = [...tempDates];

      // Remove qualquer estado anterior para este dia
      if (existingEntry) {
          newDates = newDates.filter(d => !d.startsWith(dateStr));
      }

      // LÓGICA DE CICLO:
      if (isSunday) {
          if (!existingEntry) {
              newDates.push(dateStr); // Full Available
          } else if (existingEntry === dateStr) {
              newDates.push(`${dateStr}_M`); // Morning Only
          } else if (existingEntry.endsWith('_M')) {
              newDates.push(`${dateStr}_N`); // Night Only
          } 
          // Night -> Vazio
      } else {
          // Dias Normais: Toggle Simples (Vazio <-> Full)
          if (!existingEntry) {
              newDates.push(dateStr);
          }
      }
      
      setTempDates(newDates);
      setHasChanges(true);
  };

  const getDayStatus = (day: number) => {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const found = tempDates.find(d => d.startsWith(dateStr));
      
      if (!found) return 'UNAVAILABLE'; 
      if (found.endsWith('_M')) return 'MORNING'; 
      if (found.endsWith('_N')) return 'NIGHT';   
      return 'FULL'; 
  };

  const handleSave = async () => {
      if (!selectedMember) return;
      if (!isEditable) {
          addToast("Janela fechada. Não é possível salvar.", "error");
          return;
      }

      setIsSaving(true);

      try {
          const notesToSave: Record<string, string> = {};
          if (generalNote.trim()) {
              notesToSave[`${currentMonth}-00`] = generalNote.trim();
          }

          await onSaveAvailability(selectedMember, tempDates, notesToSave, currentMonth);
          
          setHasChanges(false);
          addToast("Disponibilidade salva com sucesso!", "success");
      } catch (error) {
          console.error(error);
          addToast("Erro ao salvar. Tente novamente.", "error");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CalendarCheck size={24} />
              </div>
              <div>
                  <h2 className="text-lg font-bold text-zinc-800 dark:text-white leading-tight">Disponibilidade</h2>
                  <p className="text-sm text-zinc-500">Toque nos dias em que você <span className="font-bold text-emerald-600 dark:text-emerald-400">PODE</span> servir.</p>
              </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">←</button>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[120px] text-center capitalize select-none">{getMonthName(currentMonth)}</span>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">→</button>
          </div>
      </div>

      {/* FEEDBACK VISUAL DE STATUS DA JANELA */}
      {windowState === 'CLOSED' && (
          <div className={`p-5 rounded-2xl border flex items-start gap-4 shadow-sm animate-fade-in ${
              isAdmin 
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-300'
          }`}>
              <div className={`p-3 rounded-xl shrink-0 ${isAdmin ? 'bg-amber-100 dark:bg-amber-800/30' : 'bg-red-100 dark:bg-red-800/30'}`}>
                  {isAdmin ? <Unlock size={24}/> : <Lock size={24}/>}
              </div>
              <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                      {isAdmin ? 'Modo Administrador' : 'Janela Fechada'}
                      {isAdmin && <span className="bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Acesso Liberado</span>}
                  </h3>
                  <p className="text-sm opacity-90 leading-relaxed">
                      {isAdmin 
                        ? 'A janela está fechada para os membros, mas você possui permissão total para realizar ajustes na agenda.' 
                        : 'O período de envio de disponibilidade para este mês foi encerrado. Entre em contato com a liderança para alterações de emergência.'}
                  </p>
              </div>
          </div>
      )}

      {/* Admin User Selector */}
      {isAdmin && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold text-zinc-500 uppercase block mb-2 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-teal-500"/> Editando como:
              </label>
              <select 
                  value={selectedMember} 
                  onChange={e => setSelectedMember(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
              >
                  <option value="" className="text-zinc-500">Selecione...</option>
                  {allMembersList.map(m => <option key={m} value={m} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800">{m}</option>)}
              </select>
          </div>
      )}

      {selectedMember ? (
          <div className={`relative transition-all duration-500 ${!isEditable ? 'opacity-60 pointer-events-none grayscale' : ''}`}>
              
              {!isEditable && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/90 dark:bg-black/80 backdrop-blur-sm p-4 rounded-full shadow-2xl border border-zinc-200 dark:border-zinc-700">
                          <Lock size={32} className="text-zinc-400 dark:text-zinc-500" />
                      </div>
                  </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 text-[10px] text-zinc-500 uppercase font-bold tracking-wide mb-6 bg-white dark:bg-zinc-800 p-3 rounded-full border border-zinc-100 dark:border-zinc-700 shadow-sm w-fit mx-auto">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600"/> Indisponível</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"/> Disponível</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"/> Só Manhã</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"/> Só Noite</div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-8 select-none">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <div key={i} className="text-center text-xs font-bold text-zinc-400 py-2">{d}</div>
                  ))}
                  
                  {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                  ))}

                  {days.map(day => {
                      const status = getDayStatus(day);
                      
                      let styles = "bg-white dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600";
                      let icon = null;
                      let shadow = "shadow-sm";

                      if (status === 'FULL') {
                          styles = "bg-emerald-500 text-white border-emerald-600 font-bold ring-2 ring-emerald-200 dark:ring-emerald-900";
                          shadow = "shadow-lg shadow-emerald-500/30 transform scale-105 z-10";
                          icon = <ThumbsUp size={14} className="absolute top-1 right-1 opacity-90 stroke-[3]"/>;
                      } else if (status === 'MORNING') {
                          styles = "bg-amber-400 text-amber-950 border-amber-500 font-bold ring-2 ring-amber-200 dark:ring-amber-900";
                          shadow = "shadow-lg shadow-amber-400/30 transform scale-105 z-10";
                          icon = <Sun size={14} className="absolute top-1 right-1 opacity-80 stroke-[2.5]"/>;
                      } else if (status === 'NIGHT') {
                          styles = "bg-indigo-500 text-white border-indigo-600 font-bold ring-2 ring-indigo-200 dark:ring-indigo-900";
                          shadow = "shadow-lg shadow-indigo-500/30 transform scale-105 z-10";
                          icon = <Moon size={14} className="absolute top-1 right-1 opacity-90 stroke-[2.5]"/>;
                      }

                      return (
                          <button
                              key={day}
                              onClick={() => handleDayClick(day)}
                              className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-200 ${styles} ${shadow}`}
                              title={status === 'FULL' ? 'Disponível o dia todo' : status === 'UNAVAILABLE' ? 'Indisponível' : status === 'MORNING' ? 'Disponível apenas Manhã' : 'Disponível apenas Noite'}
                          >
                              <span className="text-sm sm:text-lg">{day}</span>
                              {icon}
                          </button>
                      );
                  })}
              </div>

              {/* Note Section */}
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm mb-24">
                  <div className="flex items-center gap-2 mb-3 text-zinc-500">
                      <MessageSquare size={18} className="text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-wider">Observações do Mês</span>
                  </div>
                  <textarea 
                      value={generalNote}
                      onChange={(e) => { setGeneralNote(e.target.value); setHasChanges(true); }}
                      className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] transition-all disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                      placeholder={isEditable ? "Ex: Chego atrasado no dia 15..." : "Edição de observações encerrada."}
                      disabled={!isEditable}
                  />
              </div>

              {/* Floating Save Button */}
              {isEditable ? (
                  <div className={`fixed bottom-6 right-6 left-6 md:left-auto flex justify-end z-[90] transition-all duration-500 ease-out ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                      <button 
                          onClick={handleSave}
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-emerald-900/30 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 disabled:opacity-70 ring-4 ring-white dark:ring-zinc-900"
                      >
                          {isSaving ? <span className="animate-spin text-white block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : <Check size={24} strokeWidth={3} />}
                          {isSaving ? "Salvando..." : "Confirmar Disponibilidade"}
                      </button>
                  </div>
              ) : (
                  <div className="fixed bottom-6 right-6 z-[90]">
                      <div className="bg-zinc-800 text-zinc-400 px-6 py-3 rounded-full shadow-lg border border-zinc-700 text-xs font-bold flex items-center gap-2">
                          <Lock size={14}/> Somente Leitura
                      </div>
                  </div>
              )}
          </div>
      ) : (
          <div className="text-center py-16 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <CalendarX size={48} className="mx-auto mb-4 opacity-20"/>
              <p className="text-sm font-medium">Selecione um membro acima para começar a editar.</p>
          </div>
      )}
    </div>
  );
};
