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

export function mensagemFluxoTriagem(
  tipo:
    | 'confirmacao_numero'
    | 'pergunta'
    | 'pedir_audio'
    | 'audio_curto'
    | 'midia_invalida'
    | 'nao_conta'
    | 'opt_out'
    | 'adiar'
    | 'sem_resposta',
  dados: DadosMensagemTriagem & { nomeCandidato?: string; enunciado?: string; ordem?: number; total?: number },
): { texto: string; opcoes?: Array<{ id: string; titulo: string }> } {
  const vaga = `Vaga "${dados.nomeVaga}" (${dados.nomeEmpresa}).`;
  if (tipo === 'confirmacao_numero') {
    return {
      texto: `${vaga}\nEste número pertence a ${dados.nomeCandidato ?? 'você'}?`,
      opcoes: [
        { id: 'sim', titulo: '1 Sim' },
        { id: 'nao', titulo: '2 Não' },
      ],
    };
  }
  if (tipo === 'pergunta') {
    return {
      texto: `${vaga}\nPergunta ${dados.ordem ?? 1} de ${dados.total ?? 1}: ${dados.enunciado ?? ''}\nResponda com um áudio.`,
    };
  }
  if (tipo === 'pedir_audio') {
    return { texto: `${vaga}\nPara esta pergunta, envie um áudio. Se não puder, pode responder em texto na próxima mensagem.` };
  }
  if (tipo === 'audio_curto') {
    return { texto: `${vaga}\nO áudio ficou curto demais. Envie de novo, com pelo menos 2 segundos, sem perder a pergunta.` };
  }
  if (tipo === 'midia_invalida') {
    return { texto: `${vaga}\nNão consegui usar essa mídia. Envie um áudio respondendo a pergunta.` };
  }
  if (tipo === 'nao_conta') {
    return { texto: `${vaga}\nQuando puder, responda a pergunta com um áudio.` };
  }
  if (tipo === 'opt_out') {
    return { texto: `${vaga}\nVocê pediu para parar. Não enviaremos novas mensagens desta empresa por aqui.` };
  }
  if (tipo === 'adiar') {
    return { texto: `${vaga}\nTudo bem. Vamos lembrar você em outro horário. A triagem ainda não começou.` };
  }
  return {
    texto: `${vaga}\nNão recebemos sua resposta dentro do prazo. A triagem ficou sem resposta e uma pessoa da empresa vai decidir o próximo passo. Isso não é uma reprovação automática.`,
  };
}
