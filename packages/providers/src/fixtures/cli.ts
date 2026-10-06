import path from 'node:path';

import { gravarFixtures } from './gerar';

const destino = path.join(__dirname, '..', '..', 'fixtures');
gravarFixtures(destino)
  .then(() => {
    process.stdout.write(`fixtures em ${destino}\n`);
  })
  .catch((erro: unknown) => {
    process.stderr.write(String(erro));
    process.exitCode = 1;
  });
