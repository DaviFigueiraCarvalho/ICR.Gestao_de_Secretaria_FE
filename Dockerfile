# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Instala pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia manifests e instala dependências
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copia o restante do código e faz o build
COPY . .
RUN pnpm build

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Apenas dependências de produção
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copia o build gerado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Variáveis de ambiente (sobrescreva no docker-compose ou no runtime)
ENV NODE_ENV=production
ENV PORT=3000

# ICR_API_URL deve ser definida no docker-compose ou como argumento de runtime
# Ex: ICR_API_URL=http://icr-api:8080
ENV ICR_API_URL=""

EXPOSE 3000

CMD ["node", "dist/index.js"]
