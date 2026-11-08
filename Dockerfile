# ==============================================================================
# e-Pano Relay Hub - Production Dockerfile (Debian Slim Tabanlı, Hızlı & Garantili)
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Derleme için gerekli paketler (better-sqlite3 ve bcrypt için)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve kur
COPY relay-server/package*.json relay-server/tsconfig.json ./
# npm ci yerine npm install (package-lock.json olmasa dahi sorunsuz kurar)
RUN npm install

# Kaynak kodları kopyala ve TypeScript derle
COPY relay-server/src/ ./src/
RUN npm run build

# ==============================================================================
# Çalışma Aşaması (Runner)
# ==============================================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY relay-server/package*.json ./
RUN npm install --only=production

# Builder aşamasından derlenmiş dist klasörünü al
COPY --from=builder /app/dist ./dist

# Veritabanı ve Medya klasörlerini hazırla
RUN mkdir -p /app/data /app/uploads

EXPOSE 8080

CMD ["node", "dist/server.js"]
