import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AuthContext } from "./AuthContext";
import { supabase } from "../lib/supabase";

import pinheiroParkTheme from "../config/theme-pinheiropark";
// Importação de tipo separada
import type { Theme } from "../config/theme-pinheiropark";
import versixTheme from "../config/theme-versix";

interface ThemeContextType {
  theme: Theme;
  loading: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);

  const [currentTheme, setCurrentTheme] = useState<Theme>(versixTheme);
  const [loading, setLoading] = useState(true);

  const loadTheme = useCallback(async () => {
    if (!auth || !auth.user || !auth.profile?.condominio_id) {
      setCurrentTheme(versixTheme);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("condominios")
        .select("slug, name, theme_config")
        .eq("id", auth.profile.condominio_id)
        .single();

      if (error) throw error;

      // Normalizar strings para comparação segura (remove espaços e caixa alta)
      const slug = data?.slug?.toLowerCase().replace(/\s/g, "") || "";
      const name = data?.name?.toLowerCase() || "";

      console.log("Carregando tema para:", { slug, name }); // Debug

      // Lógica de Seleção de Tema Mais Robusta
      if (slug.includes("pinheiro") || name.includes("pinheiro")) {
        setCurrentTheme(pinheiroParkTheme);
      } else if (slug === "versix") {
        setCurrentTheme(versixTheme);
      } else {
        // Default Fallback
        setCurrentTheme(versixTheme);
      }
    } catch (err) {
      console.error("Erro ao carregar tema:", err);
      setCurrentTheme(versixTheme);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  const toggleTheme = () => {
    console.log("Troca manual desativada");
  };

  return (
    <ThemeContext.Provider
      value={{ theme: currentTheme, loading, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme deve ser usado dentro de um ThemeProvider");
  }
  return context;
}
