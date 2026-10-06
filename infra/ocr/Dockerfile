# Worker dedicado de currículo com Tesseract local (por+eng) e Poppler.
# Não instala cliente de OCR em nuvem.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    poppler-utils \
    fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.3 --activate

COPY . .

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @scv/domain build \
  && pnpm --filter @scv/providers build \
  && pnpm --filter @scv/workers build

ENV OCR_PROVIDER=tesseract
ENV NODE_ENV=production

CMD ["node", "apps/workers/dist/main.js"]
