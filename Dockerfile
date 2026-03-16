# ── Build stage ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# ativa pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# copia manifests
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# instala dependências
RUN pnpm install --frozen-lockfile

# copia código
COPY . .

# build da aplicação
RUN pnpm build


# ── Runtime stage ───────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# copia apenas o necessário do builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
ENV ICR_API_URL=""

EXPOSE 3000

CMD ["node", "dist/index.js"]