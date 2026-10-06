import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const raiz = path.resolve(__dirname, '../../..');

function termo(partes: string[]): string {
  return partes.join('');
}

const proibidos = [
  termo(['@google-cloud', '/', 'vision']),
  termo(['@aws-sdk', '/', 'client-', 'textract']),
  termo(['@azure', '/', 'ai-form-recognizer']),
  termo(['@azure', '/', 'ai-vision']),
  termo(['ocr', '.', 'space']),
  termo(['tesseract', '.', 'js']),
  termo(['api', '.', 'linkedin', '.', 'com']),
  termo(['vision', '.', 'googleapis', '.', 'com']),
];

function listar(diretorio: string, saida: string[]): void {
  for (const nome of readdirSync(diretorio)) {
    if (nome === 'node_modules' || nome === 'dist' || nome === '.git' || nome === 'coverage') continue;
    const caminho = path.join(diretorio, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) {
      listar(caminho, saida);
      continue;
    }
    if (nome.endsWith('.test.ts')) continue;
    if (nome === 'package.json' || nome.endsWith('.ts') || nome.endsWith('.tsx') || nome.endsWith('.js')) {
      saida.push(caminho);
    }
  }
}

describe('OCR externo', () => {
  it('não declara cliente de OCR em nuvem nem API do LinkedIn', () => {
    const arquivos: string[] = [];
    listar(raiz, arquivos);
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const texto = readFileSync(arquivo, 'utf8');
      for (const proibido of proibidos) {
        if (texto.includes(proibido)) achados.push(`${path.relative(raiz, arquivo)}:${proibido}`);
      }
    }
    if (achados.length > 0) {
      throw new Error(`dependência ou chamada proibida:\n${achados.join('\n')}`);
    }
  });

  it('o binário esperado do OCR é o tesseract local', () => {
    const fonte = readFileSync(path.join(__dirname, 'ocr.ts'), 'utf8');
    if (!fonte.includes('por+eng')) throw new Error('idioma do tesseract ausente');
    try {
      execFileSync('tesseract', ['--version'], { stdio: 'ignore' });
    } catch {
      // A ausência do binário no job leve é aceitável; o job de OCR cobre a execução.
    }
  });
});
