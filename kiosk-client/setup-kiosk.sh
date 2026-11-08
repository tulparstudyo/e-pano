#!/usr/bin/env bash
# ==============================================================================
# PARDUS / DEBIAN DİJİTAL DUYURU PANOSU OTOMATİK KURULUM SCRIPTI (SIFIR NODE.JS)
# ==============================================================================
set -e

if [ "$EUID" -ne 0 ]; then
  echo "[!] Lütfen bu betiği root yetkisiyle çalıştırın: sudo bash setup-kiosk.sh"
  exit 1
fi

echo "=========================================================="
echo "    PARDUS SAF HTML KIOSK OTOMATIK KURULUMU BASLATILIYOR  "
echo "=========================================================="

echo "[1/5] Paket depoları güncelleniyor..."
apt-get update -y

echo "[2/5] Chromium, X11 ve sistem araçları kuruluyor..."
apt-get install -y \
  curl \
  chromium \
  chromium-l10n \
  xorg \
  xinit \
  lightdm \
  unclutter \
  xdotool \
  x11-xserver-utils

echo "[3/5] Kiosk sistem kullanıcısı yapılandırılıyor..."
if ! id "kiosk" &>/dev/null; then
  useradd -m -s /bin/bash kiosk
  usermod -aG video,audio,render,input kiosk
  echo "kiosk:kiosk" | chpasswd
fi

echo "[4/5] Kiosk dosyaları /opt/duyuru-kiosk içine kopyalanıyor..."
mkdir -p /opt/duyuru-kiosk
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -r "$SCRIPT_DIR/"* /opt/duyuru-kiosk/
chmod +x /opt/duyuru-kiosk/start-kiosk.sh
chown -R kiosk:kiosk /opt/duyuru-kiosk

# LightDM Autologin
mkdir -p /etc/lightdm/lightdm.conf.d
cat << 'EOF' > /etc/lightdm/lightdm.conf.d/50-kiosk.conf
[Seat:*]
autologin-guest=false
autologin-user=kiosk
autologin-user-timeout=0
pam-service=lightdm-autologin
pam-autologin-service=lightdm-autologin
xserver-command=X -s 0 -dpms -nocursor
EOF

# Oturum Başlatıcı
cat << 'EOF' > /home/kiosk/.xsession
#!/usr/bin/env bash
exec /opt/duyuru-kiosk/start-kiosk.sh
EOF
chmod +x /home/kiosk/.xsession
chown kiosk:kiosk /home/kiosk/.xsession

# Cronjob ile Gece 03:30 RAM Tazeleme
cat << 'EOF' > /etc/cron.d/kiosk-watchdog
30 3 * * * kiosk export DISPLAY=:0 && xdotool key F5 || systemctl restart duyuru-kiosk.service
EOF

echo "[5/5] Systemd servisi kaydediliyor..."
cp /opt/duyuru-kiosk/duyuru-kiosk.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable duyuru-kiosk.service
systemctl enable lightdm.service

echo "=========================================================="
echo " [OK] Kurulum tamamlandı! Node.js olmadan saf Kiosk hazır."
echo " 'sudo reboot' komutuyla sistemi başlatabilirsiniz."
echo "=========================================================="
