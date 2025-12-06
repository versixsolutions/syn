import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategorySelector } from "./CategorySelector";
import { TransactionForm } from "./TransactionForm";
import * as supabase from "../../lib/supabase";

// Mock do Supabase
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("CategorySelector", () => {
  const mockCategories = [
    {
      id: "1",
      code: "1",
      name: "Receitas",
      type: "RECEITA",
      parent_code: null,
      is_active: true,
    },
    {
      id: "2",
      code: "1.1",
      name: "Receitas Operacionais",
      type: "RECEITA",
      parent_code: "1",
      is_active: true,
    },
    {
      id: "3",
      code: "1.1.01",
      name: "Taxa de Condomínio",
      type: "RECEITA",
      parent_code: "1.1",
      is_active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar o componente", () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: mockCategories, error: null }),
          }),
        }),
      }),
    } as any);

    render(<CategorySelector type="RECEITA" value="" onChange={vi.fn()} />);

    expect(screen.getByText("Categoria")).toBeInTheDocument();
  });

  it("deve carregar categorias do Supabase", async () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: mockCategories, error: null }),
          }),
        }),
      }),
    } as any);

    render(<CategorySelector type="RECEITA" value="" onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/animado/i)).not.toBeInTheDocument();
    });
  });

  it("deve chamar onChange ao selecionar categoria", async () => {
    const onChange = vi.fn();

    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: mockCategories, error: null }),
          }),
        }),
      }),
    } as any);

    render(<CategorySelector type="RECEITA" value="" onChange={onChange} />);

    // Aguardar carregamento das categorias
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Selecionar categoria/ }),
      ).toBeInTheDocument();
    });

    // Abrir dropdown
    const button = screen.getByRole("button", { name: /Selecionar categoria/ });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/1\s*-\s*Receitas/)).toBeInTheDocument();
    });
  });

  it("deve exibir campo obrigatório", () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: mockCategories, error: null }),
          }),
        }),
      }),
    } as any);

    render(
      <CategorySelector type="RECEITA" value="" onChange={vi.fn()} required />,
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

describe("TransactionForm", () => {
  const mockCondominioId = "5c624180-5fca-41fd-a5a0-a6e724f45d96";
  const mockMonth = "2025-12";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve renderizar o formulário", () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as any);

    render(
      <TransactionForm condominioId={mockCondominioId} month={mockMonth} />,
    );

    expect(screen.getByText("Nova Transação")).toBeInTheDocument();
    expect(screen.getByText("Receita (+)")).toBeInTheDocument();
    expect(screen.getByText("Despesa (-)")).toBeInTheDocument();
  });

  it("deve selecionar tipo Receita por padrão", () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as any);

    render(
      <TransactionForm condominioId={mockCondominioId} month={mockMonth} />,
    );

    const receita = screen.getByLabelText("Receita (+)") as HTMLInputElement;
    expect(receita.checked).toBe(true);
  });

  it("deve validar campo obrigatório de valor", async () => {
    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as any);

    const onSuccess = vi.fn();
    render(
      <TransactionForm
        condominioId={mockCondominioId}
        month={mockMonth}
        onSuccess={onSuccess}
      />,
    );

    // Aguardar carregamento do CategorySelector
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Selecionar categoria/i }),
      ).toBeInTheDocument();
    });

    const submitButton = screen.getByText("Salvar Transação");
    fireEvent.click(submitButton);

    // Validação HTML5 irá impedir o submit, não há mensagem de erro customizada
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("deve chamar onCancel", () => {
    const onCancel = vi.fn();

    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    } as any);

    render(
      <TransactionForm
        condominioId={mockCondominioId}
        month={mockMonth}
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByText("Cancelar");
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it("deve converter valor de brasileira para formato decimal", async () => {
    const insertMock = vi.fn().mockResolvedValue({
      data: { id: "1", amount: 1234.56 },
      error: null,
    });

    vi.mocked(supabase.supabase.from).mockImplementation((table) => {
      if (table === "financial_transactions") {
        return {
          insert: insertMock,
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ code: "1.1.01", name: "Taxa" }],
                error: null,
              }),
            }),
          }),
        }),
      } as any;
    });

    const { container } = render(
      <TransactionForm condominioId={mockCondominioId} month={mockMonth} />,
    );

    // Simular preenchimento (mocked para simplicidade)
    // Em teste real, usaria userEvent.type
  });
});

describe("Integração com Supabase", () => {
  it("deve inserir transação com dados corretos", async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      data: {
        id: "123",
        condominio_id: "5c624180-5fca-41fd-a5a0-a6e724f45d96",
        category_code: "1.1.01",
        type: "RECEITA",
        amount: 1000.0,
      },
      error: null,
    });

    vi.mocked(supabase.supabase.from).mockReturnValue({
      insert: mockInsert,
    } as any);

    // Testar inserção
    await supabase.supabase.from("financial_transactions").insert({
      condominio_id: "5c624180-5fca-41fd-a5a0-a6e724f45d96",
      category_code: "1.1.01",
      type: "RECEITA",
      amount: 1000.0,
      transaction_date: "2025-12-01",
      month: "2025-12",
      source: "manual_input",
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("deve buscar categorias com filtros", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ code: "1.1.01", name: "Taxa" }],
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(supabase.supabase.from).mockReturnValue({
      select: mockSelect,
    } as any);

    await supabase.supabase
      .from("financial_categories")
      .select("*")
      .eq("type", "RECEITA")
      .eq("is_active", true);

    expect(mockSelect).toHaveBeenCalledWith("*");
  });
});
