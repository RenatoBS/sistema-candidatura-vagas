import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const VERSAO_PROMPT_SUGERIR = 'sugerir-perguntas/v1';
export const VERSAO_PROMPT_CURRICULO = 'extrair-curriculo/v1';

export function lerPrompt(relativo: string): string {
  const nome = relativo.endsWith('.md') ? relativo : `${relativo}.md`;
  const candidatos = [join(__dirname, '..', 'prompts', nome), join(__dirname, '..', '..', 'prompts', nome)];
  for (const caminho of candidatos) {
    try {
      return readFileSync(caminho, 'utf8').trim();
    } catch {
      // tenta o próximo caminho (src nos testes, dist no build)
    }
  }
  throw new Error(`prompt não encontrado: ${nome}`);
}
