
import { GoogleGenAI, Type } from "@google/genai";

export interface CifraClubResult {
    title: string;
    artist: string;
    url: string;
    key: string;
}

const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Cache simples para evitar chamadas repetitivas
const searchCache: Record<string, CifraClubResult[]> = {};
const matchCache: Record<string, CifraClubResult> = {};

export const searchCifraClub = async (query: string): Promise<CifraClubResult[]> => {
    const cacheKey = query.toLowerCase().trim();
    if (searchCache[cacheKey]) {
        return searchCache[cacheKey];
    }

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
            const results = JSON.parse(response.text);
            const keys = Object.keys(searchCache);
            if (keys.length > 20) delete searchCache[keys[0]];
            searchCache[cacheKey] = results; 
            return results;
        }
        return [];
    } catch (error) {
        console.error("Error searching Cifra Club:", error);
        return [];
    }
};

export const findBestMatchChord = async (songTitle: string): Promise<CifraClubResult | null> => {
    const cacheKey = songTitle.toLowerCase().trim();
    if (matchCache[cacheKey]) return matchCache[cacheKey];

    const ai = getAiClient();
    if (!ai) return null;

    try {
        const prompt = `
            Encontre a cifra exata no Cifra Club para a música: "${songTitle}".
            Remova termos como "Ao Vivo", "Live", "Official Video" para melhorar a busca.
            
            Retorne um JSON object único com o melhor resultado (mais popular/correto).
            Campos:
            - title: Nome da música
            - artist: Nome do artista
            - url: URL da cifra
            - key: O tom original da música (ex: C, F#, Bbm). Se não souber, chute o mais provável.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        artist: { type: Type.STRING },
                        url: { type: Type.STRING },
                        key: { type: Type.STRING }
                    }
                }
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            if (result && result.url) {
                matchCache[cacheKey] = result;
                return result;
            }
        }
        return null;
    } catch (error) {
        console.error("Error finding match chord:", error);
        return null;
    }
};
