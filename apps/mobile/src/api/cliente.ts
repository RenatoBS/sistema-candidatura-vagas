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

type Renovador = () => Promise<string | null>;
let renovador: Renovador | null = null;
let renovacaoEmCurso: Promise<string | null> | null = null;

/** Registra quem renova o access token expirado (AuthProvider). */
export function registrarRenovador(fn: Renovador | null): void {
  renovador = fn;
}

function renovarUmaVez(): Promise<string | null> {
  if (!renovador) return Promise.resolve(null);
  renovacaoEmCurso ??= renovador().finally(() => {
    renovacaoEmCurso = null;
  });
  return renovacaoEmCurso;
}

function rotaDeAuth(caminho: string): boolean {
  return caminho.startsWith('/auth/');
}

export async function api<T>(caminho: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const enviar = (tk?: string | null) => {
    const headers = new Headers(init.headers);
    if (tk) headers.set('authorization', `Bearer ${tk}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return fetch(`${base}${caminho}`, { ...init, headers });
  };
  let resposta = await enviar(token);
  if (resposta.status === 401 && token && !rotaDeAuth(caminho)) {
    const novo = await renovarUmaVez();
    if (novo) resposta = await enviar(novo);
  }
  const texto = await resposta.text();
  const json = texto ? (JSON.parse(texto) as T & { codigo?: string; mensagem?: string }) : ({} as T);
  if (!resposta.ok) {
    const erro = json as { codigo?: string; mensagem?: string };
    throw new ErroApi(resposta.status, erro.codigo ?? 'HTTP', erro.mensagem ?? 'erro');
  }
  return json;
}
