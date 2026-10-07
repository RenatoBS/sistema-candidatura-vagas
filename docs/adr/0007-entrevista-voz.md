# ADR 0007 — Entrevista por voz em tempo real

**Status:** Provisório (revisável pelo Renato)  
**Data:** 2026-10-07  
**Autor:** Cursor (Grok)  
**Aprovação:** pendente

## Contexto

A Fase 8 conduz a segunda fase do processo em uma sala de voz. O POC 8.1 já mediu o pipeline STT → LLM → TTS. Os testes não podem depender de LiveKit, OpenAI ou Redis.

## Decisão provisória

- **Q3 — pipeline:** STT → LLM → TTS em streaming, com LiveKit auto-hospedado quando houver infraestrutura. Nos testes o token é falso (`lk_fake_…`, `ws://localhost/livekit`) e o pipeline é medido em memória. Fala-a-fala fica para uma revisão futura.
- **Q9 — reconexão:** janela de 60 s, lida de `janelaReconexaoSegundos` do processo. O cronômetro da pergunta pausa durante a queda. Dentro da janela, a mesma sessão continua. Fora dela, a entrevista vai para `ABANDONADA`.
- **Q10 — exceção:** uma única `Entrevista.excecaoConcedida`, auditada com quem, quando e por quê. A segunda tentativa sem essa exceção é rejeitada. Fechar o app consome a tentativa.
- **Q20 — ambiente:** somente local. Sem região, GPU ou hospedagem nesta entrega.
- **Roteiro:** a IA faz as perguntas definidas, em ordem. Follow-up só dentro do tempo da pergunta e sem aprofundar idade, gênero, religião, raça ou estado civil.
- **Estouro:** grava `expirou=true`, avança e não elimina. O encerramento da última pergunta conclui a fase (`ENTREVISTA_CONCLUIDA`).
- **Admissão:** no máximo 50 sessões ativas por processo da API (`VOZ_MAX_SESSOES` só em teste). Acima disso a resposta é `FILA_ADMISSAO`. O contador é em memória, como a trava da Fase 7.
- **Gravação:** a empresa e o admin ouvem a gravação e leem a transcrição com motivo e auditoria `LER_AUDIO`. O candidato vê estado, fase, tempo e aviso — sem score.

## Consequências

- F8-15 (provedores e chaves em staging) continua com o Renato.
- A latência de staging não foi medida. O p50 local do mock fica abaixo de 1 s por etapa.
- A fila de admissão não é distribuída entre réplicas da API.
