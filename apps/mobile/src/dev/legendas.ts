/** Chave i18n da faixa de legenda, ou null quando a rota não entra no roteiro do demo. */
export function chaveLegenda(pathname: string): string | null {
  const rota = (pathname.split('?')[0] ?? pathname).replace(/\/$/, '') || '/';
  if (rota.startsWith('/dev/simulador')) return 'legenda.entrevista';
  if (rota.includes('/admin/auditoria')) return 'legenda.auditoria';
  if (rota.startsWith('/admin') || rota.includes('/mfa')) return 'legenda.admin';
  if (rota.includes('/triagens')) return 'legenda.resultado';
  if (rota.includes('/candidatos') || rota.includes('/ranking') || rota.includes('/sugestoes')) return 'legenda.scores';
  if (rota.includes('/vagas/nova') || rota.includes('/empresa/vagas')) return 'legenda.publicar';
  if (rota.includes('/curriculo')) return 'legenda.curriculo';
  if (rota.includes('/habilidades')) return 'legenda.habilidades';
  if (rota.includes('/privacidade') || rota.includes('/perfil')) return 'legenda.perfil';
  if (rota.includes('/candidato/vagas')) return 'legenda.vagas';
  if (rota.includes('/candidato/candidaturas')) return 'legenda.candidatura';
  if (rota.startsWith('/candidato')) return 'legenda.perfil';
  if (rota.startsWith('/empresa')) return 'legenda.empresa';
  if (rota === '/' || rota.includes('/login')) return 'legenda.acesso';
  return null;
}
