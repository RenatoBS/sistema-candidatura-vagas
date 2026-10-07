import { Injectable } from '@nestjs/common';
import { COTAS_PADRAO, decidirCotaJanela, decidirCotaSimultanea } from '@scv/domain';

import { ErroAplicacao } from '../erros';

@Injectable()
export class CotaService {
  private readonly api = new Map<string, number[]>();
  private readonly ia = new Map<string, number[]>();

  consumirApi(empresaId: string, agora: Date): void {
    this.consumir(
      this.api,
      empresaId,
      agora,
      60_000,
      this.limite('COTA_API_POR_MINUTO', COTAS_PADRAO.apiPorMinuto),
      'COTA_API',
    );
  }

  consumirIa(empresaId: string, agora: Date): void {
    this.consumir(
      this.ia,
      empresaId,
      agora,
      3_600_000,
      this.limite('COTA_IA_POR_HORA', COTAS_PADRAO.iaPorHora),
      'COTA_IA',
    );
  }

  admiteVoz(ativasNaEmpresa: number): boolean {
    const limite = this.limite('COTA_VOZ_POR_EMPRESA', COTAS_PADRAO.vozSimultaneasPorEmpresa);
    return decidirCotaSimultanea(ativasNaEmpresa, limite) === 'admitir';
  }

  limites() {
    return {
      apiPorMinuto: this.limite('COTA_API_POR_MINUTO', COTAS_PADRAO.apiPorMinuto),
      iaPorHora: this.limite('COTA_IA_POR_HORA', COTAS_PADRAO.iaPorHora),
      vozSimultaneasPorEmpresa: this.limite('COTA_VOZ_POR_EMPRESA', COTAS_PADRAO.vozSimultaneasPorEmpresa),
    };
  }

  limpar(): void {
    this.api.clear();
    this.ia.clear();
  }

  private consumir(
    mapa: Map<string, number[]>,
    chave: string,
    agora: Date,
    janelaMs: number,
    limite: number,
    codigo: string,
  ): void {
    const agoraMs = agora.getTime();
    const anteriores = mapa.get(chave) ?? [];
    const decisao = decidirCotaJanela(anteriores, agoraMs, janelaMs, limite);
    const naJanela = anteriores.filter((instante) => agoraMs - instante < janelaMs && agoraMs >= instante);
    if (!decisao.permitido) {
      mapa.set(chave, naJanela);
      throw new ErroAplicacao(codigo, 429, 'cota do tenant esgotada');
    }
    naJanela.push(agoraMs);
    mapa.set(chave, naJanela);
  }

  private limite(nome: string, padrao: number): number {
    const bruto = process.env[nome];
    if (!bruto) return padrao;
    const valor = Number(bruto);
    return Number.isFinite(valor) && valor > 0 ? valor : padrao;
  }
}

/** Instância compartilhada nos testes em memória. Produção cria outra no módulo. */
export const cotaTeste = new CotaService();
