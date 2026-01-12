
import { GoogleGenAI } from "@google/genai";

// FIX: Simplified Gemini Client initialization as per guidelines, directly using process.env.API_KEY.
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const polishAnnouncementAI = async (text: string, tone: 'professional' | 'exciting' | 'urgent'): Promise<string> => {
    try {
        const ai = getAiClient();
        const tonePrompt = {
            professional: "formal, claro e educado",
            exciting: "animado, usando emojis e engajador",
            urgent: "direto, sério e com senso de prioridade"
        };

        // FIX: Updated model name to 'gemini-3-flash-preview' for basic text tasks as per coding guidelines.
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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