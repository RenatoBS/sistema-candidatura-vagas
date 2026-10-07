import { Inject, Injectable } from '@nestjs/common';
import { VOZ_MAX_SESSOES_SIMULTANEAS } from '@scv/domain';

import { envNumero } from '@scv/env';
import type { Repositorio } from '../repositorio/tipos';
import { REPOSITORIO } from '../tokens';
import { CotaService } from './cota.service';

const SISTEMA = { sistema: true as const };

@Injectable()
export class CapacidadeService {
  constructor(
    @Inject(REPOSITORIO) private readonly repo: Repositorio,
    @Inject(CotaService) private readonly cotas: CotaService,
  ) {}

  async painel() {
    const sessoesVozAtivas = await this.repo.contarSessoesAtivas(SISTEMA);
    const instancias = await this.repo.listarInstancias(SISTEMA);
    const conectadas = instancias.filter((item) => item.status === 'CONECTADA').length;
    const desconectadas = instancias.length - conectadas;
    const limiteVozGlobal = this.maxSessoes();
    const alertas: string[] = [];
    if (desconectadas > 0) alertas.push('instancia_desconectada');
    if (limiteVozGlobal > 0 && sessoesVozAtivas >= Math.ceil(limiteVozGlobal * 0.8)) {
      alertas.push('voz_perto_do_limite');
    }
    return {
      sessoesVozAtivas,
      limiteVozGlobal,
      cotas: this.cotas.limites(),
      instancias: { conectadas, desconectadas },
      alertas,
      filas: {
        modo: 'memoria_ou_bull',
        painel: 'Bull Board em /admin/queues no worker local',
      },
    };
  }

  private maxSessoes(): number {
    const valor = envNumero(process.env, 'VOZ_MAX_SESSOES', VOZ_MAX_SESSOES_SIMULTANEAS);
    return Number.isFinite(valor) && valor > 0 ? valor : VOZ_MAX_SESSOES_SIMULTANEAS;
  }
}
