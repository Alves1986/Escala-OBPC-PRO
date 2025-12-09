
import { GoogleGenAI } from "@google/genai";
import { AvailabilityMap, ScheduleMap, TeamMemberProfile } from "../types";

interface AIContext {
  events: { iso: string; title: string }[];
  members: TeamMemberProfile[];
  availability: AvailabilityMap;
  roles: string[];
  ministryId: string;
}

export const generateScheduleWithAI = async (context: AIContext): Promise<ScheduleMap | null> => {
    // Acesso direto para garantir que o Vite faça a substituição estática corretamente
    // @ts-ignore (Ignora erro de tipagem caso o ambiente não tenha types do vite configurados)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Chave de API (VITE_GEMINI_API_KEY) não encontrada. Verifique suas variáveis de ambiente.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const { events, members, availability, roles, ministryId } = context;

      // Prepara os dados de forma concisa para economizar tokens
      const simplifiedMembers = members.map(m => ({
        name: m.name,
        roles: m.roles || [],
        // Envia apenas as datas relevantes para o contexto atual para reduzir tamanho do prompt
        availability: availability[m.name] || [] 
      }));

      const systemInstruction = `
        Você é um assistente especialista em gestão de escalas de voluntários para igrejas.
        Sua tarefa é preencher uma escala (ScheduleMap) cruzando eventos, membros qualificados e disponibilidade.

        REGRAS RÍGIDAS DE DISPONIBILIDADE:
        1. O formato da disponibilidade é: "YYYY-MM-DD" (Dia todo), "YYYY-MM-DD_M" (Apenas Manhã), "YYYY-MM-DD_N" (Apenas Noite).
        2. Analise a hora do evento (ISO String):
           - Evento < 13:00 (Manhã): O membro PRECISA ter "YYYY-MM-DD" OU "YYYY-MM-DD_M". Se tiver "YYYY-MM-DD_N", é INDISPONÍVEL.
           - Evento >= 13:00 (Noite): O membro PRECISA ter "YYYY-MM-DD" OU "YYYY-MM-DD_N". Se tiver "YYYY-MM-DD_M", é INDISPONÍVEL.
        3. Se o membro não tiver a data na lista, é INDISPONÍVEL.
        4. JAMAIS escale alguém indisponível.

        REGRAS DE PREENCHIMENTO:
        1. Balanceamento de Carga: Distribua a escala igualmente. Evite escalar a mesma pessoa repetidamente se houver opções. Líderes e Admins também entram na escala.
        2. Respeito à Função: Só escale um membro se a função (role) estiver na lista dele.
        3. Vagas Vazias: Tente preencher todos os espaços vazios possíveis com quem estiver disponível.

        REGRA ESPECIAL DE 'VOCAL' (Apenas se ministério for 'louvor'):
        - Se a função solicitada for 'Vocal', você deve preencher múltiplas vagas.
        - Chaves esperadas: "_Vocal_1", "_Vocal_2", "_Vocal_3", "_Vocal_4", "_Vocal_5".
        - Tente preencher pelo menos 3 vocais se houver disponibilidade.
        - Para outros ministérios, use a role exata (ex: "_Câmera").

        FORMATO DE SAÍDA (JSON PURO):
        Retorne APENAS um objeto JSON válido.
        Chave: "YYYY-MM-DDTHH:mm_Role" (Ex: "2023-10-01T19:30_Bateria" ou "2023-10-01T19:30_Vocal_1")
        Valor: "Nome do Membro"
      `;

      const prompt = JSON.stringify({
        ministryContext: ministryId,
        eventsToFill: events,
        requiredRoles: roles,
        teamMembers: simplifiedMembers
      });

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json"
          }
      });

      const responseText = response.text;
      
      if (!responseText) {
          throw new Error("A IA retornou uma resposta vazia.");
      }

      const scheduleMap: ScheduleMap = JSON.parse(responseText);
      return scheduleMap;

    } catch (error: any) {
      console.error("Erro detalhado ao gerar escala com IA:", error);
      let msg = error.message || "Erro desconhecido na geração da escala.";
      
      if (msg.includes("Failed to fetch")) {
          msg = "Erro de conexão (Failed to fetch). Verifique sua internet, se a API Key é válida ou se há bloqueadores de anúncio interferindo.";
      }
      
      // Propaga o erro original para ser exibido no Toast
      throw new Error(msg);
    }
};
