
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, User } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { User as UserIcon, CalendarCheck, ChevronDown, Save, CheckCircle2, Sun, Moon, X } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  setAvailability: (av: AvailabilityMap) => void;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  onNotify?: (message: string) => void;
  currentUser: User | null;
  onSaveAvailability: (member: string, dates: string[]) => Promise<void>;
}

// Modal Interno para Seleção de Período
const SundaySelectionModal = ({ isOpen, onClose, onSelect, currentDateDisplay }: { isOpen: boolean, onClose: () => void, onSelect: (type: 'M' | 'N' | 'BOTH') => void, currentDateDisplay: string }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                    <h3 className="font-bold text-zinc-800 dark:text-white">Disponibilidade no Domingo</h3>
                    <button onClick={onClose}><X size={20} className="text-zinc-500"/></button>
                </div>
                <div className="p-6 space-y-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center mb-4">
                        Para o dia <strong>{currentDateDisplay}</strong>, qual período você pode servir?
                    </p>
                    <button onClick={() => onSelect('M')} className="w-full flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 transition-colors">
                        <span className="font-bold flex items-center gap-2"><Sun size={18}/> Apenas Manhã</span>
                    </button>
                    <button onClick={() => onSelect('N')} className="w-full flex items-center justify-between p-3 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors">
                         <span className="font-bold flex items-center gap-2"><Moon size={18}/> Apenas Noite</span>
                    </button>
                    <button onClick={() => onSelect('BOTH')} className="w-full flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-colors">
                         <span className="font-bold flex items-center gap-2"><CheckCircle2 size={18}/> Ambos (Dia Todo)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AvailabilityScreen: React.FC<Props> = ({ availability, setAvailability, allMembersList, currentMonth, onMonthChange, onNotify, currentUser, onSaveAvailability }) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [tempDates, setTempDates] = useState<string[]>([]); // Formato: "YYYY-MM-DD" ou "YYYY-MM-DD_M" ou "YYYY-MM-DD_N"
  const [hasChanges, setHasChanges] = useState(false);
  const [sundayModal, setSundayModal] = useState<{ isOpen: boolean, day: number } | null>(null);
  const { addToast } = useToast();

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Efeito para selecionar automaticamente o usuário logado e carregar dados iniciais
  useEffect(() => {
    if (currentUser && currentUser.name) {
        setSelectedMember(currentUser.name);
    }
  }, [currentUser]);

  // Carrega os dados do membro selecionado para o estado local
  useEffect(() => {
    if (selectedMember) {
        setTempDates(availability[selectedMember] || []);
        setHasChanges(false);
    }
  }, [selectedMember, availability, currentMonth]);

  const handlePrevMonth = () => {
    onMonthChange(adjustMonth(currentMonth, -1));
  };

  const handleNextMonth = () => {
    onMonthChange(adjustMonth(currentMonth, 1));
  };

  const handleToggleDate = (day: number) => {
    if (!selectedMember) return;
    
    // Verifica se é Domingo (0 = Domingo)
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;
    const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;

    // Se for domingo, e a data NÃO estiver marcada ainda, abre modal
    // Se já estiver marcada (qualquer variação), remove direto (toggle off)
    const existingIndex = tempDates.findIndex(d => d.startsWith(dateStrBase));

    if (isSunday) {
        if (existingIndex >= 0) {
            // Se já existe, remove (independente se é M, N ou Both)
            const newDates = [...tempDates];
            newDates.splice(existingIndex, 1);
            setTempDates(newDates);
            setHasChanges(true);
        } else {
            // Se não existe, abre modal para escolher
            setSundayModal({ isOpen: true, day });
        }
    } else {
        // Dias normais (Seg-Sáb) funcionam como boolean (Dia todo)
        if (existingIndex >= 0) {
             setTempDates(prev => prev.filter(d => !d.startsWith(dateStrBase)));
        } else {
             setTempDates(prev => [...prev, dateStrBase]);
        }
        setHasChanges(true);
    }
  };

  const handleSundaySelection = (type: 'M' | 'N' | 'BOTH') => {
      if (!sundayModal) return;
      const { day } = sundayModal;
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      
      let finalString = dateStrBase;
      if (type === 'M') finalString += '_M';
      if (type === 'N') finalString += '_N';
      // 'BOTH' fica apenas a data limpa (padrão legado)

      setTempDates(prev => [...prev, finalString]);
      setHasChanges(true);
      setSundayModal(null);
  };

  const handleSave = async () => {
      if (!selectedMember) return;

      // Salva no banco de dados
      await onSaveAvailability(selectedMember, tempDates);
      setHasChanges(false);
      addToast("Disponibilidade salva com sucesso!", "success");

      // Envia notificação apenas ao clicar em Salvar
      if (onNotify) {
          const count = tempDates.filter(d => d.startsWith(currentMonth)).length;
          onNotify(`${selectedMember} informou disponibilidade para ${count} dias em ${getMonthName(currentMonth)}.`);
      }
  };

  const getDayStatus = (day: number) => {
      const dateStrBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const entry = tempDates.find(d => d.startsWith(dateStrBase));
      
      if (!entry) return null;
      if (entry.endsWith('_M')) return 'M';
      if (entry.endsWith('_N')) return 'N';
      return 'BOTH';
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarCheck className="text-blue-500"/> Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Selecione os dias em que você <strong className="text-green-600 dark:text-green-400">ESTÁ DISPONÍVEL</strong>.
            <br/>Para domingos, você poderá escolher entre Manhã, Noite ou Ambos.
          </p>
        </div>
        
        {/* Month Selector Reuse */}
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm self-end">
            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
                <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
                <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Seletor de Membro */}
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
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Você está editando sua disponibilidade</p>
                    </div>
                </div>
            )}
        </div>

        {selectedMember ? (
          <div className="animate-slide-up pb-20">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-bold text-zinc-400 uppercase py-2">{d}</div>
                ))}
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                
                {days.map(day => {
                const status = getDayStatus(day);
                const isSelectedAvailable = status !== null;

                // Estilos baseados no tipo de disponibilidade
                let bgClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700';
                if (status === 'BOTH') bgClass = 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30 ring-2 ring-green-400 dark:ring-green-600';
                if (status === 'M') bgClass = 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-orange-500/30 ring-2 ring-orange-400';
                if (status === 'N') bgClass = 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-400';

                return (
                    <button
                    key={day}
                    onClick={() => handleToggleDate(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-lg font-bold transition-all shadow-sm relative overflow-hidden group ${bgClass} ${isSelectedAvailable ? 'scale-100 z-10' : ''}`}
                    >
                    <span className="relative z-10">{day}</span>
                    {status === 'BOTH' && <CheckCircle2 size={16} className="absolute top-1 right-1 opacity-50" />}
                    {status === 'M' && <Sun size={16} className="absolute top-1 right-1 opacity-70" />}
                    {status === 'N' && <Moon size={16} className="absolute top-1 right-1 opacity-70" />}
                    </button>
                )
                })}
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center mt-6 text-sm font-medium">
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

            {/* Barra de Ação Fixa ou Flutuante */}
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
                    Salvar Disponibilidade
                </button>
            </div>
            
            {/* Modal de Domingo */}
            {sundayModal && (
                <SundaySelectionModal 
                    isOpen={true} 
                    onClose={() => setSundayModal(null)} 
                    onSelect={handleSundaySelection}
                    currentDateDisplay={`${sundayModal.day}/${month}`}
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
