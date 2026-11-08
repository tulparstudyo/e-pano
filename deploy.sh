#!/usr/bin/env bash
# ==============================================================================
# DEPO.TEKNOVIP.NET - TEK KOMUTLA DEPLOY & GÜNCELLEME SCRIPTI
# ==============================================================================
set -e

echo "[*] Git güncellemeleri çekiliyor (git pull)..."
git pull origin main || git pull

if [ ! -f .env ]; then
  echo "[!] .env dosyası bulunamadı, .env.example kopyalanıyor..."
  cp .env.example .env
fi

echo "[*] Docker konteyneri derleniyor ve arka planda başlatılıyor..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.prod.yml up -d --build

echo "[*] Konteyner durumu kontrol ediliyor..."
docker ps --filter "name=epano-relay-hub"

echo "=========================================================="
echo " [OK] depo.teknovip.net başarıyla güncellendi ve çalışıyor!"
echo "=========================================================="
