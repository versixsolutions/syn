// src/config/theme-pinheiropark.ts

export const pinheiroParkTheme = {
  name: 'Pinheiro Park',
  slug: 'pinheiropark',
  fullName: 'Condomínio Pinheiro Park',
  
  colors: {
    primary: {
      DEFAULT: '#00A86B',
      dark: '#00724E',
      light: '#00D68F',
      50: '#E6F7F1',
      100: '#CCEFE3',
      200: '#99DFC7',
      300: '#66CFAB',
      400: '#33BF8F',
      500: '#00A86B',
      600: '#008656',
      700: '#006541',
      800: '#00432B',
      900: '#002216',
    },
    secondary: {
      DEFAULT: '#2E7D6E',
      dark: '#1F5349',
      light: '#3D9A88',
    },
    accent: {
      DEFAULT: '#00D68F',
      hover: '#00B578',
    },
    brown: {
      DEFAULT: '#6B4423',
      light: '#00A86B',
      dark: '#4A2F18',
    },
    success: '#00A86B',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#2E7D6E',
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    background: {
      DEFAULT: '#FFFFFF',
      secondary: '#F9FAFB',
      tertiary: '#F3F4F6',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    border: {
      DEFAULT: '#E5E7EB',
      focus: '#00A86B',
    },
  },
  
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      display: ['Poppins', 'Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  spacing: {
    page: '1.5rem',
    card: '1.25rem',
    section: '2rem',
  },
  
  borderRadius: {
    sm: '0.375rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    none: 'none',
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #00A86B 0%, #2E7D6E 100%)',
    header: 'linear-gradient(135deg, #00724E 0%, #00A86B 100%)',
    card: 'linear-gradient(135deg, rgba(0, 168, 107, 0.05) 0%, rgba(46, 125, 110, 0.05) 100%)',
  },
  
  modules: {
    faq: {
      categories: {
        geral: { label: 'Geral', icon: '📋', color: 'blue' },
        regras: { label: 'Regras', icon: '📜', color: 'purple' },
        manutencao: { label: 'Manutenção', icon: '🔧', color: 'orange' },
        financeiro: { label: 'Financeiro', icon: '💰', color: 'green' },
        areas_comuns: { label: 'Áreas Comuns', icon: '🏊', color: 'cyan' },
      },
    },
    despesas: {
      categories: {
        manutencao: { label: 'Manutenção', icon: '🔧', color: 'orange' },
        contas: { label: 'Contas', icon: '📄', color: 'blue' },
        administrativo: { label: 'Administrativo', icon: '📁', color: 'purple' },
        limpeza: { label: 'Limpeza', icon: '🧹', color: 'green' },
        seguranca: { label: 'Segurança', icon: '🛡️', color: 'red' },
      },
    },
    ocorrencias: {
      statuses: {
        aberta: { label: 'Aberta', icon: '🔴', color: 'red' },
        em_analise: { label: 'Em Análise', icon: '🟡', color: 'yellow' },
        em_andamento: { label: 'Em Andamento', icon: '🔵', color: 'blue' },
        resolvida: { label: 'Resolvida', icon: '🟢', color: 'green' },
        arquivada: { label: 'Arquivada', icon: '⚫', color: 'gray' },
      },
    },
    comunicados: {
      priorities: {
        baixa: { label: 'Baixa', icon: '📌', color: 'gray' },
        normal: { label: 'Normal', icon: '📋', color: 'blue' },
        alta: { label: 'Alta', icon: '⚠️', color: 'orange' },
        urgente: { label: 'Urgente', icon: '🚨', color: 'red' },
      },
    },
  },
  
  condominium: {
    totalUnits: 120,
    structure: 'horizontal',
    type: 'casas',
    blocks: [
      { id: 1, name: 'Bloco A', units: 30, type: 'duplex' },
      { id: 2, name: 'Bloco B', units: 30, type: 'duplex' },
      { id: 3, name: 'Bloco C', units: 30, type: 'duplex' },
      { id: 4, name: 'Bloco D', units: 30, type: 'duplex' },
    ],
    amenities: [
      { id: 'piscina', name: 'Piscina', icon: '🏊' },
      { id: 'churrasqueira', name: 'Churrasqueira', icon: '🍖' },
      { id: 'salao', name: 'Salão de Festas', icon: '🎉' },
      { id: 'quadra', name: 'Quadra Poliesportiva', icon: '⚽' },
      { id: 'playground', name: 'Playground', icon: '🎠' },
      { id: 'academia', name: 'Academia', icon: '🏋️' },
    ],
  },
  
  branding: {
    // CORREÇÃO: Apontar para o arquivo .png existente em vez do .svg inexistente
    logoUrl: '/assets/logos/pinheiro-park-logo.png', 
    // Mantendo o white como fallback ou futuro, mas idealmente deve existir também
    logoWhiteUrl: '/assets/logos/pinheiro-park-white.svg', 
    poweredByUrl: '/assets/logos/condomix-badge.svg',
    favicon: '/favicon-pinheiropark.ico',
    meta: {
      title: 'Pinheiro Park - Gestão Inteligente',
      description: 'Sistema de gestão condominial do Pinheiro Park.',
      keywords: ['condomínio', 'gestão', 'pinheiro park'],
    },
    social: {
      instagram: '',
      facebook: '',
      whatsapp: '',
    },
  },
}

export default pinheiroParkTheme

// TIPO EXPORTADO EXPLICITAMENTE PARA CORRIGIR O ERRO
export type Theme = typeof pinheiroParkTheme