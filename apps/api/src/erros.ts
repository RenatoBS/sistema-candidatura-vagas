export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: string,
    readonly statusHttp: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}
