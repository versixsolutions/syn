import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useAdmin } from "../../contexts/AdminContext";
import { formatCurrency, formatDate } from "../../lib/utils";
import { extractTextFromPDF } from "../../lib/pdfUtils"; // <--- IMPORTANTE: Usando a função centralizada
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

interface Despesa {
  id: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  paid_at: string | null;
  receipt_url: string | null;
  is_consolidated?: boolean;
}

const CATEGORIES = [
  "Manutenção",
  "Administrativa",
  "Pessoal",
  "Serviços",
  "Aquisições",
  "Impostos",
  "Financeira",
  "Outros",
];

export default function FinanceiroManagement() {
  const { user } = useAuth();
  const { selectedCondominioId } = useAdmin();

  // Estados da Listagem
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal de Nova Despesa
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Manutenção",
    dueDate: "",
    isPaid: false,
  });

  // Estados do Modal de IMPORTAÇÃO
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "saving">(
    "upload",
  );
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [extractedData, setExtractedData] = useState<{
    receitas: any[];
    despesas: any[];
  }>({ receitas: [], despesas: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCondominioId) {
      loadDespesas();
    }
  }, [selectedCondominioId, loadDespesas]);

  const loadDespesas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("condominio_id", selectedCondominioId)
        .order("due_date", { ascending: false });

      if (error) throw error;
      setDespesas(data || []);
    } catch (error) {
      console.error("Erro ao carregar despesas:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCondominioId]);

  useEffect(() => {
    if (selectedCondominioId) {
      loadDespesas();
    }
  }, [selectedCondominioId, loadDespesas]);

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    try {
      const { error } = await supabase.from("despesas").delete().eq("id", id);
      if (error) throw error;
      setDespesas((prev) => prev.filter((d) => d.id !== id));
      toast.success("Lançamento excluído");
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  }

  async function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedCondominioId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("despesas").insert({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        due_date: formData.dueDate,
        paid_at: formData.isPaid ? new Date().toISOString() : null,
        author_id: user.id,
        condominio_id: selectedCondominioId,
      });

      if (error) throw error;

      toast.success("Despesa lançada!");
      setIsNewModalOpen(false);
      setFormData({
        description: "",
        amount: "",
        category: "Manutenção",
        dueDate: "",
        isPaid: false,
      });
      loadDespesas();
    } catch (error: any) {
      toast.error("Erro ao lançar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  // --- LÓGICA DE IMPORTAÇÃO INTELIGENTE (IA) ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Por favor, envie um arquivo PDF.");
      return;
    }

    setIsProcessingPdf(true);
    const toastId = toast.loading("Lendo demonstrativo...");

    try {
      // 1. Extração Local do Texto (Usando função centralizada e corrigida)
      const fullText = await extractTextFromPDF(file);

      // 2. Envio para Edge Function (IA)
      toast.loading("IA analisando tabelas...", { id: toastId });

      const { data: aiData, error: aiError } = await supabase.functions.invoke(
        "process-financial-pdf",
        {
          body: { text: fullText },
        },
      );

      if (aiError) {
        console.error("Erro da Edge Function:", aiError);
        throw new Error(
          `Erro no processamento: ${aiError.message || "Serviço indisponível"}`,
        );
      }

      if (!aiData || (!aiData.receitas?.length && !aiData.despesas?.length)) {
        throw new Error(
          "A IA não conseguiu identificar dados financeiros válidos no PDF. Verifique se o arquivo contém tabelas de receitas/despesas.",
        );
      }

      setExtractedData({
        receitas: aiData.receitas || [],
        despesas: aiData.despesas || [],
      });

      setImportStep("preview");
      toast.success("Dados processados!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(`Falha: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedCondominioId || !user) return;

    setImportStep("saving");
    const toastId = toast.loading("Salvando lançamentos...");

    try {
      // Salvar Receitas
      if (extractedData.receitas.length > 0) {
        const receitasToInsert = extractedData.receitas.map((r) => ({
          description: r.description,
          amount: parseFloat(r.amount),
          received_at: r.date,
          category: r.category || "Outros",
          condominio_id: selectedCondominioId,
          author_id: user.id,
          is_consolidated: true,
        }));
        await supabase.from("receitas").insert(receitasToInsert);
      }

      // Salvar Despesas
      if (extractedData.despesas.length > 0) {
        const despesasToInsert = extractedData.despesas.map((d) => ({
          description: d.description,
          amount: parseFloat(d.amount),
          category: d.category || "Outros",
          due_date: d.date,
          paid_at: d.date,
          condominio_id: selectedCondominioId,
          author_id: user.id,
          is_consolidated: true,
        }));
        await supabase.from("despesas").insert(despesasToInsert);
      }

      toast.success("Importação concluída!", { id: toastId });
      setIsImportModalOpen(false);
      setImportStep("upload");
      setExtractedData({ receitas: [], despesas: [] });
      loadDespesas(); // Recarrega a tabela
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message, { id: toastId });
      setImportStep("preview");
    }
  };

  // Totais para Preview
  const totalReceitas = extractedData.receitas.reduce(
    (acc, r) => acc + (parseFloat(r.amount) || 0),
    0,
  );
  const totalDespesas = extractedData.despesas.reduce(
    (acc, d) => acc + (parseFloat(d.amount) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestão Financeira
          </h1>
          <p className="text-gray-500 text-sm">
            Lançamento e conciliação de despesas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
          >
            <span>📥</span>{" "}
            <span className="hidden sm:inline">Importar PDF</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-700 transition flex items-center gap-2"
          >
            <span>+</span> Nova Despesa
          </button>
        </div>
      </div>

      {/* LISTAGEM DE DESPESAS */}
      {loading ? (
        <LoadingSpinner />
      ) : despesas.length === 0 ? (
        <EmptyState
          icon="💰"
          title="Sem lançamentos"
          description="Comece a registrar as despesas deste condomínio."
          action={{
            label: "Importar Demonstrativo (PDF)",
            onClick: () => setIsImportModalOpen(true),
          }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {despesas.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition ${item.is_consolidated ? "bg-blue-50/30" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {item.description}
                      </p>
                      {item.is_consolidated && (
                        <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wide bg-blue-100 px-1.5 py-0.5 rounded">
                          Importado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(item.due_date)}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold border ${item.paid_at ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
                      >
                        {item.paid_at ? "PAGO" : "PENDENTE"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-600 p-1"
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

      {/* MODAL 1: NOVA DESPESA MANUAL */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Lançar Despesa"
      >
        <form onSubmit={handleSubmitNew} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border rounded-lg"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Vencimento
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border rounded-lg"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Categoria
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg bg-white"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              className="w-5 h-5 text-green-600 rounded"
              checked={formData.isPaid}
              onChange={(e) =>
                setFormData({ ...formData, isPaid: e.target.checked })
              }
            />
            <label className="text-sm font-medium text-gray-700">
              Já foi pago?
            </label>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="flex-1 py-2.5 border rounded-lg font-bold hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: IMPORTAÇÃO DE PDF (IA) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportStep("upload");
          setExtractedData({ receitas: [], despesas: [] });
        }}
        title="Importar Demonstrativo (IA)"
      >
        {importStep === "upload" && (
          <div className="p-4 text-center">
            <div
              onClick={() => !isProcessingPdf && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-indigo-200 bg-indigo-50 rounded-xl p-8 cursor-pointer transition hover:border-indigo-400 ${isProcessingPdf ? "opacity-50" : ""}`}
            >
              {isProcessingPdf ? (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="text-4xl mb-2">🧠</div>
                  <p className="text-indigo-800 font-bold">
                    Lendo e Estruturando...
                  </p>
                  <p className="text-xs text-indigo-500">
                    A IA está processando seu PDF
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-indigo-900 font-bold">
                    Clique para selecionar PDF
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">
                    Suporte para demonstrativos de qualquer administradora
                  </p>
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                className="hidden"
                disabled={isProcessingPdf}
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}

        {importStep === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <p className="text-xs text-green-700 font-bold uppercase">
                  Receitas
                </p>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(totalReceitas)}
                </p>
                <p className="text-[10px] text-green-600">
                  {extractedData.receitas.length} itens
                </p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <p className="text-xs text-red-700 font-bold uppercase">
                  Despesas
                </p>
                <p className="text-lg font-bold text-red-900">
                  {formatCurrency(totalDespesas)}
                </p>
                <p className="text-[10px] text-red-600">
                  {extractedData.despesas.length} itens
                </p>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {extractedData.receitas.map((r, i) => (
                    <tr key={`r-${i}`}>
                      <td className="p-2 text-green-700">{r.description}</td>
                      <td className="p-2 text-right font-bold">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {extractedData.despesas.map((d, i) => (
                    <tr key={`d-${i}`}>
                      <td className="p-2 text-red-700">{d.description}</td>
                      <td className="p-2 text-right font-bold">
                        {formatCurrency(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setImportStep("upload")}
                className="flex-1 py-2 border rounded-lg text-gray-700 font-bold text-sm hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importStep === "saving"}
                className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {importStep === "saving"
                  ? "Processando..."
                  : "Confirmar Importação"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
