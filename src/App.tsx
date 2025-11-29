import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ReloadPrompt from './components/ReloadPrompt'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import * as Sentry from '@sentry/react'

// --- PAGES PÚBLICAS ---
import Login from './pages/Login'
import Signup from './pages/Signup'
import PendingApproval from './pages/PendingApproval'

// --- PAGES MORADOR (Layout Padrão) ---
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Comunicacao from './pages/Comunicacao'
import Suporte from './pages/Suporte'
import Despesas from './pages/Despesas'
import Profile from './pages/Profile'
import FAQ from './pages/FAQ'
import Ocorrencias from './pages/Ocorrencias'
import NovaOcorrencia from './pages/NovaOcorrencia'
import NovoChamado from './pages/NovoChamado'
import MeusChamados from './pages/MeusChamados'
import Biblioteca from './pages/Biblioteca'
import Comunicados from './pages/Comunicados'
import Votacoes from './pages/Votacoes'

// --- PAGES ADMIN (Layout Admin) ---
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import CondominioManagement from './pages/admin/CondominioManagement'
import OcorrenciasManagement from './pages/admin/OcorrenciasManagement'
import ComunicadosManagement from './pages/admin/ComunicadosManagement'
import VotacoesManagement from './pages/admin/VotacoesManagement'
import FinanceiroManagement from './pages/admin/FinanceiroManagement'
import KnowledgeBaseManagement from './pages/admin/KnowledgeBaseManagement'
import MarketplaceManagement from './pages/admin/MarketplaceManagement'
import ChamadosManagement from './pages/admin/ChamadosManagement'
import FAQImport from './pages/admin/FAQImport'
import FinanceiroImport from './pages/admin/FinanceiroImport'

// --- COMPONENTES DE PROTEÇÃO DE ROTA ---

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { session, loading, profile, canManage, authError, signOut } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!loading && session && !profile && authError) {
      console.warn('Sessão inválida detectada (sem perfil). Forçando logout...')
      signOut()
    }
  }, [loading, session, profile, authError, signOut])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm font-medium">Carregando Versix...</div>
  }
  
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role === 'pending') {
    return <Navigate to="/pending-approval" replace />
  }

  if (adminOnly && !canManage) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function PendingRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  
  if (!session) return <Navigate to="/login" replace />
  
  if (profile?.role && profile.role !== 'pending') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
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
              style: { background: '#333', color: '#fff', borderRadius: '8px', fontSize: '14px', maxWidth: '90vw' },
              success: { style: { background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }, iconTheme: { primary: '#059669', secondary: '#ecfdf5' } },
              error: { style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }, iconTheme: { primary: '#dc2626', secondary: '#fef2f2' } },
            }}
          />
          
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/pending-approval" element={<PendingRoute><PendingApproval /></PendingRoute>} />

            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/comunicacao" element={<Comunicacao />} />
              <Route path="/suporte" element={<Suporte />} />
              <Route path="/transparencia" element={<Despesas />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/ocorrencias" element={<Ocorrencias />} />
              <Route path="/ocorrencias/nova" element={<NovaOcorrencia />} />
              <Route path="/chamados/novo" element={<NovoChamado />} />
              <Route path="/chamados" element={<MeusChamados />} />
              <Route path="/biblioteca" element={<Biblioteca />} />
              <Route path="/comunicados" element={<Comunicados />} />
              <Route path="/votacoes" element={<Votacoes />} />
              <Route path="/despesas" element={<Navigate to="/transparencia" replace />} />
            </Route>

            <Route path="/admin" element={<PrivateRoute adminOnly><AdminLayout /></PrivateRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="usuarios" element={<UserManagement />} />
              <Route path="condominios" element={<CondominioManagement />} />
              <Route path="ocorrencias" element={<OcorrenciasManagement />} />
              <Route path="chamados" element={<ChamadosManagement />} />
              <Route path="comunicados" element={<ComunicadosManagement />} />
              <Route path="votacoes" element={<VotacoesManagement />} />
              <Route path="financeiro" element={<FinanceiroManagement />} />
              <Route path="financeiro/import" element={<FinanceiroImport />} />
              <Route path="ia" element={<KnowledgeBaseManagement />} />
              <Route path="marketplace" element={<MarketplaceManagement />} />
              <Route path="faq-import" element={<FAQImport />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  )
}

// Error fallback component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-2">Oops! Algo deu errado</h1>
        <p className="text-gray-700 mb-6">Estamos ciente do problema e já começamos a resolvê-lo.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Recarregar página
        </button>
      </div>
    </div>
  )
}

// Main App with Sentry
export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <Sentry.Profiler name="App">
        <AppRoutes />
      </Sentry.Profiler>
    </Sentry.ErrorBoundary>
  )
}