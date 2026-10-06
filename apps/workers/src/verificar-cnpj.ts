export async function executarVerificacaoCnpj(
  empresaId: string,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const base = env.API_PUBLIC_URL ?? 'http://localhost:3000';
  const resposta = await fetchImpl(`${base}/api/v1/interno/empresas/${empresaId}/verificar-cnpj`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': env.INTERNAL_JOB_TOKEN ?? '',
    },
  });
  if (!resposta.ok) {
    throw new Error(`verificar-cnpj falhou com status ${resposta.status}`);
  }
  return resposta.json();
}
