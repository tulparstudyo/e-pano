# ==============================================================================
# e-Pano Relay Hub - Relay Server Klasöründen Doğrudan Derleme Dockerfile
# ==============================================================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --only=production

COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data /app/uploads

EXPOSE 8080

CMD ["node", "dist/server.js"]
