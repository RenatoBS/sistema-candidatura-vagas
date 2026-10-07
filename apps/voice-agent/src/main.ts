/**
 * Stub do agente de voz (Fase 8).
 * Participará das salas LiveKit para conduzir entrevistas por voz em tempo real.
 */
import { envOu } from '@scv/env';
import pino from 'pino';

const logger = pino({ level: envOu(process.env, 'LOG_LEVEL', 'info') });

logger.info('Voice agent stub — implementação prevista para a Fase 8');
