import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import PageLayout from "../components/PageLayout";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import Modal from "../components/ui/Modal";
import toast from "react-hot-toast";
import { recordAIResponseFeedback } from "../lib/feedback";

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  article_reference?: string;
  votes_helpful: number | null;
  votes_not_helpful: number | null;
}

const CATEGORIES: Record<string, any> = {
  horarios: {
    label: "Horários",
    icon: "⏰",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  area_lazer: {
    label: "Área de Lazer",
    icon: "⚽",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  animais: {
    label: "Animais",
    icon: "🐾",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  garagem: {
    label: "Garagem",
    icon: "🚗",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },
  lixo: {
    label: "Lixo",
    icon: "♻️",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  obras: {
    label: "Obras",
    icon: "🔨",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  seguranca: {
    label: "Segurança",
    icon: "🛡️",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  financeiro: {
    label: "Financeiro",
    icon: "💰",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  penalidades: {
    label: "Multas",
    icon: "⚠️",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },
  geral: {
    label: "Geral",
    icon: "📋",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

function getCategoryInfo(categoryKey: string) {
  const normalized = categoryKey?.toLowerCase() || "geral";
  return CATEGORIES[normalized] || CATEGORIES["geral"];
}

export default function FAQ() {
  const { canManage, profile } = useAuth();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(),
  );

  // Estados do Modal de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.condominio_id) loadFAQs();
  }, [profile?.condominio_id]);

  async function loadFAQs() {
    try {
      const { data, error } = await supabase
        .from("faqs")
        .select("*")
        .eq("condominio_id", profile?.condominio_id)
        .order("priority", { ascending: true }) // Prioridade primeiro
        .order("question", { ascending: true });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Agrupa as FAQs por categoria
  const groupedFaqs = faqs.reduce(
    (acc, faq) => {
      const cat = faq.category || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(faq);
      return acc;
    },
    {} as Record<string, FAQ[]>,
  );

  // Filtra categorias baseado na busca (se houver busca, expande tudo que der match)
  const activeCategories = Object.keys(groupedFaqs).filter((catKey) => {
    if (!searchTerm) return true;
    // Se tiver busca, verifica se alguma pergunta da categoria dá match
    return groupedFaqs[catKey].some(
      (f) =>
        f.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.answer.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  });

  // --- Lógica de Importação CSV (Mantida igual) ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Apenas arquivos .csv são permitidos");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => parseCSV(event.target?.result as string);
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split("\n");
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values =
          line
            .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            ?.map((v) => v.replace(/"/g, "")) || line.split(",");
        if (values.length >= 2) {
          const entry: any = {};
          headers.forEach((header, index) => {
            if (values[index]) entry[header] = values[index].trim();
          });
          if (entry.question && entry.answer) data.push(entry);
        }
      }
      setImportPreview(data);
    } catch (err) {
      toast.error("Erro ao ler CSV.");
    }
  };

  const confirmImport = async () => {
    if (!profile?.condominio_id) return;
    setIsImporting(true);
    const toastId = toast.loading("Importando...");
    try {
      const faqsToInsert = importPreview.map((item) => ({
        condominio_id: profile.condominio_id,
        question: item.question,
        answer: item.answer,
        category: item.category || "geral",
        priority: item.priority ? parseInt(item.priority) : 3,
        article_reference: item.article_reference || null,
      }));
      const { error } = await supabase.from("faqs").insert(faqsToInsert);
      if (error) throw error;
      toast.success(`${faqsToInsert.length} perguntas importadas!`, {
        id: toastId,
      });
      setIsImportModalOpen(false);
      setImportPreview([]);
      loadFAQs();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro na importação.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };
  // -------------------------------

  if (loading) return <LoadingSpinner />;

  return (
    <PageLayout
      title="Perguntas Frequentes"
      subtitle="Tire suas dúvidas sobre o condomínio"
      icon="❓"
    >
      {/* --- Header de Ações --- */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar dúvida..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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

        {canManage && (
          <button
            onClick={() => {
              setIsImportModalOpen(true);
              setImportPreview([]);
            }}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <span>📥</span>{" "}
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
        )}
      </div>

      {/* --- Lista de Categorias (Accordion) --- */}
      <div className="space-y-4 pb-20">
        {activeCategories.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Nada encontrado"
            description="Nenhuma pergunta corresponde ao termo buscado."
            variant="faq"
            actions={[
              {
                label: "Limpar busca",
                onClick: () => setSearch(""),
                variant: "secondary",
              },
              {
                label: "Perguntar à Norma",
                onClick: () =>
                  window.dispatchEvent(new CustomEvent("openChatbot")),
              },
            ]}
          />
        ) : (
          activeCategories.map((catKey) => {
            const catInfo = getCategoryInfo(catKey);
            const questions = groupedFaqs[catKey].filter(
              (q) =>
                !searchTerm ||
                q.question.toLowerCase().includes(searchTerm.toLowerCase()),
            );

            if (questions.length === 0) return null;

            // Se tiver busca, expande automaticamente. Se não, respeita o estado manual.
            const isCatExpanded = searchTerm
              ? true
              : expandedCategory === catKey;

            return (
              <div
                key={catKey}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all duration-300"
              >
                {/* Header da Categoria */}
                <button
                  onClick={() =>
                    setExpandedCategory(isCatExpanded ? null : catKey)
                  }
                  className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition ${isCatExpanded ? "bg-gray-50 border-b border-gray-100" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl border ${catInfo.color.replace("text-", "border-").split(" ")[2]} ${catInfo.color.split(" ")[0]}`}
                    >
                      {catInfo.icon}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">
                        {catInfo.label}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {questions.length} tópicos
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isCatExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Lista de Perguntas da Categoria */}
                {isCatExpanded && (
                  <div className="bg-white animate-fade-in">
                    {questions.map((faq, idx) => {
                      const isQExpanded = expandedQuestions.has(faq.id);
                      return (
                        <div
                          key={faq.id}
                          className={`border-b border-gray-100 last:border-0 ${isQExpanded ? "bg-gray-50/50" : ""}`}
                        >
                          <button
                            onClick={() => toggleQuestion(faq.id)}
                            className="w-full text-left p-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition"
                          >
                            <span className="mt-0.5 text-gray-400 text-xs font-bold min-w-[1.5rem]">
                              Q{idx + 1}.
                            </span>
                            <div className="flex-1">
                              <p
                                className={`text-sm font-medium ${isQExpanded ? "text-primary font-bold" : "text-gray-700"}`}
                              >
                                {faq.question}
                              </p>
                            </div>
                            <span className="text-gray-400 text-xs">
                              {isQExpanded ? "−" : "+"}
                            </span>
                          </button>

                          {/* Resposta Expandida */}
                          {isQExpanded && (
                            <div className="px-4 pb-4 pt-0 ml-9">
                              <div className="text-sm text-gray-600 leading-relaxed bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                {faq.answer}
                                {faq.article_reference && (
                                  <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                    📖 Fonte: {faq.article_reference}
                                  </div>
                                )}
                                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs">
                                  <span className="text-gray-500">
                                    Esta resposta foi útil?
                                  </span>
                                  <button
                                    onClick={async () => {
                                      await recordAIResponseFeedback({
                                        context: "faq",
                                        question: faq.question,
                                        answer: faq.answer,
                                        source_title:
                                          faq.article_reference || null,
                                        source_type: "faq",
                                        useful: true,
                                        user_id: null,
                                        condominio_id:
                                          profile?.condominio_id || null,
                                        faq_id: faq.id,
                                      });
                                      toast.success(
                                        "✅ Obrigado pelo feedback!",
                                      );
                                    }}
                                    className="px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                                    aria-label="Resposta útil"
                                    title="Marcar como útil"
                                  >
                                    👍 Útil
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await recordAIResponseFeedback({
                                        context: "faq",
                                        question: faq.question,
                                        answer: faq.answer,
                                        source_title:
                                          faq.article_reference || null,
                                        source_type: "faq",
                                        useful: false,
                                        user_id: null,
                                        condominio_id:
                                          profile?.condominio_id || null,
                                        faq_id: faq.id,
                                      });
                                      toast.success(
                                        "📝 Obrigado! Vamos melhorar esta resposta.",
                                      );
                                    }}
                                    className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                                    aria-label="Resposta não útil"
                                    title="Marcar como não útil"
                                  >
                                    👎 Não útil
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Importação (Mantido) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar FAQs"
      >
        {!importPreview.length ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50 transition"
          >
            <div className="text-4xl mb-2">📂</div>
            <p className="text-sm font-bold text-gray-700">
              Clique para selecionar o CSV
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border border-green-100">
              <span className="text-sm font-bold text-green-800">
                ✅ {importPreview.length} perguntas
              </span>
              <button
                onClick={() => setImportPreview([])}
                className="text-xs text-red-600 underline"
              >
                Trocar
              </button>
            </div>
            <button
              onClick={confirmImport}
              disabled={isImporting}
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary-dark disabled:opacity-50"
            >
              {isImporting ? "Importando..." : "Confirmar"}
            </button>
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
