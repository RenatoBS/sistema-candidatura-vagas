import { api } from '../api/cliente';

export type CaminhoAcaoAdmin = 'aprovar' | 'rejeitar' | 'suspender' | 'reativar';

export interface AcaoAdminEntrada {
  empresaId: string;
  caminho: CaminhoAcaoAdmin;
  senha: string;
  motivo: string;
  accessToken: string | null;
}

type ChamadaApi = <T>(caminho: string, init?: RequestInit, token?: string | null) => Promise<T>;

/** A senha só vai para a reautenticação; o corpo da ação leva apenas o motivo. */
export async function executarAcaoAdmin(entrada: AcaoAdminEntrada, chamar: ChamadaApi = api): Promise<void> {
  const reauth = await chamar<{ reauthToken: string }>(
    '/auth/reautenticar',
    { method: 'POST', body: JSON.stringify({ senha: entrada.senha }) },
    entrada.accessToken,
  );
  await chamar(
    `/admin/empresas/${entrada.empresaId}/${entrada.caminho}`,
    {
      method: 'POST',
      body: JSON.stringify({ motivo: entrada.motivo.trim() || 'revisao' }),
      headers: { 'x-reauth-token': reauth.reauthToken },
    },
    entrada.accessToken,
  );
}
