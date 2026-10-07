import { type CallHandler, type ExecutionContext, Inject, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

import type { Relogio } from '../auth/auth.service';
import { CotaService } from '../capacidade/cota.service';
import { RELOGIO } from '../tokens';

interface RequisicaoCota {
  params?: { empresaId?: string };
  originalUrl?: string;
  url?: string;
}

/** Conta chamadas autenticadas com empresaId na rota. Rotas internas ficam de fora. */
@Injectable()
export class CotaApiInterceptor implements NestInterceptor {
  constructor(
    @Inject(CotaService) private readonly cotas: CotaService,
    @Inject(RELOGIO) private readonly relogio: Relogio,
  ) {}

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = contexto.switchToHttp().getRequest<RequisicaoCota>();
    const empresaId = req.params?.empresaId;
    const url = req.originalUrl ?? req.url ?? '';
    if (empresaId && !url.includes('/interno/')) {
      this.cotas.consumirApi(empresaId, this.relogio.agora());
    }
    return next.handle();
  }
}
