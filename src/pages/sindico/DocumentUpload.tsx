import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import PageLayout from "../../components/PageLayout";
import LoadingSpinner from "../../components/LoadingSpinner";

interface Document {
  id: string;
  title: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  chunk_count: number;
  status: "processing" | "completed" | "error";
  created_at: string;
  updated_at: string;
}

export default function DocumentUpload() {
  const { profile } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("condominio_id", profile?.condominio_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, [profile?.condominio_id]);

  useEffect(() => {
    if (profile?.condominio_id) {
      loadDocuments();
    }
  }, [profile?.condominio_id, loadDocuments]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!profile?.condominio_id) {
        toast.error("Condomínio não identificado");
        return;
      }

      // Validações
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error("Formato não suportado. Use PDF, DOCX, DOC ou TXT");
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("Arquivo muito grande. Tamanho máximo: 10MB");
        return;
      }

      setUploading(true);
      const toastId = toast.loading("Fazendo upload do documento...");

      try {
        // 1. Upload do arquivo para storage
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `${profile.condominio_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // 2. Obter URL pública
        const {
          data: { publicUrl },
        } = supabase.storage.from("documents").getPublicUrl(filePath);

        setUploadProgress(50);
        toast.loading("Processando documento...", { id: toastId });

        // 3. Criar registro no banco
        const { data: docData, error: dbError } = await supabase
          .from("documents")
          .insert([
            {
              condominio_id: profile.condominio_id,
              title: file.name,
              file_url: publicUrl,
              file_size: file.size,
              mime_type: file.type,
              status: "processing",
              chunk_count: 0,
            },
          ])
          .select()
          .single();

        if (dbError) throw dbError;

        setUploadProgress(75);

        // 4. Chamar edge function para processar
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              document_id: docData.id,
              file_url: publicUrl,
              condominio_id: profile.condominio_id,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Erro ao processar documento");
        }

        setUploadProgress(100);
        toast.success("Documento enviado e processado com sucesso!", {
          id: toastId,
        });

        // Recarregar lista
        setTimeout(() => {
          loadDocuments();
          setUploadProgress(0);
        }, 1000);
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Erro ao fazer upload", { id: toastId });
      } finally {
        setUploading(false);
      }
    },
    [profile, loadDocuments],
  );

  async function handleDelete(doc: Document) {
    if (!confirm(`Tem certeza que deseja excluir "${doc.title}"?`)) return;

    const toastId = toast.loading("Excluindo documento...");

    try {
      // 1. Deletar do storage
      const filePath = doc.file_url.split("/documents/")[1];
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([filePath]);

        if (storageError)
          console.warn("Erro ao deletar do storage:", storageError);
      }

      // 2. Deletar do banco (cascade irá deletar vectors no Qdrant via webhook/trigger)
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      toast.success("Documento excluído com sucesso!", { id: toastId });
      loadDocuments();
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao excluir documento", { id: toastId });
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType.includes("text")) return "📃";
    return "📎";
  }

  if (loading) return <LoadingSpinner />;

  return (
    <PageLayout
      title="Upload Documentos"
      subtitle="Enriquecer base de conhecimento da Norma"
      icon="📚"
    >
      {/* Área de Upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`mb-6 border-2 border-dashed rounded-xl p-12 text-center transition ${
          isDragging
            ? "border-primary bg-blue-50"
            : "border-gray-300 bg-white hover:border-primary hover:bg-gray-50"
        }`}
      >
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">📤</div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {isDragging
              ? "Solte o arquivo aqui"
              : "Arraste um documento ou clique para selecionar"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            PDF, DOCX, DOC ou TXT • Máximo 10MB
          </p>

          <input
            type="file"
            id="file-upload"
            accept=".pdf,.docx,.doc,.txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
            disabled={uploading}
          />

          <label
            htmlFor="file-upload"
            className={`inline-block px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition cursor-pointer ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploading ? "Processando..." : "Selecionar Arquivo"}
          </label>

          {uploading && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{uploadProgress}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total de Documentos</p>
          <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total de Chunks</p>
          <p className="text-2xl font-bold text-gray-900">
            {documents.reduce((sum, d) => sum + d.chunk_count, 0)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Tamanho Total</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatFileSize(documents.reduce((sum, d) => sum + d.file_size, 0))}
          </p>
        </div>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Nenhum documento ainda
            </h3>
            <p className="text-gray-500">
              Comece fazendo upload de regimentos, atas ou manuais
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{getFileIcon(doc.mime_type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 truncate">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{doc.chunk_count} chunks</span>
                        <span>•</span>
                        <span>
                          {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          doc.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : doc.status === "processing"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {doc.status === "completed"
                          ? "✓ Processado"
                          : doc.status === "processing"
                            ? "⏳ Processando"
                            : "✗ Erro"}
                      </span>

                      {/* Ações */}
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Baixar"
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </a>

                      <button
                        onClick={() => handleDelete(doc)}
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

                  {doc.status === "processing" && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-yellow-500 h-1.5 rounded-full animate-pulse"
                          style={{ width: "60%" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dica */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">Dica:</p>
            <p className="text-sm text-blue-700">
              Documentos carregados são automaticamente processados e indexados
              para que a Norma possa responder perguntas baseadas no conteúdo.
              Recomendamos enviar: Regimento Interno, Atas de Assembleia,
              Manuais de Procedimentos e Regulamentos.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
