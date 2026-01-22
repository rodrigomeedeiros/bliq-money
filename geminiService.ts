import { GoogleGenAI } from "@google/genai";
import { Transaction, MonthKey } from "../types";

export const getFinancialAdvice = async (month: MonthKey, transactions: Transaction[]) => {
  // Use this process.env.API_KEY string directly when initializing the @google/genai client instance
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const confirmedIn = transactions.filter(t => t.type === 'INCOME' && t.status === 'CONFIRMED').reduce((acc, t) => acc + t.amount, 0);
  const confirmedOut = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'CONFIRMED').reduce((acc, t) => acc + t.amount, 0);
  const pendingIn = transactions.filter(t => t.type === 'INCOME' && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0);
  const pendingOut = transactions.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING').reduce((acc, t) => acc + t.amount, 0);
  
  const summary = transactions.map(t => `${t.description}: R$ ${t.amount} (${t.type}, ${t.status === 'CONFIRMED' ? 'Realizado' : 'Pendente'})`).join(', ');

  const prompt = `
    Como um mentor de inteligência financeira estratégica, analise o mês de ${month}.
    Dados Atuais:
    - Recebido (Dinheiro em mãos): R$ ${confirmedIn}
    - Pago (Contas liquadas): R$ ${confirmedOut}
    - Saldo Real Hoje: R$ ${confirmedIn - confirmedOut}
    - Expectativa de Recebimento (Pendente): R$ ${pendingIn}
    - Contas a Pagar (Pendente): R$ ${pendingOut}
    - Projeção de Fim de Mês: R$ ${(confirmedIn + pendingIn) - (confirmedOut + pendingOut)}

    Transações detalhadas: ${summary}

    Forneça uma análise curta, direta e impactante dividida em:
    1. DIAGNÓSTICO: Como está a saúde financeira real vs projetada?
    2. ALERTA: Quais são as contas pendentes mais perigosas ou oportunidades de recebimento?
    3. PLANO DE AÇÃO: O que o usuário deve fazer AGORA para melhorar o saldo projetado?

    Use um tom executivo, encorajador e profissional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    // Access the .text property on the GenerateContentResponse object directly.
    return response.text || "Análise concluída, mas sem texto gerado.";
  } catch (error) {
    console.error("Erro na IA:", error);
    return "Falha na conexão com o cérebro financeiro. Verifique sua chave de API nas configurações da Vercel.";
  }
};
