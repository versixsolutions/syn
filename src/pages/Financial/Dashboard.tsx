import { useState, useEffect, useMemo } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  BarChart3,
  LineChart as LineChartIcon,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatCurrency, formatDate } from "../../lib/utils";
import PageLayout from "../../components/PageLayout";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../contexts/AuthContext";
import { TransactionForm } from "../../components/Financial/TransactionForm";
import { PeriodSelector } from "../../components/Financial/PeriodSelector";
import { FinancialCharts } from "../../components/Financial/FinancialCharts";

// Types
interface Transaction {
  id: string;
  description: string;
  amount: number;
  reference_month: string;
  payment_date: string;
  category_code: string;
  status: string;
  category: {
    name: string;
    type: string;
  };
}

interface MonthlySummary {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

interface DashboardSummary {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  count: number;
  inadimplenciaMes: number | null;
  inadimplenciaTotal: number | null;
}

interface InadimplenciaRecord {
  id: string;
  condominio_id: string;
  reference_month: string;
  inadimplencia_mes: number | null;
  inadimplencia_total: number | null;
}

interface InadimplenciaFormProps {
  condominioId: string;
  defaultMonth: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const InadimplenciaForm: React.FC<InadimplenciaFormProps> = ({
  condominioId,
  defaultMonth,
  onSuccess,
  onCancel,
}) => {
  const [month, setMonth] = useState(defaultMonth);
  const [inadMes, setInadMes] = useState("0");
  const [inadTotal, setInadTotal] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const mesValue = parseFloat(inadMes.replace(",", "."));
    const totalValue = parseFloat(inadTotal.replace(",", "."));

    if (Number.isNaN(mesValue) || mesValue < 0) {
      setError("Informe a inadimplência do mês (0 ou positivo)");
      return;
    }

    if (Number.isNaN(totalValue) || totalValue < 0) {
      setError("Informe a inadimplência total (0 ou positivo)");
      return;
    }

    try {
      setLoading(true);
      const { error: upsertError } = await supabase
        .from("financial_inadimplencia")
        .upsert(
          {
            condominio_id: condominioId,
            reference_month: month,
            inadimplencia_mes: mesValue,
            inadimplencia_total: totalValue,
          },
          { onConflict: "condominio_id,reference_month" },
        );

      if (upsertError) throw upsertError;

      setSuccess("Inadimplência registrada com sucesso.");
      setTimeout(() => setSuccess(""), 2000);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar inadimplência");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Inadimplência</h3>
          <p className="text-sm text-slate-600">
            Informe o percentual de inadimplência do mês e o acumulado geral.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Referência (AAAA-MM)
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Inadimplência do mês (%)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={inadMes}
            onChange={(e) => setInadMes(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="0,0"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Inadimplência total (%)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={inadTotal}
            onChange={(e) =>
              setInadTotal(e.target.value.replace(/[^\d.,]/g, ""))
            }
            placeholder="0,0"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? "Salvando..." : "Salvar inadimplência"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default function FinancialDashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [modalMode, setModalMode] = useState<"transaction" | "inadimplencia">(
    "transaction",
  );
  const [condominioId, setCondominioId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [inadimplenciaEntries, setInadimplenciaEntries] = useState<
    InadimplenciaRecord[]
  >([]);

  // Verificar se usuário é síndico
  const isSindico =
    profile?.role === "sindico" ||
    profile?.role === "sub_sindico" ||
    profile?.role === "admin";

  // Inicializar com mês atual
  useEffect(() => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    setSelectedPeriods([currentPeriod]);
  }, []);

  // Fetch Data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // 1. Get User's Condominio
        const { data: userData } = await supabase
          .from("users")
          .select("condominio_id")
          .eq("id", user?.id)
          .single();

        if (!userData?.condominio_id) return;

        setCondominioId(userData.condominio_id);

        // 2. Fetch Transactions
        let query = supabase
          .from("financial_transactions")
          .select(
            `
            *,
            category:financial_categories(name, type)
          `,
          )
          .eq("condominio_id", userData.condominio_id)
          .eq("status", "approved")
          .order("reference_month", { ascending: true }); // Order by month for charts

        const { data: transData, error } = await query;

        if (error) throw error;
        setTransactions(transData || []);

        // 3. Buscar inadimplência
        const { data: inadData, error: inadError } = await supabase
          .from("financial_inadimplencia")
          .select("*")
          .eq("condominio_id", userData.condominio_id)
          .order("reference_month", { ascending: true });

        if (inadError) throw inadError;
        setInadimplenciaEntries(inadData || []);

        // 4. Fetch Health Check (Edge Function)
        await supabase.functions.invoke("financial-health-check", {
          body: { condominio_id: userData.condominio_id },
        });

        // Health check invoked for monitoring purposes
      } catch (error) {
        console.error("Error loading financial data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user) loadData();
  }, [user, refreshKey]);

  // Process Data for Charts & Summary
  const summaryData: DashboardSummary = useMemo(() => {
    const filtered = transactions.filter((t) => {
      // Se nenhum período selecionado, mostrar todos
      if (selectedPeriods.length === 0) return true;

      // Verificar se a transação está em algum dos períodos selecionados
      const transactionPeriod = t.reference_month.slice(0, 7); // YYYY-MM
      return selectedPeriods.includes(transactionPeriod);
    });

    const totalReceitas = filtered
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDespesas = filtered
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const saldo = totalReceitas - totalDespesas;

    const currentPeriod = selectedPeriods[selectedPeriods.length - 1] || null;

    const inadMes = currentPeriod
      ? (inadimplenciaEntries.find(
          (item) => item.reference_month.slice(0, 7) === currentPeriod,
        )?.inadimplencia_mes ?? null)
      : null;

    const inadTotal = inadimplenciaEntries.length
      ? (inadimplenciaEntries[inadimplenciaEntries.length - 1]
          .inadimplencia_total ?? null)
      : null;

    return {
      totalReceitas,
      totalDespesas,
      saldo,
      count: filtered.length,
      inadimplenciaMes: inadMes,
      inadimplenciaTotal: inadTotal,
    };
  }, [transactions, selectedPeriods, inadimplenciaEntries]);

  const formatPercent = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "--";
    return `${value.toFixed(1)}%`;
  };

  const chartData = useMemo(() => {
    // Se nenhum período selecionado, retornar vazio
    if (selectedPeriods.length === 0) return [];

    // Group by month
    const monthlyData: Record<string, MonthlySummary> = {};

    // Initialize selected periods
    selectedPeriods.forEach((period) => {
      const [year, month] = period.split("-").map(Number);
      monthlyData[period] = {
        month: new Date(year, month - 1, 1).toLocaleString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        receitas: 0,
        despesas: 0,
        saldo: 0,
      };
    });

    transactions.forEach((t) => {
      const period = t.reference_month.slice(0, 7);
      if (monthlyData[period]) {
        if (t.amount > 0) {
          monthlyData[period].receitas += t.amount;
        } else {
          monthlyData[period].despesas += Math.abs(t.amount);
        }
        monthlyData[period].saldo += t.amount;
      }
    });

    // Ordenar por período
    return Object.keys(monthlyData)
      .sort()
      .map((key) => monthlyData[key]);
  }, [transactions, selectedPeriods]);

  // Process category data for pie chart
  const categoryData = useMemo(() => {
    const filtered = transactions.filter((t) => {
      if (selectedPeriods.length === 0) return true;
      const transactionPeriod = t.reference_month.slice(0, 7);
      return selectedPeriods.includes(transactionPeriod) && t.amount < 0; // Apenas despesas
    });

    const categoryMap: Record<string, number> = {};
    let total = 0;

    filtered.forEach((t) => {
      const categoryName = t.category?.name || "Outros";
      const value = Math.abs(t.amount);
      categoryMap[categoryName] = (categoryMap[categoryName] || 0) + value;
      total += value;
    });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selectedPeriods]);

  if (loading)
    return <LoadingSpinner message="Carregando dados financeiros..." />;

  const handleTransactionSuccess = () => {
    setShowTransactionForm(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <PageLayout
      title="Painel Financeiro"
      subtitle="Visão geral das finanças do condomínio"
      icon="📊"
      headerAction={
        <div className="flex gap-3 items-center flex-wrap">
          <PeriodSelector
            selectedPeriods={selectedPeriods}
            onPeriodsChange={setSelectedPeriods}
            availableYears={[2024, 2025, 2026]}
          />
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setChartType("bar")}
              className={`p-2 rounded transition-colors ${
                chartType === "bar"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Gráfico de Barras"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChartType("line")}
              className={`p-2 rounded transition-colors ${
                chartType === "line"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Gráfico de Linhas"
            >
              <LineChartIcon className="h-4 w-4" />
            </button>
          </div>
          {isSindico && (
            <button
              onClick={() => setShowTransactionForm(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Transação
            </button>
          )}
        </div>
      }
    >
      {/* KPIs - Padrão Mural de Comunicados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Saldo Período */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider">
              Saldo Período
            </h3>
            <div className="bg-indigo-50 p-1.5 md:p-2 rounded-lg">
              <Wallet className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
            </div>
          </div>
          <div
            className={`text-xl md:text-3xl font-extrabold tracking-tight break-words ${
              summaryData.saldo >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatCurrency(summaryData.saldo)}
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1 md:mt-2">
            Resultado operacional
          </p>
        </div>

        {/* Receita Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider">
              Receita Total
            </h3>
            <div className="bg-emerald-50 p-1.5 md:p-2 rounded-lg">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl md:text-3xl font-extrabold tracking-tight text-slate-900 break-words">
            {formatCurrency(summaryData.totalReceitas)}
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1 md:mt-2 flex items-center gap-1">
            <ArrowUpCircle size={12} /> Entradas
          </p>
        </div>

        {/* Despesa Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wider">
              Despesa Total
            </h3>
            <div className="bg-rose-50 p-1.5 md:p-2 rounded-lg">
              <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-rose-600" />
            </div>
          </div>
          <div className="text-xl md:text-3xl font-extrabold tracking-tight text-slate-900 break-words">
            {formatCurrency(summaryData.totalDespesas)}
          </div>
          <p className="text-xs text-rose-600 font-medium mt-1 md:mt-2 flex items-center gap-1">
            <ArrowDownCircle size={12} /> Saídas
          </p>
        </div>

        {/* Inadimplência */}
        <div className="rounded-xl border border-amber-200 bg-white p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h3 className="text-xs md:text-sm font-bold text-amber-700 uppercase tracking-wider">
              Inadimplência ⚠
            </h3>
            <div className="bg-amber-50 p-1.5 md:p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-extrabold tracking-tight text-amber-700">
            {formatPercent(summaryData.inadimplenciaMes)}
          </div>
          <p className="text-xs font-medium text-amber-600 mt-1 md:mt-2 mb-1">
            Inadimplência do mês selecionado
          </p>
          <div className="text-xs md:text-sm text-amber-700 font-semibold">
            Total: {formatPercent(summaryData.inadimplenciaTotal)}
          </div>
        </div>
      </div>

      {/* Financial Charts - New Design */}
      <FinancialCharts
        monthlyData={chartData}
        categoryData={categoryData}
        chartType={chartType}
      />

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">
            Transações Recentes
          </h3>
          <button className="text-sm text-primary font-bold hover:underline">
            Ver Todas
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Descrição</th>
                <th className="px-6 py-4 font-semibold">Categoria</th>
                <th className="px-6 py-4 font-semibold text-right">Valor</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions
                .filter((t) => {
                  if (selectedPeriods.length === 0) return true;
                  const transactionPeriod = t.reference_month.slice(0, 7);
                  return selectedPeriods.includes(transactionPeriod);
                })
                .slice(0, 10)
                .map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {formatDate(t.payment_date || t.reference_month)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {t.description}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {t.category?.name || t.category_code}
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-bold ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Aprovado
                      </span>
                    </td>
                  </tr>
                ))}

              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Nova Transação */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="flex flex-col gap-4 p-6 border-b border-slate-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Registrar</h2>
                <button
                  onClick={() => setShowTransactionForm(false)}
                  className="text-slate-500 hover:text-slate-700 p-1 hover:bg-slate-100 rounded"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setModalMode("transaction")}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                    modalMode === "transaction"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Nova Transação
                </button>
                <button
                  onClick={() => setModalMode("inadimplencia")}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${
                    modalMode === "inadimplencia"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Inadimplência
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6">
              {condominioId && modalMode === "transaction" && (
                <TransactionForm
                  condominioId={condominioId}
                  month={new Date().toISOString().slice(0, 7)}
                  onSuccess={handleTransactionSuccess}
                  onCancel={() => setShowTransactionForm(false)}
                />
              )}

              {condominioId && modalMode === "inadimplencia" && (
                <InadimplenciaForm
                  condominioId={condominioId}
                  defaultMonth={
                    selectedPeriods[0] || new Date().toISOString().slice(0, 7)
                  }
                  onSuccess={() => {
                    setShowTransactionForm(false);
                    setRefreshKey((prev) => prev + 1);
                  }}
                  onCancel={() => setShowTransactionForm(false)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay do Modal */}
      {showTransactionForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowTransactionForm(false)}
          style={{ pointerEvents: "auto" }}
        />
      )}
    </PageLayout>
  );
}
