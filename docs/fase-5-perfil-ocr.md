# Fase 5 — Perfil do candidato e OCR local

Currículo do candidato com extração nativa (PDF com camada de texto e DOCX) e OCR **somente local** (Tesseract `por+eng`). Não há cliente de OCR em nuvem nem chamada à API do LinkedIn.

## Fluxo

1. `POST /curriculos/upload-url` devolve URL pré-assinada (MinIO) ou, nos testes, `PUT /interno/uploads/{token}`.
2. O cliente envia o arquivo (PDF, DOCX, PNG ou JPEG, até 8 MiB) e chama `POST /curriculos`.
3. A API confere tamanho, assinatura do arquivo e antivírus, grava o currículo como `PENDENTE` e enfileira `cv-processamento`.
4. O worker baixa o objeto, extrai texto nativo e só rasteriza/OCR as páginas sem texto (DOCX nunca vai ao OCR).
5. O resultado fica em `dadosExtraidos`. O JSON de perfil **não** muda.
6. `POST /curriculos/{id}/confirmar` aplica resumo, experiências, formação, idiomas e habilidades do catálogo.

`linkedinUrl` só aceita `https://www.linkedin.com/in/…` (ou `www`). WhatsApp só normaliza E.164; a verificação do número fica para a Fase 7.

## Extração estruturada

A interface `ExtratorEstruturadoCurriculo` vive em `packages/providers`. A implementação padrão é `ExtratorEstruturadoMock` (determinística: linhas `resumo:`, `experiencia:`, `formacao:`, `idioma:`, `habilidade:` e nomes do catálogo).

TODO(Fase 4): quando `@scv/llm` existir, implementar a interface com o `LlmProvider` e validar a saída com `dadosCurriculoValidos` / `schemaDadosCurriculo`. Não criar `packages/llm` nesta fase.

## Antivírus

- Com `CLAMAV_HOST`, o adapter fala INSTREAM com o ClamAV (`infra/docker-compose.yml`, profile `antivirus`).
- Sem essa variável, o adapter é um mock que ainda recusa a assinatura EICAR. Não é antivírus real.

```bash
docker compose -f infra/docker-compose.yml --profile antivirus up -d clamav
```

A primeira subida baixa a base de assinaturas e pode demorar.

## Worker de OCR

```bash
docker compose -f infra/docker-compose.yml --profile ocr up -d --build ocr-worker
```

A imagem `infra/ocr/Dockerfile` instala `tesseract-ocr` (`por` e `eng`), `poppler-utils` e DejaVu. O profile não sobe no `docker compose up` padrão. A API continua no host (`API_PUBLIC_URL`, padrão `http://host.docker.internal:3000`). `OCR_PROVIDER=mock` troca o Tesseract pelo mock (testes).

Pré-processamento: escala de cinza, normalização, limiar e busca de inclinação entre −4° e 4°. Rasterização com `pdftoppm` a 200 dpi.

## Fixtures e testes

```bash
pnpm --filter @scv/providers fixtures
# grava packages/providers/fixtures/cv-texto.pdf, cv-escaneado.pdf, cv-imagem.png, cv-texto.docx
```

O teste pesado em `ocr-qualidade.test.ts` é ignorado se `tesseract` ou `pdftoppm` não existem. No CI, o job `ocr-tesseract` instala os binários e roda com `OCR_OBRIGATORIO=1`. A suíte principal não depende deles.

`sem-ocr-externo.test.ts` varre o código e os `package.json` em busca de clientes de OCR em nuvem e de host da API do LinkedIn.

## LGPD

- `POST /lgpd/exportar` devolve perfil, habilidades, currículos e consentimentos vigentes. O pacote não pode conter score, posição, percentil, embedding ou ranking.
- `POST /lgpd/excluir` exige reautenticação (`x-reauth-token`) e `{ "confirmacao": "EXCLUIR" }`. Anonimiza o usuário, apaga habilidades, consentimentos e currículos (também no armazenamento) e registra a solicitação.

Consentimentos são append-only. `GET /candidatos/me/consentimentos` devolve o último registro de cada tipo.

## Fora desta fase

Prazos de retenção (Q18), direito de revisão de decisão automatizada (LGPD art. 20 / Q16), notificação push para revisar o currículo (Fase 6), verificação do WhatsApp (Fase 7) e o extrator real via `@scv/llm` (Fase 4).
