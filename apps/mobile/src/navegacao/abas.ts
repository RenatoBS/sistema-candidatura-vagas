export type GrupoAbas = 'candidato' | 'empresa';

export interface Aba {
  id: string;
  rotuloKey: string;
  href: '/candidato/vagas' | '/candidato/candidaturas' | '/candidato/notificacoes' | '/candidato/perfil' | '/empresa/vagas' | '/empresa/notificacoes' | '/empresa';
  icone: 'vagas' | 'candidaturas' | 'notificacoes' | 'perfil' | 'empresa';
}

export const ABAS: Record<GrupoAbas, readonly Aba[]> = {
  candidato: [
    { id: 'vagas', rotuloKey: 'abas.vagas', href: '/candidato/vagas', icone: 'vagas' },
    { id: 'candidaturas', rotuloKey: 'abas.candidaturas', href: '/candidato/candidaturas', icone: 'candidaturas' },
    { id: 'notificacoes', rotuloKey: 'abas.notificacoes', href: '/candidato/notificacoes', icone: 'notificacoes' },
    { id: 'perfil', rotuloKey: 'abas.perfil', href: '/candidato/perfil', icone: 'perfil' },
  ],
  empresa: [
    { id: 'vagas', rotuloKey: 'abas.vagas', href: '/empresa/vagas', icone: 'vagas' },
    { id: 'notificacoes', rotuloKey: 'abas.notificacoes', href: '/empresa/notificacoes', icone: 'notificacoes' },
    { id: 'empresa', rotuloKey: 'abas.empresa', href: '/empresa', icone: 'empresa' },
  ],
};

const ROTAS_COM_BARRA: Record<GrupoAbas, readonly string[]> = {
  candidato: ['/candidato', '/candidato/vagas', '/candidato/candidaturas', '/candidato/notificacoes', '/candidato/perfil'],
  empresa: ['/empresa', '/empresa/vagas', '/empresa/notificacoes'],
};

export function normalizarRota(pathname: string): string {
  const semHash = pathname.split('#')[0] ?? pathname;
  const semQuery = semHash.split('?')[0] ?? semHash;
  if (semQuery.length > 1 && semQuery.endsWith('/')) return semQuery.slice(0, -1);
  return semQuery;
}

export function barraVisivel(grupo: GrupoAbas, pathname: string): boolean {
  return ROTAS_COM_BARRA[grupo].includes(normalizarRota(pathname));
}

export function abaAtiva(grupo: GrupoAbas, pathname: string): string | null {
  const rota = normalizarRota(pathname);
  const especificas = ABAS[grupo]
    .filter((aba) => aba.href !== `/${grupo}`)
    .slice()
    .sort((a, b) => b.href.length - a.href.length);
  const encontrada = especificas.find((aba) => rota === aba.href || rota.startsWith(`${aba.href}/`));
  if (encontrada) return encontrada.id;
  if (rota === `/${grupo}`) return grupo === 'candidato' ? 'vagas' : 'empresa';
  return null;
}
