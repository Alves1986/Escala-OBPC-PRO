
import { GoogleGenAI } from "@google/genai";
import { AvailabilityMap, ScheduleMap, TeamMemberProfile } from "../types";

interface AIContext {
  events: { iso: string; title: string }[];
  members: TeamMemberProfile[];
  availability: AvailabilityMap;
  roles: string[];
  ministryId: string;
}

// Helper para converter data ISO e status em formato curto: "05", "05(M)", "05(N)"
const minifyAvailability = (isoDateString: string, contextMonthPrefix: string): string | null => {
  if (!isoDateString.startsWith(contextMonthPrefix)) return null;
  
  const [datePart, suffix] = isoDateString.split('_'); // '2023-10-05', 'M'
  const day = parseInt(datePart.split('-')[2], 10); // 5
  
  if (!suffix) return `${day}`;
  return `${day}(${suffix})`; // 5(M) ou 5(N)
};

const prepareMinifiedContext = (context: AIContext) => {
  // Assume que todos os eventos são do mesmo mês para otimização (padrão do app)
  const firstEvent = context.events[0];
  if (!firstEvent) return { events: [], members: [] };

  const monthPrefix = firstEvent.iso.slice(0, 7); // "YYYY-MM"

  // 1. Minificar Eventos: Envia apenas Dia, Hora e ID (ISO)
  const minifiedEvents = context.events.map(e => ({
    id: e.iso, // Chave necessária para resposta
    d: parseInt(e.iso.split('T')[0].split('-')[2], 10), // Dia
    h: parseInt(e.iso.split('T')[1].split(':')[0], 10)  // Hora (inteiro) para lógica M/N
  }));

  // 2. Minificar Membros
  const minifiedMembers = context.members
    // Filtro 1: Remove quem não tem nenhuma das roles solicitadas (economia de tokens)
    .filter(m => m.roles && m.roles.some(r => context.roles.includes(r)))
    .map(m => {
      // Simplifica Disponibilidade
      const rawAvail = context.availability[m.name] || [];
      const days = rawAvail
        .map(dateStr => minifyAvailability(dateStr, monthPrefix))
        .filter((d): d is string => d !== null);

      return {
        nome: m.name,
        funcoes: m.roles?.filter(r => context.roles.includes(r)) || [], // Apenas roles relevantes
        dias: days // Ex: ["1", "5(M)", "12", "20(N)"]
      };
    });

  return { 
    month: monthPrefix,
    e: minifiedEvents, 
    m: minifiedMembers 
  };
};

export const generateScheduleWithAI = async (context: AIContext): Promise<ScheduleMap | null> => {
    // Guidelines: The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    // Assume this variable is pre-configured, valid, and accessible.
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const { roles, ministryId } = context;

      // Prepara dados comprimidos
      const inputData = prepareMinifiedContext(context);

      if (inputData.e.length === 0 || inputData.m.length === 0) {
          throw new Error("Dados insuficientes para gerar escala (sem eventos ou membros qualificados).");
      }

      // Instrução de Sistema Otimizada (Token Efficient)
      const systemInstruction = `
        Role: Scheduler. Task: Assign members to events.
        Ministry: ${ministryId}. Required Roles: ${JSON.stringify(roles)}.
        
        RULES:
        1. Availability Format: "D" (All Day), "D(M)" (Morning only <13h), "D(N)" (Night only >=13h).
        2. Logic: 
           - Event Hour < 13: Accept "D" or "D(M)". Reject "D(N)".
           - Event Hour >= 13: Accept "D" or "D(N)". Reject "D(M)".
           - If day not listed, member is UNAVAILABLE.
        3. Constraints:
           - Member must have the specific role.
           - Balance distribution.
           - For 'louvor' & role 'Vocal', fill keys: "_Vocal_1", "_Vocal_2", etc. (min 3).
           - For others, use exact role key (e.g., "_Bateria").
        
        OUTPUT: JSON Object only.
        Key: "EventISO_Role" (Use original Event ISO from input).
        Value: "MemberName".
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: JSON.stringify(inputData), // Envia JSON minificado
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.2 // Baixa temperatura para seguir regras estritas
          }
      });

      const responseText = response.text;
      
      if (!responseText) {
          throw new Error("Resposta vazia da IA.");
      }

      const scheduleMap: ScheduleMap = JSON.parse(responseText);
      return scheduleMap;

    } catch (error: any) {
      console.error("AI Service Error:", error);
      let msg = error.message || "Erro na geração inteligente.";
      if (msg.includes("400") || msg.includes("API key")) msg = "Erro de autenticação com a IA.";
      throw new Error(msg);
    }
};
