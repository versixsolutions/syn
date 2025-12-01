/**
 * COMPONENTE: KeyboardShortcutsHelp
 * Exibe tooltip com atalhos de teclado disponíveis
 */

import { useState } from 'react'

interface Shortcut {
  keys: string
  description: string
}

const shortcuts: Shortcut[] = [
  { keys: 'Alt + 1', description: 'Ir para Dashboard' },
  { keys: 'Alt + S', description: 'Ir para Suporte' },
  { keys: 'Alt + T', description: 'Ir para Transparência' },
  { keys: 'Alt + P', description: 'Ir para Perfil' },
  { keys: 'Alt + N', description: 'Abrir Chat Norma' },
  { keys: 'Tab', description: 'Navegar entre elementos' },
  { keys: 'Shift + Tab', description: 'Navegar para trás' },
  { keys: 'Enter', description: 'Ativar elemento focado' },
  { keys: 'Esc', description: 'Fechar modais' },
  { keys: '?', description: 'Mostrar este menu' },
]

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Botão de ajuda - Escondido em mobile */}
      <button
        onClick={() => setIsOpen(true)}
        data-tour="keyboard-shortcuts"
        className="hidden md:flex fixed bottom-4 right-4 w-12 h-12 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition z-40 items-center justify-center"
        aria-label="Atalhos de teclado"
        title="Atalhos de teclado (pressione ?)"
      >
        <span className="text-lg font-bold">?</span>
      </button>

      {/* Modal de atalhos */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="shortcuts-title" className="text-xl font-bold text-gray-900">
                ⌨️ Atalhos de Teclado
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {shortcuts.map((shortcut, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm text-gray-600">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-mono border border-gray-300">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Pressione <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> para fechar este menu
            </p>
          </div>
        </div>
      )}
    </>
  )
}
