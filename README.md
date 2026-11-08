# Dijital Duyuru Panosu (Digital Signage Kiosk Sistemi)

Okul, hastane ve kurumsal binalar için geliştirilmiş; merkezi sunucu üzerinden PIN eşleştirmeli, internet kopsa dahi kesintisiz çalışan tam yığın (full-stack) dijital pano sistemi.

---

## 🏗 Mimari Bileşenler

```
+-------------------------------------------------------------------------------+
|                             RELAY & MEDIA HUB                                 |
|                       (Node.js / Express / WebSocket)                         |
|         - 6 Haneli Rastgele PIN & Token Eşleştirme (TTL: 10 Dk)               |
|         - WebSocket Odaları (Room_<DeviceId>)                                 |
|         - HTTP POST /api/upload Medya Servisi                                 |
+-------------------------------------------------------------------------------+
           ▲                                                         ▲
           │ WebSocket (WSS)                                         │ WebSocket (WSS)
           │ HTTP POST (Upload)                                      │ JSON Updates
           ▼                                                         ▼
+-------------------------------------+   +-------------------------------------+
|      ADMIN STUDIO (Windows)         |   |      KIOSK CLIENT (Pardus Linux)    |
|      (React / Vite / Tailwind)      |   |       (Chromium Kiosk + Engine)     |
| - Canlı 1:1 WYSIWYG Önizleme        |   | - İlk Açılışta QR/PIN Ekranı        |
| - Tıkla-Düzenle Dinamik Popuplar    |   | - 7/24 Kesintisiz Tam Ekran         |
| - Şablon Seçici (Okul/Hastane/Krp)  |   | - Yerel Önbellek (Offline Cache)    |
| - Tek Tıkla Canlı Yayına Gönder     |   | - Otomatik Systemd & LightDM Giriş  |
+-------------------------------------+   +-------------------------------------+
```

---

## 📁 Dizin Yapısı

* `shared/`: Ortak JSON Schema (`board-data.schema.json`) ve TypeScript tipleri (`board.ts`).
* `relay-server/`: Node.js Express & WebSocket Hub ve Medya yükleme servisi.
* `admin-client/`: İçerik yöneticisinin şablonlar üzerinden veri düzenlediği React/Tailwind WYSIWYG arayüzü (Electron masaüstü destekli).
* `kiosk-client/`: Pardus/Debian üzerinde çalışan Kiosk istemcisi (Arka plan daemon'u `engine.js`, Chromium ön yüzü, `systemd` servisleri ve `setup-kiosk.sh` otomatik kurulum betiği).
* `docker-compose.yml` & `nginx.conf`: Merkezi sunucunun buluta tek komutla konuşlandırılması için Docker yapılandırması.

---

## 🚀 Hızlı Başlangıç & Yerel Geliştirme (Localhost Testi)

Tüm sistemi yerel bilgisayarınızda test etmek için:

### 1. Relay Sunucusunu Başlatma
```bash
cd relay-server
npm install
npm run dev
# Sunucu http://localhost:8080 ve ws://localhost:8080 üzerinde dinlemede olacaktır.
```

### 2. Kiosk İstemcisini Başlatma (Simülasyon)
Yeni bir terminalde:
```bash
cd kiosk-client
npm install
npm start
# http://127.0.0.1:3000 adresini tarayıcınızda açın.
# Ekranda 6 haneli eşleşme PIN kodu ve QR kod görünecektir.
```

### 3. Yönetici Stüdyosu'nu (Admin Studio) Başlatma
Yeni bir terminalde:
```bash
cd admin-client
npm install
npm run dev
# http://localhost:5173 adresini tarayıcınızda açın.
```
- Ekranda görünen PIN kodunu Admin Studio sol menüsündeki alana girip **Panoyu Bağla** butonuna basın.
- Pano anında eşleşecek ve yeşil `CANLI (ONLINE)` durumuna geçecektir.
- Önizleme ekranındaki bileşenlere tıklayarak metinleri, duyuruları, tabloları veya medya slider'ını düzenleyin.
- **Canlı Panoya Yayınla** butonuna bastığınız anda Kiosk ekranı anında güncellenecektir.

---

## 🐧 Pardus / Debian Linux Kiosk Kurulumu (Üretim Ortamı)

Sıfır bir Pardus veya Debian makinesinde otomatik kurulum yapmak için:

1. `kiosk-client` klasörünü hedef cihaza kopyalayın.
2. Otomatik kurulum betiğini root yetkisiyle çalıştırın:
```bash
cd kiosk-client/scripts
sudo bash setup-kiosk.sh
```

Bu script otomatik olarak:
- Chromium, X11 ve Node.js bağımlılıklarını kurar.
- `kiosk` kullanıcısını oluşturur ve LightDM otomatik oturum açmayı (`autologin`) etkinleştirir.
- Ekran kararmasını, fare imlecini ve güç tasarrufunu devre dışı bırakır.
- `duyuru-engine.service` ve `duyuru-kiosk.service` systemd servislerini kaydedip başlatır.
- Cihaz yeniden başladığında doğrudan tam ekran dijital pano açılır.

---

## 🛡 Çevrimdışı Dayanıklılık (Offline Resiliency)
- Kiosk istemcisi, sunucudan gelen son içerik paketini `/var/lib/duyuru-pano/board-data.json` dosyasına **atomik yazma** yöntemiyle kaydeder.
- Resim ve video dosyaları `/var/lib/duyuru-pano/media/` klasörüne yerel olarak indirilir.
- İnternet bağlantısı kesilse veya elektrik gidip gelse bile pano açıldığında son indirilen içeriklerle yayına kesintisiz devam eder.
