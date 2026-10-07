// Brasília não tem horário de verão desde 2019: deslocamento fixo (ver formatacao/data.ts).
const DESLOCAMENTO_BRASILIA_MS = -3 * 60 * 60 * 1000;

export const ATALHOS_PRAZO_DIAS = [7, 15, 30, 60] as const;

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Máscara de digitação `dd/mm/aaaa hh:mm`: só números entram; barras, espaço e dois-pontos são automáticos. */
export function mascararPrazo(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 12);
  let saida = d.slice(0, 2);
  if (d.length > 2) saida += `/${d.slice(2, 4)}`;
  if (d.length > 4) saida += `/${d.slice(4, 8)}`;
  if (d.length > 8) saida += ` ${d.slice(8, 10)}`;
  if (d.length > 10) saida += `:${d.slice(10, 12)}`;
  return saida;
}

/** Prazo daqui a `dias` dias, às 23:59 de Brasília, no formato da máscara. */
export function prazoEmDias(dias: number, agora: Date = new Date()): string {
  const local = new Date(agora.getTime() + DESLOCAMENTO_BRASILIA_MS + dias * 24 * 60 * 60 * 1000);
  return `${doisDigitos(local.getUTCDate())}/${doisDigitos(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} 23:59`;
}

export type ProblemaPrazo = 'INCOMPLETO' | 'INVALIDO' | 'PASSADO';

/** null = válido (ou vazio, quando o prazo é opcional). Hora ausente vale 23:59. */
export function problemaDoPrazo(texto: string, agora: Date = new Date()): ProblemaPrazo | null {
  const valor = texto.trim();
  if (!valor) return null;
  const casou = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(valor);
  if (!casou) return valor.replace(/\D/g, '').length < 8 || valor.length < 10 ? 'INCOMPLETO' : 'INVALIDO';
  const [, dia, mes, ano, hora = '23', minuto = '59'] = casou;
  const [d, m, a, h, min] = [Number(dia), Number(mes), Number(ano), Number(hora), Number(minuto)];
  const calendario = new Date(Date.UTC(a, m - 1, d));
  if (m < 1 || m > 12 || calendario.getUTCDate() !== d || h > 23 || min > 59) return 'INVALIDO';
  const instante = Date.UTC(a, m - 1, d, h, min) - DESLOCAMENTO_BRASILIA_MS;
  return instante <= agora.getTime() ? 'PASSADO' : null;
}

/** Aceita também o formato brasileiro (dd/mm/aaaa [hh:mm]) e converte para AAAA-MM-DDTHH:mm. */
export function normalizarPrazo(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2}))?$/.exec(texto);
  if (!br) return texto;
  const [, dia, mes, ano, hora = '23', minuto = '59'] = br;
  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

export interface PartesPrazo {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** Partes de um prazo completo `dd/mm/aaaa [hh:mm]` (hora ausente = 23:59); null se não estiver completo/válido. */
export function partesDoPrazo(texto: string): PartesPrazo | null {
  const casou = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(texto.trim());
  if (!casou) return null;
  const [, dia, mes, ano, hora = '23', minuto = '59'] = casou;
  const partes = { dia: Number(dia), mes: Number(mes), ano: Number(ano), hora: Number(hora), minuto: Number(minuto) };
  const calendario = new Date(Date.UTC(partes.ano, partes.mes - 1, partes.dia));
  if (partes.mes < 1 || partes.mes > 12 || calendario.getUTCDate() !== partes.dia || partes.hora > 23 || partes.minuto > 59) return null;
  return partes;
}

export function montarPrazo({ ano, mes, dia, hora, minuto }: PartesPrazo): string {
  return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano} ${doisDigitos(hora)}:${doisDigitos(minuto)}`;
}

export interface DiaCivil {
  ano: number;
  mes: number;
  dia: number;
}

/** Hoje no calendário de Brasília. */
export function hojeEmBrasilia(agora: Date = new Date()): DiaCivil {
  const local = new Date(agora.getTime() + DESLOCAMENTO_BRASILIA_MS);
  return { ano: local.getUTCFullYear(), mes: local.getUTCMonth() + 1, dia: local.getUTCDate() };
}

/** Semanas do mês (domingo a sábado); `null` preenche os dias fora do mês. `mes` vai de 1 a 12. */
export function semanasDoMes(ano: number, mes: number): Array<Array<number | null>> {
  const diaDaSemanaDoPrimeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const totalDeDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: Array<number | null> = [
    ...Array<null>(diaDaSemanaDoPrimeiro).fill(null),
    ...Array.from({ length: totalDeDias }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);
  return Array.from({ length: celulas.length / 7 }, (_, semana) => celulas.slice(semana * 7, semana * 7 + 7));
}

export function deslocarMes({ ano, mes }: { ano: number; mes: number }, meses: number): { ano: number; mes: number } {
  const indice = ano * 12 + (mes - 1) + meses;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** Dia selecionável: hoje ou futuro (a hora é validada junto com o prazo). */
export function diaPermitido(ano: number, mes: number, dia: number, hoje: DiaCivil): boolean {
  return ano * 10000 + mes * 100 + dia >= hoje.ano * 10000 + hoje.mes * 100 + hoje.dia;
}

export const HORAS = Array.from({ length: 24 }, (_, hora) => hora);
export const MINUTOS = [0, 15, 30, 45, 59] as const;
