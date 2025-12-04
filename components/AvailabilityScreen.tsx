
import React, { useState, useEffect } from 'react';
import { AvailabilityMap, User } from '../types';
import { getMonthName } from '../utils/dateUtils';
import { User as UserIcon, CalendarCheck, ChevronDown, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  setAvailability: (av: AvailabilityMap) => void;
  allMembersList: string[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  onNotify?: (message: string) => void;
  currentUser: User | null;
}

export const AvailabilityScreen: React.FC<Props> = ({ availability, setAvailability, allMembersList, currentMonth, onMonthChange, onNotify, currentUser }) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [tempDates, setTempDates] = useState<string[]>([]); // Estado local para edição
  const [hasChanges, setHasChanges] = useState(false);
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
        // Agora a lógica é: O que está no array são os dias DISPONÍVEIS (Verdes)
        // Se não tiver nada salvo, começa vazio (tudo cinza)
        setTempDates(availability[selectedMember] || []);
        setHasChanges(false);
    }
  }, [selectedMember, availability, currentMonth]); // Adicionado currentMonth para recarregar ao mudar mês

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    onMonthChange(prev.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    onMonthChange(next.toISOString().slice(0, 7));
  };

  const handleToggleDate = (day: number) => {
    if (!selectedMember) return;
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    
    setTempDates(prev => {
        const exists = prev.includes(dateStr);
        if (exists) {
            return prev.filter(d => d !== dateStr);
        } else {
            return [...prev, dateStr];
        }
    });
    setHasChanges(true);
  };

  const handleSave = () => {
      if (!selectedMember) return;

      // Salva no estado global
      setAvailability({ ...availability, [selectedMember]: tempDates });
      setHasChanges(false);
      addToast("Disponibilidade salva com sucesso!", "success");

      // Envia notificação apenas ao clicar em Salvar
      if (onNotify) {
          const count = tempDates.filter(d => d.startsWith(currentMonth)).length;
          onNotify(`${selectedMember} informou disponibilidade para ${count} dias em ${getMonthName(currentMonth)}.`);
      }
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
            Selecione os dias em que você <strong className="text-green-600 dark:text-green-400">ESTÁ DISPONÍVEL</strong> para servir.
            Dias não marcados serão considerados como indisponíveis.
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
                const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                
                // Nova lógica: Verifica se está no array tempDates (disponível)
                const isSelectedAvailable = tempDates.includes(dateStr);

                return (
                    <button
                    key={day}
                    onClick={() => handleToggleDate(day)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-lg font-bold transition-all shadow-sm relative overflow-hidden group ${
                        isSelectedAvailable 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-500/30 scale-100 ring-2 ring-green-400 dark:ring-green-600 z-10' 
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                    }`}
                    >
                    <span className="relative z-10">{day}</span>
                    {isSelectedAvailable && <CheckCircle2 size={16} className="absolute top-1 right-1 opacity-50" />}
                    </button>
                )
                })}
            </div>
            
            <div className="flex gap-6 justify-center mt-6 text-sm font-medium">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md shadow-sm ring-1 ring-green-400"/> 
                    Disponível (Selecionado)
                </div>
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm"/> 
                    Indisponível (Vazio)
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
