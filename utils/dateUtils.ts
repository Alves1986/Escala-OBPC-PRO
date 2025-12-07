
import { CustomEvent } from '../types';

export const getMonthName = (monthIso: string) => {
  if (!monthIso) return "";
  const [y, m] = monthIso.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  const name = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export const adjustMonth = (currentMonth: string, delta: number): string => {
  const [y, m] = currentMonth.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

export const generateMonthEvents = (year: number, month: number, customEvents: CustomEvent[]) => {
  const events: { iso: string; dateDisplay: string; title: string }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const addEvent = (date: Date, title: string, time: string) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${d}/${m}`;
    const iso = `${y}-${m}-${d}T${time}`;
    events.push({ iso, dateDisplay: dateStr, title });
  };

  // Standard Schedule Rules (from legacy code)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed

    if (dayOfWeek === 3) {
      addEvent(date, "Culto (Quarta)", "19:30");
    } else if (dayOfWeek === 0) {
      addEvent(date, "Culto (Domingo - Manhã)", "09:00");
      addEvent(date, "Culto (Domingo - Noite)", "18:00");
    }
  }

  // Santa Ceia (First Sunday) Override Logic could go here...

  // Custom Events
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  customEvents.forEach(evt => {
    if (evt.date.startsWith(monthStr)) {
       const [y, m, d] = evt.date.split('-').map(Number);
       const date = new Date(y, m - 1, d);
       addEvent(date, evt.title, evt.time);
    }
  });

  // Sort by ISO Date
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
};
