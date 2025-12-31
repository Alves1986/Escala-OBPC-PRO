import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User, TeamMemberProfile } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { 
  ChevronLeft, ChevronRight, Save, CheckCircle2, Moon, Sun, 
  Lock, FileText, Ban, RefreshCw, Check, ShieldAlert 
} from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes: AvailabilityNotesMap;
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityMap>>;
  allMembersList: string[];
  members?: TeamMemberProfile[];
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  currentUser: User | null;
  onSaveAvailability: (
    ministryId: string,
    memberId: string,
    dates: string[],
    notes: Record<string, string>,
    targetMonth: string
  ) => Promise<void>;
  availabilityWindow?: { start?: string; end?: string };
  ministryId: string;
}

export const AvailabilityScreen: React.FC<Props> = ({
  availability,
  availabilityNotes,
  allMembersList,
  members,
  currentMonth,
  onMonthChange,
  currentUser,
  onSaveAvailability,
  availabilityWindow,
  ministryId
}) => {
  const { addToast } = useToast();

  const [selectedMember, setSelectedMember] = useState<string>('');
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Resolve membro real
  const memberObj = members?.find(m => m.name === selectedMember);
  const memberId = memberObj?.id || '';

  const isWindowOpenForMembers = React.useMemo(() => {
    if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
    if (availabilityWindow.start?.includes('1970')) return false;

    const now = new Date();
    let start = new Date(0);
    let end = new Date(8640000000000000);

    if (availabilityWindow.start) start = new Date(availabilityWindow.start);
    if (availabilityWindow.end) end = new Date(availabilityWindow.end);

    return now >= start && now <= end;
  }, [availabilityWindow]);

  const canEdit = isAdmin || isWindowOpenForMembers;

  // Seleciona membro padrão
  useEffect(() => {
    if (currentUser && !selectedMember) {
      if (allMembersList.includes(currentUser.name)) {
        setSelectedMember(currentUser.name);
      } else if (allMembersList.length > 0) {
        setSelectedMember(allMembersList[0]);
      }
    }
  }, [currentUser, allMembersList]);

  // Carrega disponibilidade usando UUID
  useEffect(() => {
    if (!memberId) return;

    const storedDates = availability[memberId] || [];
    const monthDates = storedDates.filter(d => d.startsWith(currentMonth));
    setTempDates(monthDates);

    const noteKey = `${memberId}_${currentMonth}-00`;
    setGeneralNote(availabilityNotes?.[noteKey] || '');

    setHasUnsavedChanges(false);
    setSaveSuccess(false);
  }, [memberId, currentMonth, availability, availabilityNotes]);

  const isBlockedMonth = tempDates.includes(`${currentMonth}-BLK`);

  const handleToggleBlockMonth = () => {
    if (!canEdit) return;
    setHasUnsavedChanges(true);
    setSaveSuccess(false);
    setTempDates(isBlockedMonth ? [] : [`${currentMonth}-BLK`]);
  };

  const handleToggleDate = (day: number) => {
    if (!canEdit) return;

    setHasUnsavedChanges(true);
    setSaveSuccess(false);

    const base = `${currentMonth}-${String(day).padStart(2, '0')}`;
    let newDates = isBlockedMonth ? [] : [...tempDates];

    newDates = newDates.filter(d => d.startsWith(base) === false);
    newDates.push(base);

    setTempDates(newDates);
  };

  const handleSave = async () => {
    if (!memberId) {
      addToast('Erro: membro inválido.', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const notesPayload: Record<string, string> = {};
      if (generalNote.trim()) {
        notesPayload[`${currentMonth}-00`] = generalNote.trim();
      }

      await onSaveAvailability(ministryId, memberId, tempDates, notesPayload, currentMonth);

      setHasUnsavedChanges(false);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      addToast(`Erro ao salvar: ${e?.message || 'desconhecido'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMonthNav = (dir: number) => {
    if (hasUnsavedChanges && !window.confirm('Há alterações não salvas. Descartar?')) return;
    onMonthChange(adjustMonth(currentMonth, dir));
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto pb-32">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" /> Minha Disponibilidade
          </h2>
          <p className="text-xs md:text-sm mt-1">
            Toque nos dias para marcar.
          </p>
        </div>

        {isAdmin && (
          <select
            value={selectedMember}
            onChange={(e) => {
              if (hasUnsavedChanges && !confirm('Descartar alterações?')) return;
              setSelectedMember(e.target.value);
            }}
            className="border rounded-lg py-1.5 px-3 text-sm"
          >
            {allMembersList.map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => handleMonthNav(-1)}><ChevronLeft /></button>
          <span>{getMonthName(currentMonth)}</span>
          <button onClick={() => handleMonthNav(1)}><ChevronRight /></button>
        </div>
      </div>

      <button onClick={handleToggleBlockMonth} className="w-full border rounded-xl py-2">
        {isBlockedMonth ? 'Liberar mês' : 'Bloquear mês inteiro'}
      </button>

      <div className="grid grid-cols-7 gap-2">
        {blanks.map((_, i) => <div key={i} />)}

        {days.map(day => {
          const base = `${currentMonth}-${String(day).padStart(2, '0')}`;
          const active = tempDates.includes(base);

          return (
            <button
              key={day}
              onClick={() => handleToggleDate(day)}
              className={`p-3 border rounded-xl text-sm ${active ? 'bg-emerald-500 text-white' : ''}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <textarea
        value={generalNote}
        onChange={e => {
          setGeneralNote(e.target.value);
          setHasUnsavedChanges(true);
        }}
        placeholder="Observações..."
        className="w-full border rounded-xl p-3"
      />

      {hasUnsavedChanges && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      )}
    </div>
  );
};
