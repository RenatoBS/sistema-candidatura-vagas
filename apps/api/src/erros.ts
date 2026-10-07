export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: string,
    readonly statusHttp: number,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}
