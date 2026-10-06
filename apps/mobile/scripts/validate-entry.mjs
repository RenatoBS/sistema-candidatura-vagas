import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const appRoot = join(root, '..');

const required = [
  'app/_layout.tsx',
  'app/index.tsx',
  'app.json',
  'package.json',
  'babel.config.js',
  'metro.config.js',
];

for (const file of required) {
  const path = join(appRoot, file);
  if (!existsSync(path)) {
    console.error(`Arquivo obrigatório ausente: ${file}`);
    process.exit(1);
  }
}

console.log('Entrypoint Expo válido — arquivos essenciais presentes.');
