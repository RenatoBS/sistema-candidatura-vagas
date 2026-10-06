/** Validação local dos dígitos verificadores do CNPJ. Não consulta fonte externa. */

const PESOS_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function somenteDigitosCnpj(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += Number(base[i]) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjDigitosValidos(valor: string): boolean {
  const cnpj = somenteDigitosCnpj(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const primeiro = digito(cnpj.slice(0, 12), PESOS_PRIMEIRO);
  const segundo = digito(cnpj.slice(0, 12) + String(primeiro), PESOS_SEGUNDO);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

export function normalizarRazaoSocial(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function razoesCompativeis(informada: string, oficial: string): boolean {
  const a = normalizarRazaoSocial(informada);
  const b = normalizarRazaoSocial(oficial);
  return a.length > 0 && a === b;
}
