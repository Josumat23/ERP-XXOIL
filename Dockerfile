# node:20-bookworm-slim (glibc, no alpine) porque better-sqlite3 usa un
# binario nativo prebuilt que necesita glibc, no musl.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# No se usa `output: "standalone"` de Next: ese trace está pensado para el
# `next start` por defecto y es incompatible con el servidor custom
# (server.ts) que maneja el upgrade de WebSocket — se copia node_modules
# completo en vez de depender de ese modo.
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/public ./public
COPY package.json server.ts next.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
