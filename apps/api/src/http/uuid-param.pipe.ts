import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';

import { ErroAplicacao } from '../erros';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parâmetros de rota `:id` e `:xxxId` são sempre UUID. Valor malformado vira 400 em vez de chegar ao
 * Postgres (onde `invalid input syntax for type uuid` estourava como 500).
 */
@Injectable()
export class UuidParamPipe implements PipeTransform<unknown> {
  transform(valor: unknown, metadata: ArgumentMetadata): unknown {
    const nome = metadata.data;
    if (metadata.type !== 'param' || !nome || !(nome === 'id' || nome.endsWith('Id'))) return valor;
    if (typeof valor !== 'string' || !UUID.test(valor)) {
      throw new ErroAplicacao('PARAMETRO_INVALIDO', 400, `parâmetro ${nome} inválido`);
    }
    return valor;
  }
}
