export interface RotaRegistrada {
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Caminho sem o prefixo global, ex.: `empresas/:empresaId/vagas`. */
  caminho: string;
}

interface Camada {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: Camada[] };
}

/** Rotas realmente registradas no Express (nada de lista manual que envelhece). */
export function rotasRegistradas(app: { getHttpAdapter(): { getInstance(): unknown } }): RotaRegistrada[] {
  const express = app.getHttpAdapter().getInstance() as { router?: { stack: Camada[] }; _router?: { stack: Camada[] } };
  const pilha = express.router?.stack ?? express._router?.stack ?? [];
  const rotas: RotaRegistrada[] = [];
  for (const camada of pilha) {
    if (!camada.route) continue;
    for (const metodo of Object.keys(camada.route.methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(metodo)) continue;
      rotas.push({
        metodo: metodo.toUpperCase() as RotaRegistrada['metodo'],
        caminho: camada.route.path.replace(/^\/api\/v1\//, '').replace(/^\/+/, ''),
      });
    }
  }
  return rotas.sort((a, b) => `${a.caminho} ${a.metodo}`.localeCompare(`${b.caminho} ${b.metodo}`));
}
