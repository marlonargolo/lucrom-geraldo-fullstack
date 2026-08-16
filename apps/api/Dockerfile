# syntax=docker/dockerfile:1

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Runtime stage ───────────────────────────────────────────────────────────
# Mesma imagem serve tanto pra API quanto pro Worker do FFmpeg — o
# docker-compose.yml decide o processo via `command:` (dist/main.js vs
# dist/worker-main.js), evitando manter dois Dockerfiles quase idênticos.
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Dependências de sistema:
#   • chromium          — usado pelo Puppeteer (GraphicComposerService). Instalamos
#                          o pacote do SO em vez do Chromium embutido do Puppeteer
#                          (PUPPETEER_SKIP_DOWNLOAD=true) — build mais rápido e
#                          já traz todas as libs gráficas necessárias.
#   • fonts-liberation   — fonte usada pelos drawtext do FfmpegService (lower thirds).
#   • ca-certificates    — TLS para chamadas a Replicate/Fal.ai/S3.
# fluent-ffmpeg usa os binários portáveis de ffmpeg-static/ffprobe-static
# (instalados via npm), então NÃO é necessário `apt-get install ffmpeg`.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main.js"]
