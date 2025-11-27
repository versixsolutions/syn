import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { versixTheme } from '../../config/theme-versix'
import AdminSidebar from './AdminSidebar'
import LoadingSpinner from '../LoadingSpinner'
import { AdminProvider, useAdmin } from '../../contexts/AdminContext'

// Componente interno que consome o contexto (precisa estar dentro do Provider)
function AdminLayoutContent() {
  const { profile } = useAuth()
  const { 
    selectedCondominioId, 
    setSelectedCondominioId, 
    condominios,
    selectedCondominio
  } = useAdmin()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      
      {/* Sidebar Desktop */}
      <aside className="hidden lg:block w-64 fixed inset-y-0 left-0 z-50 shadow-xl">
        <AdminSidebar />
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Mobile */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <AdminSidebar onClose={() => setIsMobileMenuOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col lg:ml-64 min-h-screen transition-all duration-300 min-w-0 overflow-x-hidden">
        
        {/* Topbar Administrativa com SELETOR GLOBAL */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              
              {/* SELETOR GLOBAL DE CONDOMÍNIO */}
              {isAdmin ? (
                <div className="relative group animate-fade-in">
                  <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 pr-3 border border-slate-200 hover:border-blue-300 transition-colors">
                    <div className="bg-slate-800 text-white p-1.5 rounded text-xs font-bold shadow-sm">
                      🏢
                    </div>
                    <select
                      value={selectedCondominioId || ''}
                      onChange={(e) => setSelectedCondominioId(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer min-w-[200px] outline-none"
                    >
                      <option value="" disabled>Selecione um Condomínio...</option>
                      {condominios.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {!selectedCondominioId && (
                    <div className="absolute top-12 left-0 bg-red-500 text-white text-xs px-3 py-1 rounded shadow-lg animate-bounce whitespace-nowrap z-50">
                      👆 Selecione aqui para começar
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-100">
                  <span className="text-lg">🏢</span>
                  <span className="text-sm font-bold truncate max-w-[200px]">{selectedCondominio?.name || profile?.condominio_name || 'Meu Condomínio'}</span>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                  {profile?.role}
                </p>
              </div>
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white ring-1 ring-gray-200"
                style={{ background: versixTheme.colors.primary.DEFAULT }}
              >
                {profile?.full_name?.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Bloqueia se Admin não selecionou condomínio */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full animate-fade-in">
          {isAdmin && !selectedCondominioId ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
              <div className="text-6xl mb-6 animate-bounce">👆</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Nenhum condomínio selecionado</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Para garantir a segurança e organização dos dados, selecione no topo da página qual condomínio você deseja gerenciar agora.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

      </div>
    </div>
  )
}

// Componente Principal que envelopa tudo
export default function AdminLayout() {
  const { user, loading, canManage } = useAuth()

  if (loading) return <LoadingSpinner message="Verificando permissões..." />

  if (!user || !canManage) {
    return <Navigate to="/" replace />
  }

  return (
    <AdminProvider>
      <AdminLayoutContent />
    </AdminProvider>
  )
}