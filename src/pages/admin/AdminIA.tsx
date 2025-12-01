import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAdmin } from "../../contexts/AdminContext";

interface IAMetrics {
  totalInteractions: number;
  avgResponseTime: number;
  successRate: number;
  topQuestions: { question: string; count: number }[];
  todayInteractions: number;
  weekInteractions: number;
  monthInteractions: number;
  documentsCount: number;
  faqsCount: number;
  qdrantVectorsCount: number;
  avgConfidence: number;
  feedbackPositive: number;
  feedbackNegative: number;
}

export default function AdminIA() {
  const { selectedCondominioId, selectedCondominio } = useAdmin();
  const [metrics, setMetrics] = useState<IAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [selectedCondominioId]);

  async function loadMetrics() {
    setLoading(true);
    try {
      // Buscar métricas de interações (tabela customizada ou logs)
      // Por enquanto, dados mockados - você pode criar tabela 'ai_interactions' depois

      // const now = new Date()
      // const today = new Date(now.setHours(0, 0, 0, 0))
      // const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      // const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      // Contar FAQs
      let faqQuery = supabase
        .from("faqs")
        .select("id", { count: "exact", head: true });
      if (selectedCondominioId) {
        faqQuery = faqQuery.eq("condominio_id", selectedCondominioId);
      }
      const { count: faqsCount } = await faqQuery;

      // Contar Documentos (se houver tabela documents vinculada)
      // const { count: documentsCount } = await supabase
      //   .from('documents')
      //   .select('id', { count: 'exact', head: true })
      //   .eq('condominio_id', selectedCondominioId)

      // Dados mockados para demonstração (substitua por queries reais)
      const mockMetrics: IAMetrics = {
        totalInteractions: 1247,
        avgResponseTime: 1.8, // segundos
        successRate: 94.2, // %
        topQuestions: [
          { question: "Quando vence o condomínio?", count: 89 },
          { question: "Qual o horário de silêncio?", count: 67 },
          { question: "Como reservar o salão?", count: 54 },
          { question: "Posso ter pets?", count: 43 },
          { question: "Horário da piscina?", count: 38 },
        ],
        todayInteractions: 34,
        weekInteractions: 156,
        monthInteractions: 542,
        documentsCount: 107, // chunks no Qdrant
        faqsCount: faqsCount || 70,
        qdrantVectorsCount: 177,
        avgConfidence: 0.87,
        feedbackPositive: 112,
        feedbackNegative: 8,
      };

      setMetrics(mockMetrics);
      setLastSync(new Date());
    } catch (error) {
      console.error("Erro ao carregar métricas IA:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReindexVectors() {
    if (!confirm("Reindexar vetores pode levar alguns minutos. Continuar?"))
      return;

    try {
      // Chamar edge function de reindex (se existir) ou mostrar instrução CLI
      alert("Execute no terminal: npm run reindex:qdrant");
      // TODO: Criar edge function para reindex via API
    } catch (error) {
      console.error("Erro ao reindexar:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-t-transparent border-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-4 font-semibold">
            Carregando métricas...
          </p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Não foi possível carregar as métricas.</p>
        <button
          onClick={loadMetrics}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            🤖 Inteligência Artificial
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Métricas e gestão da assistente virtual Norma
            {selectedCondominio && (
              <span className="font-bold ml-1">
                ({selectedCondominio.name})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadMetrics}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-medium"
          >
            🔄 Atualizar
          </button>
          <button
            onClick={handleReindexVectors}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold"
          >
            ⚡ Reindexar Vetores
          </button>
        </div>
      </div>

      {lastSync && (
        <p className="text-xs text-gray-400">
          Última atualização: {lastSync.toLocaleString("pt-BR")}
        </p>
      )}

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Interações"
          value={metrics.totalInteractions.toLocaleString("pt-BR")}
          icon="💬"
          color="bg-blue-50 text-blue-600"
        />
        <MetricCard
          title="Taxa de Sucesso"
          value={`${metrics.successRate}%`}
          icon="✅"
          color="bg-green-50 text-green-600"
        />
        <MetricCard
          title="Tempo Médio Resposta"
          value={`${metrics.avgResponseTime}s`}
          icon="⚡"
          color="bg-yellow-50 text-yellow-600"
        />
        <MetricCard
          title="Confiança Média"
          value={`${(metrics.avgConfidence * 100).toFixed(0)}%`}
          icon="🎯"
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Uso por Período */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          📊 Uso por Período
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">
              {metrics.todayInteractions}
            </p>
            <p className="text-sm text-gray-500 mt-1">Hoje</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">
              {metrics.weekInteractions}
            </p>
            <p className="text-sm text-gray-500 mt-1">Esta Semana</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-3xl font-bold text-gray-900">
              {metrics.monthInteractions}
            </p>
            <p className="text-sm text-gray-500 mt-1">Este Mês</p>
          </div>
        </div>
      </div>

      {/* Base de Conhecimento */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          📚 Base de Conhecimento
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.faqsCount}
            </p>
            <p className="text-sm text-gray-600 mt-1">FAQs Cadastradas</p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.documentsCount}
            </p>
            <p className="text-sm text-gray-600 mt-1">Documentos Processados</p>
          </div>
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
            <p className="text-2xl font-bold text-indigo-600">
              {metrics.qdrantVectorsCount}
            </p>
            <p className="text-sm text-gray-600 mt-1">Vetores Qdrant</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-800">
            <strong>💡 Dica:</strong> Mantenha a base atualizada adicionando
            novos documentos e FAQs. Reindexe os vetores após mudanças
            significativas para melhorar a precisão.
          </p>
        </div>
      </div>

      {/* Top 5 Perguntas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          🔥 Top 5 Perguntas
        </h2>
        <div className="space-y-3">
          {metrics.topQuestions.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg font-bold text-gray-400">
                  #{index + 1}
                </span>
                <p className="text-sm text-gray-700 truncate">
                  {item.question}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600 ml-4">
                {item.count}x
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback dos Usuários */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          ⭐ Feedback dos Usuários
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👍</span>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {metrics.feedbackPositive}
                </p>
                <p className="text-sm text-gray-600">Respostas Úteis</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👎</span>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {metrics.feedbackNegative}
                </p>
                <p className="text-sm text-gray-600">Respostas Inadequadas</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all"
              style={{
                width: `${(metrics.feedbackPositive / (metrics.feedbackPositive + metrics.feedbackNegative)) * 100}%`,
              }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Satisfação:{" "}
            {(
              (metrics.feedbackPositive /
                (metrics.feedbackPositive + metrics.feedbackNegative)) *
              100
            ).toFixed(1)}
            %
          </p>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          ⚙️ Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => (window.location.href = "/admin/ia")}
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
          >
            <span className="text-2xl mb-2 block">📝</span>
            <p className="font-bold text-gray-900 text-sm">Gerenciar FAQs</p>
            <p className="text-xs text-gray-500 mt-1">
              Adicionar ou editar perguntas
            </p>
          </button>
          <button
            onClick={() => (window.location.href = "/admin/biblioteca")}
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
          >
            <span className="text-2xl mb-2 block">📚</span>
            <p className="font-bold text-gray-900 text-sm">Upload Documentos</p>
            <p className="text-xs text-gray-500 mt-1">
              Enriquecer base de conhecimento
            </p>
          </button>
          <button
            onClick={() =>
              alert("Logs disponíveis no Supabase Dashboard ou Sentry")
            }
            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
          >
            <span className="text-2xl mb-2 block">📊</span>
            <p className="font-bold text-gray-900 text-sm">
              Ver Logs Detalhados
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Análise avançada de uso
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-3xl p-2 rounded-lg ${color}`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}
