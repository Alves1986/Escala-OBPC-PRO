import { GoogleGenAI, Type } from "@google/genai";
import { AvailabilityMap, ScheduleMap, TeamMemberProfile, AvailabilityNotesMap } from "../types";

// Initialize Gemini Client Lazily with robust env check
const getAiClient = () => {
  let key = '';
  try {
      // @ts-ignore
      if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
          // @ts-ignore
          key = import.meta.env.VITE_GEMINI_API_KEY;
      }
  } catch(e) {}

  if (!key && typeof process !== 'undefined' && process.env) {
      key = process.env.API_KEY || '';
  }

  if (!key) {
    console.warn("API Key do Gemini não encontrada.");
    throw new Error("Chave de API da Inteligência Artificial não configurada. Verifique o arquivo .env.");
  }
  // Initialize with named parameter
  return new GoogleGenAI({ apiKey: key });
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
      
      const isBlocked = rawAvail.some(d => d.startsWith(monthPrefix) && (d.includes('BLK') || d.includes('BLOCKED')));
      
      if (isBlocked) {
          return {
              n: m.name,
              r: m.roles?.filter(r => context.roles.includes(r)) || [],
              d: [], 
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
        .filter(x => x.day > 0 && x.day <= 31) 
        .map(x => x.suffix ? `${x.day}(${x.suffix})` : `${x.day}`);

      const notes: Record<string, string> = {};
      if (context.availabilityNotes) {
          Object.entries(context.availabilityNotes).forEach(([key, note]) => {
             if (key.startsWith(`${m.name}_`)) {
                 const datePart = key.substring(m.name.length + 1); 
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

const cleanAiResponse = (text: string) => {
    return text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
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
        Required Roles: ${JSON.stringify(roles)}
        OUTPUT (JSON): { "EventISO_RoleName": "MemberName" }
      `;

      // Use gemini-3-pro-preview for complex reasoning task
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: JSON.stringify(inputData),
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.0, 
          }
      });

      // Fixed: response.text is a property
      if (!response.text) throw new Error("A IA não retornou uma escala válida.");
      
      const cleanJson = cleanAiResponse(response.text);
      const rawSchedule = JSON.parse(cleanJson);

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
      throw new Error("Falha na geração inteligente. Verifique os dados e tente novamente.");
    }
};

export const suggestRepertoireAI = async (theme: string, style: string = "Contemporary"): Promise<{title: string, artist: string, reason: string}[]> => {
    try {
        const ai = getAiClient();
        // Use gemini-3-flash-preview for basic text task
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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

        // Fixed: response.text is a property
        if (!response.text) return [];
        return JSON.parse(cleanAiResponse(response.text));
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

        // Use gemini-3-flash-preview for proofreading task
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Act as a professional copywriter. Rewrite the announcement text below to be ${tonePrompt[tone]}. 
                STRICT RULES: Return ONLY the rewritten text. NO conversational filler. ONE single best version. Language: Portuguese.
                Original Text: "${text}"
            `,
        });

        // Fixed: response.text is a property
        return response.text ? response.text.trim() : text;
    } catch (e) {
        return text;
    }
};
