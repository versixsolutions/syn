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
  // Área de lazer
  area_lazer_piscina: {
    label: "Área de Lazer — Piscina",
    icon: "🏊",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  area_lazer_festas: {
    label: "Área de Lazer — Festas",
    icon: "🎉",
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
  area_lazer_esportes: {
    label: "Área de Lazer — Esportes",
    icon: "⚽",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },

  // Animais
  animais_passeio: {
    label: "Animais — Passeio",
    icon: "🐾",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  animais_restricoes: {
    label: "Animais — Restrições",
    icon: "🚫",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },

  // Financeiro
  financeiro_pagamento: {
    label: "Financeiro — Pagamento",
    icon: "💳",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  financeiro_cobranca: {
    label: "Financeiro — Cobrança",
    icon: "💰",
    color: "bg-green-50 text-green-700 border-green-200",
  },

  // Segurança
  seguranca_acesso: {
    label: "Segurança — Acesso",
    icon: "🛡️",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  seguranca_emergencia: {
    label: "Segurança — Emergência",
    icon: "🚨",
    color: "bg-red-50 text-red-700 border-red-200",
  },

  // Obras
  obras_pequenas: {
    label: "Obras — Pequenas",
    icon: "🧰",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  obras_grandes: {
    label: "Obras — Grandes",
    icon: "🏗️",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },

  // Governança
  governanca_assembleia: {
    label: "Governança — Assembleia",
    icon: "🗳️",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  governanca_sindico: {
    label: "Governança — Síndico",
    icon: "👤",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },

  // Conflitos
  conflitos_vizinhos: {
    label: "Conflitos — Vizinhos",
    icon: "🤝",
    color: "bg-slate-50 text-slate-700 border-slate-200",
  },
  conflitos_multas: {
    label: "Conflitos — Multas",
    icon: "⚠️",
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },

  // Horários
  horarios_silencio: {
    label: "Horários — Silêncio",
    icon: "🔇",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  horarios_servicos: {
    label: "Horários — Serviços",
    icon: "🧹",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },

  // Lixo
  lixo_coleta: {
    label: "Lixo — Coleta",
    icon: "🗑️",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  lixo_reciclagem: {
    label: "Lixo — Reciclagem",
    icon: "♻️",
    color: "bg-green-50 text-green-700 border-green-200",
  },

  // Veículos
  veiculos_estacionamento: {
    label: "Veículos — Estacionamento",
    icon: "🚗",
    color: "bg-zinc-50 text-zinc-700 border-zinc-200",
  },

  // Fallback
  geral: {
    label: "Geral",
    icon: "📋",
    color: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

function getCategoryInfo(categoryKey: string) {
  const key = (categoryKey || "geral").toLowerCase();
  if (CATEGORIES[key]) return CATEGORIES[key];
  // Mapear categorias antigas para novas, caso existam registros legados
  const legacyMap: Record<string, string> = {
    horarios: "horarios_silencio",
    area_lazer: "area_lazer_piscina",
    animais: "animais_passeio",
    garagem: "veiculos_estacionamento",
    lixo: "lixo_coleta",
    obras: "obras_pequenas",
    seguranca: "seguranca_acesso",
    financeiro: "financeiro_pagamento",
    penalidades: "conflitos_multas",
  };
  const mapped = legacyMap[key] || "geral";
  return CATEGORIES[mapped] || CATEGORIES["geral"];
}

export default function FAQ() {
  const { canManage, profile } = useAuth();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(),
  );

  // Estados do Modal de Importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFAQs = useCallback(async () => {
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
  }, [profile?.condominio_id]);

  useEffect(() => {
    if (profile?.condominio_id) loadFAQs();
  }, [profile?.condominio_id, loadFAQs]);

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

  // Aplica filtros: categoria selecionada e busca
  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory =
      !selectedCategory || faq.category === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Agrupa os FAQs filtrados
  const filteredGroupedFaqs = filteredFaqs.reduce(
    (acc, faq) => {
      const cat = faq.category || "geral";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(faq);
      return acc;
    },
    {} as Record<string, FAQ[]>,
  );

  const activeCategories = Object.keys(filteredGroupedFaqs);

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
      {/* --- 1. CARDS DE RESUMO --- */}
      <div className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 mb-6 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none scrollbar-hide">
        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Total de Perguntas
          </p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-800">{faqs.length}</p>
            <span className="text-2xl">❓</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Categorias
          </p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-blue-600">
              {Object.keys(groupedFaqs).length}
            </p>
            <span className="text-2xl">📚</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            Mais Popular
          </p>
          <div className="flex items-end justify-between">
            <p className="text-sm font-bold text-purple-600 line-clamp-2">
              {Object.entries(groupedFaqs).sort(
                ([, a], [, b]) => b.length - a.length,
              )[0]?.[0]
                ? getCategoryInfo(
                    Object.entries(groupedFaqs).sort(
                      ([, a], [, b]) => b.length - a.length,
                    )[0][0],
                  ).label
                : "N/A"}
            </p>
            <span className="text-2xl">⭐</span>
          </div>
        </div>
      </div>

      {/* --- 2. BARRA DE BUSCA E AÇÕES --- */}
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

      {/* --- 3. FILTROS DE CATEGORIA --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 ${
              !selectedCategory
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
            }`}
          >
            Todas
          </button>
          {Object.entries(CATEGORIES).map(([key, config]) => {
            const count = groupedFaqs[key]?.length || 0;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 flex items-center gap-1 ${
                  selectedCategory === key
                    ? `${config.color} shadow-sm`
                    : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                }`}
              >
                <span>{config.icon}</span> {config.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* --- 4. LISTA DE PERGUNTAS (AGRUPADAS) --- */}
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
                onClick: () => setSearchTerm(""),
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
            const questions = filteredGroupedFaqs[catKey];

            if (questions.length === 0) return null;

            return (
              <div
                key={catKey}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm transition-all duration-300"
              >
                {/* Header da Categoria */}
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl border ${catInfo.color}`}
                    >
                      {catInfo.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm md:text-base">
                        {catInfo.label}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {questions.length}{" "}
                        {questions.length === 1 ? "tópico" : "tópicos"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lista de Perguntas da Categoria */}
                <div className="bg-white">
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
                                    toast.success("✅ Obrigado pelo feedback!");
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
