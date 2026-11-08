# Kiosk Client - Saf HTML / CSS / JavaScript (Sıfır Node.js)

Bu gösterici sürümü, **cihazda Node.js, npm veya Express olmadan** çalışan, doğrudan Chromium tarayıcısının donanım hızlandırmasından ve IndexedDB çevrimdışı önbelleğinden beslenen ultra hafif sürümdür.

---

## ⚡ Temel Yetenekler
1. **Sıfır Kurulum:** Cihazda Node.js yüklü olması gerekmez. Sadece Chromium yeterlidir.
2. **Doğrudan WebSocket:** Tarayıcı JavaScript'i doğrudan `wss://pano.teknovip.net` sunucusuna bağlanır.
3. **IndexedDB Çevrimdışı Önbellek:** Gelen videolar ve resimler tarayıcının yerel **IndexedDB** deposuna `Blob` olarak kaydedilir. İnternet kopsa dahi pano videoları ve görselleri kesintisiz oynatmaya devam eder.
4. **Donanım Kimliği (Hardware ID):** Başlatma scripti `/etc/machine-id` donanım kimliğini okur ve `file:///...?deviceId=...` parametresi ile tarayıcıya aktarır.

---

## 🚀 Pardus / Debian Otomatik Kurulumu

1. `kiosk-client` klasörünü cihaza kopyalayın.
2. Otomatik kurulum betiğini çalıştırın:
   ```bash
   sudo bash setup-kiosk.sh
   sudo reboot
   ```
3. Cihaz açıldığında ekranda doğrudan 6 haneli PIN kodu ve QR kod görünecektir.
