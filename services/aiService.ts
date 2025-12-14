
import { GoogleGenAI, Type } from "@google/genai";
import { AvailabilityMap, ScheduleMap, TeamMemberProfile, AvailabilityNotesMap } from "../types";

// Initialize Gemini Client
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

interface AIContext {
  events: { iso: string; title: string }[];
  members: TeamMemberProfile[];
  availability: AvailabilityMap;
  availabilityNotes?: AvailabilityNotesMap;
  roles: string[];
  ministryId: string;
}

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
      
      // Critical check for NEW Block Tag (Updated to _BLK)
      // If found, this member is forcefully unavailable for the whole month
      const isBlocked = rawAvail.some(d => d.startsWith(monthPrefix) && (d.includes('BLK') || d.includes('BLOCKED')));
      
      if (isBlocked) {
          return {
              n: m.name,
              r: m.roles?.filter(r => context.roles.includes(r)) || [],
              d: [], // Empty days array signals 0 availability to AI
              nt: { "0": "User requested BLOCK MONTH" }
          };
      }

      const days = rawAvail
        .filter(d => d.startsWith(monthPrefix))
        .map(d => {
            const [date, suffix] = d.split('_');
            const day = parseInt(date.split('-')[2], 10);
            return { day, suffix };
        })
        .filter(x => x.day > 0 && x.day <= 31) // Exclude markers 00 and 99
        .map(x => x.suffix ? `${x.day}(${x.suffix})` : `${x.day}`);

      // Extract notes for this member for this month
      const notes: Record<string, string> = {};
      if (context.availabilityNotes) {
          Object.entries(context.availabilityNotes).forEach(([key, note]) => {
             // key is "Name_YYYY-MM-DD"
             if (key.startsWith(`${m.name}_`)) {
                 const datePart = key.substring(m.name.length + 1); // YYYY-MM-DD
                 if (datePart.startsWith(monthPrefix)) {
                     const day = parseInt(datePart.split('-')[2], 10);
                     notes[day] = note;
                 }
             }
          });
      }

      return {
        n: m.name,
        r: m.roles?.filter(r => context.roles.includes(r)) || [],
        d: days,
        nt: Object.keys(notes).length > 0 ? notes : undefined
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
        
        GOAL: Create a fair schedule based strictly on availability and notes.
        
        INPUT DATA:
        - Events (e): {id: "ISO_Date", d: day_number, h: hour_of_day}
        - Members (m): {n: name, r: [roles], d: [available_days], nt: {day: "note"}}
        - Required Roles: ${JSON.stringify(roles)}

        AVAILABILITY CODES (d):
        - "5": Available ALL day.
        - "5(M)": Available ONLY Morning (h < 13).
        - "5(N)": Available ONLY Night (h >= 13).
        - empty list []: NOT AVAILABLE AT ALL. DO NOT SCHEDULE.
        
        RULES:
        0. **STRICT EVENTS**: Schedule ONLY for provided Event IDs.
        1. **ONE ROLE PER DAY**: A member takes max 1 slot per day.
        2. **AVAILABILITY**: Respect (M)/(N) constraints vs event hour (h). If 'd' is empty, NEVER schedule.
        3. **NOTES (nt)**: 
           - If 'nt' exists for a day, READ IT.
           - If note says "Prefer [Role]", prioritize assignment to that role.
           - If note says "Chego as 20h" (late arrival) and event is 19:30, try to avoid or assign a role that allows it.
           - Notes are high priority hints.
        4. **FAIRNESS**: Distribute load. Prioritize those with fewer available days to ensure they get a spot.

        OUTPUT (JSON): { "EventISO_RoleName": "MemberName" }
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: JSON.stringify(inputData),
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.0, // Zero temperature for deterministic output and strict rule adherence
          }
      });

      if (!response.text) throw new Error("A IA não retornou uma escala válida.");
      const rawSchedule = JSON.parse(response.text);

      const filteredSchedule: ScheduleMap = {};
      const validEventIds = new Set(inputData.e.map(evt => evt.id));

      Object.entries(rawSchedule).forEach(([key, value]) => {
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
