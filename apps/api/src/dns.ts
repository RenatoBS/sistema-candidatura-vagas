import { Resolver } from 'node:dns/promises';

export interface ResolvedorDns {
  txt(dominio: string): Promise<string[]>;
}

export class DnsNode implements ResolvedorDns {
  async txt(dominio: string): Promise<string[]> {
    const resolver = new Resolver();
    try {
      const registros = await resolver.resolveTxt(dominio);
      return registros.map((partes) => partes.join(''));
    } catch {
      return [];
    }
  }
}

export class DnsControlavel implements ResolvedorDns {
  registros = new Map<string, string[]>();

  async txt(dominio: string): Promise<string[]> {
    return this.registros.get(dominio) ?? [];
  }

  limpar(): void {
    this.registros.clear();
  }
}
