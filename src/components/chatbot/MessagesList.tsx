import React from "react";

interface ChatOption {
  label: string;
  value: string;
  type: "category" | "question" | "action";
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  isError?: boolean;
  options?: ChatOption[];
}

interface MessagesListProps {
  messages: Message[];
  isTyping: boolean;
  onOptionClick: (opt: ChatOption) => void;
  endRef: React.RefObject<HTMLDivElement>;
}

export function MessagesList({
  messages,
  isTyping,
  onOptionClick,
  endRef,
}: MessagesListProps) {
  return (
    <div
      className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4"
      role="log"
      aria-live="polite"
      aria-atomic="false"
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
        >
          <div
            className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
              msg.sender === "user"
                ? "bg-primary text-white rounded-br-none"
                : msg.isError
                  ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-none"
                  : "bg-white text-gray-700 border border-gray-200 rounded-bl-none"
            }`}
          >
            <p className="whitespace-pre-line leading-relaxed">
              {msg.text
                .split("**")
                .map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i}>{part}</strong>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
            </p>
            <p
              className={`text-[10px] mt-1 text-right ${msg.sender === "user" ? "text-white/70" : "text-gray-400"}`}
            >
              {msg.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Controles de feedback para respostas da Norma */}
          {msg.sender === "bot" && !msg.isError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span className="text-gray-400">Esta resposta foi útil?</span>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("chatbotFeedback", {
                      detail: { useful: true },
                    }),
                  )
                }
                className="px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                aria-label="Resposta útil"
                title="Marcar como útil"
              >
                👍 Útil
              </button>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("chatbotFeedback", {
                      detail: { useful: false },
                    }),
                  )
                }
                className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                aria-label="Resposta não útil"
                title="Marcar como não útil"
              >
                👎 Não útil
              </button>
            </div>
          )}

          {msg.options && (
            <div className="flex flex-wrap gap-2 mt-2 max-w-[90%] animate-fade-in">
              {msg.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onOptionClick(opt)}
                  aria-label={`Opção: ${opt.label}`}
                  className={`text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm border flex items-center gap-2 ${
                    opt.type === "action"
                      ? "bg-white border-orange-200 text-orange-600 hover:bg-orange-50"
                      : "bg-white border-primary text-primary hover:bg-primary hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-none flex gap-1 items-center shadow-sm">
            <span className="text-[10px] text-gray-400 mr-2 font-medium">
              Norma pensando...
            </span>
            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce delay-100"></span>
            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce delay-200"></span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
