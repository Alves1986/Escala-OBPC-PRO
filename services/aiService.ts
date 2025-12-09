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
    // @ts-ignore
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Chave de API (VITE_GEMINI_API_KEY) não encontrada.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const { events, members, availability, roles, ministryId } = context;

      // Prepara os dados de forma concisa
      const simplifiedMembers = members.map(m => ({
        name: m.name,
        roles: m.roles || [],
        availability: availability[m.name] || [] 
      }));

      // --- AJUSTE AQUI: Novas regras inseridas no Prompt ---
      const systemInstruction = `
        Você é um assistente especialista em gestão de escalas de voluntários para igrejas.
        Sua tarefa é preencher uma escala (ScheduleMap) cruzando eventos, membros qualificados e disponibilidade.

        REGRAS RÍGIDAS DE DISPONIBILIDADE:
        1. Formato: "YYYY-MM-DD" (Dia todo), "YYYY-MM-DD_M" (Manhã), "YYYY-MM-DD_N" (Noite).
        2. Hora do Evento:
           - < 13:00 (Manhã): Exige "YYYY-MM-DD" OU "YYYY-MM-DD_M". ("_N" é inválido).
           - >= 13:00 (Noite): Exige "YYYY-MM-DD" OU "YYYY-MM-DD_N". ("_M" é inválido).
        3. Sem data na lista = INDISPONÍVEL.

        REGRAS DE CONFLITO E FADIGA (CRÍTICO):
        1. UNICIDADE DE FUNÇÃO (Projeção vs Foto): 
           - Um membro NÃO pode exercer duas funções no mesmo evento simultaneamente.
           - ATENÇÃO MÁXIMA: É PROIBIDO escalar a mesma pessoa em "Projeção/Transmissão" e "Fotografia/Storys" no mesmo horário. São funções incompatíveis. Se ele estiver em uma, remova da outra.
        2. FADIGA DIÁRIA (Manhã vs Noite):
           - Se um membro for escalado para um culto de MANHÃ, NÃO o escale para o culto da NOITE no mesmo dia, mesmo que ele tenha disponibilidade "Dia Todo".
           - Priorize a rotatividade. Só quebre essa regra se não houver absolutamente nenhum outro voluntário qualificado disponível.

        REGRAS GERAIS DE PREENCHIMENTO:
        1. Balanceamento: Distribua a escala igualmente. Evite repetir pessoas.
        2. Respeito à Função: Só escale se o membro tiver a role.
        3. Preencha o máximo de vagas possível.

        REGRA ESPECIAL DE 'VOCAL' (Apenas se ministério for 'louvor'):
        - Preencha chaves: "_Vocal_1", "_Vocal_2", etc.
        - Tente preencher ao menos 3 vocais.

        FORMATO DE SAÍDA (JSON PURO):
        Retorne APENAS um objeto JSON válido.
        Chave: "YYYY-MM-DDTHH:mm_Role"
        Valor: "Nome do Membro"
      `;

      const prompt = JSON.stringify({
        ministryContext: ministryId,
        eventsToFill: events,
        requiredRoles: roles,
        teamMembers: simplifiedMembers
      });

      const response = await ai.models.generateContent({
          // Alterado para flash-8b ou flash normal se preferir, o 2.5-flash é ótimo
          model: 'gemini-1.5-flash', 
          contents: [{ role: 'user', parts: [{ text: prompt }] }], // Ajuste na estrutura da chamada v1
          config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json"
          }
      });

      const responseText = response.text(); // Ajuste: em algumas versões do SDK é func, em outras prop
      
      if (!responseText) {
          throw new Error("A IA retornou uma resposta vazia.");
      }

      const scheduleMap: ScheduleMap = JSON.parse(responseText);
      return scheduleMap;

    } catch (error: any) {
      console.error("Erro na IA:", error);
      let msg = error.message || "Erro desconhecido.";
      if (msg.includes("Failed to fetch")) msg = "Erro de conexão com a IA.";
      throw new Error(msg);
    }
};
