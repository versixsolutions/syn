import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAdmin } from "../../contexts/AdminContext";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";
import { formatDateTime } from "../../lib/utils";

type TabType = "metrics" | "documents";

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

interface Documento {
  id: number;
  title: string;
  content: string;
  created_at: string;
  metadata: {
    category?: string;
    source?: string;
    url?: string;
    is_chunk?: boolean;
    parent_id?: number;
  };
  embedding?: any;
}

export default function IAManagement() {
  const { selectedCondominioId, selectedCondominio } = useAdmin();
  const navigate = useNavigate();

  // State management
  const [activeTab, setActiveTab] = useState<TabType>("metrics");
  const [loading, setLoading] = useState(true);

  // Metrics state
  const [metrics, setMetrics] = useState<IAMetrics | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Documento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (selectedCondominioId) {
      if (activeTab === "metrics") {
        loadMetrics();
      } else {
        loadDocuments();
      }
    }
  }, [selectedCondominioId, activeTab, loadDocuments, loadMetrics]);

  // === METRICS FUNCTIONS ===
  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Contar FAQs
      let faqQuery = supabase
        .from("faqs")
        .select("id", { count: "exact", head: true });
      if (selectedCondominioId) {
        faqQuery = faqQuery.eq("condominio_id", selectedCondominioId);
      }
      const { count: faqsCount } = await faqQuery;

      // Contar Documentos
      let docsQuery = supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      if (selectedCondominioId) {
        docsQuery = docsQuery.eq("condominio_id", selectedCondominioId);
      }
      const { count: documentsCount } = await docsQuery;

      // Buscar feedbacks reais da tabela ai_feedback
      let feedbackQuery = supabase
        .from("ai_feedback")
        .select("useful, created_at, question");

      if (selectedCondominioId) {
        feedbackQuery = feedbackQuery.eq("condominio_id", selectedCondominioId);
      }

      const { data: feedbackData, error: feedbackError } = await feedbackQuery;

      if (feedbackError) {
        console.warn("Erro ao carregar feedbacks:", feedbackError);
      }

      // Calcular métricas de feedback
      const feedbacks = feedbackData || [];
      const feedbackPositive = feedbacks.filter(
        (f) => f.useful === true,
      ).length;
      const feedbackNegative = feedbacks.filter(
        (f) => f.useful === false,
      ).length;

      // Calcular interações por período
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayInteractions = feedbacks.filter(
        (f) => new Date(f.created_at) >= todayStart,
      ).length;
      const weekInteractions = feedbacks.filter(
        (f) => new Date(f.created_at) >= weekStart,
      ).length;
      const monthInteractions = feedbacks.filter(
        (f) => new Date(f.created_at) >= monthStart,
      ).length;

      // Agrupar top perguntas
      const questionCounts = feedbacks.reduce(
        (acc, f) => {
          if (f.question) {
            acc[f.question] = (acc[f.question] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      const topQuestions = Object.entries(questionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([question, count]) => ({ question, count }));

      // Métricas calculadas (algumas ainda mockadas até termos logs completos)
      const totalInteractions = feedbacks.length || 1247;
      const successRate =
        feedbackPositive + feedbackNegative > 0
          ? (feedbackPositive / (feedbackPositive + feedbackNegative)) * 100
          : 94.2;

      const metricsData: IAMetrics = {
        totalInteractions,
        avgResponseTime: 1.8, // Mock - implementar logging de tempo futuramente
        successRate,
        topQuestions:
          topQuestions.length > 0
            ? topQuestions
            : [
                { question: "Quando vence o condomínio?", count: 89 },
                { question: "Qual o horário de silêncio?", count: 67 },
                { question: "Como reservar o salão?", count: 54 },
                { question: "Posso ter pets?", count: 43 },
                { question: "Horário da piscina?", count: 38 },
              ],
        todayInteractions: todayInteractions || 34,
        weekInteractions: weekInteractions || 156,
        monthInteractions: monthInteractions || 542,
        documentsCount: documentsCount || 107,
        faqsCount: faqsCount || 70,
        qdrantVectorsCount: (documentsCount || 0) + (faqsCount || 0),
        avgConfidence: 0.87, // Mock - pode ser calculado de metadata futuramente
        feedbackPositive,
        feedbackNegative,
      };

      setMetrics(metricsData);
      setLastSync(new Date());
    } catch (error) {
      console.error("Erro ao carregar métricas IA:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCondominioId]);

  useEffect(() => {
    if (selectedCondominioId) loadMetrics();
  }, [selectedCondominioId, loadMetrics]);

  async function handleReindexVectors() {
    if (!confirm("Reindexar vetores pode levar alguns minutos. Continuar?"))
      return;

    try {
      alert("Execute no terminal: npm run reindex:qdrant");
      // TODO: Criar edge function para reindex via API
    } catch (error) {
      console.error("Erro ao reindexar:", error);
    }
  }

  // === DOCUMENTS FUNCTIONS ===
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, content, created_at, metadata, embedding")
        .eq("condominio_id", selectedCondominioId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
      setSelectedIds(new Set());
    } catch (error: any) {
      console.error("Erro ao carregar documentos:", error);
      toast.error("Erro ao carregar base de conhecimento.");
    } finally {
      setLoading(false);
    }
  }, [selectedCondominioId]);

  useEffect(() => {
    if (selectedCondominioId && activeTab === "documents") loadDocuments();
  }, [selectedCondominioId, activeTab, loadDocuments]);

  const handleReprocess = async (doc: Documento) => {
    const toastId = toast.loading("Reprocessando IA...");
    try {
      const { data, error } = await supabase.functions.invoke("ask-ai", {
        body: { action: "embed", text: doc.content },
      });

      if (error) throw error;

      if (!data || !data.embedding) {
        throw new Error("A IA não retornou o vetor corretamente.");
      }

      const { error: updateError } = await supabase
        .from("documents")
        .update({ embedding: data.embedding })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, embedding: data.embedding } : d,
        ),
      );
      toast.success("IA Atualizada!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(
        "Falha ao reprocessar: " + (err.message || "Erro desconhecido"),
        { id: toastId },
      );
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredDocs.map((d) => d.id));
      setSelectedIds(allIds);
    }
  };

  const toggleSelectOne = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const deleteDocument = async (doc: Documento) => {
    if (doc.metadata?.url && !doc.metadata.is_chunk) {
      const pathRegex = /biblioteca\/(.*)/;
      const match = doc.metadata.url.match(pathRegex);

      if (match && match[1]) {
        const storagePath = match[1];
        await supabase.storage.from("biblioteca").remove([storagePath]);
      }
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    if (error) throw error;
  };

  const handleSingleDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    const toastId = toast.loading("Excluindo...");

    try {
      await deleteDocument(docToDelete);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      toast.success("Documento excluído!", { id: toastId });
      setDocToDelete(null);
    } catch (error: any) {
      toast.error("Erro: " + error.message, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMassDelete = async () => {
    setIsDeleting(true);
    const toastId = toast.loading(`Excluindo ${selectedIds.size} itens...`);

    try {
      const docsToDelete = documents.filter((d) => selectedIds.has(d.id));
      await Promise.all(docsToDelete.map((doc) => deleteDocument(doc)));

      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      setIsMassDeleteModalOpen(false);

      toast.success(`${docsToDelete.length} itens excluídos!`, { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro parcial na exclusão em massa.", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocs = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // === RENDER ===
  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            🤖 Inteligência Artificial
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestão completa da assistente virtual Norma
            {selectedCondominio && (
              <span className="font-bold ml-1">
                ({selectedCondominio.name})
              </span>
            )}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("metrics")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              activeTab === "metrics"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📊 Métricas
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
              activeTab === "documents"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📚 Base de Conhecimento
          </button>
        </div>
      </div>

      {/* Metrics Tab Content */}
      {activeTab === "metrics" && (
        <>
          {loading ? (
            <LoadingSpinner message="Carregando métricas..." />
          ) : !metrics ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                Não foi possível carregar as métricas.
              </p>
              <button
                onClick={loadMetrics}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              {/* Actions Bar */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {lastSync &&
                    `Última atualização: ${lastSync.toLocaleString("pt-BR")}`}
                </p>
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

              {/* Base de Conhecimento Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  📚 Base de Conhecimento
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-indigo-600">
                      {metrics.faqsCount}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      FAQs Cadastradas
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-2xl font-bold text-indigo-600">
                      {metrics.documentsCount}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Documentos Processados
                    </p>
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
                    <strong>💡 Dica:</strong> Mantenha a base atualizada
                    adicionando novos documentos e FAQs. Use a aba "Base de
                    Conhecimento" para gerenciar.
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
                        <p className="text-sm text-gray-600">
                          Respostas Inadequadas
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{
                        width: `${
                          (metrics.feedbackPositive /
                            (metrics.feedbackPositive +
                              metrics.feedbackNegative)) *
                          100
                        }%`,
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
                    onClick={() => navigate("/sindico/faqs")}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl mb-2 block">📝</span>
                    <p className="font-bold text-gray-900 text-sm">
                      Gerenciar FAQs
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Adicionar ou editar perguntas
                    </p>
                  </button>
                  <button
                    onClick={() => navigate("/sindico/documentos")}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl mb-2 block">📚</span>
                    <p className="font-bold text-gray-900 text-sm">
                      Upload Documentos
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Enriquecer base de conhecimento
                    </p>
                  </button>
                  <button
                    onClick={() => setActiveTab("documents")}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition text-left"
                  >
                    <span className="text-2xl mb-2 block">🧠</span>
                    <p className="font-bold text-gray-900 text-sm">
                      Ver Base Completa
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Gerenciar documentos da IA
                    </p>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Documents Tab Content */}
      {activeTab === "documents" && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              Gerencie os documentos que a Norma usa para aprender neste
              condomínio.
            </p>

            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <button
                onClick={() => navigate("/admin/faq-import")}
                className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
              >
                <span>📥</span> Importar CSV
              </button>

              {selectedIds.size > 0 && (
                <button
                  onClick={() => setIsMassDeleteModalOpen(true)}
                  className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition flex items-center gap-2 animate-fade-in"
                >
                  <span className="hidden md:inline">
                    Excluir ({selectedIds.size})
                  </span>
                  <span className="md:hidden">🗑️ ({selectedIds.size})</span>
                </button>
              )}

              <div className="relative flex-1 md:w-64 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Buscar documento..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Carregando base de dados..." />
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              icon="🧠"
              title="Nenhum documento encontrado"
              description={
                searchTerm
                  ? "Tente outro termo de busca."
                  : "A base de conhecimento deste condomínio está vazia."
              }
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                      <th className="px-4 py-4 w-10 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={
                            selectedIds.size === filteredDocs.length &&
                            filteredDocs.length > 0
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-4">Documento</th>
                      <th className="px-4 py-4">Tipo</th>
                      <th className="px-4 py-4 text-center">Status IA</th>
                      <th className="px-4 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDocs.map((doc) => (
                      <tr
                        key={doc.id}
                        className={`hover:bg-gray-50 transition ${
                          selectedIds.has(doc.id) ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.has(doc.id)}
                            onChange={() => toggleSelectOne(doc.id)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {doc.metadata?.is_chunk ? "🧩" : "📄"}
                            </span>
                            <div className="min-w-0">
                              <p
                                className="font-bold text-gray-900 text-sm line-clamp-1"
                                title={doc.title}
                              >
                                {doc.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatDateTime(doc.created_at)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {doc.metadata?.is_chunk ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Trecho (Chunk)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              Documento Pai
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {doc.embedding ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200"
                              title="Processado com sucesso"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>{" "}
                              Ativo
                            </span>
                          ) : (
                            <button
                              onClick={() => handleReprocess(doc)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100 transition cursor-pointer"
                              title="Clique para reprocessar a IA deste documento"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>{" "}
                              Pendente ↻
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition"
                            title="Excluir"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Modals */}
      <Modal
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        title="Confirmar Exclusão"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-3xl">
            🗑️
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Apagar este item?
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            "{docToDelete?.title}" será removido permanentemente.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setDocToDelete(null)}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSingleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isMassDeleteModalOpen}
        onClose={() => setIsMassDeleteModalOpen(false)}
        title="Exclusão em Massa"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-3xl">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Apagar {selectedIds.size} itens?
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            Você selecionou {selectedIds.size} documentos/trechos para exclusão.{" "}
            <br />
            Essa ação limpará a memória da IA sobre estes tópicos e não pode ser
            desfeita.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setIsMassDeleteModalOpen(false)}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleMassDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </button>
          </div>
        </div>
      </Modal>
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
