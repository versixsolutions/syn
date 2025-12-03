import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import Modal from "./Modal";

const meta = {
  title: "Components/UI/Modal",
  component: Modal,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          'Modal acessível com focus trap, fechamento por ESC, backdrop blur e scroll lock. Implementa WCAG 2.1 AA com role="dialog" e aria-modal.',
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Estado de visibilidade do modal",
    },
    title: {
      control: "text",
      description: "Título do modal",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl", "full"],
      description: "Tamanho do modal",
    },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const ModalWrapper = ({
  size = "md",
  title = "Título do Modal",
}: {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  title?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Abrir Modal
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        size={size}
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Este é um exemplo de conteúdo do modal. Você pode adicionar qualquer
            conteúdo aqui.
          </p>
          <p className="text-gray-600">
            O modal fecha ao clicar no botão X, pressionar ESC ou clicar fora
            (no backdrop).
          </p>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                alert("Ação confirmada!");
                setIsOpen(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export const Default: Story = {
  render: () => <ModalWrapper />,
};

export const Small: Story = {
  render: () => <ModalWrapper size="sm" title="Modal Pequeno" />,
};

export const Large: Story = {
  render: () => <ModalWrapper size="lg" title="Modal Grande" />,
};

export const FullScreen: Story = {
  render: () => <ModalWrapper size="full" title="Modal Tela Cheia" />,
};

export const WithForm: Story = {
  render: function Render() {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Formulário
        </button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Novo Cadastro"
        >
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o nome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Digite o email"
              />
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Formulário enviado!");
                  setIsOpen(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      </>
    );
  },
};
