export interface DadosMensagemTriagem {
  nomeVaga: string;
  nomeEmpresa: string;
}

export function mensagemTriagem(
  tipo: 'convite_triagem' | 'lembrete_triagem' | 'lembrete_inatividade',
  dados: DadosMensagemTriagem,
): { texto: string; opcoes?: Array<{ id: string; titulo: string }> } {
  if (tipo === 'convite_triagem') {
    return {
      texto: [
        `Olá, ${dados.nomeEmpresa} convidou você para a triagem da vaga "${dados.nomeVaga}".`,
        'A triagem é feita por perguntas e respostas de áudio pelo WhatsApp.',
        'Atenção: depois de iniciada, a triagem não pode ser refeita.',
      ].join('\n'),
      opcoes: [
        { id: 'comecar', titulo: 'Começar' },
        { id: 'agora_nao', titulo: 'Agora não' },
      ],
    };
  }
  if (tipo === 'lembrete_triagem') {
    return {
      texto: `Lembrete: a triagem da vaga "${dados.nomeVaga}" ainda está aguardando seu início.`,
    };
  }
  return {
    texto: `Você iniciou a triagem da vaga "${dados.nomeVaga}". Quando puder, envie um áudio para continuar.`,
  };
}
