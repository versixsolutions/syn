import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import Chatbot from '../components/Chatbot'

export default function Suporte() {
  const navigate = useNavigate()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const services = [
    {
      title: 'Assistente Virtual',
      description: 'Tire dúvidas rápidas sobre o regimento com nossa IA.',
      icon: '🤖',
      action: () => setIsChatOpen(true),
      color: 'bg-gradient-to-br from-purple-50 to-white border-purple-100 text-purple-600'
    },
    {
      title: 'Perguntas Frequentes',
      description: 'Consulte a base de conhecimento do condomínio.',
      icon: '❓',
      link: '/faq',
      color: 'bg-blue-50 text-blue-600 border-blue-100'
    },
    {
      title: 'Abrir Ocorrência',
      description: 'Reporte problemas, barulhos ou solicite manutenção.',
      icon: '🚨',
      link: '/ocorrencias/nova',
      color: 'bg-orange-50 text-orange-600 border-orange-100'
    },
    {
      title: 'Biblioteca Oficial',
      description: 'Acesse o Regimento Interno, Convenção e Atas.',
      icon: '📚',
      link: '/biblioteca',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      title: 'Meus Chamados',
      description: 'Acompanhe suas mensagens com a administração.',
      icon: '📞',
      link: '/chamados',
      color: 'bg-cyan-50 text-cyan-600 border-cyan-100'
    },
    {
      title: 'Falar com o Síndico',
      description: 'Envie uma mensagem direta para a administração.',
      icon: '💬',
      link: '/chamados/novo',
      color: 'bg-green-50 text-green-600 border-green-100'
    }
  ]

  return (
    <PageLayout 
      title="Central de Suporte" 
      subtitle="Como podemos ajudar você hoje?" 
      icon="🤝"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {services.map((service) => (
          <div 
            key={service.title}
            // Lógica simplificada: Se tem action, executa. Se não, navega para o link.
            onClick={() => service.action ? service.action() : navigate(service.link!)}
            className={`
              relative p-5 rounded-xl border cursor-pointer transition-all duration-200
              hover:shadow-md hover:-translate-y-1 active:scale-95 bg-white
              ${service.color.includes('bg-gradient') ? 'border-purple-200' : service.color.replace('text-', 'border-')} 
            `}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 shadow-sm ${service.color.split(' ')[0]}`}>
              {service.icon}
            </div>
            
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {service.title}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {service.description}
            </p>
            
            <div className="mt-3 flex items-center text-xs font-bold uppercase tracking-wider opacity-60">
              Acessar <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        ))}
      </div>

      {/* Card de Emergência (Mantido Igual) */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-xl animate-pulse">
              🆘
            </div>
            <div>
              <h3 className="font-bold text-lg">Emergência no Condomínio?</h3>
              <p className="text-slate-400 text-xs">Utilize estes canais apenas em casos graves.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <a href="tel:190" className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-center transition border border-slate-700">
              <span className="block text-xl font-bold text-red-400 mb-1">190</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Polícia</span>
            </a>
            <a href="tel:193" className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-center transition border border-slate-700">
              <span className="block text-xl font-bold text-orange-400 mb-1">193</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Bombeiros</span>
            </a>
            <a href="tel:192" className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-center transition border border-slate-700">
              <span className="block text-xl font-bold text-yellow-400 mb-1">192</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">SAMU</span>
            </a>
            <button className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg text-center transition border border-slate-700 cursor-default">
              <span className="block text-xl font-bold text-blue-400 mb-1">9000</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Portaria</span>
            </button>
          </div>
          
          <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <svg className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>Para vazamento de gás, incêndio ou segurança, acione primeiro a portaria ou os serviços públicos. Não tente resolver sozinho.</p>
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 opacity-5 text-9xl transform rotate-12 pointer-events-none">
          ☎️
        </div>
      </div>

      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </PageLayout>
  )
}