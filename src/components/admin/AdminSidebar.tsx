import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { versixTheme } from '../../config/theme-versix'

export default function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const { signOut, isAdmin, isSindico } = useAuth() 
  
  const isActive = (path: string) => location.pathname === path

  const menuItems = [
    { path: '/admin', label: 'Visão Geral', icon: '📊', show: true },
    
    { path: '/admin/condominios', label: 'Condomínios', icon: '🏢', show: isAdmin },
    
    { path: '/admin/usuarios', label: 'Gestão de Acesso', icon: '👥', show: true },
    { path: '/admin/ocorrencias', label: 'Ocorrências', icon: '🚨', show: true },
    { path: '/admin/comunicados', label: 'Comunicados', icon: '📢', show: true },
    { path: '/admin/votacoes', label: 'Assembleia', icon: '🗳️', show: true },
    { path: '/admin/financeiro', label: 'Financeiro', icon: '💰', show: true },
    
    // Novo Item de Marketplace
    { path: '/admin/marketplace', label: 'Gestão Marketplace', icon: '🛍️', show: isAdmin },
    
    { path: '/admin/ia', label: 'Base de Conhecimento', icon: '🧠', show: isAdmin || isSindico },
  ]

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <img 
          src={versixTheme.branding.logoUrl} 
          alt="Versix Admin" 
          className="h-8 w-auto"
        />
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">Versix</h1>
          <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Admin Console</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.filter(item => item.show).map((item) => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${active 
                  ? 'bg-slate-50 text-blue-900 font-bold shadow-sm border border-slate-200' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <span className={`text-lg ${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
              
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"></div>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={() => signOut()}
          className="flex items-center gap-2 text-red-600 hover:bg-red-50 w-full px-4 py-2 rounded-lg transition text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Sair do Sistema
        </button>
      </div>
    </div>
  )
}