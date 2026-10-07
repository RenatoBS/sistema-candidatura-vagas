/** Primeiro nome para identificar o candidato à empresa (nunca o nome completo). */
export function primeiroNome(nome: string | null | undefined): string {
  return nome?.trim().split(/\s+/)[0] || 'Candidato';
}
