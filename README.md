# Sistema de Candidatura a Vagas

Plataforma de recrutamento com IA, com duas visões em um **único app React Native**: **empresa** (cadastro de vagas, habilidades requeridas, processo seletivo com perguntas próprias ou sugeridas por IA, acompanhamento das fases e ranqueamento explicável) e **candidato** (vagas, perfil, upload de currículo com OCR, link do LinkedIn, habilidades e acompanhamento das candidaturas). O processo seletivo tem uma **1ª fase de triagem pelo WhatsApp** — o bot envia as perguntas por texto e o candidato responde por áudio, que é transcrito e avaliado pela IA — e uma **2ª fase de entrevista conduzida por IA**, sempre com revisão humana. O sistema é multi-tenant e suporta vários processos seletivos simultâneos.

**Status:** 🟡 fase de planejamento — ainda não há código de aplicação neste repositório.

## Stack decidida

| Camada | Tecnologia |
|--------|------------|
| App | React Native (Expo + Expo Router), app único com visões empresa e candidato |
| Backend | Node.js + NestJS (TypeScript) |
| Dados | PostgreSQL + pgvector, via Prisma |
| Assíncrono | Redis + BullMQ |
| Arquivos | Armazenamento S3-compatível (CVs e áudios) |
| IA | OCR local (Tesseract/PaddleOCR), Whisper para transcrição (local ou API — em aberto), LLM via camada de abstração |
| Mensageria | WhatsApp Business (Cloud API ou Twilio — em aberto) |

## Documentos

- [Plano Técnico e de Produto](docs/plano-sistema.md) — requisitos, arquitetura, modelo de dados, fluxos, ranqueamento, LGPD, fases e riscos.
- [Plano de Implementação Orquestrado](docs/plano-implementacao.md) — como implementar com Claude Code, Codex e Cursor: papéis, fluxo de PRs, backlog por fase e qualidade.
- [Diagramas renderizados (PNG)](docs/diagramas/) — versões estáticas dos diagramas Mermaid.
