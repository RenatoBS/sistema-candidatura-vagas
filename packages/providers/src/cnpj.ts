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

/**
 * BrasilAPI pública. Trocar o provider não muda a regra de dígitos nem o job.
 * Testes devem injetar mock — esta classe só é usada com fetch explícito.
 */
export class BrasilApiFonteCnpj implements FonteCnpjProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl = 'https://brasilapi.com.br/api/cnpj/v1',
  ) {}

  async consultar(cnpj: string): Promise<ResultadoFonteCnpj> {
    let resposta: Response;
    try {
      resposta = await this.fetchImpl(`${this.baseUrl}/${cnpj}`, {
        headers: { accept: 'application/json' },
      });
    } catch {
      return { situacaoAtiva: false, razaoSocial: '', indisponivel: true };
    }

    if (resposta.status === 404) {
      return { situacaoAtiva: false, razaoSocial: '', indisponivel: false };
    }

    if (!resposta.ok) {
      return { situacaoAtiva: false, razaoSocial: '', indisponivel: true };
    }

    const corpo = (await resposta.json()) as RespostaBrasilApi;
    const situacao = (corpo.descricao_situacao_cadastral ?? '').toUpperCase();
    return {
      situacaoAtiva: situacao === 'ATIVA',
      razaoSocial: corpo.razao_social ?? '',
      indisponivel: false,
    };
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
