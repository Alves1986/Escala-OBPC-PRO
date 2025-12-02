
import React, { useState } from 'react';
import { CustomEvent, AvailabilityMap, AuditLogEntry, Role } from '../types';
import { X, Plus, Trash2, Calendar, ShieldAlert, Undo2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Custom Events Modal ---
export const EventsModal = ({ isOpen, onClose, events, hiddenEvents, onAdd, onRemove, onRestore }: { 
  isOpen: boolean; onClose: () => void; events: CustomEvent[]; hiddenEvents: { iso: string, title: string, dateDisplay: string }[]; onAdd: (e: CustomEvent) => void; onRemove: (id: string) => void; onRestore: (iso: string) => void;
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
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Eventos">
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
          <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
            <div className="flex gap-2">
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-24 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
              <input type="text" placeholder="Nome do Evento" value={title} onChange={e => setTitle(e.target.value)} className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded p-2 text-sm" />
            </div>
            <button onClick={handleAdd} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded text-sm flex items-center justify-center gap-2"><Plus size={16}/> Adicionar Evento</button>
          </div>
          <ul className="space-y-2">
            {events.length === 0 && <p className="text-center text-zinc-500 text-sm italic">Nenhum evento extra.</p>}
            {events.map(evt => (
              <li key={evt.id} className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                 <div>
                   <div className="font-semibold text-sm">{evt.title}</div>
                   <div className="text-xs text-zinc-500">{evt.date.split('-').reverse().join('/')} às {evt.time}</div>
                 </div>
                 <button onClick={() => onRemove(evt.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'hidden' && (
        <div className="space-y-2">
          {hiddenEvents.length === 0 && <p className="text-center text-zinc-500 text-sm italic">Nenhum evento oculto para este mês.</p>}
          {hiddenEvents.map(evt => (
            <li key={evt.iso} className="flex justify-between items-center bg-zinc-100 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700">
               <div>
                 <div className="font-semibold text-sm">{evt.title}</div>
                 <div className="text-xs text-zinc-500">{evt.dateDisplay}</div>
               </div>
               <button onClick={() => onRestore(evt.iso)} className="text-blue-500 hover:text-blue-700 p-1" title="Restaurar">
                 <Undo2 size={16}/>
               </button>
            </li>
          ))}
        </div>
      )}
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
        <select 
          value={selectedMember} 
          onChange={e => setSelectedMember(e.target.value)}
          className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2"
        >
          <option value="">Selecione o Membro...</option>
          {members.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {selectedMember && (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
              const isUnavailable = (availability[selectedMember] || []).includes(dateStr);
              return (
                <button
                  key={day}
                  onClick={() => toggleDate(day)}
                  className={`aspect-square flex items-center justify-center rounded text-sm font-medium transition-colors ${
                    isUnavailable 
                      ? 'bg-red-500 text-white' 
                      : 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-zinc-500 text-center">Clique nos dias que o membro NÃO pode servir.</p>
      </div>
    </Modal>
  );
};

// --- Roles Modal ---
export const RolesModal = ({ isOpen, onClose, roles, onUpdate }: {
  isOpen: boolean; onClose: () => void; roles: Role[]; onUpdate: (r: Role[]) => void;
}) => {
  const [newRole, setNewRole] = useState("");
  
  const add = () => {
    if (newRole && !roles.includes(newRole)) {
      onUpdate([...roles, newRole]);
      setNewRole("");
    }
  };

  const remove = (r: string) => {
    if (confirm("Remover esta função? Isso pode afetar escalas existentes.")) {
      onUpdate(roles.filter(role => role !== r));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Funções">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input 
            value={newRole} 
            onChange={e => setNewRole(e.target.value)} 
            placeholder="Nova Função (ex: Som)" 
            className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-sm"
          />
          <button onClick={add} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700"><Plus/></button>
        </div>
        <ul className="space-y-1">
          {roles.map(r => (
            <li key={r} className="flex justify-between items-center p-2 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
              <span>{r}</span>
              <button onClick={() => remove(r)} className="text-red-500 hover:text-red-600"><Trash2 size={16}/></button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};

// --- Audit Log Modal ---
export const AuditModal = ({ isOpen, onClose, logs }: { isOpen: boolean; onClose: () => void; logs: AuditLogEntry[] }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Histórico de Atividades (Logs)">
      <div className="space-y-2">
        {logs.length === 0 && <p className="text-zinc-500 text-sm">Nenhum registro.</p>}
        {logs.map((log, idx) => (
          <div key={idx} className="text-xs p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded">
            <div className="flex justify-between text-zinc-400 mb-1">
              <span>{log.date}</span>
              <span className="font-bold text-blue-500">{log.action}</span>
            </div>
            <div className="text-zinc-700 dark:text-zinc-300">{log.details}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
};
