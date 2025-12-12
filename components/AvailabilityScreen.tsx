
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { User as UserIcon, CalendarCheck, ChevronDown, Save, CheckCircle2, Sun, Moon, X, Ban, Lock, Clock, MessageSquare } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes?: AvailabilityNotesMap; // New Prop
  setAvailability: (av: AvailabilityMap) => void;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  onNotify?: (message: string) => void;
  currentUser: User | null;
  onSaveAvailability: (member: string, dates: string[], notes: Record<string, string>) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
}

// Modal Interno Unificado para Seleção de Data e Notas
const DateDetailsModal = ({ isOpen, onClose, onSave, onDelete, currentDateDisplay, initialType, initialNote }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (type: 'M' | 'N' | 'BOTH', note: string) => void, 
    onDelete: () => void,
    currentDateDisplay: string,
    initialType?: string,
    initialNote?: string
}) => {
    const [type, setType] = useState<'M' | 'N' | 'BOTH'>((initialType as any) || 'BOTH');
    const [note, setNote] = useState(initialNote || "");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                    <h3 className="font-bold text-zinc-800 dark:text-white">Detalhes do Dia {currentDateDisplay}</h3>
                    <button onClick={onClose}><X size={20} className="text-zinc-500"/></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Período Disponível</label>
                        <div className="space-y-2">
                            <button onClick={() => setType('BOTH')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'BOTH' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-1 ring-green-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2"><CheckCircle2 size={18}/> Dia Todo</span>
                            </button>
                            <button onClick={() => setType('M')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'M' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2"><Sun size={18}/> Apenas Manhã</span>
                            </button>
                            <button onClick={() => setType('N')} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${type === 'N' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}>
                                <span className="font-bold flex items-center gap-2"><Moon size={18}/> Apenas Noite</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Observação (Opcional)</label>
                        <textarea 
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ex: Chego às 19h30..."
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex gap-3">
                    <button onClick={onDelete} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm">Remover</button>
                    <div className="flex-1"></div>
                    <button onClick={onClose} className="px-4 py-2 text-zinc-500 font-bold hover:bg-zinc-200 rounded-lg transition-colors text-sm">Cancelar</button>
                    <button onClick={() => onSave(type, note)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm">Salvar</button>
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
  const [tempDates, setTempDates] = useState<string[]>([]); // "YYYY-MM-DD" or "YYYY-MM-DD_M" etc
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({}); // "YYYY-MM-DD": "Note content"
  
  const [hasChanges, setHasChanges] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean, day: number } | null>(null);
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
        setTempDates(availability[selectedMember] || []);
        
        // Filter notes for selected member
        const memberNotes: Record<string, string> = {};
        if (availabilityNotes) {
            Object.keys(availabilityNotes).forEach(key => {
                if (key.startsWith(selectedMember + '_')) {
                    const datePart = key.split('_')[1]; // Member_Date
                    memberNotes[datePart] = availabilityNotes[key];
                }
            });
        }
        setTempNotes(memberNotes);
        setHasChanges(false);
    }
  }, [selectedMember, availability, availabilityNotes, currentMonth]);

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(currentMonth, 1));
  };

  const isMonthBlocked = tempDates.some(d => d.startsWith(currentMonth) && d.includes('BLOCKED'));

  const handleToggleBlockMonth = () => {
      if (!isEditable) return;

      if (isMonthBlocked) {
          setTempDates(prev => prev.filter(d => !(d.startsWith(currentMonth) && d.includes('BLOCKED'))));
      } else {
          const otherMonths = tempDates.filter(d => !d.startsWith(currentMonth));
          const blockTag = `${currentMonth}-01_BLOCKED`; 
          setTempDates([...otherMonths, blockTag]);
      }
      setHasChanges(true);
  };

  const handleDayClick = (day: number) => {
    if (!selectedMember || isMonthBlocked || !isEditable) return;
    setDetailsModal({ isOpen: true, day });
  };

  const handleModalSave = (type: 'M' | 'N' | 'BOTH', note: string) => {
      if (!detailsModal) return;
      const { day } = detailsModal;
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      // Remove existing entry for this day
      const newDates = tempDates.filter(d => !d.startsWith(dateStrBase));
      
      // Add new entry
      let finalString = dateStrBase;
      if (type === 'M') finalString += '_M';
      if (type === 'N') finalString += '_N';
      
      setTempDates([...newDates, finalString]);
      
      // Update Notes
      const newNotes = { ...tempNotes };
      if (note.trim()) {
          newNotes[dateStrBase] = note.trim();
      } else {
          delete newNotes[dateStrBase];
      }
      setTempNotes(newNotes);

      setHasChanges(true);
      setDetailsModal(null);
  };

  const handleModalDelete = () => {
      if (!detailsModal) return;
      const { day } = detailsModal;
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      setTempDates(prev => prev.filter(d => !d.startsWith(dateStrBase)));
      
      const newNotes = { ...tempNotes };
      delete newNotes[dateStrBase];
      setTempNotes(newNotes);

      setHasChanges(true);
      setDetailsModal(null);
  };

  const handleSave = async () => {
      if (!selectedMember) return;

      await onSaveAvailability(selectedMember, tempDates, tempNotes);
      setHasChanges(false);
      
      if (isMonthBlocked) {
          addToast("Mês marcado como Indisponível.", "info");
      } else {
          addToast("Disponibilidade salva com sucesso!", "success");
      }

      if (onNotify) {
          onNotify(`${selectedMember} atualizou disponibilidade para ${getMonthName(currentMonth)}.`);
      }
  };

  const getDayStatus = (day: number) => {
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const entry = tempDates.find(d => d.startsWith(dateStrBase));
      
      if (!entry) return null;
      let status = 'BOTH';
      if (entry.endsWith('_M')) status = 'M';
      if (entry.endsWith('_N')) status = 'N';
      
      return { status, note: tempNotes[dateStrBase] };
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarCheck className="text-blue-500"/> Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Selecione os dias em que você <strong className="text-green-600 dark:text-green-400">ESTÁ DISPONÍVEL</strong>.
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
                      O período para envio de disponibilidade foi encerrado. Entre em contato com a liderança se precisar fazer alterações urgentes.
                  </p>
              </div>
          </div>
      )}
      
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Membro</label>
            
            {isAdmin ? (
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
            ) : (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {currentUser?.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">{currentUser?.name}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Você está visualizando sua disponibilidade</p>
                    </div>
                </div>
            )}
        </div>

        {selectedMember && isEditable && (
            <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                isMonthBlocked 
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
                : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${isMonthBlocked ? 'bg-red-100 text-red-600' : 'bg-zinc-200 text-zinc-500'}`}>
                        {isMonthBlocked ? <Ban size={20}/> : <CalendarCheck size={20}/>}
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${isMonthBlocked ? 'text-red-700 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {isMonthBlocked ? 'Indisponível este Mês' : 'Disponível para Escala'}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {isMonthBlocked 
                                ? 'Você não será incluído em nenhuma escala deste mês.' 
                                : 'Clique nos dias para marcar disponibilidade ou adicionar observações.'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={handleToggleBlockMonth}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        isMonthBlocked 
                        ? 'bg-white text-red-600 border border-red-200 hover:bg-red-50' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                    }`}
                >
                    {isMonthBlocked ? 'Desbloquear' : 'Marcar Indisponível'}
                </button>
            </div>
        )}

        {selectedMember ? (
          <div className="animate-slide-up pb-20 relative">
            
            {isMonthBlocked && (
                <div className="absolute inset-0 z-20 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center text-center border-2 border-dashed border-red-300 dark:border-red-900/50">
                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-full shadow-xl mb-4">
                        <Lock size={32} className="text-red-500"/>
                    </div>
                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Mês Bloqueado</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs mt-2">
                        Você marcou que não pode servir em {getMonthName(currentMonth)}. Clique em "Desbloquear" acima se mudar de ideia.
                    </p>
                </div>
            )}

            <div className="hidden sm:grid sm:grid-cols-7 gap-3 mb-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-bold text-zinc-400 uppercase py-2">{d}</div>
                ))}
            </div>

            <div className={`grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3 transition-opacity duration-300 ${isMonthBlocked || !isEditable ? 'opacity-50' : 'opacity-100'}`}>
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="hidden sm:block" />
                ))}
                
                {days.map(day => {
                    const data = getDayStatus(day);
                    const isSelected = data !== null;
                    const status = data?.status;
                    const hasNote = !!data?.note;
                    const dateObj = new Date(year, month - 1, day);
                    const weekDayShort = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3).toUpperCase();

                    let bgClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700';
                    if (status === 'BOTH') bgClass = 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30 ring-2 ring-green-400 dark:ring-green-600';
                    if (status === 'M') bgClass = 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-orange-500/30 ring-2 ring-orange-400';
                    if (status === 'N') bgClass = 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-400';

                    return (
                        <button
                            key={day}
                            onClick={() => handleDayClick(day)}
                            disabled={!isEditable}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all shadow-sm relative overflow-hidden group ${bgClass} ${isSelected ? 'scale-100 z-10' : ''} ${!isEditable ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                            <span className="text-[10px] font-bold uppercase opacity-60 sm:hidden mb-0.5">{weekDayShort}</span>
                            <span className="text-lg sm:text-lg font-bold relative z-10 leading-none">{day}</span>
                            
                            {status === 'BOTH' && <CheckCircle2 size={16} className="absolute top-1 right-1 opacity-50 hidden sm:block" />}
                            {status === 'M' && <Sun size={16} className="absolute top-1 right-1 opacity-70 hidden sm:block" />}
                            {status === 'N' && <Moon size={16} className="absolute top-1 right-1 opacity-70 hidden sm:block" />}
                            
                            {hasNote && (
                                <div className="absolute bottom-1 right-1">
                                    <MessageSquare size={12} className="text-white drop-shadow-md" fill="currentColor"/>
                                </div>
                            )}

                            <div className="sm:hidden mt-1">
                                {status === 'BOTH' && <CheckCircle2 size={12} className="opacity-80" />}
                                {status === 'M' && <Sun size={12} className="opacity-80" />}
                                {status === 'N' && <Moon size={12} className="opacity-80" />}
                            </div>
                        </button>
                    )
                })}
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center mt-6 text-sm font-medium opacity-80">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md shadow-sm ring-1 ring-green-400"/> 
                    Dia Todo
                </div>
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-md shadow-sm ring-1 ring-orange-400"/> 
                    Manhã
                </div>
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md shadow-sm ring-1 ring-indigo-400"/> 
                    Noite
                </div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm"/> 
                    Indisponível
                </div>
            </div>

            {isEditable && (
                <div className="fixed bottom-6 right-6 left-6 md:left-auto flex justify-end z-40">
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-xl transition-all ${
                            hasChanges 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white translate-y-0 opacity-100' 
                            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed translate-y-10 opacity-0'
                        }`}
                    >
                        <Save size={20} />
                        Salvar {isMonthBlocked ? 'Bloqueio' : 'Disponibilidade'}
                    </button>
                </div>
            )}
            
            {detailsModal && (
                <DateDetailsModal 
                    isOpen={true} 
                    onClose={() => setDetailsModal(null)} 
                    onSave={handleModalSave}
                    onDelete={handleModalDelete}
                    currentDateDisplay={`${detailsModal.day}/${month}`}
                    initialType={getDayStatus(detailsModal.day)?.status}
                    initialNote={getDayStatus(detailsModal.day)?.note}
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
