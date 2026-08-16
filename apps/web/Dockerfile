# syntax=docker/dockerfile:1

FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# URL pública da API, usada em tempo de build pelo Next.js para embutir
# NEXT_PUBLIC_* nos bundles do client (ver lib/api/client.ts). Não é
# segredo — só a URL. O segredo real (API_TOKEN, usado pelo backend-proxy
# server-side) NUNCA é ARG/ENV de build: é passado só em runtime pelo
# docker-compose.yml, pra nunca ser embutido no bundle do navegador.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
ARG NEXT_PUBLIC_TENANT_ID
ARG NEXT_PUBLIC_SHOW_INTERNAL_VIEWS=false
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_TENANT_ID=$NEXT_PUBLIC_TENANT_ID \
    NEXT_PUBLIC_SHOW_INTERNAL_VIEWS=$NEXT_PUBLIC_SHOW_INTERNAL_VIEWS
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3001
CMD ["npm", "run", "start", "--", "-p", "3001"]
