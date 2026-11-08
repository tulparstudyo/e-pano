#!/usr/bin/env bash
# ==============================================================================
# PARDUS / DEBIAN DİJİTAL DUYURU PANOSU OTOMATİK KURULUM VE KİOSK YAPILANDIRMASI
# ==============================================================================
set -e

if [ "$EUID" -ne 0 ]; then
  echo "[!] Lutfen bu betigi root yetkisiyle calistirin: sudo bash setup-kiosk.sh"
  exit 1
fi

echo "=========================================================="
echo "    PARDUS / DEBIAN KIOSK OTOMATIK KURULUM BASLATILIYOR   "
echo "=========================================================="

echo "[1/7] Paket depolari guncelleniyor..."
apt-get update -y

echo "[2/7] Chromium, X11 ve gerekli sistem araclari kuruluyor..."
apt-get install -y \
  curl \
  wget \
  chromium \
  chromium-l10n \
  xorg \
  xinit \
  lightdm \
  unclutter \
  xdotool \
  x11-xserver-utils

# Node.js LTS (20.x) kontrolu ve kurulumu
if ! command -v node &> /dev/null; then
  echo "[3/7] Node.js 20.x LTS yukleniyor..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[3/7] Node.js zaten kurulu: $(node -v)"
fi

echo "[4/7] Kiosk sistem kullanicisi olusturuluyor..."
if ! id "kiosk" &>/dev/null; then
  useradd -m -s /bin/bash kiosk
  usermod -aG video,audio,render,input kiosk
  echo "kiosk:kiosk" | chpasswd
  echo "kiosk kullanicisi basariyla olusturuldu."
fi

echo "[5/7] Calisma ve onbellek dizinleri hazirlaniyor..."
mkdir -p /opt/duyuru-kiosk/public
mkdir -p /var/lib/duyuru-pano/media
mkdir -p /etc/duyuru-pano

# Dosyalari kopyala
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$SCRIPT_DIR/engine.js" /opt/duyuru-kiosk/
cp "$SCRIPT_DIR/package.json" /opt/duyuru-kiosk/
cp "$SCRIPT_DIR/start-kiosk.sh" /opt/duyuru-kiosk/
cp -r "$SCRIPT_DIR/public/"* /opt/duyuru-kiosk/public/

# Kiosk icindeki bagimliliklari yukle
cd /opt/duyuru-kiosk
npm install --production

# Izinleri duzenle
chmod +x /opt/duyuru-kiosk/start-kiosk.sh
chown -R kiosk:kiosk /var/lib/duyuru-pano
chmod 775 /var/lib/duyuru-pano/media

echo "[6/7] LightDM Autologin (Otomatik Giris) aktif ediliyor..."
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

# Kiosk oturum baslaticisi
cat << 'EOF' > /home/kiosk/.xsession
#!/usr/bin/env bash
exec /opt/duyuru-kiosk/start-kiosk.sh
EOF
chmod +x /home/kiosk/.xsession
chown kiosk:kiosk /home/kiosk/.xsession

# Watchdog Cronjob: Her gece 03:30'da bellek tazeleme
cat << 'EOF' > /etc/cron.d/kiosk-watchdog
30 3 * * * kiosk export DISPLAY=:0 && xdotool key F5 || systemctl restart duyuru-kiosk.service
EOF

echo "[7/7] Systemd servisleri kaydediliyor ve baslatiliyor..."
cp "$SCRIPT_DIR/systemd/duyuru-engine.service" /etc/systemd/system/
cp "$SCRIPT_DIR/systemd/duyuru-kiosk.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable duyuru-engine.service
systemctl enable lightdm.service

echo "=========================================================="
echo " [TAMAMLANDI] Pardus Kiosk Kurulumu Basariyla Bitti!"
echo " Cihazi 'reboot' komutuyla yeniden baslatabilirsiniz."
echo "=========================================================="
