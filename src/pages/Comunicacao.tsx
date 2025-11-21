import { useNavigate } from 'react-router-dom'
import { useDashboardStats } from '../hooks/useDashboardStats'
import PageLayout from '../components/PageLayout'

export default function Comunicacao() {
  const navigate = useNavigate()
  const { stats } = useDashboardStats()

  return (
    <PageLayout 
      title="Comunicação & Decisões" 
      subtitle="Fique informado e participe das decisões" 
      icon="📢"
    >
      <div className="grid grid-cols-1 gap-6">
        
        {/* Card Comunicados */}
        <div 
          onClick={() => navigate('/comunicados')}
          className="bg-white rounded-xl p-6 border-l-4 border-blue-500 shadow-sm hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                📰
              </div>
              <div>
                {/* ALTERADO DE 'Mural de Avisos' PARA 'Comunicados' */}
                <h3 className="text-xl font-bold text-gray-900">Comunicados</h3>
                <p className="text-gray-500 text-sm mt-1">Comunicados oficiais, circulares e notícias.</p>
              </div>
            </div>
            {stats.comunicados.nao_lidos > 0 && (
               <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                 {stats.comunicados.nao_lidos} NOVOS
               </span>
            )}
          </div>
        </div>

        {/* Card Votações */}
        <div 
          onClick={() => navigate('/votacoes')}
          className="bg-white rounded-xl p-6 border-l-4 border-purple-500 shadow-sm hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🗳️
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Assembleia Digital</h3>
                <p className="text-gray-500 text-sm mt-1">Participe das votações e enquetes ativas.</p>
              </div>
            </div>
            {stats.votacoes.ativas > 0 ? (
               <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                 {stats.votacoes.ativas} ATIVAS
               </span>
            ) : (
              <span className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">
                 Nenhuma ativa
               </span>
            )}
          </div>
        </div>

      </div>
    </PageLayout>
  )
}