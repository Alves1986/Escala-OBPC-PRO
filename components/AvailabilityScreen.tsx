import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User, TeamMemberProfile } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, Moon, Sun, Lock, FileText, Ban, RefreshCw, Check, ShieldAlert } from 'lucide-react';
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
  onSaveAvailability: (ministryId: string, memberId: string, dates: string[], notes: Record<string,string>, targetMonth: string) => Promise<void>;
  availabilityWindow?: { start?: string, end?: string };
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

  const [selectedMember, setSelectedMember] = useState("");
  const [tempDates, setTempDates] = useState<string[]>([]);
  const [generalNote, setGeneralNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const isBlockedMonth = tempDates.includes(`${currentMonth}-BLK`);

  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isWindowOpenForMembers = React.useMemo(() => {
    if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
    if (availabilityWindow.start?.includes("1970")) return false;
    const now = new Date();
    let start = new Date(0);
    let end = new Date(8640000000000000);
    if (availabilityWindow.start) start = new Date(availabilityWindow.start);
    if (availabilityWindow.end) end = new Date(availabilityWindow.end);
    return now >= start && now <= end;
  }, [availabilityWindow]);

  const canEdit = isAdmin || isWindowOpenForMembers;

  useEffect(() => {
    if (currentUser && !selectedMember) {
      if (allMembersList.includes(currentUser.name)) {
        setSelectedMember(currentUser.name);
      } else if (allMembersList.length > 0) {
        setSelectedMember(allMembersList[0]);
      }
    }
  }, [currentUser, allMembersList]);

  useEffect(() => {
    if (!selectedMember) return;

    const storedDates = availability[selectedMember] || [];
    const monthDates = storedDates.filter(d => d.startsWith(currentMonth));
    setTempDates(monthDates);

    const noteKey = `${selectedMember}_${currentMonth}-00`;
    setGeneralNote(availabilityNotes?.[noteKey] || "");

    setHasUnsavedChanges(false);
    setSaveSuccess(false);
  }, [selectedMember, currentMonth, availability, availabilityNotes]);

  const handleToggleBlockMonth = () => {
    if (!canEdit) return;
    setHasUnsavedChanges(true);
    setSaveSuccess(false);

    if (isBlockedMonth) setTempDates([]);
    else setTempDates([`${currentMonth}-BLK`]);
  };

  const handleToggleDate = (day: number) => {
    if (!canEdit) {
      addToast("O período de envio está fechado.", "warning");
      return;
    }

    setHasUnsavedChanges(true);
    setSaveSuccess(false);

    const dateBase = `${currentMonth}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;

    const full = dateBase;
    const morning = `${dateBase}_M`;
    const night = `${dateBase}_N`;

    let newDates = isBlockedMonth ? [] : [...tempDates];

    const hadFull = newDates.includes(full);
    const hadMorning = newDates.includes(morning);
    const hadNight = newDates.includes(night);

    newDates = newDates.filter(d => d.startsWith(dateBase) === false);

    if (isSunday) {
      if (!hadFull && !hadMorning && !hadNight) newDates.push(full);
      else if (hadFull) newDates.push(morning);
      else if (hadMorning) newDates.push(night);
    } else {
      if (!hadFull) newDates.push(full);
    }

    setTempDates(newDates);
  };

  const handleSave = async () => {
    if (!selectedMember) return;

    // resolve UUID
    const memberObj = members?.find(m => m.name === selectedMember);

    if (!memberObj?.id) {
      addToast("Erro: não foi possível identificar o membro. Tente atualizar a página.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const notesPayload: Record<string,string> = {};

      if (generalNote.trim()) {
        notesPayload[`${currentMonth}-00`] = generalNote.trim();
      }

      await onSaveAvailability(
        ministryId,
        memberObj.id,
        tempDates,
        notesPayload,
        currentMonth
      );

      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

    } catch (e: any) {
      console.error(e);
      addToast(`Erro ao salvar: ${e?.message || "desconhecido"}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const getDayStatus = (day: number) => {
    if (isBlockedMonth) return "blocked";
    const dateBase = `${currentMonth}-${String(day).padStart(2, "0")}`;
    if (tempDates.includes(dateBase)) return "full";
    if (tempDates.includes(`${dateBase}_M`)) return "morning";
    if (tempDates.includes(`${dateBase}_N`)) return "night";
    return "none";
  };

  const handleMonthNav = (dir: number) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("Há alterações não salvas. Descartar?")) return;
    }
    onMonthChange(adjustMonth(currentMonth, dir));
  };

  return (
    /* exatamente igual ao seu layout */
    <>
      {/* …todo o JSX permanece o mesmo que você já tinha… */}
    </>
  );
};
