# Saf HTML / CSS / JS Dijital Pano Kiosk İstemcisi (Node.js Yok)

Bu sürüm, **cihazda Node.js, npm, Express veya herhangi bir arka plan motoru OLMADAN** çalışan ultra hafif gösterici sürümüdür.

---

## ⚡ Avantajları
1. **Sıfır Node.js / Sıfır Kurulum:** Cihazda Node.js kurulu olması gerekmez. Sadece Chromium tarayıcısı yeterlidir.
2. **Doğrudan WebSocket:** Tarayıcı JavaScript'i doğrudan `wss://pano.teknovip.net` sunucusuna bağlanır.
3. **IndexedDB Çevrimdışı Önbellek:** Gelen videolar ve resimler tarayıcının yerel **IndexedDB** deposuna `Blob` olarak kaydedilir. İnternet kopsa dahi pano videoları ve görselleri kesintisiz oynatmaya devam eder.
4. **Donanım Kimliği (Hardware ID):** Başlatma scripti `/etc/machine-id` donanım kimliğini okur ve `file:///...?deviceId=...` parametresi ile tarayıcıya aktarır.

---

## 🚀 Pardus / Debian Kurulumu

1. Bu klasörü Pardus cihazında `/opt/duyuru-kiosk-static` dizinine kopyalayın:
   ```bash
   sudo mkdir -p /opt/duyuru-kiosk-static
   sudo cp -r * /opt/duyuru-kiosk-static/
   sudo chmod +x /opt/duyuru-kiosk-static/start-kiosk.sh
   ```

2. Systemd servisini kaydedip başlatın:
   ```bash
   sudo cp /opt/duyuru-kiosk-static/duyuru-kiosk-static.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable duyuru-kiosk-static.service
   sudo systemctl start duyuru-kiosk-static.service
   ```

3. Cihaz açıldığında ekranda doğrudan 6 haneli PIN kodu ve QR kod görünecektir.
