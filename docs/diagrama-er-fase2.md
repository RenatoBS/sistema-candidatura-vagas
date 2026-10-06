# Diagrama ER — Fase 2 (modelo de dados)

Gerado a partir do schema Prisma em `prisma/schema/` (F2-03..F2-07).

> Versão de referência completa no [plano do sistema §5.1](plano-sistema.md).

```mermaid
erDiagram
  USUARIO ||--o| CANDIDATO : "possui perfil"
  USUARIO ||--o{ MEMBRO_EMPRESA : vincula
  EMPRESA ||--o{ MEMBRO_EMPRESA : tem
  EMPRESA ||--o{ VERIFICACAO_EMPRESA : "passa por"
  EMPRESA ||--o| INSTANCIA_WHATSAPP : "conecta numero"
  EMPRESA ||--o{ VAGA : publica
  EMPRESA ||--o{ PERGUNTA : "banco de perguntas"
  VAGA ||--o{ VAGA_HABILIDADE : requer
  HABILIDADE ||--o{ VAGA_HABILIDADE : ""
  CANDIDATO ||--o{ CANDIDATO_HABILIDADE : declara
  HABILIDADE ||--o{ CANDIDATO_HABILIDADE : ""
  CANDIDATO ||--o{ CURRICULO : envia
  VAGA ||--|| PROCESSO_SELETIVO : tem
  PROCESSO_SELETIVO ||--o{ ETAPA : compoe
  ETAPA ||--o{ ETAPA_PERGUNTA : usa
  PERGUNTA ||--o{ ETAPA_PERGUNTA : ""
  CANDIDATO ||--o{ CANDIDATURA : faz
  VAGA ||--o{ CANDIDATURA : recebe
  CANDIDATURA ||--o{ ENTREVISTA : "uma por fase"
  ETAPA ||--o{ ENTREVISTA : ""
  ENTREVISTA ||--o{ RESPOSTA : contem
  ENTREVISTA ||--o{ SESSAO_VOZ : "sessoes 2a fase"
  ENTREVISTA ||--o{ MENSAGEM_WHATSAPP : "mensagens 1a fase"
  INSTANCIA_WHATSAPP ||--o{ MENSAGEM_WHATSAPP : "envia e recebe"
  ETAPA_PERGUNTA ||--o{ RESPOSTA : responde
  RESPOSTA ||--o{ AVALIACAO : avaliada
  CANDIDATURA ||--o{ SCORE : ranqueada
  CANDIDATURA ||--o{ HISTORICO_STATUS : registra
  CANDIDATO ||--o{ CONSENTIMENTO : concede
  VAGA ||--o{ SUGESTAO_MATCH : gera
  CANDIDATO ||--o{ SUGESTAO_MATCH : ""
  USUARIO ||--o{ NOTIFICACAO : recebe
  USUARIO ||--o{ PREFERENCIA_NOTIFICACAO : define
  USUARIO ||--o{ DISPOSITIVO_PUSH : registra
  USUARIO ||--o{ AUDITORIA_ACESSO : "gera eventos"

  USUARIO {
    uuid id PK
    string email UK
    enum[] papeisGlobais
    bool mfaAtivo
    timestamptz criadoEm
  }
  EMPRESA {
    uuid id PK
    string cnpj UK
    enum statusVerificacao
    timestamptz verificadaEm
  }
  VAGA {
    uuid id PK
    uuid empresaId FK
    timestamptz prazoInscricoes
    timestamptz inscricoesEncerradasEm
    timestamptz pausadaEm
    enum statusAntesDaPausa
    timestamptz fechadaEm
    json pesosRanking
    vector embedding
  }
  PROCESSO_SELETIVO {
    uuid id PK
    uuid empresaId FK
    int tempoPadraoPorPergunta
    json politicaRetry
    int janelaReconexaoSegundos
  }
  PERGUNTA {
    uuid id PK
    uuid empresaId FK
    int tempoLimiteSegundos
  }
  CANDIDATO {
    uuid id PK
    string linkedinUrl
    vector embedding
  }
  CANDIDATURA {
    uuid id PK
    uuid empresaId FK
    enum status
    enum statusAntesDaEspera
  }
  ENTREVISTA {
    uuid id PK
    uuid empresaId FK
    UK candidaturaId_etapaId
    timestamptz iniciadaEm
    timestamptz proximoRetryEm
    bool excecaoConcedida
  }
  RESPOSTA {
    uuid id PK
    uuid empresaId FK
    string audioUrl
    text transcricao
    enum statusTranscricao
    int tempoUsado
    bool expirou
    bool parcial
  }
  INSTANCIA_WHATSAPP {
    uuid id PK
    uuid empresaId FK UK
    string tokenCifrado
    enum status
    timestamptz ultimaConexaoEm
  }
  NOTIFICACAO {
    uuid id PK
    string chaveDedup UK
    int agrupadas
    timestamptz lidaEm
  }
```

## Domínios e arquivos

| Domínio | Arquivo Prisma | Entidades principais |
|---------|----------------|----------------------|
| Identidade | `identidade.prisma` | Usuario, Empresa, VerificacaoEmpresa, MembroEmpresa, AuditoriaAcesso |
| Vagas | `vagas.prisma` | Vaga, Habilidade, ProcessoSeletivo, Etapa, Pergunta |
| Candidatos | `candidatos.prisma` | Candidato, Curriculo, Consentimento |
| Entrevistas | `entrevistas.prisma` | Candidatura, Entrevista, Resposta, InstanciaWhatsapp, Score |
| Notificações | `notificacoes.prisma` | Notificacao, PreferenciaNotificacao, DispositivoPush, SugestaoMatch |

## Multi-tenant (RLS)

Ver [ADR 0002](adr/0002-multi-tenant.md): coluna `empresaId`, políticas RLS e bypass `app.is_admin` somente com MFA.
