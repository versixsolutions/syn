import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import PageLayout from "../../components/PageLayout";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/ui/Modal";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  priority: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
}

export default function FAQManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "geral",
    priority: 3,
  });

  const categories = [
    { value: "geral", label: "📋 Geral", color: "bg-gray-100 text-gray-700" },
    {
      value: "financeiro",
      label: "💰 Financeiro",
      color: "bg-green-100 text-green-700",
    },
    {
      value: "areas-comuns",
      label: "🏊 Áreas Comuns",
      color: "bg-blue-100 text-blue-700",
    },
    {
      value: "portaria",
      label: "🚪 Portaria/Acesso",
      color: "bg-purple-100 text-purple-700",
    },
    {
      value: "obras",
      label: "🔧 Obras/Manutenção",
      color: "bg-orange-100 text-orange-700",
    },
    { value: "regras", label: "📜 Regras", color: "bg-red-100 text-red-700" },
    {
      value: "animais",
      label: "🐾 Animais",
      color: "bg-yellow-100 text-yellow-700",
    },
    { value: "multas", label: "⚠️ Multas", color: "bg-red-100 text-red-700" },
  ];

  useEffect(() => {
    if (profile?.condominio_id) {
      loadFAQs();
    }
  }, [profile?.condominio_id]);

  async function loadFAQs() {
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq("condominio_id", profile?.condominio_id)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar FAQs");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenNew() {
    setEditingId(null);
    setFormData({
      question: "",
      answer: "",
      category: "geral",
      priority: 3,
    });
    setIsModalOpen(true);
  }

  function handleEdit(faq: FAQ) {
    setEditingId(faq.id);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      priority: faq.priority,
    });
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta FAQ?")) return;

    const toastId = toast.loading("Excluindo FAQ...");
    try {
      const { error } = await supabase.from("faqs").delete().eq("id", id);

      if (error) throw error;

      toast.success("FAQ excluída com sucesso!", { id: toastId });
      loadFAQs();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao excluir FAQ", { id: toastId });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.question.trim() || !formData.answer.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const toastId = toast.loading(
      editingId ? "Atualizando FAQ..." : "Criando FAQ...",
    );

    try {
      const faqData = {
        ...formData,
        condominio_id: profile?.condominio_id,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("faqs")
          .update(faqData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("FAQ atualizada com sucesso!", { id: toastId });
      } else {
        const { error } = await supabase.from("faqs").insert([
          {
            ...faqData,
            helpful_count: 0,
            not_helpful_count: 0,
          },
        ]);

        if (error) throw error;
        toast.success("FAQ criada com sucesso!", { id: toastId });
      }

      setIsModalOpen(false);
      loadFAQs();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao salvar FAQ", { id: toastId });
    }
  }

  // Filtrar FAQs
  const filteredFAQs = faqs.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <PageLayout
      title="Gerenciar FAQs"
      subtitle="Adicionar ou editar perguntas frequentes"
      icon="📝"
    >
      {/* Header com ações */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por pergunta ou resposta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-3.5 w-5 h-5 text-gray-400"
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

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">Todas as Categorias</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleOpenNew}
          className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition flex items-center gap-2 shadow-lg whitespace-nowrap"
        >
          <span>➕</span> Nova FAQ
        </button>

        <button
          onClick={() => navigate("/admin/faq-import")}
          className="bg-white text-gray-700 border border-gray-300 px-6 py-3 rounded-lg font-bold hover:bg-gray-50 transition flex items-center gap-2 whitespace-nowrap"
        >
          <span>📥</span> Importar CSV
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total de FAQs</p>
          <p className="text-2xl font-bold text-gray-900">{faqs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Categorias</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Set(faqs.map((f) => f.category)).size}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Votos Positivos</p>
          <p className="text-2xl font-bold text-green-600">
            {faqs.reduce((sum, f) => sum + f.helpful_count, 0)}
          </p>
        </div>
      </div>

      {/* Lista de FAQs */}
      <div className="space-y-3">
        {filteredFAQs.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Nenhuma FAQ encontrada
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory !== "all"
                ? "Tente ajustar os filtros de busca"
                : "Comece adicionando uma nova FAQ"}
            </p>
            {!searchTerm && selectedCategory === "all" && (
              <button
                onClick={handleOpenNew}
                className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary-dark transition inline-flex items-center gap-2"
              >
                <span>➕</span> Adicionar Primeira FAQ
              </button>
            )}
          </div>
        ) : (
          filteredFAQs.map((faq) => {
            const categoryInfo =
              categories.find((c) => c.value === faq.category) || categories[0];
            return (
              <div
                key={faq.id}
                className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${categoryInfo.color}`}
                      >
                        {categoryInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        Prioridade: {faq.priority}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {faq.answer}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(faq)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Editar"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    👍 {faq.helpful_count}
                  </span>
                  <span className="flex items-center gap-1">
                    👎 {faq.not_helpful_count}
                  </span>
                  <span className="ml-auto">
                    {new Date(faq.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Edição/Criação */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Editar FAQ" : "Nova FAQ"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Pergunta *
            </label>
            <input
              type="text"
              value={formData.question}
              onChange={(e) =>
                setFormData({ ...formData, question: e.target.value })
              }
              placeholder="Ex: Qual o horário da piscina?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Resposta *
            </label>
            <textarea
              value={formData.answer}
              onChange={(e) =>
                setFormData({ ...formData, answer: e.target.value })
              }
              placeholder="Digite a resposta completa..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Categoria
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Prioridade (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: parseInt(e.target.value) || 3,
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-lg transition"
            >
              {editingId ? "Salvar Alterações" : "Criar FAQ"}
            </button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}
