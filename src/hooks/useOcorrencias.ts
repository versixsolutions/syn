import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Ocorrencia, OcorrenciasStats } from "../types";

/**
 * Hook para carregar ocorrências (tickets/issues) do condomínio
 * @function useOcorrencias
 * @param {string} [statusFilter] - Filtro opcional por status (aberta, em_andamento, resolvida)
 * @returns {Object} Objeto contendo ocorrencias, stats, loading e error
 * @returns {Ocorrencia[]} ocorrencias - Array de ocorrências registradas
 * @returns {OcorrenciasStats} stats - Estatísticas das ocorrências (abertas, em andamento, resolvidas)
 * @returns {boolean} loading - Indica se os dados estão sendo carregados
 * @returns {Error|null} error - Erro durante o carregamento, se houver
 * @example
 * const { ocorrencias, stats } = useOcorrencias('aberta')
 * console.log(`${stats.abertas} ocorrências abertas`)
 */
export function useOcorrencias(statusFilter?: string) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [stats, setStats] = useState<OcorrenciasStats>({
    abertas: 0,
    em_andamento: 0,
    resolvidas_mes: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("ocorrencias")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: listData, error: listError } = await query;
      if (listError) throw listError;
      setOcorrencias(listData || []);

      const { count: countAbertas } = await supabase
        .from("ocorrencias")
        .select("*", { count: "exact", head: true })
        .eq("status", "aberto");

      const { count: countAndamento } = await supabase
        .from("ocorrencias")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_andamento");

      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).toISOString();

      const { count: countResolvidas } = await supabase
        .from("ocorrencias")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolvido")
        .gte("resolved_at", startOfMonth)
        .lte("resolved_at", endOfMonth);

      setStats({
        abertas: countAbertas || 0,
        em_andamento: countAndamento || 0,
        resolvidas_mes: countResolvidas || 0,
        total: listData?.length || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { ocorrencias, stats, loading, error, reload: loadData };
}
