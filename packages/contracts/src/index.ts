/**
 * Contratos compartilhados (OpenAPI, Zod, tipos).
 * Será expandido na Fase 2+ conforme o schema Prisma e a API.
 */

export const API_VERSION = 'v1';

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}
