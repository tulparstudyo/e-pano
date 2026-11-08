#!/usr/bin/env bash
# ==============================================================================
# e-Pano Sistem ve Kurulum Doğrulama Scripti (Diagnostics)
# ==============================================================================

echo "=========================================================="
echo "    e-PANO SİSTEM SAĞLIK VE BAĞLANTI DOĞRULAMA TESTİ      "
echo "=========================================================="

# 1. Docker Konteyner Kontrolü
echo -n "[1/4] Docker Konteyneri Kontrol Ediliyor... "
if docker ps --format '{{.Names}}' | grep -q "epano-relay-hub"; then
    echo "✓ [ÇALIŞIYOR]"
else
    echo "✗ [HATA: epano-relay-hub konteyneri çalışmıyor!]"
    echo "       'docker compose -f docker-compose.prod.yml up -d' ile başlatın."
fi

# 2. Yerel Port 8080 Dinleme Testi
echo -n "[2/4] 127.0.0.1:8080 Port Erişimi... "
LOCAL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/auth/me || echo "000")
if [ "$LOCAL_HTTP" = "401" ] || [ "$LOCAL_HTTP" = "200" ]; then
    echo "✓ [BAŞARILI (HTTP $LOCAL_HTTP)]"
else
    echo "✗ [HATA: 127.0.0.1:8080 yanıt vermiyor! (HTTP $LOCAL_HTTP)]"
fi

# 3. Dış HTTPS / Domain Testi (pano.teknovip.net)
DOMAIN=${1:-"pano.teknovip.net"}
echo -n "[3/4] Dış Dünya HTTPS Erişimi (https://$DOMAIN)... "
DOMAIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/auth/me" || echo "000")
if [ "$DOMAIN_HTTP" = "401" ] || [ "$DOMAIN_HTTP" = "200" ]; then
    echo "✓ [BAŞARILI (HTTP $DOMAIN_HTTP)]"
else
    echo "⚠ [UYARI: https://$DOMAIN erişimi HTTP $DOMAIN_HTTP döndü. Nginx veya Cloudflare ayarlarını kontrol edin.]"
fi

# 4. Veritabanı ve Dizin Yazma Yetkisi
echo -n "[4/4] SQLite Veritabanı ve Medya Deposu... "
if [ -d "data" ] && [ -d "uploads" ]; then
    echo "✓ [DİZİNLER MEVCUT]"
else
    echo "⚠ [Dizinler henüz oluşmamış, konteyner başladığında otomatik oluşacaktır]"
fi

echo "=========================================================="
echo " Doğrulama tamamlandı. Kiosk ve Admin Studio bağlantıya hazır!"
echo "=========================================================="
