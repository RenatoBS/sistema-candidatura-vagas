import { SetMetadata } from '@nestjs/common';

import type { Acao } from '@scv/domain';

export const PUBLICO = 'publico';
export const ACAO = 'acao';
export const SENSIVEL = 'sensivel';

export const Publico = () => SetMetadata(PUBLICO, true);
export const Exige = (acao: Acao) => SetMetadata(ACAO, acao);
export const Sensivel = () => SetMetadata(SENSIVEL, true);
