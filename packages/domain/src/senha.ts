export function senhaAtendePolitica(senha: string): boolean {
  return senha.length >= 8 && senha.length <= 128 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}
