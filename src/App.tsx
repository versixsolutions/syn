import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ReloadPrompt from "./components/ReloadPrompt";
import { Toaster } from "react-hot-toast";
import { useEffect, Suspense, lazy } from "react";
import * as Sentry from "@sentry/react";

// --- PAGES PÚBLICAS ---
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));

// --- PAGES MORADOR (Layout Padrão) ---
const Layout = lazy(() => import("./components/Layout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Comunicacao = lazy(() => import("./pages/Comunicacao"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Profile = lazy(() => import("./pages/Profile"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Ocorrencias = lazy(() => import("./pages/Ocorrencias"));
const NovaOcorrencia = lazy(() => import("./pages/NovaOcorrencia"));
const NovoChamado = lazy(() => import("./pages/NovoChamado"));
const MeusChamados = lazy(() => import("./pages/MeusChamados"));
const Biblioteca = lazy(() => import("./pages/Biblioteca"));
const Comunicados = lazy(() => import("./pages/Comunicados"));
const Votacoes = lazy(() => import("./pages/Votacoes"));
const Transparencia = lazy(() => import("./pages/Transparencia"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Assembleias = lazy(() => import("./pages/Assembleias"));
const AssembleiaDetalhes = lazy(() => import("./pages/AssembleiaDetalhes"));
const AssembleiaPresenca = lazy(() => import("./pages/AssembleiaPresenca"));

// --- PAGES ADMIN (Layout Admin) ---
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const CondominioManagement = lazy(
  () => import("./pages/admin/CondominioManagement"),
);
const OcorrenciasManagement = lazy(
  () => import("./pages/admin/OcorrenciasManagement"),
);
const ComunicadosManagement = lazy(
  () => import("./pages/admin/ComunicadosManagement"),
);
const VotacoesManagement = lazy(
  () => import("./pages/admin/VotacoesManagement"),
);
const FinanceiroManagement = lazy(
  () => import("./pages/admin/FinanceiroManagement"),
);
const KnowledgeBaseManagement = lazy(
  () => import("./pages/admin/KnowledgeBaseManagement"),
);
const MarketplaceManagement = lazy(
  () => import("./pages/admin/MarketplaceManagement"),
);
const ChamadosManagement = lazy(
  () => import("./pages/admin/ChamadosManagement"),
);
const FAQImport = lazy(() => import("./pages/admin/FAQImport"));
const FinanceiroImport = lazy(() => import("./pages/admin/FinanceiroImport"));
const AdminAssembleias = lazy(() => import("./pages/admin/AdminAssembleias"));
const AdminIA = lazy(() => import("./pages/admin/AdminIA"));

// --- COMPONENTES DE PROTEÇÃO DE ROTA ---

function PrivateRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { session, loading, profile, canManage, authError, signOut } =
    useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && session && !profile && authError) {
      console.warn(
        "Sessão inválida detectada (sem perfil). Forçando logout...",
      );
      signOut();
    }
  }, [loading, session, profile, authError, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm font-medium">
        Carregando Versix...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role === "pending") {
    return <Navigate to="/pending-approval" replace />;
  }

  if (adminOnly && !canManage) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PendingRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando...
      </div>
    );

  if (!session) return <Navigate to="/login" replace />;

  if (profile?.role && profile.role !== "pending") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ThemeProvider>
          <ReloadPrompt />

          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#333",
                color: "#fff",
                borderRadius: "8px",
                fontSize: "14px",
                maxWidth: "90vw",
              },
              success: {
                style: {
                  background: "#ecfdf5",
                  color: "#047857",
                  border: "1px solid #a7f3d0",
                },
                iconTheme: { primary: "#059669", secondary: "#ecfdf5" },
              },
              error: {
                style: {
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                },
                iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
              },
            }}
          />

          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center text-gray-500">
                Carregando...
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/pending-approval"
                element={
                  <PendingRoute>
                    <PendingApproval />
                  </PendingRoute>
                }
              />

              <Route
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/comunicacao" element={<Comunicacao />} />
                <Route path="/suporte" element={<Suporte />} />
                <Route path="/transparencia" element={<Transparencia />} />
                <Route
                  path="/transparencia/financeiro"
                  element={<Financeiro />}
                />
                <Route
                  path="/transparencia/assembleias"
                  element={<Assembleias />}
                />
                <Route
                  path="/transparencia/assembleias/:id"
                  element={<AssembleiaDetalhes />}
                />
                <Route
                  path="/transparencia/assembleias/:id/presenca"
                  element={<AssembleiaPresenca />}
                />
                <Route path="/perfil" element={<Profile />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/ocorrencias" element={<Ocorrencias />} />
                <Route path="/ocorrencias/nova" element={<NovaOcorrencia />} />
                <Route path="/chamados/novo" element={<NovoChamado />} />
                <Route path="/chamados" element={<MeusChamados />} />
                <Route path="/biblioteca" element={<Biblioteca />} />
                <Route path="/comunicados" element={<Comunicados />} />
                <Route path="/votacoes" element={<Votacoes />} />
                <Route
                  path="/despesas"
                  element={<Navigate to="/transparencia/financeiro" replace />}
                />
              </Route>

              <Route
                path="/admin"
                element={
                  <PrivateRoute adminOnly>
                    <AdminLayout />
                  </PrivateRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="usuarios" element={<UserManagement />} />
                <Route path="condominios" element={<CondominioManagement />} />
                <Route path="ocorrencias" element={<OcorrenciasManagement />} />
                <Route path="chamados" element={<ChamadosManagement />} />
                <Route path="comunicados" element={<ComunicadosManagement />} />
                <Route path="votacoes" element={<VotacoesManagement />} />
                <Route path="financeiro" element={<FinanceiroManagement />} />
                <Route
                  path="financeiro/import"
                  element={<FinanceiroImport />}
                />
                <Route path="assembleias" element={<AdminAssembleias />} />
                <Route path="ia" element={<KnowledgeBaseManagement />} />
                <Route path="ia-dashboard" element={<AdminIA />} />
                <Route path="marketplace" element={<MarketplaceManagement />} />
                <Route path="faq-import" element={<FAQImport />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

// Error fallback component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-2">
          Oops! Algo deu errado
        </h1>
        <p className="text-gray-700 mb-6">
          Estamos ciente do problema e já começamos a resolvê-lo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}

// Main App with Sentry
export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <Sentry.Profiler name="App">
        <AppRoutes />
      </Sentry.Profiler>
    </Sentry.ErrorBoundary>
  );
}
