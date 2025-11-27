import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ReloadPrompt from './components/ReloadPrompt'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

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
import MarketplaceManagement from './pages/admin/MarketplaceManagement' // Nova Importação

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

export default function App() {
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
              <Route path="comunicados" element={<ComunicadosManagement />} />
              <Route path="votacoes" element={<VotacoesManagement />} />
              <Route path="financeiro" element={<FinanceiroManagement />} />
              <Route path="ia" element={<KnowledgeBaseManagement />} />
              <Route path="marketplace" element={<MarketplaceManagement />} /> 
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  )
}