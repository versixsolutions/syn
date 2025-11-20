import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  isError?: boolean
}

interface ChatbotProps {
  isOpen: boolean
  onClose: () => void
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou o assistente virtual do Pinheiro Park. 🤖\nDigite sua dúvida (ex: "horário piscina", "barulho", "mudança") e eu buscarei no Regimento para você!',
      sender: 'bot',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim()) return

    const userText = inputText.trim()
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newUserMsg])
    setInputText('')
    setIsTyping(true)

    try {
      // --- LÓGICA DE BUSCA SEM CUSTO (KEYWORD SEARCH) ---
      // Busca nas FAQs e nos Documentos por palavras-chave
      
      // 1. Busca em FAQs (Perguntas prontas)
      const { data: faqData } = await supabase
        .from('faqs')
        .select('question, answer')
        .ilike('question', `%${userText}%`)
        .limit(1)

      let botResponse = ''

      if (faqData && faqData.length > 0) {
        botResponse = `Encontrei isso no FAQ:\n\n${faqData[0].answer}`
      } else {
        // 2. Se não achar no FAQ, busca nos Documentos (Regimento) via busca de texto simples
        // (Isso requer que você tenha rodado o seed, mas busca por texto ao invés de vetor para ser grátis)
        const { data: docData } = await supabase
          .from('documents')
          .select('content')
          .ilike('content', `%${userText}%`)
          .limit(1)

        if (docData && docData.length > 0) {
          botResponse = `De acordo com o Regimento:\n\n"${docData[0].content}"`
        } else {
          // 3. Fallback genérico
          botResponse = 'Desculpe, não encontrei essa informação específica nos documentos. Tente usar palavras-chave mais simples (ex: "Lixo", "Reforma") ou contate a administração.'
        }
      }

      setTimeout(() => {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: botResponse,
          sender: 'bot',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botMsg])
        setIsTyping(false)
      }, 800) 

    } catch (err) {
      console.error('Erro no chat:', err)
      setIsTyping(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50 h-[500px] animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary p-3 text-white flex justify-between items-center cursor-pointer" onClick={onClose}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg backdrop-blur-sm">
            🤖
          </div>
          <div>
            <h3 className="font-bold text-sm">IA Pinheiro Park</h3>
            <p className="text-[10px] opacity-90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online (Modo Gratuito)
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

      {/* Área de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-primary text-white rounded-br-none'
                  : 'bg-white text-gray-700 border border-gray-200 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none flex gap-1 items-center">
              <span className="text-xs text-gray-400 mr-2">Buscando</span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ex: Pode cachorro?"
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