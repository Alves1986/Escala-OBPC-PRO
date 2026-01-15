
import { EventRule, CalendarEvent } from './types';

export function generateEvents(
  rules: EventRule[],
  startStr: string, // YYYY-MM-DD
  endStr: string    // YYYY-MM-DD
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  // Normalização de datas para evitar problemas de fuso horário
  // Usamos meio-dia para garantir segurança em operações de dia
  const [ startY, startM, startD ] = startStr.split('-').map(Number);
  const [ endY, endM, endD ] = endStr.split('-').map(Number);
  
  const current = new Date(startY, startM - 1, startD, 12, 0, 0);
  const end = new Date(endY, endM - 1, endD, 12, 0, 0);

  // Iteração diária
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    const weekday = current.getDay();

    // Filtra regras ativas
    const activeRules = rules.filter(r => r.active);

    for (const rule of activeRules) {
      let match = false;

      if (rule.type === 'weekly') {
        // Regra semanal: bate o dia da semana?
        if (rule.weekday === weekday) {
          match = true;
        }
      } else if (rule.type === 'single') {
        // Regra pontual: bate a data exata?
        if (rule.date === dateString) {
          match = true;
        }
      }

      if (match) {
        // Geração do Evento
        // ID Determinístico garante estabilidade para o React
        const deterministicId = `${rule.id}_${dateString}`;
        
        events.push({
          id: deterministicId,
          ruleId: rule.id,
          title: rule.title,
          date: dateString,
          time: rule.time, // HH:mm
          iso: `${dateString}T${rule.time}`, // Local ISO format
          weekday: weekday
        });
      }
    }

    // Próximo dia
    current.setDate(current.getDate() + 1);
  }

  // Ordenação cronológica
  return events.sort((a, b) => a.iso.localeCompare(b.iso));
}
