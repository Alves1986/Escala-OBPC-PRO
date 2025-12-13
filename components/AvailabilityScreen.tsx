
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { User as UserIcon, CalendarCheck, ChevronDown, Save, CheckCircle2, Sun, Moon, X, Ban, Lock, MessageSquare, AlertCircle } from 'lucide-react';
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
  onSaveAvailability: (member: string, dates: string[], notes: Record<string, string>) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
}

// TAG SEGURA CURTA: Usamos '99_BLK' para evitar limites de caracteres em colunas VARCHAR
const BLOCK_TAG_SUFFIX = '99_BLK'; 

// Modal simplificado APENAS para Domingos (Seleção de Período)
const SundaySelectionModal = ({ isOpen, onClose, onSave, onDelete, currentDateDisplay, initialType }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (type: 'M' | 'N' | 'BOTH') => void, 
    onDelete: () => void,
    currentDateDisplay: string,
    initialType?: string
}) => {
    const [type, setType] = useState<'M' | 'N' | 'BOTH'>((initialType as any) || 'BOTH');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-xs border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col animate-slide-up">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                    <h3 className="font-bold text-zinc-800 dark:text-white text-sm">Domingo - {currentDateDisplay}</h3>
                    <button onClick={onClose}><X size={18} className="text-zinc-500"/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Qual período você servirá?</label>
                        <div className="space-y-2">
                            <button onClick={() => setType('BOTH')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'BOTH' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-1 ring-green-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2 text-sm"><CheckCircle2 size={16}/> Dia Todo</span>
                            </button>
                            <button onClick={() => setType('M')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'M' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2 text-sm"><Sun size={16}/> Apenas Manhã</span>
                            </button>
                            <button onClick={() => setType('N')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'N' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2 text-sm"><Moon size={16}/> Apenas Noite</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex gap-2">
                    <button onClick={onDelete} className="flex-1 py-2 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-xs border border-transparent hover:border-red-200">Remover</button>
                    <button onClick={() => onSave(type)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all text-xs">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

export const AvailabilityScreen: React.FC<Props> = ({ 
    availability, availabilityNotes, setAvailability, allMembersList, currentMonth, 
    onMonthChange, onNotify, currentUser, onSaveAvailability,
    availabilityWindow 
}) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState(""); 
  
  const [hasChanges, setHasChanges] = useState(false);
  const [sundayModal, setSundayModal] = useState<{ isOpen: boolean, day: number } | null>(null);
  const { addToast } = useToast();

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isAdmin = currentUser?.role === 'admin';

  const isWindowOpen = () => {
      if (!availabilityWindow?.start || !availabilityWindow?.end) return true;
      const now = new Date();
      const start = new Date(availabilityWindow.start);
      const end = new Date(availabilityWindow.end);
      return now >= start && now <= end;
  };

  const isEditable = isAdmin || isWindowOpen();

  useEffect(() => {
    if (currentUser && currentUser.name) {
        setSelectedMember(currentUser.name);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedMember) {
        const storedDates = availability[selectedMember] || [];
        setTempDates(storedDates);
        
        // Carrega nota geral (usamos o dia '00' como chave para nota do mês)
        const generalNoteKey = `${selectedMember}_${currentMonth}-00`;
        setGeneralNote(availabilityNotes?.[generalNoteKey] || "");
        
        setHasChanges(false);
    }
  }, [selectedMember, availability, availabilityNotes, currentMonth]);

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(currentMonth, 1));
  };

  // Verifica se o mês atual está bloqueado.
  const currentBlockTag = `${currentMonth}-${BLOCK_TAG_SUFFIX}`;
  const isMonthBlocked = tempDates.includes(currentBlockTag);

  const handleToggleBlockMonth = () => {
      if (!isEditable) return;

      if (isMonthBlocked) {
          // DESBLOQUEAR
          setTempDates(prev => prev.filter(d => d !== currentBlockTag));
      } else {
          // BLOQUEAR: Remove dias do mês e adiciona tag de bloqueio
          setTempDates(prev => {
              const otherMonths = prev.filter(d => !d.startsWith(currentMonth));
              return [...otherMonths, currentBlockTag];
          });
      }
      setHasChanges(true);
  };

  const handleDayClick = (day: number) => {
    if (!selectedMember || isMonthBlocked || !isEditable) return;

    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;
    const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;

    if (isSunday) {
        setSundayModal({ isOpen: true, day });
    } else {
        const exists = tempDates.some(d => d.startsWith(dateStrBase));
        if (exists) {
            setTempDates(prev => prev.filter(d => !d.startsWith(dateStrBase)));
        } else {
            setTempDates(prev => [...prev, dateStrBase]);
        }
        setHasChanges(true);
    }
  };

  const handleSundaySave = (type: 'M' | 'N' | 'BOTH') => {
      if (!sundayModal) return;
      const { day } = sundayModal;
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      const newDates = tempDates.filter(d => !d.startsWith(dateStrBase));
      
      let finalString = dateStrBase;
      if (type === 'M') finalString += '_M';
      if (type === 'N') finalString += '_N';
      
      setTempDates([...newDates, finalString]);
      setHasChanges(true);
      setSundayModal(null);
  };

  const handleSundayDelete = () => {
      if (!sundayModal) return;
      const { day } = sundayModal;
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      setTempDates(prev => prev.filter(d => !d.startsWith(dateStrBase)));
      setHasChanges(true);
      setSundayModal(null);
  };

  const handleSave = async () => {
      if (!selectedMember) return;

      const notesToSave: Record<string, string> = {};
      const noteContent = generalNote.trim();
      let datesToSave = [...tempDates];

      if (noteContent) {
          if (isMonthBlocked) {
              // Se bloqueado, vincula a nota à tag de bloqueio (dia 99)
              notesToSave[`${currentMonth}-99`] = noteContent;
          } else {
              // Se disponível, vincula à nota geral (dia 00)
              notesToSave[`${currentMonth}-00`] = noteContent;
              
              // Garante que o dia 00 exista na lista para que a nota seja salva
              if (!datesToSave.includes(`${currentMonth}-00`)) {
                  datesToSave.push(`${currentMonth}-00`);
              }
          }
      }

      // Envia o estado atual para salvar.
      await onSaveAvailability(selectedMember, datesToSave, notesToSave);
      
      setTempDates(datesToSave);
      setHasChanges(false);
      
      if (isMonthBlocked) {
          addToast("Mês marcado como Indisponível.", "warning");
      } else {
          addToast("Disponibilidade salva com sucesso!", "success");
      }

      if (onNotify) {
          onNotify(`${selectedMember} atualizou disponibilidade para ${getMonthName(currentMonth)}.`);
      }
  };

  const getDayStatus = (day: number) => {
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const entry = tempDates.find(d => d.startsWith(dateStrBase) && !d.includes('_BLK'));
      
      if (!entry) return null;
      let status = 'BOTH';
      if (entry.endsWith('_M')) status = 'M';
      if (entry.endsWith('_N')) status = 'N';
      
      return { status };
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarCheck className="text-blue-500"/> Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Toque nos dias que você <strong className="text-green-600 dark:text-green-400">PODE SERVIR</strong>.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm self-end">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
        </div>
      </div>

      {!isEditable && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-start gap-3 animate-slide-up">
              <Lock className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                  <h4 className="text-sm font-bold text-red-700 dark:text-red-300">Edição Fechada</h4>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      O período para envio de disponibilidade foi encerrado.
                  </p>
              </div>
          </div>
      )}
      
      <div className="space-y-6">
        {isAdmin && (
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Membro</label>
                <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <select 
                        value={selectedMember} 
                        onChange={e => setSelectedMember(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-10 appearance-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-zinc-100 font-medium"
                    >
                        <option value="">Selecione o Membro...</option>
                        {allMembersList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={18} />
                </div>
            </div>
        )}

        {/* STATUS CARD / BLOCK TOGGLE */}
        {selectedMember && isEditable && (
            <div className={`p-5 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${
                isMonthBlocked 
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 shadow-md ring-1 ring-red-100 dark:ring-red-900/20' 
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm'
            }`}>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`p-3 rounded-full shrink-0 ${isMonthBlocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {isMonthBlocked ? <Ban size={24}/> : <CalendarCheck size={24}/>}
                    </div>
                    <div>
                        <p className={`text-base font-bold ${isMonthBlocked ? 'text-red-700 dark:text-red-400' : 'text-zinc-800 dark:text-white'}`}>
                            {isMonthBlocked ? 'Mês Bloqueado (Indisponível)' : 'Disponível para Escala'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {isMonthBlocked 
                                ? 'Você não será incluído em nenhuma escala deste mês.' 
                                : 'Selecione os dias abaixo ou bloqueie o mês inteiro.'}
                        </p>
                    </div>
                </div>
                
                <button 
                    onClick={handleToggleBlockMonth}
                    className={`w-full md:w-auto px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                        isMonthBlocked 
                        ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300' 
                        : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 border border-transparent'
                    }`}
                >
                    {isMonthBlocked ? <><CheckCircle2 size={16}/> Desbloquear Mês</> : <><Ban size={16}/> Marcar Mês Indisponível</>}
                </button>
            </div>
        )}

        {selectedMember ? (
          <div className="animate-slide-up pb-32 relative">
            
            {/* Overlay visual quando bloqueado */}
            {isMonthBlocked && (
                <div className="absolute inset-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center text-center border-2 border-dashed border-red-300 dark:border-red-900/50 transition-opacity">
                    <div className="bg-red-50 dark:bg-zinc-800 p-6 rounded-full shadow-xl mb-4 border border-red-100 dark:border-red-900/30">
                        <Lock size={40} className="text-red-500"/>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">Mês Indisponível</h3>
                    <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                        Você sinalizou que não pode participar em nenhuma data de {getMonthName(currentMonth)}.
                    </p>
                    <button onClick={handleToggleBlockMonth} className="mt-6 text-sm font-bold text-blue-600 hover:underline">
                        Quero desbloquear e selecionar dias
                    </button>
                </div>
            )}

            <div className="hidden sm:grid sm:grid-cols-7 gap-3 mb-2">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-bold text-zinc-400 uppercase py-2">{d}</div>
                ))}
            </div>

            <div className={`grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3 transition-opacity duration-300 ${isMonthBlocked || !isEditable ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="hidden sm:block" />
                ))}
                
                {days.map(day => {
                    const data = getDayStatus(day);
                    const isSelected = data !== null;
                    const status = data?.status;
                    const dateObj = new Date(year, month - 1, day);
                    const weekDayShort = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3).toUpperCase();
                    const isSunday = dateObj.getDay() === 0;

                    let bgClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700';
                    
                    if (isSelected) {
                        bgClass = 'bg-green-600 text-white shadow-sm ring-2 ring-green-500';
                        if (isSunday) {
                            if (status === 'M') bgClass = 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm ring-2 ring-orange-400';
                            if (status === 'N') bgClass = 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm ring-2 ring-indigo-400';
                        }
                    }

                    return (
                        <button
                            key={day}
                            onClick={() => handleDayClick(day)}
                            disabled={!isEditable}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all relative overflow-hidden group ${bgClass} ${!isEditable ? 'cursor-not-allowed opacity-80' : 'active:scale-95'}`}
                        >
                            <span className="text-[10px] font-bold uppercase opacity-60 sm:hidden mb-0.5">{weekDayShort}</span>
                            <span className="text-lg sm:text-lg font-bold relative z-10 leading-none">{day}</span>
                            
                            {isSelected && isSunday && (
                                <div className="absolute top-1 right-1">
                                    {status === 'BOTH' && <CheckCircle2 size={14} className="opacity-70" />}
                                    {status === 'M' && <Sun size={14} className="opacity-70" />}
                                    {status === 'N' && <Moon size={14} className="opacity-70" />}
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
            
            <div className="mt-8 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative z-30">
                <div className="flex items-center gap-2 mb-2 text-zinc-500 dark:text-zinc-400">
                    <MessageSquare size={16} />
                    <label className="text-xs font-bold uppercase">Observações Gerais</label>
                </div>
                <textarea 
                    value={generalNote}
                    onChange={(e) => { setGeneralNote(e.target.value); setHasChanges(true); }}
                    disabled={!isEditable}
                    placeholder={isMonthBlocked ? "Motivo da indisponibilidade (opcional)..." : "Ex: Chego atrasado nas quartas; Estarei de férias do dia 10 ao 20..."}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none disabled:opacity-50"
                />
            </div>

            <div className="flex flex-wrap gap-4 justify-center mt-6 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-600 rounded-sm"/> Disponível</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-sm"/> Indisponível</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-400 rounded-sm"/> Manhã (Dom)</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-indigo-500 rounded-sm"/> Noite (Dom)</div>
            </div>

            {isEditable && (
                <div className="fixed bottom-6 right-6 left-6 md:left-auto flex justify-end z-40 pointer-events-none">
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-xl transition-all transform ${
                            hasChanges 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white translate-y-0 opacity-100 scale-100' 
                            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 translate-y-10 opacity-0 scale-90'
                        }`}
                    >
                        <Save size={20} />
                        Salvar Alterações
                    </button>
                </div>
            )}
            
            {sundayModal && (
                <SundaySelectionModal 
                    isOpen={true} 
                    onClose={() => setSundayModal(null)} 
                    onSave={handleSundaySave}
                    onDelete={handleSundayDelete}
                    currentDateDisplay={`${sundayModal.day}/${month}`}
                    initialType={getDayStatus(sundayModal.day)?.status}
                />
            )}

          </div>
        ) : (
            <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 border-dashed">
                <p className="text-zinc-500">Carregando...</p>
            </div>
        )}
      </div>
    </div>
  );
};
