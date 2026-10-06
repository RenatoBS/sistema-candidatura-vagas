const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export async function api<T>(caminho: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const resposta = await fetch(`${base}${caminho}`, { ...init, headers });
  const texto = await resposta.text();
  const json = texto ? (JSON.parse(texto) as T & { codigo?: string; mensagem?: string }) : ({} as T);
  if (!resposta.ok) {
    const erro = json as { codigo?: string; mensagem?: string };
    throw new ErroApi(resposta.status, erro.codigo ?? 'HTTP', erro.mensagem ?? 'erro');
  }
  return json;
}
