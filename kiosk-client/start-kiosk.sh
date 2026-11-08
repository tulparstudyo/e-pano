#!/usr/bin/env bash
# ==============================================================================
# PARDUS / DEBIAN KIOSK SHELL BAŞLATMA SCRIPTI
# Ekran kararması, uyku modunu ve fare imlecini kapatır; Chromium'u Kiosk başlatır.
# ==============================================================================

export DISPLAY=:0

# 1. Ekran koruyucu ve DPMS güç yönetimini tamamen kapat
xset s noblank
xset s off
xset -dpms

# 2. Hareketsiz fare imlecini 0.5 saniyede ekrandan gizle
if command -v unclutter &> /dev/null; then
  unclutter -idle 0.5 -root &
fi

# 3. Chromium'un beklenmedik kapanışlarındaki "Restore session" uyarılarını temizle
CHROME_PREF="$HOME/.config/chromium/Default/Preferences"
if [ -f "$CHROME_PREF" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROME_PREF" 2>/dev/null || true
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROME_PREF" 2>/dev/null || true
fi

# 4. Chromium Kiosk Modunu Başlat
exec /usr/bin/chromium \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --incognito \
  --check-for-update-interval=31536000 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=TranslateUI \
  --disk-cache-dir=/tmp/chromium-cache \
  http://127.0.0.1:3000
