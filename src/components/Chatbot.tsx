import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChatHeader } from "./chatbot/ChatHeader";
import { MessagesList } from "./chatbot/MessagesList";
import { ChatInput } from "./chatbot/ChatInput";
import { useChatbot, ChatOption } from "../hooks/useChatbot";

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const navigate = useNavigate();
  const {
    messages,
    inputText,
    setInputText,
    isTyping,
    messagesEndRef,
    handleSendMessage,
    handleOptionClick,
    createTicketFromChat,
    recordFeedback,
  } = useChatbot({ isOpen });

  function handleWrappedOption(opt: ChatOption) {
    if (opt.type === "action" && opt.value === "suporte") {
      onClose();
      navigate("/suporte");
      return;
    }
    handleOptionClick(opt);
  }

  // Ouve eventos de feedback disparados pelos botões das mensagens
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ useful: boolean }>;
      if (custom?.detail) {
        recordFeedback(custom.detail.useful);
      }
    };
    window.addEventListener("chatbotFeedback", handler as EventListener);
    return () => {
      window.removeEventListener("chatbotFeedback", handler as EventListener);
    };
  }, [recordFeedback]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50 h-[500px] animate-fade-in-up"
      role="dialog"
      aria-label="Chat com assistente Norma"
      aria-modal="true"
    >
      <ChatHeader onClose={onClose} />
      <MessagesList
        messages={messages}
        isTyping={isTyping}
        onOptionClick={handleWrappedOption}
        endRef={messagesEndRef}
      />
      <ChatInput
        value={inputText}
        onChange={setInputText}
        onSubmit={(e) => handleSendMessage(e)}
        disabled={isTyping}
      />
    </div>
  );
}
