
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
  // Safely calculate new month by setting day to 1
  const date = new Date(y, m - 1 + delta, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

export const generateMonthEvents = (year: number, month: number, customEvents: CustomEvent[]) => {
  const events: { iso: string; dateDisplay: string; title: string }[] = [];
  
  // Helper to add event
  const addEvent = (date: Date, title: string, time: string) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${d}/${m}`;
    const iso = `${y}-${m}-${d}T${time}`;
    events.push({ iso, dateDisplay: dateStr, title });
  };

  // REMOVIDO: Lógica antiga que gerava Quartas e Domingos automaticamente via código.
  // AGORA: O sistema confia 100% nos eventos passados via 'customEvents' (que vêm do banco de dados).
  // Isso resolve o problema de duplicidade visual (um evento do código + um evento do banco).

  // Process Database Events (passed as customEvents)
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  if (customEvents && customEvents.length > 0) {
      customEvents.forEach(evt => {
        // Ensure we only show events for the requested month to avoid border leakage
        if (evt.date.startsWith(monthStr)) {
           const [y, m, d] = evt.date.split('-').map(Number);
           const date = new Date(y, m - 1, d);
           addEvent(date, evt.title, evt.time);
        }
      });
  }

  // Sort by ISO Date
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
};
