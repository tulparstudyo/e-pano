# ==============================================================================
# e-Pano Relay Hub - Production Dockerfile (aaPanel Uyumlu Kök Dizin Dockerfile)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Relay Server bağımlılıklarını kopyala ve derle
COPY relay-server/package*.json relay-server/tsconfig.json ./
RUN npm ci

COPY relay-server/src/ ./src/
RUN npm run build

# Çalışma Aşaması (Runner)
FROM node:20-alpine AS runner

WORKDIR /app

COPY relay-server/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Veri ve Medya dizinlerini oluştur
RUN mkdir -p /app/data /app/uploads

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.js"]
