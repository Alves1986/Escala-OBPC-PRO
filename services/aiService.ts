
import { GoogleGenAI, Type } from "@google/genai";
import { AvailabilityMap, ScheduleMap, TeamMemberProfile } from "../types";

// Initialize Gemini Client Lazily
// Isso previne que o app quebre (Tela Branca) se a chave não estiver configurada no carregamento
const getAiClient = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.warn("API Key do Gemini não encontrada. Verifique VITE_GEMINI_API_KEY.");
    throw new Error("Chave de API não configurada.");
  }
  return new GoogleGenAI({ apiKey: key });
};

interface AIContext {
  events: { iso: string; title: string }[];
  members: TeamMemberProfile[];
  availability: AvailabilityMap;
  roles: string[];
  ministryId: string;
}

// Helper to minify data context for the AI to save tokens
const prepareMinifiedContext = (context: AIContext) => {
  const firstEvent = context.events[0];
  if (!firstEvent) return { events: [], members: [] };

  const monthPrefix = firstEvent.iso.slice(0, 7);

  const minifiedEvents = context.events.map(e => ({
    id: e.iso,
    d: parseInt(e.iso.split('T')[0].split('-')[2], 10),
    h: parseInt(e.iso.split('T')[1].split(':')[0], 10)
  }));

  const minifiedMembers = context.members
    .filter(m => m.roles && m.roles.some(r => context.roles.includes(r)))
    .map(m => {
      const rawAvail = context.availability[m.name] || [];
      
      // Critical check: if any date in this month is marked as 'BLOCKED', clear the schedule for this member
      const isBlocked = rawAvail.some(d => d.startsWith(monthPrefix) && d.includes('BLOCKED'));
      
      if (isBlocked) {
          return {
              n: m.name,
              r: m.roles?.filter(r => context.roles.includes(r)) || [],
              d: [] // Empty days means completely unavailable for AI
          };
      }

      const days = rawAvail
        .filter(d => d.startsWith(monthPrefix))
        .map(d => {
            const [date, suffix] = d.split('_');
            const day = parseInt(date.split('-')[2], 10);
            return suffix ? `${day}(${suffix})` : `${day}`;
        });

      return {
        n: m.name,
        r: m.roles?.filter(r => context.roles.includes(r)) || [],
        d: days 
      };
    });

  return { 
    month: monthPrefix,
    e: minifiedEvents, 
    m: minifiedMembers 
  };
};

export const generateScheduleWithAI = async (context: AIContext): Promise<ScheduleMap> => {
    try {
      const ai = getAiClient();
      const { roles, ministryId } = context;
      const inputData = prepareMinifiedContext(context);

      if (inputData.e.length === 0 || inputData.m.length === 0) {
          throw new Error("Dados insuficientes (eventos ou membros) para gerar escala.");
      }

      const systemInstruction = `
        You are an expert Ministry Scheduler for "${ministryId}".
        
        GOAL: Create a fair schedule based strictly on availability.
        
        INPUT DATA:
        - Events (e): {id: "ISO_Date", d: day_number, h: hour_of_day}
        - Members (m): {n: name, r: [roles], d: [available_days]}
        - Required Roles: ${JSON.stringify(roles)}

        AVAILABILITY CODES in Member Data (d):
        - "5": Available ALL day on the 5th.
        - "5(M)": Available ONLY Morning (events where h < 13).
        - "5(N)": Available ONLY Night (events where h >= 13).
        
        CRITICAL RULES (MUST FOLLOW OR FAIL):

        0. **STRICT IMMUTABLE EVENTS**:
           - Use ONLY the Event IDs provided in "Events (e)".
           - DO NOT create new events. DO NOT invent dates, times, or shift existing times.
           - If a specific date/time is not in the "Events (e)" list, DO NOT schedule anyone for it.
           - Output keys MUST start with one of the provided Event IDs.
        
        1. **ONE ROLE PER DAY (HARD CONSTRAINT)**: 
           - A member CANNOT appear more than ONCE per calendar day (d).
           - Even if they are available all day, DO NOT assign them to both Morning and Night services.
           - DO NOT assign the same person to 2 different roles in the same event.
           - Example: If John is "Camera" on Day 5, he CANNOT be "Sound" on Day 5.

        2. **AVAILABILITY CHECK**: 
           - Member MUST have the day listed in their 'd' array.
           - If event is Morning (h<13), member must have "X" or "X(M)". Reject "X(N)".
           - If event is Night (h>=13), member must have "X" or "X(N)". Reject "X(M)".
        
        3. **SCARCITY PRIORITY**:
           - Count how many available days each member has.
           - Assign members with FEW available days (1 or 2) FIRST.
           - Members with wide availability (4+ days) should fill the remaining gaps.

        4. **MISSING PEOPLE**:
           - If NO ONE matches the criteria for a slot, return "" (empty string). DO NOT force an unavailable person.

        OUTPUT FORMAT (JSON Only):
        { 
          "EventISO_RoleName": "MemberName",
          "EventISO_RoleName2": "" (if empty)
        }
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: JSON.stringify(inputData),
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.0, // Zero temperature for deterministic output and strict rule adherence
          }
      });

      if (!response.text) throw new Error("A IA não retornou uma escala válida.");
      const rawSchedule = JSON.parse(response.text);

      // SAFETY FILTER: Ensure AI didn't hallucinate events
      const filteredSchedule: ScheduleMap = {};
      const validEventIds = new Set(inputData.e.map(evt => evt.id));

      Object.entries(rawSchedule).forEach(([key, value]) => {
          // Check if key starts with a valid event ID
          const isValidEvent = Array.from(validEventIds).some(validId => key.startsWith(validId));
          if (isValidEvent) {
              filteredSchedule[key] = value as string;
          }
      });

      return filteredSchedule;

    } catch (error: any) {
      console.error("AI Schedule Error:", error);
      if (error.message?.includes("429") || error.message?.includes("Quota")) {
          throw new Error("Limite da IA excedido. Aguarde alguns instantes e tente novamente.");
      }
      throw new Error(error.message || "Falha na geração inteligente.");
    }
};

export const suggestRepertoireAI = async (theme: string, style: string = "Contemporary"): Promise<{title: string, artist: string, reason: string}[]> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Suggest 5 christian worship songs for the theme: "${theme}". Style: ${style}. Return JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            artist: { type: Type.STRING },
                            reason: { type: Type.STRING, description: "Brief reason why it fits the theme in Portuguese" }
                        }
                    }
                }
            }
        });

        if (!response.text) return [];
        return JSON.parse(response.text);
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const polishAnnouncementAI = async (text: string, tone: 'professional' | 'exciting' | 'urgent'): Promise<string> => {
    try {
        const ai = getAiClient();
        const tonePrompt = {
            professional: "formal, claro e educado",
            exciting: "animado, usando emojis e engajador",
            urgent: "direto, sério e com senso de prioridade"
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `
                Act as a professional copywriter. Rewrite the announcement text below to be ${tonePrompt[tone]}. 
                
                STRICT RULES:
                1. Return ONLY the rewritten text.
                2. NO conversational filler (e.g., "Here is your text", "Sure!").
                3. Provide ONE single best version.
                4. Language: Portuguese.
                5. Keep emojis relevant but professional.

                Original Text: "${text}"
            `,
        });

        return response.text ? response.text.trim() : text;
    } catch (e) {
        return text;
    }
};
