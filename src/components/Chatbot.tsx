import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ChatOption {
  label: string
  value: string
  type: 'category' | 'question' | 'action'
}

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  isError?: boolean
  options?: ChatOption[]
}

interface ChatbotProps {
  isOpen: boolean
  onClose: () => void
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [lastQuestion, setLastQuestion] = useState('')

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen && !initialized.current) {
      const hour = new Date().getHours()
      let greeting = 'Bom dia'
      if (hour >= 12) greeting = 'Boa tarde'
      if (hour >= 18) greeting = 'Boa noite'
      const name = profile?.full_name?.split(' ')[0] || 'Morador'

      setMessages([{
        id: '1',
        text: `${greeting}, ${name}! Sou a **Norma**, sua assistente virtual. 🤖\n\nJá estudei o regimento e as regras do condomínio. Como posso ajudar hoje?`,
        sender: 'bot',
        timestamp: new Date()
      }])
      initialized.current = true
    }
  }, [isOpen, profile])

  async function createTicketFromChat() {
    if (!user || !lastQuestion) return
    setIsTyping(true)
    try {
      const { error } = await supabase.from('chamados').insert({
        user_id: user.id,
        condominio_id: profile?.condominio_id, // ✅ ADICIONADO
        subject: 'Dúvida via Chatbot (Norma)',
        description: lastQuestion, 
        status: 'aberto'
      })
      if (error) throw error
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: `✅ **Chamado Aberto!**\n\nEnviei sua dúvida para o síndico. Você será notificado quando houver resposta.`,
          sender: 'bot',
          timestamp: new Date()
        }])
        setIsTyping(false)
      }, 1000)
    } catch (err) {
      console.error('❌ Erro ao criar chamado:', err)
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        text: 'Erro ao criar chamado. Tente novamente.', 
        sender: 'bot', 
        timestamp: new Date(), 
        isError: true 
      }])
      setIsTyping(false)
    }
  }

  function handleOptionClick(option: ChatOption) {
    if (option.type === 'action') {
      if (option.value === 'chamado') createTicketFromChat()
      else if (option.value === 'suporte') { onClose(); navigate('/suporte') }
      return
    }
    handleSendMessage(null, option.label)
  }

  async function handleSendMessage(e: React.FormEvent | null, textOverride?: string) {
    if (e) e.preventDefault()
    const textToSend = textOverride || inputText
    if (!textToSend.trim()) return
    
    const name = profile?.full_name?.split(' ')[0] || 'Morador'
    setLastQuestion(textToSend)
    
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      text: textToSend, 
      sender: 'user', 
      timestamp: new Date() 
    }])
    setInputText('')
    setIsTyping(true)

    try {
      // ✅ VALIDAÇÃO ANTES DE CHAMAR API
      if (!profile?.condominio_id) {
        throw new Error('Condomínio não configurado. Entre em contato com o síndico.')
      }

      console.log('🔍 [DEBUG] Enviando para ask-ai:', {
        query: textToSend,
        userName: name,
        filter_condominio_id: profile.condominio_id
      })

      // ✅ CHAMADA PARA EDGE FUNCTION COM VALIDAÇÃO
      const { data, error } = await supabase.functions.invoke('ask-ai', {
        body: { 
          query: textToSend, // ✅ GARANTIDO que não é vazio
          userName: name,
          filter_condominio_id: profile.condominio_id // ✅ GARANTIDO que existe
        }
      })

      console.log('📊 [DEBUG] Resposta ask-ai:', { data, error })

      if (error) {
        console.error('❌ [DEBUG] Erro da API:', error)
        throw error
      }

      // ✅ VALIDAÇÃO DA RESPOSTA
      if (!data) {
        throw new Error('Resposta vazia da API')
      }

      const botResponse = data.answer || "Desculpe, não consegui processar sua pergunta no momento."

      // ✅ DETECTAR SE NÃO ENCONTROU INFORMAÇÃO
      const notFoundKeywords = ["não encontrei", "não consta", "não localizei", "desculpe", "não há", "sem informação"]
      const seemsNotFound = notFoundKeywords.some(kw => botResponse.toLowerCase().includes(kw))

      const options: ChatOption[] | undefined = seemsNotFound ? [
        { label: '🎫 Abrir Chamado', value: 'chamado', type: 'action' },
        { label: '📞 Ver Contatos', value: 'suporte', type: 'action' }
      ] : undefined

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
        options: options
      }])

    } catch (err: any) {
      console.error('❌ [DEBUG] Erro completo:', err)
      
      let errorMessage = 'Estou com dificuldade de conexão no momento. '
      
      // ✅ MENSAGENS DE ERRO MAIS ESPECÍFICAS
      if (err.message?.includes('condominio_id')) {
        errorMessage = 'Seu perfil não está vinculado a um condomínio. Entre em contato com o suporte.'
      } else if (err.message?.includes('Query não fornecida')) {
        errorMessage = 'Erro ao processar sua pergunta. Por favor, tente novamente.'
      } else if (err.message?.includes('500')) {
        errorMessage = 'Erro no servidor. Nossa equipe foi notificada. Tente novamente em instantes.'
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: errorMessage,
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
        options: [
          { label: '🎫 Abrir Chamado', value: 'chamado', type: 'action' },
          { label: '📞 Ver Suporte', value: 'suporte', type: 'action' }
        ]
      }])
    } finally {
      setIsTyping(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50 h-[500px] animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary p-3 text-white flex justify-between items-center cursor-pointer" onClick={onClose}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg backdrop-blur-sm border border-white/20">
            👩‍💻
          </div>
          <div>
            <h3 className="font-bold text-sm">Fale com a Norma</h3>
            <p className="text-[10px] opacity-90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
              msg.sender === 'user' 
                ? 'bg-primary text-white rounded-br-none' 
                : msg.isError 
                  ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-none' 
                  : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'
            }`}>
              <p className="whitespace-pre-line leading-relaxed">
                {msg.text.split('**').map((part, i) => 
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                )}
              </p>
              <p className={`text-[10px] mt-1 text-right ${
                msg.sender === 'user' ? 'text-white/70' : 'text-gray-400'
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            {/* Options */}
            {msg.options && (
              <div className="flex flex-wrap gap-2 mt-2 max-w-[90%] animate-fade-in">
                {msg.options.map((opt) => (
                  <button 
                    key={opt.value} 
                    onClick={() => handleOptionClick(opt)} 
                    className={`text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm border flex items-center gap-2 ${
                      opt.type === 'action' 
                        ? 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50' 
                        : 'bg-white border-primary text-primary hover:bg-primary hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none flex gap-1 items-center shadow-sm">
              <span className="text-[10px] text-gray-400 mr-2 font-medium">Norma pensando...</span>
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => handleSendMessage(e)} className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          placeholder="Digite sua dúvida..." 
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition" 
        />
        <button 
          type="submit" 
          disabled={!inputText.trim() || isTyping} 
          className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
        >
          <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}