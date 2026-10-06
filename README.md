# Sistema de Candidatura a Vagas

Plataforma de recrutamento com IA em um **único app React Native**, com três visões conforme o papel do usuário:

- **Empresa**: auto-cadastro com verificação, conexão do próprio WhatsApp, vagas com prazo de inscrições obrigatório, processo seletivo com perguntas próprias ou sugeridas por IA e ranking explicável.
- **Candidato**: vagas, perfil, currículo com OCR local, link do LinkedIn, habilidades e acompanhamento do status das candidaturas.
- **Admin da plataforma**: acesso total, com MFA e auditoria.

O processo seletivo tem duas fases, ambas com tentativa única e revisão humana:

1. **Triagem pelo WhatsApp**: o bot envia as perguntas por texto, pelo número da empresa (Uazapi), e o candidato responde por áudio. O áudio é transcrito e avaliado pela IA, com retry automático para quem não respondeu.
2. **Entrevista por voz em tempo real com IA**, no app, com limite de tempo por pergunta.

O sistema é multi-tenant e suporta vários processos seletivos simultâneos.

**Status:** 🟡 fase de planejamento. Ainda não há código de aplicação neste repositório.

## Stack decidida

| Camada | Tecnologia |
|--------|------------|
| App | React Native (Expo + Expo Router), app único com visões candidato, empresa e admin |
| Backend | Node.js + NestJS (TypeScript) |
| Dados | PostgreSQL + pgvector, via Prisma |
| Assíncrono | Redis + BullMQ |
| Arquivos | Armazenamento S3-compatível (CVs, áudios, gravações) |
| OCR | Tesseract local |
| WhatsApp | Uazapi, com uma instância (número) por empresa, padrão portado do SaaS sof |
| Voz em tempo real | WebRTC com servidor de mídia (ex.: LiveKit); pipeline de voz em aberto (definido por POC) |
| IA | Whisper para a 1ª fase (local ou API, em aberto) e LLM via camada de abstração |

## Documentos

- [Plano Técnico e de Produto](docs/plano-sistema.md): requisitos, arquitetura, modelo de dados, fluxos, regras de vaga e de entrevista, ranqueamento, LGPD e questões em aberto.
- [Plano de Implementação Orquestrado](docs/plano-implementacao.md): 10 fases, executadas por Claude Code, Codex e Cursor sob orquestração do Renato, com tarefas, paralelismo e critérios de aceite.
- [Diagramas renderizados (PNG)](docs/diagramas/): versões estáticas dos diagramas Mermaid.
