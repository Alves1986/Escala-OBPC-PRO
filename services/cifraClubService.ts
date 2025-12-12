
import { GoogleGenAI, Type } from "@google/genai";

export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

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
  
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
};

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    const ai = getAiClient();
    if (!ai) {
        console.warn("AI Key missing for Cifra Club search");
        return [];
    }

    try {
        const prompt = `
            Atue como um motor de busca especializado no site Cifra Club (cifraclub.com.br).
            Para o termo de busca: "${query}", retorne os 5 melhores resultados de músicas.
            
            Retorne APENAS um JSON array. Não use markdown.
            Estrutura do objeto:
            - title: Nome da música
            - artist: Nome do artista/banda
            - url: URL completa do Cifra Club (ex: https://www.cifraclub.com.br/artista/musica/)
            - key: O tom provável da música (ex: G, Cm, A#) ou "N/A" se não souber.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            artist: { type: Type.STRING },
                            url: { type: Type.STRING },
                            key: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (error) {
        console.error("Error searching Cifra Club:", error);
        return [];
    }
};
