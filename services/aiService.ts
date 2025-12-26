
import { GoogleGenAI } from "@google/genai";

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
  return new GoogleGenAI({ apiKey: key });
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
                2. NO conversational filler.
                3. Provide ONE single best version.
                4. Language: Portuguese.

                Original Text: "${text}"
            `,
        });

        return response.text ? response.text.trim() : text;
    } catch (e) {
        return text;
    }
};
