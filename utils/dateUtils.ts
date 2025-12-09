
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
  
  // Format target month string YYYY-MM to filter events
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  
  if (customEvents && customEvents.length > 0) {
      customEvents.forEach(evt => {
        // Ensure we only show events for the requested month
        if (evt.date.startsWith(monthStr)) {
           // Direct string manipulation to avoid Timezone bugs with new Date()
           // evt.date format is YYYY-MM-DD
           const parts = evt.date.split('-');
           if (parts.length === 3) {
               const [y, m, d] = parts;
               const dateDisplay = `${d}/${m}`;
               const iso = `${evt.date}T${evt.time}`;
               events.push({ iso, dateDisplay, title: evt.title });
           }
        }
      });
  }

  // Sort by ISO Date String directly
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
};
