import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  isError?: boolean
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou a IA do Pinheiro Park. 🤖\nConheço todo o Regimento e Convenção. Pergunte-me sobre regras, horários ou multas!',
      sender: 'bot',
      timestamp: new Date()
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim()) return

    const userText = inputText.trim()
    
    // 1. Adiciona mensagem do usuário na tela
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
      // 2. Tenta chamar a Inteligência Artificial (Supabase Edge Function)
      // Requer configuração no backend (ver arquivo ask-ai.ts)
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ask-ai', {
        body: { query: userText }
      })

      let botResponse = ''

      if (!aiError && aiData?.answer) {
        // Sucesso: Resposta da IA
        botResponse = aiData.answer
      } else {
        // Fallback: Se a IA falhar ou não estiver configurada, usa a busca local antiga
        console.warn('IA indisponível, usando busca simples:', aiError)
        
        const { data: dataLike } = await supabase
          .from('faqs')
          .select('answer')
          .ilike('question', `%${userText}%`)
          .limit(1)
          
        if (dataLike && dataLike.length > 0) {
          botResponse = `(Modo Offline) ${dataLike[0].answer}`
        } else {
          botResponse = 'Desculpe, não encontrei essa informação nos documentos. Tente reformular sua pergunta ou contate o síndico.'
        }
      }

      // 3. Exibe a resposta
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, botMsg])

    } catch (err) {
      console.error('Erro crítico no chat:', err)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: 'Ocorreu um erro ao processar sua mensagem. Tente novamente mais tarde.',
        sender: 'bot',
        timestamp: new Date(),
        isError: true
      }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {/* Botão Flutuante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary to-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
        >
          <span className="text-3xl">🤖</span>
        </button>
      )}

      {/* Janela do Chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50 h-[500px] animate-fade-in-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl backdrop-blur-sm">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-sm">IA Pinheiro Park</h3>
                <p className="text-xs opacity-90 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      : msg.isError 
                        ? 'bg-red-50 text-red-700 border border-red-200'
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
                  <span className="text-xs text-gray-400 mr-2">Pensando</span>
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
              placeholder="Ex: Pode cachorro na piscina?"
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}