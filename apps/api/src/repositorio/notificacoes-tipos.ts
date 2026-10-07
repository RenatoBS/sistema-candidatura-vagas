import type { TipoNotificacaoEmpresa } from '@scv/domain';

export interface NotificacaoRegistro {
  id: string;
  usuarioId: string;
  empresaId: string | null;
  tipo: TipoNotificacaoEmpresa;
  chaveDedup: string;
  /** `central: false` quando o usuário desligou o in-app: a linha existe só para dedup/agrupamento. */
  dados: Record<string, unknown>;
  agrupadas: number;
  lidaEm: Date | null;
  criadoEm: Date;
}

export type NotificacaoNova = Omit<NotificacaoRegistro, 'agrupadas' | 'lidaEm'>;

export interface FiltroNotificacoes {
  usuarioId: string;
  /** `undefined` = todas as empresas visíveis no contexto. */
  empresaId?: string;
  pagina: number;
  limite: number;
}

export interface PaginaNotificacoes {
  itens: NotificacaoRegistro[];
  total: number;
  naoLidas: number;
}

export interface PreferenciaNotificacaoRegistro {
  usuarioId: string;
  empresaId: string;
  tipo: TipoNotificacaoEmpresa;
  inApp: boolean;
  push: boolean;
  email: boolean;
  limiarMatch: number | null;
}
