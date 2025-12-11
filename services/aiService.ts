
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
        You are an expert Ministry Scheduler. 
        Task: Assign members to events for Ministry: ${ministryId}.
        Required Roles to fill per event: ${JSON.stringify(roles)}.
        
        INPUT DATA FORMAT:
        - Events (e): {id: "ISO", d: day, h: hour}
        - Members (m): {n: name, r: [roles], d: [available_days]}
        
        AVAILABILITY RULES:
        - "d" array contains days user CAN serve.
        - format "5": All day. "5(M)": Morning only (<13h). "5(N)": Night only (>=13h).
        - If event hour < 13: User must have "D" or "D(M)". Reject "D(N)".
        - If event hour >= 13: User must have "D" or "D(N)". Reject "D(M)".
        - If day not listed, member is UNAVAILABLE. DO NOT ASSIGN.

        DISTRIBUTION RULES:
        - Distribute load evenly. Avoid same person 2 days in a row if possible.
        - For 'louvor' & role 'Vocal': assign 3 to 5 people per event (keys: _Vocal_1, _Vocal_2...).
        - For others: 1 person per role key.
        
        RETURN JSON:
        { "EventISO_Role": "MemberName" }
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', // Stronger reasoning for constraints
          contents: JSON.stringify(inputData),
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              temperature: 0.2, // Low temp for strict adherence to availability
          }
      });

      if (!response.text) throw new Error("A IA não retornou uma escala válida.");
      return JSON.parse(response.text);

    } catch (error: any) {
      console.error("AI Schedule Error:", error);
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
            contents: `Rewrite the following announcement text to be ${tonePrompt[tone]}. Keep the core information, improve clarity and grammar. Portuguese language.\n\nText: "${text}"`,
        });

        return response.text || text;
    } catch (e) {
        return text;
    }
};
