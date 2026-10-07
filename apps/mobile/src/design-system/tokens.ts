import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  primary: '#3E54D3',
  primaryStrong: '#293AA8',
  primarySoft: '#EEF0FF',
  onPrimary: '#FFFFFF',
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F3F9',
  text: '#16213E',
  textMuted: '#69758C',
  border: '#E4E8F1',
  danger: '#C23B4B',
  dangerSurface: '#FFF0F2',
  warning: '#A96608',
  warningSurface: '#FFF7E8',
  success: '#0B8060',
  successSurface: '#E8F8F1',
  teal: '#0D8D8B',
  tealSoft: '#E5F7F6',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const toque = {
  minAltura: 52,
};

export const tipo = {
  titulo: { fontSize: 32, fontWeight: '800', lineHeight: 38, letterSpacing: -0.6 },
  secao: { fontSize: 22, fontWeight: '800', lineHeight: 28, letterSpacing: -0.25 },
  corpo: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  destaque: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  legenda: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export const elevacao = {
  cartao: {
    shadowColor: '#16213E',
    shadowOpacity: 0.055,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} satisfies Record<string, ViewStyle>;
