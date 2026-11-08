#!/usr/bin/env bash
# ==============================================================================
# PARDUS / DEBIAN SAF HTML KIOSK BAŞLATICI (Sıfır Node.js Bağımlılığı)
# ==============================================================================

export DISPLAY=:0

# 1. Ekran koruyucu ve DPMS güç yönetimini kapat
xset s noblank
xset s off
xset -dpms

# 2. Hareketsiz fare imlecini gizle
if command -v unclutter &> /dev/null; then
  unclutter -idle 0.5 -root &
fi

# 3. Donanım Machine ID oku
HW_ID="unknown"
if [ -f /etc/machine-id ]; then
  HW_ID=$(cat /etc/machine-id | tr -d '[:space:]')
fi

# 4. Chromium kilitlerini temizle
CHROME_PREF="$HOME/.config/chromium/Default/Preferences"
if [ -f "$CHROME_PREF" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$CHROME_PREF" 2>/dev/null || true
  sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$CHROME_PREF" 2>/dev/null || true
fi

# 5. Chromium'u Doğrudan Yerel HTML ile Başlat (IndexedDB ve WebSocket İzinli)
exec /usr/bin/chromium \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --incognito \
  --allow-file-access-from-files \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=TranslateUI \
  "file:///opt/duyuru-kiosk/index.html?deviceId=${HW_ID}"
