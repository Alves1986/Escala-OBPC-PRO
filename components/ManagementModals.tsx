
import React, { useState, useEffect } from 'react';
import { CustomEvent, AvailabilityMap, AuditLogEntry, Role, TeamMemberProfile } from '../types';
import { X, Plus, Trash2, Calendar, ShieldAlert, Undo2, ArrowUp, ArrowDown, GripVertical, User, Check, Briefcase, Hash, History, Link, Copy, Loader2, Mail } from 'lucide-react';
import { useToast } from './Toast';
import { createInviteToken } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-xl">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Invite Modal ---
export const InviteModal = ({ isOpen, onClose, ministryId, orgId }: { isOpen: boolean; onClose: () => void; ministryId: string; orgId: string }) => {
    const [generatedLink, setGeneratedLink] = useState("");
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const { availableMinistries } = useAppStore();

    const currentMinistry = availableMinistries.find(m => m.id === ministryId);

    const handleGenerate = async () => {
        setLoading(true);
        const res = await createInviteToken(ministryId, orgId);
        setLoading(false);

        if (res.success && res.url) {
            setGeneratedLink(res.url);
            addToast("Link gerado com sucesso!", "success");
        } else {
            addToast(res.message || "Erro ao gerar convite.", "error");
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedLink);
        addToast("Link copiado para a área de transferência!", "success");
    };

    const reset = () => {
        setGeneratedLink("");
    };

    useEffect(() => {
        if (isOpen) reset();
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Convidar Novo Membro">
            <div className="space-y-6">
                {!generatedLink ? (
                    <>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/30 text-xs text-blue-700 dark:text-blue-300 flex gap-2">
                            <ShieldAlert size={16} className="shrink-0"/>
                            <p>O cadastro é feito via link. O novo membro será adicionado ao ministério <strong>{currentMinistry?.label || 'Selecionado'}</strong> e poderá escolher suas funções durante o cadastro.</p>
                        </div>
                        
                        <button 
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Link size={18}/>}
                            Gerar Link de Convite
                        </button>
                    </>
                ) : (
                    <div className="animate-fade-in space-y-4">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Check size={24}/>
                            </div>
                            <h3 className="font-bold text-zinc-800 dark:text-white">Convite Gerado!</h3>
                            <p className="text-xs text-zinc-500 mt-1">Qualquer pessoa com este link poderá se cadastrar neste ministério.</p>
                        </div>
                        
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                            <input 
                                readOnly 
                                value={generatedLink} 
                                className="flex-1 bg-transparent text-xs text-zinc-600 dark:text-zinc-300 font-mono outline-none"
                            />
                            <button onClick={handleCopy} className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 hover:text-blue-500 transition-colors">
                                <Copy size={16}/>
                            </button>
                        </div>

                        <button 
                            onClick={reset}
                            className="w-full text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white py-2"
                        >
                            Gerar Outro
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

// --- Custom Events Modal ---
export const EventsModal = ({ isOpen, onClose, events, onAdd, onRemove }: { 
  isOpen: boolean; onClose: () => void; events: CustomEvent[]; onAdd: (e: CustomEvent) => void; onRemove: (id: string) => void;
}) => {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:30");
  const [title, setTitle] = useState("");

  const handleAdd = () => {
    if (!date || !title) return;
    onAdd({ 
      id: Date.now().toString(), 
      date, 
      time, 
      title,
      iso: `${date}T${time}`
    });
    setTitle("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Eventos">
      <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm outline-none focus:border-blue-500" />
            <div className="flex gap-2">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-24 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm outline-none focus:border-blue-500" />
              <input type="text" placeholder="Nome do Evento" value={title} onChange={e => setTitle(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleAdd} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded text-sm flex items-center justify-center gap-2 transition-colors"><Plus size={16}/> Adicionar Evento</button>
          </div>
          <ul className="space-y-2">
            {events.length === 0 && <p className="text-center text-zinc-500 text-sm italic py-4">Nenhum evento extra cadastrado.</p>}
            {events.map(evt => (
              <li key={evt.id} className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                 <div>
                   <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{evt.title}</div>
                   <div className="text-xs text-zinc-500 flex items-center gap-1"><Calendar size={12}/> {evt.date.split('-').reverse().join('/')} às {evt.time}</div>
                 </div>
                 <button onClick={() => onRemove(evt.id)} className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
              </li>
            ))}
          </ul>
      </div>
    </Modal>
  );
};

// --- Availability Modal ---
export const AvailabilityModal = ({ isOpen, onClose, members, availability, onUpdate, currentMonth }: {
  isOpen: boolean; onClose: () => void; members: string[]; availability: AvailabilityMap; onUpdate: (m: string, dates: string[]) => void; currentMonth: string;
}) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

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
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Indisponibilidade">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert size={16} className="shrink-0 mt-0.5"/>
            <p>Use esta ferramenta para marcar dias em que um membro avisou antecipadamente que <strong>não poderá servir</strong>.</p>
        </div>

        <select 
          value={selectedMember} 
          onChange={e => setSelectedMember(e.target.value)}
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione o Membro...</option>
          {members.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {selectedMember && (
          <div className="animate-fade-in">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['D','S','T','Q','Q','S','S'].map((d, i) => <div key={i} className="text-center text-[10px] font-bold text-zinc-400">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                  const isUnavailable = (availability[selectedMember] || []).includes(dateStr);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDate(day)}
                      className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                        isUnavailable 
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/30' 
                          : 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// --- Roles Modal ---
export const RolesModal = ({ isOpen, onClose, roles, onUpdate }: {
  isOpen: boolean; onClose: () => void; roles: Role[]; onUpdate: (r: Role[]) => void;
}) => {
  const [newRole, setNewRole] = useState("");
  const { confirmAction } = useToast();
  
  const add = () => {
    if (newRole && !roles.includes(newRole)) {
      onUpdate([...roles, newRole]);
      setNewRole("");
    }
  };

  const remove = (r: string) => {
    confirmAction(
      "Remover Função",
      `Deseja realmente remover a função "${r}"? Isso removerá esta coluna da escala.`,
      () => onUpdate(roles.filter(role => role !== r))
    );
  };

  const moveRole = (index: number, direction: 'up' | 'down') => {
      const newRoles = [...roles];
      if (direction === 'up' && index > 0) {
          [newRoles[index], newRoles[index - 1]] = [newRoles[index - 1], newRoles[index]];
      } else if (direction === 'down' && index < newRoles.length - 1) {
          [newRoles[index], newRoles[index + 1]] = [newRoles[index + 1], newRoles[index]];
      }
      onUpdate(newRoles);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Funções">
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
            Adicione, remova ou reorganize as funções. A ordem aqui define a ordem das colunas na escala.
        </p>
        
        <div className="flex gap-2">
          <input 
            value={newRole} 
            onChange={e => setNewRole(e.target.value)} 
            placeholder="Nova Função (ex: Som)" 
            className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button onClick={add} disabled={!newRole} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"><Plus size={20}/></button>
        </div>

        <div className="space-y-2">
          {roles.map((r, index) => (
            <div key={r} className="flex justify-between items-center p-3 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm group">
              <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded text-zinc-400 cursor-grab active:cursor-grabbing">
                      <GripVertical size={16} />
                  </div>
                  <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{r}</span>
              </div>
              
              <div className="flex items-center gap-1">
                  <button 
                    onClick={() => moveRole(index, 'up')} 
                    disabled={index === 0}
                    className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                    title="Mover para cima"
                  >
                      <ArrowUp size={16}/>
                  </button>
                  <button 
                    onClick={() => moveRole(index, 'down')} 
                    disabled={index === roles.length - 1}
                    className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 transition-colors"
                    title="Mover para baixo"
                  >
                      <ArrowDown size={16}/>
                  </button>
                  
                  <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
                  
                  <button onClick={() => remove(r)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                      <Trash2 size={16}/>
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

// --- Edit Member Modal ---
export const EditMemberModal = ({ isOpen, onClose, member, availableRoles, onSave }: { 
    isOpen: boolean; 
    onClose: () => void; 
    member: TeamMemberProfile | null;
    availableRoles: string[];
    onSave: (id: string, data: { name: string, whatsapp: string, roles: string[] }) => void;
}) => {
    const [name, setName] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

    useEffect(() => {
        if (member) {
            setName(member.name);
            setWhatsapp(member.whatsapp || "");
            setSelectedRoles(member.roles || []);
        }
    }, [member]);

    const toggleRole = (role: string) => {
        if (selectedRoles.includes(role)) {
            setSelectedRoles(selectedRoles.filter(r => r !== role));
        } else {
            setSelectedRoles([...selectedRoles, role]);
        }
    };

    const handleSave = () => {
        if (member) {
            onSave(member.id, { name, whatsapp, roles: selectedRoles });
            onClose();
        }
    };

    if (!isOpen || !member) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Editar Membro">
            <div className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1 flex items-center gap-1"><User size={12}/> Nome Completo</label>
                    <input 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1 flex items-center gap-1"><Hash size={12}/> WhatsApp</label>
                    <input 
                        value={whatsapp} 
                        onChange={e => setWhatsapp(e.target.value)} 
                        placeholder="(00) 00000-0000"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2 ml-1 flex items-center gap-1"><Briefcase size={12}/> Funções (Cargos)</label>
                    <div className="flex flex-wrap gap-2">
                        {availableRoles.map(role => {
                            const isSelected = selectedRoles.includes(role);
                            return (
                                <button
                                    key={role}
                                    onClick={() => toggleRole(role)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                                        isSelected 
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                                    }`}
                                >
                                    {role}
                                    {isSelected && <Check size={12} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
                
                <div className="pt-2">
                    <button 
                        onClick={handleSave} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- Audit Log Modal ---
export const AuditModal = ({ isOpen, onClose, logs }: { isOpen: boolean; onClose: () => void; logs: AuditLogEntry[] }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Histórico de Atividades (Logs)">
      <div className="space-y-2">
        {logs.length === 0 && <p className="text-zinc-500 text-sm italic text-center py-8 flex flex-col items-center gap-2"><History size={24} className="opacity-20"/> Nenhum registro recente.</p>}
        {logs.map((log, idx) => (
          <div key={log.id || idx} className="text-xs p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-lg flex flex-col gap-1">
            <div className="flex justify-between items-center text-zinc-400">
              <span className="font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5"><User size={10}/> {log.author}</span>
              <span>{new Date(log.date).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[10px] bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{log.action}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300 font-medium mt-1 leading-relaxed border-l-2 border-zinc-200 dark:border-zinc-700 pl-2">{log.details}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
