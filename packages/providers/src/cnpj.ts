export interface ResultadoFonteCnpj {
  situacaoAtiva: boolean;
  razaoSocial: string;
  indisponivel: boolean;
}

export interface FonteCnpjProvider {
  consultar(cnpj: string): Promise<ResultadoFonteCnpj>;
}

interface RespostaBrasilApi {
  razao_social?: string;
  descricao_situacao_cadastral?: string;
}

/** A BrasilAPI responde 403 a clientes sem User-Agent identificável. */
export const USER_AGENT_CNPJ = 'sistema-candidatura-vagas/1.0 (verificacao-cnpj)';

export interface OpcoesBrasilApi {
  baseUrl?: string;
  userAgent?: string;
  /** Total de tentativas para 403/429/5xx/rede (padrão 3). */
  tentativas?: number;
  /** Atraso base em ms; cresce exponencialmente (padrão 500). Testes passam 0. */
  atrasoBaseMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

const INDISPONIVEL: ResultadoFonteCnpj = { situacaoAtiva: false, razaoSocial: '', indisponivel: true };

/**
 * BrasilAPI pública. Trocar o provider não muda a regra de dígitos nem o job.
 * Testes devem injetar mock — esta classe só é usada com fetch explícito.
 *
 * 404 = CNPJ inexistente (não é indisponibilidade); 403/429/5xx/rede = fonte indisponível, com retry.
 */
export class BrasilApiFonteCnpj implements FonteCnpjProvider {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly tentativas: number;
  private readonly atrasoBaseMs: number;
  private readonly esperar: (ms: number) => Promise<void>;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    opcoes: OpcoesBrasilApi | string = {},
  ) {
    const config = typeof opcoes === 'string' ? { baseUrl: opcoes } : opcoes;
    this.baseUrl = config.baseUrl ?? 'https://brasilapi.com.br/api/cnpj/v1';
    this.userAgent = config.userAgent ?? USER_AGENT_CNPJ;
    this.tentativas = Math.max(1, config.tentativas ?? 3);
    this.atrasoBaseMs = config.atrasoBaseMs ?? 500;
    this.esperar = config.esperar ?? ((ms) => new Promise((resolver) => setTimeout(resolver, ms)));
  }

  async consultar(cnpj: string): Promise<ResultadoFonteCnpj> {
    for (let tentativa = 1; tentativa <= this.tentativas; tentativa += 1) {
      const ultima = tentativa === this.tentativas;
      let resposta: Response;
      try {
        resposta = await this.fetchImpl(`${this.baseUrl}/${cnpj}`, {
          headers: { accept: 'application/json', 'user-agent': this.userAgent },
        });
      } catch {
        if (ultima) return INDISPONIVEL;
        await this.esperar(this.atrasoBaseMs * 2 ** (tentativa - 1));
        continue;
      }

      if (resposta.status === 404) {
        return { situacaoAtiva: false, razaoSocial: '', indisponivel: false };
      }
      if (!resposta.ok) {
        if (ultima) return INDISPONIVEL;
        await this.esperar(this.atrasoBaseMs * 2 ** (tentativa - 1));
        continue;
      }

      const corpo = (await resposta.json()) as RespostaBrasilApi;
      const situacao = (corpo.descricao_situacao_cadastral ?? '').toUpperCase();
      return {
        situacaoAtiva: situacao === 'ATIVA',
        razaoSocial: corpo.razao_social ?? '',
        indisponivel: false,
      };
    }
    return INDISPONIVEL;
  }
}

export class FonteCnpjControlavel implements FonteCnpjProvider {
  private resultados = new Map<string, ResultadoFonteCnpj | 'erro-rede'>();

  definir(cnpj: string, resultado: ResultadoFonteCnpj | 'erro-rede'): void {
    this.resultados.set(cnpj, resultado);
  }

  async consultar(cnpj: string): Promise<ResultadoFonteCnpj> {
    const resultado = this.resultados.get(cnpj);
    if (!resultado || resultado === 'erro-rede') {
      return { situacaoAtiva: false, razaoSocial: '', indisponivel: true };
    }
    return resultado;
  }

  limpar(): void {
    this.resultados.clear();
  }
}
