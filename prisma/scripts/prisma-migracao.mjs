#!/usr/bin/env node
/**
 * Roda a CLI do Prisma com o papel de MIGRAÇÃO (dono do schema).
 * A API/workers usam DATABASE_URL (papel `scv_app`, sem BYPASSRLS); migrações, seed e reset precisam do
 * papel dono: MIGRATION_DATABASE_URL tem prioridade sobre DATABASE_URL (ADR 0002).
 */
import { spawnSync } from 'node:child_process';

const migracao = process.env.MIGRATION_DATABASE_URL?.trim();
const env = { ...process.env, ...(migracao ? { DATABASE_URL: migracao } : {}) };
const resultado = spawnSync('pnpm', ['exec', 'prisma', ...process.argv.slice(2)], { stdio: 'inherit', env });
process.exit(resultado.status ?? 1);
