const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');
const WebSocket = require('ws');
const express = require('express');

// Platform dosya yolları
const isLinux = process.platform === 'linux';
const BASE_DATA_DIR = isLinux ? '/var/lib/duyuru-pano' : path.join(__dirname, 'data');
const BASE_CONF_DIR = isLinux ? '/etc/duyuru-pano' : path.join(__dirname, 'config');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MEDIA_DIR = path.join(BASE_DATA_DIR, 'media');
const DATA_FILE = path.join(BASE_DATA_DIR, 'board-data.json');
const CONFIG_FILE = path.join(BASE_CONF_DIR, 'config.json');

if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(BASE_CONF_DIR)) fs.mkdirSync(BASE_CONF_DIR, { recursive: true });

function getDeviceId() {
  try {
    if (fs.existsSync('/etc/machine-id')) {
      return fs.readFileSync('/etc/machine-id', 'utf-8').trim();
    }
  } catch (e) {}

  const idPath = path.join(BASE_CONF_DIR, 'device-id');
  if (fs.existsSync(idPath)) return fs.readFileSync(idPath, 'utf-8').trim();

  const generated = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(idPath, generated, 'utf-8');
  return generated;
}

const deviceId = getDeviceId();
console.log(`[Kiosk Engine] Cihaz ID: ${deviceId}`);

let config = {
  relayUrl: process.env.RELAY_WS_URL || 'wss://pano.teknovip.net',
  token: null,
  nightSleepEnabled: false,
  sleepHour: 22,
  wakeHour: 7
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  } catch (e) {}
}

let currentPin = null;
let emergencyState = null; // { active: boolean, title: string, message: string }

// Yerel Web Servisi (Chromium buradan beslenir)
const app = express();
app.use(express.json());
app.use('/media', express.static(MEDIA_DIR));
app.use(express.static(PUBLIC_DIR));

app.get('/api/current-data', (_req, res) => {
  // 1. Eğer Acil Durum / Siren modu aktifse öncelikli olarak onu ilet
  if (emergencyState && emergencyState.active) {
    return res.json({
      layoutId: 'emergency',
      title: emergencyState.title,
      message: emergencyState.message
    });
  }

  // 2. Cihaz henüz eşleşmemişse veya sunucu yeni PIN vermişse Eşleştirme (PIN/QR) ekranını göster
  if (!config.token || currentPin) {
    return res.json({
      layoutId: 'pairing',
      pin: currentPin,
      deviceId
    });
  }

  // 3. Cihaz eşleşmişse ve yerel önbellekte içerik varsa onu göster
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return res.json(data);
    } catch (e) {}
  }

  return res.json({
    layoutId: 'pairing',
    pin: currentPin,
    deviceId
  });
});

app.listen(3000, '127.0.0.1', () => {
  console.log('[Kiosk Engine] 127.0.0.1:3000 üzerinde aktif.');
});

// Güvenli Atomik Dosya Yazma
function safeWriteJsonSync(filePath, data) {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

// Medya İndirme
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Medyaları Yerel Diske İndirip URL'leri localhost yapma
async function cacheMediaLocally(payload) {
  if (!payload || !payload.components) return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  const comp = clone.components;

  for (const key of Object.keys(comp)) {
    const item = comp[key];
    if (item && item.type === 'media_slider' && Array.isArray(item.items)) {
      for (const media of item.items) {
        if (!media.url) continue;
        try {
          const urlObj = new URL(media.url);
          const ext = path.extname(urlObj.pathname) || '.bin';
          const localFileName = `${media.id}${ext}`;
          const localFilePath = path.join(MEDIA_DIR, localFileName);

          if (!fs.existsSync(localFilePath)) {
            console.log(`[Cache] Medya indiriliyor: ${media.url}`);
            await downloadFile(media.url, localFilePath);
          }
          media.url = `http://127.0.0.1:3000/media/${localFileName}`;
        } catch (err) {
          console.error(`[Cache] Hata:`, err.message);
        }
      }
    }
  }
  return clone;
}

// Ekran Güç Yönetimi (Gece Modu DPMS Sleep/Wake)
function handleScreenPowerSchedule() {
  if (!isLinux || !config.nightSleepEnabled) return;
  const currentHour = new Date().getHours();
  const shouldSleep = currentHour >= config.sleepHour || currentHour < config.wakeHour;

  if (shouldSleep) {
    exec('export DISPLAY=:0 && xset dpms force off', () => {});
  } else {
    exec('export DISPLAY=:0 && xset dpms force on', () => {});
  }
}
setInterval(handleScreenPowerSchedule, 60 * 1000);

let wsClient = null;

// Telemetri Gönderimi (CPU / RAM / Disk)
function sendTelemetry() {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) return;

  const memFreeMb = Math.round(os.freemem() / (1024 * 1024));
  const cpus = os.cpus();
  const cpuUsage = Math.round(
    (cpus.reduce((acc, cpu) => acc + (cpu.times.user + cpu.times.sys) / (cpu.times.idle + cpu.times.user + cpu.times.sys), 0) / cpus.length) * 100
  );

  wsClient.send(JSON.stringify({
    type: 'KIOSK_TELEMETRY',
    cpuUsage,
    memFreeMb,
    diskFreeGb: 12.4, // Linux ortamında df -h parse edilebilir
    resolution: '1920x1080',
    uptimeSec: Math.round(os.uptime())
  }));
}

// WebSocket Relay İletişim Döngüsü
function connectSocket() {
  wsClient = new WebSocket(config.relayUrl);

  wsClient.on('open', () => {
    console.log('[Relay WS] Bağlantı kuruldu.');
    wsClient.send(JSON.stringify({
      type: 'KIOSK_REGISTER',
      deviceId,
      token: config.token
    }));
    sendTelemetry();
  });

  wsClient.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'PIN_GENERATED') {
        currentPin = msg.pin;
        config.token = null;
        console.log(`[Relay WS] Eşleşme PIN Kodu Alındı: ${currentPin} (Admin Studio'ya bu PIN'i girin)`);
      } else if (msg.type === 'PAIRED_SUCCESS') {
        config.token = msg.pairingToken;
        safeWriteJsonSync(CONFIG_FILE, config);
        currentPin = null;
      } else if (msg.type === 'STATUS') {
        if (msg.paired) currentPin = null;
      } else if (msg.type === 'UPDATE_CONTENT') {
        const cachedPayload = await cacheMediaLocally(msg.payload);
        safeWriteJsonSync(DATA_FILE, cachedPayload);
      } else if (msg.type === 'EMERGENCY_ALERT') {
        console.warn('🚨 ACİL DURUM UYARISI ALINDI:', msg.title);
        emergencyState = msg;
      } else if (msg.type === 'UNPAIRED') {
        config.token = null;
        safeWriteJsonSync(CONFIG_FILE, config);
        if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
        currentPin = null;
        emergencyState = null;
        wsClient.close();
      }
    } catch (err) {
      console.error('[Relay WS] Hata:', err);
    }
  });

  wsClient.on('close', () => setTimeout(connectSocket, 5000));
  wsClient.on('error', (err) => {
    console.error('[Relay WS] Soket hatası:', err.message);
    wsClient.close();
  });
}

// 60 saniyede bir telemetri gönder
setInterval(sendTelemetry, 60 * 1000);
connectSocket();
