import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Tratamento de CORS (Para o frontend conseguir chamar)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Receber o Texto do PDF
    const { text } = await req.json();

    if (!text) {
      throw new Error("Texto do PDF não fornecido no corpo da requisição.");
    }

    // 3. Inicializar Gemini
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada no servidor.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 4. Engenharia de Prompt (O "Cérebro" da operação)
    const prompt = `
      Atue como um analista contábil sênior. Sua tarefa é extrair dados financeiros de um texto desorganizado proveniente de um PDF de condomínio.

      ENTRADA:
      ${text.substring(0, 30000)}

      OBJETIVO:
      Identifique e estruture as RECEITAS (entradas, taxas, aluguéis) e DESPESAS (pagamentos, contas, manutenções).

      REGRAS CRÍTICAS:
      1. Ignore saldos anteriores, totais acumulados ou linhas de "transporte". Queremos apenas os lançamentos do mês/período.
      2. Data de Competência: Se o texto mencionar um mês (ex: "Jan/2025"), assuma o dia 10 desse mês para o campo 'date' (ex: "2025-01-10").
      3. Categorização:
         - Para Receitas: Use categorias como "Taxa Ordinária", "Taxa Extra", "Multas", "Aluguel Espaço", "Outros".
         - Para Despesas: Use categorias como "Pessoal", "Administrativa", "Manutenção", "Consumo" (água/luz), "Financeira".
      4. Formato de Saída: Retorne ESTRITAMENTE um JSON puro, sem crases, sem markdown, sem comentários.

      SCHEMA JSON ESPERADO:
      {
        "receitas": [
          { "description": "Nome da receita", "amount": 100.00, "date": "YYYY-MM-DD", "category": "Categoria" }
        ],
        "despesas": [
          { "description": "Nome da despesa", "amount": 50.50, "date": "YYYY-MM-DD", "category": "Categoria" }
        ]
      }
    `;

    // 5. Gerar Conteúdo
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let jsonString = response.text();

    // Limpeza de segurança (caso a IA retorne markdown ```json)
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();

    // Validar JSON
    const data = JSON.parse(jsonString);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Erro no processamento IA:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});