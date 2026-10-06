import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Visao } from '@scv/domain';

export interface AccessPayload {
  sub: string;
  email: string;
  visao: Visao;
  empresaId: string | null;
  mfaVerificado: boolean;
  tipo: 'access';
  iat: number;
  exp: number;
}

export interface ReauthPayload {
  sub: string;
  tipo: 'reauth';
  iat: number;
  exp: number;
}

function b64(valor: string): string {
  return Buffer.from(valor).toString('base64url');
}

function assinar(conteudo: string, segredo: string): string {
  return createHmac('sha256', segredo).update(conteudo).digest('base64url');
}

export function assinarJwt(payload: object, segredo: string, expiraEmSegundos: number, agora = Date.now()): string {
  const iat = Math.floor(agora / 1000);
  const corpo = b64(JSON.stringify({ ...payload, iat, exp: iat + expiraEmSegundos }));
  const cabecalho = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const conteudo = `${cabecalho}.${corpo}`;
  return `${conteudo}.${assinar(conteudo, segredo)}`;
}

export function lerJwt<T>(token: string, segredo: string, agora = Date.now()): T {
  const [cabecalho, corpo, assinatura] = token.split('.');
  if (!cabecalho || !corpo || !assinatura) throw new Error('JWT_INVALIDO');
  const conteudo = `${cabecalho}.${corpo}`;
  const esperada = assinar(conteudo, segredo);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('JWT_INVALIDO');
  const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as T & { exp: number };
  if (payload.exp * 1000 <= agora) throw new Error('JWT_EXPIRADO');
  return payload;
}
