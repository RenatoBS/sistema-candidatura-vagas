import type { TextStyle, ViewStyle } from 'react-native';

/** Cores do chat de desenvolvimento, no visual de uma conversa. */
export const chat = {
  fundo: '#ECE5DD',
  cabecalho: '#075E54',
  recebida: '#FFFFFF',
  enviada: '#DCF8C6',
  textoCabecalho: '#FFFFFF',
};

export const colors = {
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#B91C1C',
  dangerSurface: '#FEF2F2',
  warning: '#B45309',
  warningSurface: '#FFFBEB',
  success: '#047857',
  successSurface: '#ECFDF5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const toque = {
  minAltura: 48,
};

export const tipo = {
  titulo: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  secao: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  corpo: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  destaque: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  legenda: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export const elevacao = {
  cartao: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} satisfies Record<string, ViewStyle>;
