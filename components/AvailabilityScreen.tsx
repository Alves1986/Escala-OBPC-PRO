
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarCheck, CheckCircle2, Lock, Save, MessageSquare, Sun, Moon, ShieldCheck, Unlock } from 'lucide-react';
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
      // 1. Se não houver configuração, aberto por padrão
      if (!availabilityWindow?.start && !availabilityWindow?.end) return 'OPEN';
      
      const startStr = availabilityWindow.start;
      const endStr = availabilityWindow.end;

      // 2. Verifica "Código de Bloqueio" (Epoch 1970)
      if (startStr?.includes('1970') || endStr?.includes('1970')) return 'CLOSED';

      // 3. Validação de datas
      const start = new Date(startStr || '');
      const end = new Date(endStr || '');
      const now = new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return 'OPEN'; // Falha segura: Aberto
      }
      
      // 4. Comparação Temporal
      return (now >= start && now <= end) ? 'OPEN' : 'CLOSED';
  };

  const windowState = getWindowState();
  const isEditable = isAdmin || windowState === 'OPEN';

  // Inicializa com o usuário atual se não for admin (ou se for admin, mas sem seleção ainda)
  useEffect(() => {
    if (currentUser && currentUser.name && !isAdmin) {
        setSelectedMember(currentUser.name);
    } else if (isAdmin && !selectedMember && currentUser) {
        // Admin começa vendo a si mesmo ou o primeiro da lista
        setSelectedMember(currentUser.name);
    }
  }, [currentUser, isAdmin]);

  // Carrega dados do banco para o estado temporário (tempDates/generalNote)
  useEffect(() => {
    if (selectedMember) {
        const storedDates = availability[selectedMember] || [];
        // Cria uma cópia para evitar mutação direta
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
      
      // Encontra se já existe alguma entrada para este dia (Full, Morning ou Night)
      // O .find retorna a string completa ex: "2023-10-05" ou "2023-10-05_M"
      const existingEntry = tempDates.find(d => d.startsWith(dateStr));

      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      let newDates = [...tempDates];

      // Remove a entrada existente para este dia (limpeza prévia)
      if (existingEntry) {
          newDates = newDates.filter(d => !d.startsWith(dateStr));
      }

      // Lógica de Toggle
      if (isSunday) {
          // Domingo: Vazio -> Full -> Manhã -> Noite -> Vazio
          if (!existingEntry) {
              newDates.push(dateStr); // Full
          } else if (existingEntry === dateStr) {
              newDates.push(`${dateStr}_M`); // Manhã
          } else if (existingEntry.endsWith('_M')) {
              newDates.push(`${dateStr}_N`); // Noite
          } 
          // Se era Noite (_N), já foi removido no filtro acima, então fica vazio
      } else {
          // Dias Normais: Vazio -> Full -> Vazio
          if (!existingEntry) {
              newDates.push(dateStr); // Full (Unavailable)
          }
          // Se já existia, foi removido, então fica vazio (Available)
      }
      
      setTempDates(newDates);
      setHasChanges(true);
  };

  const getDayStatus = (day: number) => {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const found = tempDates.find(d => d.startsWith(dateStr));
      
      if (!found) return 'NONE'; // Available
      if (found.endsWith('_M')) return 'MORNING'; // Unavailable Morning
      if (found.endsWith('_N')) return 'NIGHT';   // Unavailable Night
      return 'FULL'; // Unavailable All Day
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
              // A chave da nota precisa seguir o padrão esperado pelo hook useMinistryData -> supabaseService
              // O service espera: notes[`${targetMonth}-00`] = text
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-20">
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <CalendarCheck size={20} />
              </div>
              <div>
                  <h2 className="font-bold text-zinc-800 dark:text-white">Disponibilidade</h2>
                  <p className="text-xs text-zinc-500">Informe quando você <span className="font-bold text-red-500">NÃO</span> pode servir.</p>
              </div>
          </div>

          <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-colors shadow-sm">←</button>
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[100px] text-center capitalize">{getMonthName(currentMonth)}</span>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition-colors shadow-sm">→</button>
          </div>
      </div>

      {/* FEEDBACK VISUAL DE STATUS DA JANELA */}
      {windowState === 'CLOSED' ? (
          isAdmin ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl flex flex-col md:flex-row items-center gap-3 text-amber-700 dark:text-amber-400 shadow-sm animate-slide-up">
                  <div className="flex items-center gap-3">
                    <Unlock size={20} />
                    <div>
                        <span className="text-sm font-bold flex items-center gap-2">
                            Janela Fechada <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-white px-1.5 py-0.5 rounded text-[10px] uppercase">Modo Admin</span>
                        </span>
                        <span className="text-xs opacity-90 block">Os membros não podem editar, mas você tem acesso total.</span>
                    </div>
                  </div>
              </div>
          ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 shadow-sm animate-pulse">
                  <Lock size={20} />
                  <div>
                      <span className="text-sm font-bold block">Período de Edição Encerrado</span>
                      <span className="text-xs opacity-90">A agenda está fechada. Entre em contato com a liderança para alterações.</span>
                  </div>
              </div>
          )
      ) : null}

      {/* Admin User Selector */}
      {isAdmin && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <label className="text-xs font-bold text-zinc-500 uppercase block mb-2 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-teal-500"/> Editando como:
              </label>
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
          <div className={`relative transition-opacity duration-300 ${!isEditable ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-6 select-none">
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
                          styles = "bg-red-500 text-white shadow-md ring-2 ring-red-400 ring-offset-1 dark:ring-offset-zinc-900";
                      } else if (status === 'MORNING') {
                          styles = "bg-orange-400 text-white shadow-md ring-2 ring-orange-300 ring-offset-1 dark:ring-offset-zinc-900";
                          icon = <Sun size={12} className="absolute top-1 right-1 opacity-90"/>;
                      } else if (status === 'NIGHT') {
                          styles = "bg-indigo-500 text-white shadow-md ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-zinc-900";
                          icon = <Moon size={12} className="absolute top-1 right-1 opacity-90"/>;
                      }

                      return (
                          <button
                              key={day}
                              onClick={() => handleDayClick(day)}
                              className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${styles}`}
                              title={status === 'FULL' ? 'Indisponível o dia todo' : status === 'NONE' ? 'Disponível' : `Indisponível: ${status}`}
                          >
                              <span className="text-sm sm:text-base font-bold">{day}</span>
                              {icon}
                          </button>
                      );
                  })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 text-[10px] text-zinc-500 uppercase font-bold tracking-wide mb-6">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600"/> Disponível</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"/> Indisponível</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-400"/> Indisp. Manhã</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-500"/> Indisp. Noite</div>
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
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                      placeholder={isEditable ? "Ex: Viajarei do dia 10 ao 20..." : "Edição de observações encerrada."}
                      disabled={!isEditable}
                  />
              </div>

              {/* Floating Save Button */}
              <div className={`fixed bottom-6 right-6 left-6 md:left-auto flex justify-end z-[90] transition-all duration-300 ${hasChanges ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                  <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-70 ring-2 ring-white dark:ring-zinc-900"
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
