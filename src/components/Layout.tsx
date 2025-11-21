import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useTheme } from '../contexts/ThemeContext'
import LoadingSpinner from './LoadingSpinner'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { stats } = useDashboardStats()
  const { theme, loading } = useTheme()
  
  // Estado para controlar o menu sidebar (desktop)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  // Menu Desktop (Lateral)
  const desktopNavItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/comunicacao', label: 'Comunicação', icon: '📢' },
    { path: '/suporte', label: 'Suporte', icon: '🤝' },
    { path: '/transparencia', label: 'Transparência', icon: '💰' }, // Ícone atualizado
    { path: '/perfil', label: 'Perfil', icon: '👤' },
  ]

  // Menu Mobile (Inferior)
  const mobileNavItems = [
    { path: '/', label: 'Início', icon: '🏠' },
    { path: '/comunicacao', label: 'Comunicação', icon: '📢' },
    { path: '/suporte', label: 'Suporte', icon: '🤝' },
    { path: '/transparencia', label: 'Transparência', icon: '💰' },
    { path: '/perfil', label: 'Perfil', icon: '👤' },
  ]

  async function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
      await signOut()
      navigate('/login')
    }
  }

  if (loading) return <LoadingSpinner message="Carregando..." />

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Header Desktop e Mobile */}
      <header 
        className="text-white shadow-lg sticky top-0 z-40 transition-all duration-500"
        style={{ background: theme.gradients.header }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* MENU HAMBÚRGUER (Apenas Desktop) */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="hidden md:flex p-2 rounded-lg hover:bg-white/20 transition"
                aria-label="Abrir menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link to="/" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
                  🏢
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">
                    Versix Meu Condomínio
                  </h1>
                  <p className="text-xs opacity-90 font-medium flex flex-col md:flex-row md:gap-1">
                    <span className="font-bold text-white">
                      {profile?.condominio_name || 'Carregando...'}
                    </span>
                  </p>
                </div>
              </Link>
            </div>

            {/* User Menu Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/perfil" className="text-right hover:opacity-80 transition">
                <p className="text-sm font-bold leading-tight">{profile?.full_name?.split(' ')[0]}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">
                  {profile?.role === 'sindico' ? '👑 Síndico' : '🏠 Morador'}
                </p>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-white/20 rounded-lg transition duration-200"
                title="Sair"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* SIDEBAR (Drawer) - Apenas Desktop */}
      {/* Overlay Escuro */}
      <div 
        className={`fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 md:block hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Painel Lateral */}
      <aside 
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:block hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-gray-800">Menu</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {desktopNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200 ${
                  isActive(item.path) 
                    ? 'bg-gray-100 text-primary font-bold' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="pt-6 border-t border-gray-100 mt-auto">
            <button 
              onClick={() => { setIsSidebarOpen(false); handleLogout(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe safe-area-pb">
        <div className="grid grid-cols-5 gap-1 p-1">
          {mobileNavItems.map((item) => {
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center py-2 rounded-lg transition duration-200"
                style={{ 
                  color: active ? theme.colors.primary.DEFAULT : theme.colors.text.secondary,
                  backgroundColor: active ? theme.colors.primary[50] : 'transparent'
                }}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className={`text-[9px] font-medium truncate w-full text-center ${active ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-24 md:pb-8 animate-fade-in flex-1">
        <Outlet />
      </main>
    </div>
  )
}