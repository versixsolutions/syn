import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useAdmin } from "../../contexts/AdminContext"; // Importar
import { formatDateTime } from "../../lib/utils";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/ui/Modal";

interface Comunicado {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: number;
  created_at: string;
  author: {
    full_name: string;
  };
}

const TYPES = [
  { value: "geral", label: "Geral" },
  { value: "informativo", label: "Informativo" },
  { value: "financeiro", label: "Financeiro" },
  { value: "urgente", label: "Urgente" },
  { value: "assembleia", label: "Assembleia" },
];

export default function ComunicadosManagement() {
  const { user } = useAuth();
  const { selectedCondominioId } = useAdmin(); // Contexto Global

  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "geral",
    isUrgent: false,
  });

  const loadComunicados = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comunicados")
        .select(
          `
          *,
          author:author_id(full_name)
        `,
        )
        .eq("condominio_id", selectedCondominioId) // Filtro Seguro
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((c) => ({
        ...c,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
      }));

      setComunicados(formatted);
    } catch (error) {
      console.error("Erro ao carregar comunicados:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCondominioId]);

  useEffect(() => {
    if (selectedCondominioId) {
      loadComunicados();
    }
  }, [selectedCondominioId, loadComunicados]);

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este comunicado?")) return;
    try {
      const { error } = await supabase
        .from("comunicados")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setComunicados((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedCondominioId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("comunicados").insert({
        title: formData.title,
        content: formData.content,
        type: formData.type,
        priority: formData.isUrgent ? 3 : 1,
        author_id: user.id,
        condominio_id: selectedCondominioId, // INSERÇÃO SEGURA
      });

      if (error) throw error;

      alert("Comunicado publicado com sucesso!");
      setIsModalOpen(false);
      setFormData({ title: "", content: "", type: "geral", isUrgent: false });
      loadComunicados();
    } catch (error: any) {
      alert("Erro ao publicar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicados</h1>
          <p className="text-gray-500 text-sm">
            Gerencie os avisos do mural digital deste condomínio.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-primary-dark transition flex items-center gap-2"
        >
          <span>+</span> Novo Comunicado
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : comunicados.length === 0 ? (
        <EmptyState
          icon="📢"
          title="Mural vazio"
          description="Nenhum comunicado publicado ainda."
        />
      ) : (
        <div className="grid gap-4">
          {comunicados.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition relative group"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        item.priority >= 3
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-blue-50 text-blue-600 border-blue-200"
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    {item.title}
                  </h3>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
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

              <p className="text-gray-600 text-sm whitespace-pre-line leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                {item.content}
              </p>

              <div className="mt-3 text-xs text-gray-400 text-right">
                Publicado por: {item.author?.full_name || "Admin"}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Comunicado"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Título
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Manutenção na Piscina"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Tipo
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer text-gray-700 font-medium">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                  checked={formData.isUrgent}
                  onChange={(e) =>
                    setFormData({ ...formData, isUrgent: e.target.checked })
                  }
                />
                Marcar como Urgente 🚨
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Conteúdo
            </label>
            <textarea
              required
              rows={6}
              placeholder="Digite o texto do comunicado..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-md disabled:opacity-50 transition"
            >
              {isSaving ? "Publicando..." : "Publicar Agora"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
