import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../lib/utils";
import PageLayout from "../components/PageLayout";
import LoadingSpinner from "../components/LoadingSpinner";

interface TransparenciaKPIs {
  assembleias: {
    total: number;
    proxima: string | null;
    emAndamento: number;
  };
  financeiro: {
    totalMes: number;
    totalAno: number;
    categorias: number;
  };
}

export default function Transparencia() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [kpis, setKpis] = useState<TransparenciaKPIs>({
    assembleias: { total: 0, proxima: null, emAndamento: 0 },
    financeiro: { totalMes: 0, totalAno: 0, categorias: 0 },
  });
  const [loading, setLoading] = useState(true);

  const loadKPIs = useCallback(async () => {
    setLoading(true);
    try {
      // KPIs de Assembleias
      const { data: assembleias } = await supabase
        .from("assembleias")
        .select("id, data_hora, status")
        .eq("condominio_id", profile?.condominio_id);

      const total = assembleias?.length || 0;
      const emAndamento =
        assembleias?.filter((a) => a.status === "em_andamento").length || 0;

      // Próxima assembleia agendada
      const proximas = assembleias
        ?.filter(
          (a) => a.status === "agendada" && new Date(a.data_hora) > new Date(),
        )
        .sort(
          (a, b) =>
            new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
        );

      const proximaData =
        proximas && proximas.length > 0
          ? new Date(proximas[0].data_hora).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
          : null;

      // KPIs Financeiro
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();

      const { data: despesasMes } = await supabase
        .from("despesas")
        .select("amount")
        .eq("condominio_id", profile?.condominio_id)
        .gte("created_at", startOfMonth);

      const { data: despesasAno } = await supabase
        .from("despesas")
        .select("amount")
        .eq("condominio_id", profile?.condominio_id)
        .gte("created_at", startOfYear);

      const { data: categorias } = await supabase
        .from("despesa_categories")
        .select("id")
        .eq("condominio_id", profile?.condominio_id);

      const totalMes =
        despesasMes?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const totalAno =
        despesasAno?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

      setKpis({
        assembleias: { total, proxima: proximaData, emAndamento },
        financeiro: {
          totalMes,
          totalAno,
          categorias: categorias?.length || 0,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar KPIs:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.condominio_id]);

  useEffect(() => {
    if (profile?.condominio_id) {
      loadKPIs();
    }
  }, [profile?.condominio_id, loadKPIs]);

  if (loading) return <LoadingSpinner message="Carregando transparência..." />;

  return (
    <PageLayout
      title="Transparência"
      subtitle="Acesso completo às informações do condomínio"
      icon="🔍"
    >
      <div className="max-w-4xl mx-auto">
        {/* Cards de Módulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Assembleias */}
          <button
            onClick={() => navigate("/transparencia/assembleias")}
            className="bg-white border-2 border-purple-200 rounded-2xl p-6 hover:shadow-xl hover:border-purple-400 transition-all duration-300 text-left group active:scale-95"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🗳️
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-purple-600">
                  {kpis.assembleias.total}
                </div>
                <div className="text-xs text-purple-400 font-medium">Total</div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
              Assembleias
            </h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Consulte editais, atas, participe de votações e acompanhe decisões
              da assembleia.
            </p>

            {/* KPIs */}
            <div className="space-y-2 border-t border-purple-100 pt-4">
              {kpis.assembleias.emAndamento > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">🔴 Em andamento</span>
                  <span className="font-bold text-purple-600">
                    {kpis.assembleias.emAndamento}
                  </span>
                </div>
              )}
              {kpis.assembleias.proxima && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">📅 Próxima assembleia</span>
                  <span className="font-bold text-purple-600">
                    {kpis.assembleias.proxima}
                  </span>
                </div>
              )}
              {!kpis.assembleias.proxima &&
                kpis.assembleias.emAndamento === 0 && (
                  <div className="text-xs text-gray-400 text-center">
                    Nenhuma assembleia agendada no momento
                  </div>
                )}
            </div>

            <div className="mt-4 flex items-center text-sm font-bold text-purple-600 group-hover:gap-2 transition-all">
              Acessar módulo
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          {/* Card Prestação de Contas */}
          <button
            onClick={() => navigate("/transparencia/financeiro")}
            className="bg-white border-2 border-green-200 rounded-2xl p-6 hover:shadow-xl hover:border-green-400 transition-all duration-300 text-left group active:scale-95"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                💰
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(kpis.financeiro.totalMes)}
                </div>
                <div className="text-xs text-green-400 font-medium">
                  Este mês
                </div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
              Prestação de Contas
            </h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Acompanhe todas as despesas, receitas e movimentações financeiras
              do condomínio.
            </p>

            {/* KPIs */}
            <div className="space-y-2 border-t border-green-100 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">📊 Total no ano</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(kpis.financeiro.totalAno)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">🏷️ Categorias</span>
                <span className="font-bold text-green-600">
                  {kpis.financeiro.categorias}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center text-sm font-bold text-green-600 group-hover:gap-2 transition-all">
              Acessar módulo
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
