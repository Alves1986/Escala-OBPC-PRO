
import React, { useState, useEffect } from 'react';
import { CustomEvent, AvailabilityMap, AuditLogEntry, Role, User } from '../types';
import { X, Plus, Trash2, Calendar, ShieldAlert, Undo2, CheckCircle2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean; // Agora usado para controlar se o componente deve ser renderizado (no caso de modal) ou se é sempre visível (no caso de página)
  onClose?: () => void;
  title: string;
  children: React.ReactNode;
  isPage?: boolean;
}

const Wrapper: React.FC<ModalProps> = ({ isOpen, onClose, title, children, isPage }) => {
  if (!isOpen && !isPage) return null;

  if (isPage) {
    return (
      <div className="w-full h-full flex flex-col animate-fade-in">
         <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
            {children}
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {onClose && <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={20} /></button>}
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Custom Events Modal ---
export const EventsModal = ({ isOpen, onClose, events, hiddenEvents, onAdd, onRemove, onRestore, isPage }: { 
  isOpen: boolean; onClose?: () => void; events: CustomEvent[]; hiddenEvents: { iso: string, title: string, dateDisplay: string }[]; onAdd: (e: CustomEvent) => void; onRemove: (id: string) => void; onRestore: (iso: string) => void; isPage?: boolean;
}) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:30");
  const [title, setTitle] = useState("");
  const [tab, setTab] = useState<'custom'|'hidden'>('custom');

  const handleAdd = () => {
    if (!date || !title) return;
    onAdd({ id: Date.now().toString(), date, time, title });
    setTitle("");
  };

  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title="Gerenciar Eventos" isPage={isPage}>
      <div className="flex gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-700">
        <button 
          onClick={() => setTab('custom')}
          className={`pb-2 px-2 text-sm font-medium ${tab === 'custom' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500'}`}
        >
          Eventos Extras
        </button>
        <button 
          onClick={() => setTab('hidden')}
          className={`pb-2 px-2 text-sm font-medium ${tab === 'hidden' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500'}`}
        >
          Eventos Ocultos ({hiddenEvents.length})
        </button>
      </div>

      {tab === 'custom' && (
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
            <h3 className="text-sm font-bold text-zinc-500 uppercase">Adicionar Novo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
               <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
               <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
            </div>
            <input type="text" placeholder="Nome do Evento" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
            <button onClick={handleAdd} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded text-sm flex items-center justify-center gap-2"><Plus size={16}/> Adicionar Evento</button>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-zinc-500 uppercase mt-4">Eventos Criados</h3>
            {events.length === 0 && <p className="text-center text-zinc-500 text-sm italic py-4">Nenhum evento extra adicionado.</p>}
            {events.map(evt => (
              <li key={evt.id} className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 list-none">
                 <div>
                   <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{evt.title}</div>
                   <div className="text-xs text-zinc-500">{evt.date.split('-').reverse().join('/')} às {evt.time}</div>
                 </div>
                 <button onClick={() => onRemove(evt.id)} className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 p-2 rounded"><Trash2 size={16}/></button>
              </li>
            ))}
          </div>
        </div>
      )}

      {tab === 'hidden' && (
        <div className="space-y-2">
          {hiddenEvents.length === 0 && <p className="text-center text-zinc-500 text-sm italic py-4">Nenhum evento oculto para este mês.</p>}
          {hiddenEvents.map(evt => (
            <li key={evt.iso} className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 list-none">
               <div>
                 <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{evt.title}</div>
                 <div className="text-xs text-zinc-500">{evt.dateDisplay}</div>
               </div>
               <button onClick={() => onRestore(evt.iso)} className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/20 p-2 rounded" title="Restaurar">
                 <Undo2 size={16}/>
               </button>
            </li>
          ))}
        </div>
      )}
    </Wrapper>
  );
};

// --- Availability Modal ---
export const AvailabilityModal = ({ isOpen, onClose, members, availability, onUpdate, currentMonth, currentUser, isPage }: {
  isOpen: boolean; onClose?: () => void; members: string[]; availability: AvailabilityMap; onUpdate: (m: string, dates: string[]) => void; currentMonth: string; currentUser: User | null; isPage?: boolean;
}) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    // Se for página, já seleciona o usuário atual se for membro
    if ((isOpen || isPage) && currentUser) {
        if (!isAdmin) {
             setSelectedMember(currentUser.name);
        } else if (!selectedMember && members.length > 0) {
             // Admin sem seleção, pode selecionar o primeiro ou ficar vazio
        }
    }
  }, [isOpen, isPage, currentUser, isAdmin]);

  const toggleDate = (day: number) => {
    if (!selectedMember) return;
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    const currentDates = availability[selectedMember] || [];
    
    const newDates = currentDates.includes(dateStr) 
      ? currentDates.filter(d => d !== dateStr)
      : [...currentDates, dateStr];
    onUpdate(selectedMember, newDates);
  };

  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title="Marcar Disponibilidade" isPage={isPage}>
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-200">
           <p>Selecione os dias em que você <strong>ESTÁ DISPONÍVEL</strong> para servir. Dias não marcados serão considerados como indisponíveis.</p>
        </div>

        {isAdmin ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Membro</label>
            <select 
                value={selectedMember} 
                onChange={e => setSelectedMember(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2"
            >
                <option value="">Selecione o Membro...</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ) : (
          <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-center font-bold text-zinc-800 dark:text-zinc-200">
             {currentUser?.name}
          </div>
        )}

        {selectedMember && (
          <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="grid grid-cols-7 gap-2 mb-4">
               {['D','S','T','Q','Q','S','S'].map((d,i) => (
                   <div key={i} className="text-center text-xs font-bold text-zinc-400">{d}</div>
               ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                const isAvailable = (availability[selectedMember] || []).includes(dateStr);
                
                // Calculando dia da semana para offset se quisesse ser perfeito, mas grid simples funciona
                
                return (
                  <button
                    key={day}
                    onClick={() => toggleDate(day)}
                    className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 ${
                      isAvailable 
                        ? 'bg-green-500 text-white shadow-md ring-2 ring-green-300 dark:ring-green-900 scale-105' 
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-6 text-xs mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded shadow-sm"></span> Disponível</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-zinc-200 dark:bg-zinc-800 rounded border border-zinc-300 dark:border-zinc-600"></span> Indisponível</div>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
};

// --- Roles Modal (Equipe) ---
export const RolesModal = ({ isOpen, onClose, roles, onUpdate, members, setMembers, isPage }: {
  isOpen: boolean; onClose?: () => void; roles: Role[]; onUpdate: (r: Role[]) => void; members: any; setMembers: any; isPage?: boolean;
}) => {
  const [newRole, setNewRole] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  
  const addRole = () => {
    if (newRole && !roles.includes(newRole)) {
      onUpdate([...roles, newRole]);
      setNewRole("");
    }
  };

  const removeRole = (r: string) => {
    if (confirm("Remover esta função? Isso pode afetar escalas existentes.")) {
      onUpdate(roles.filter(role => role !== r));
    }
  };

  const toggleCollapse = (r: string) => {
      setCollapsed(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  const addMemberToRole = (role: string, name: string) => {
      if(!name) return;
      const current = members[role] || [];
      if(!current.includes(name)) {
          setMembers({...members, [role]: [...current, name]});
      }
  }

  const removeMember = (role: string, name: string) => {
      if(confirm(`Remover ${name} de ${role}?`)) {
          setMembers({...members, [role]: members[role].filter((x: string) => x !== name)});
      }
  }

  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title="Gerenciar Equipe e Funções" isPage={isPage}>
      <div className="space-y-6">
         {/* Add Role Section */}
         <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
             <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Adicionar Nova Função</h3>
             <div className="flex gap-2">
                <input 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value)} 
                    placeholder="Ex: Câmera, Som..." 
                    className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm"
                />
                <button onClick={addRole} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 font-medium text-sm">Adicionar</button>
            </div>
         </div>

         {/* Roles List */}
         <div className="space-y-4">
            {roles.map(r => (
                <div key={r} className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-3 flex justify-between items-center cursor-pointer" onClick={() => toggleCollapse(r)}>
                        <h4 className="font-bold text-zinc-700 dark:text-zinc-200">{r}</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{(members[r]||[]).length} membros</span>
                            <button onClick={(e) => { e.stopPropagation(); removeRole(r); }} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    
                    {!collapsed.includes(r) && (
                        <div className="p-3 bg-white dark:bg-zinc-900/50">
                            <ul className="space-y-2 mb-3">
                                {(members[r] || []).map((m: string) => (
                                    <li key={m} className="flex justify-between items-center text-sm bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-100 dark:border-zinc-700">
                                        <span className="text-zinc-700 dark:text-zinc-300">{m}</span>
                                        <button onClick={() => removeMember(r, m)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                    </li>
                                ))}
                            </ul>
                            <input 
                                placeholder="Adicionar membro..." 
                                className="w-full text-sm p-2 border border-zinc-300 dark:border-zinc-600 rounded bg-transparent"
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') {
                                        addMemberToRole(r, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            ))}
         </div>
      </div>
    </Wrapper>
  );
};

// --- Stats Modal ---
export const StatsModal = ({ isOpen, onClose, stats, monthName, isPage }: { isOpen: boolean; onClose?: () => void; stats: Record<string, number>; monthName: string; isPage?: boolean; }) => {
  
  const data = Object.entries(stats)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title={`Estatísticas - ${monthName}`} isPage={isPage}>
        <div className="space-y-6">
          {data.length > 0 ? (
            <div className="space-y-4">
               {data.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-3">
                     <div className="w-32 text-sm text-right truncate text-zinc-600 dark:text-zinc-400 font-medium" title={item.name}>{item.name}</div>
                     <div className="flex-1 h-8 bg-zinc-100 dark:bg-zinc-700/50 rounded-lg overflow-hidden relative">
                        <div 
                          className={`h-full flex items-center justify-end px-3 transition-all duration-1000 ease-out ${idx < 3 ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                          style={{ width: `${(item.count / maxVal) * 100}%` }}
                        >
                           <span className="text-xs text-white font-bold">{item.count}</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-500 py-20 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
               <ShieldAlert size={48} className="mb-4 opacity-20"/>
              Nenhuma escala preenchida ainda para gerar dados.
            </div>
          )}
        </div>
    </Wrapper>
  );
};

// --- Audit Log Modal ---
export const AuditModal = ({ isOpen, onClose, logs, isPage }: { isOpen: boolean; onClose?: () => void; logs: AuditLogEntry[]; isPage?: boolean; }) => {
  return (
    <Wrapper isOpen={isOpen} onClose={onClose} title="Histórico de Atividades" isPage={isPage}>
      <div className="space-y-3">
        {logs.length === 0 && <p className="text-zinc-500 text-sm italic">Nenhum registro.</p>}
        {logs.map((log, idx) => (
          <div key={idx} className="flex gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
             <div className="w-24 shrink-0 text-xs text-zinc-400 font-mono mt-0.5">{log.date.split(' ')[0]}<br/>{log.date.split(' ')[1]}</div>
             <div>
                <div className="font-bold text-blue-600 dark:text-blue-400 text-sm mb-1">{log.action}</div>
                <div className="text-sm text-zinc-700 dark:text-zinc-300">{log.details}</div>
             </div>
          </div>
        ))}
      </div>
    </Wrapper>
  );
};
