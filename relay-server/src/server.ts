import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'pano-global-jwt-secret-key-2024';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Dizinler
const DATA_DIR = path.join(__dirname, '../data');
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// SQLite Veritabanı (WAL Modu)
const db = new Database(path.join(DATA_DIR, 'pano.db'));
db.pragma('journal_mode = WAL');

// Çok Kurumlu (Multi-Tenant) Tablo Şeması
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at INTEGER NOT NULL,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    tenant_id TEXT,
    pairing_token TEXT UNIQUE,
    name TEXT DEFAULT 'Giriş Panosu',
    location TEXT DEFAULT 'Zemin Kat',
    last_seen INTEGER,
    created_at INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS device_contents (
    device_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(device_id) REFERENCES devices(device_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS device_telemetry (
    device_id TEXT PRIMARY KEY,
    cpu_usage REAL,
    mem_free_mb INTEGER,
    disk_free_gb REAL,
    resolution TEXT,
    uptime_sec INTEGER,
    updated_at INTEGER
  );
`);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/media', express.static(UPLOADS_DIR));

// Disk Depolama Yapılandırması
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const hash = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${hash}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Medya Yükleme
app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya yüklenemedi.' });
  const fileUrl = `${req.protocol}://${req.get('host')}/media/${req.file.filename}`;
  const isVideo = req.file.mimetype.startsWith('video');

  res.json({
    id: req.file.filename,
    url: fileUrl,
    size: req.file.size,
    mediaType: isVideo ? 'video' : 'image'
  });
});

// JWT Doğrulama Middleware
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
  };
}

function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme başlığı (Bearer token) eksik.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }
}

// -------------------------------------------------------------
// KİMLİK DOĞRULAMA (AUTH) UÇ NOKTALARI
// -------------------------------------------------------------

// Kurum ve Yönetici Kaydı (Register)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { institutionName, email, password } = req.body;
  if (!institutionName || !email || !password) {
    return res.status(400).json({ error: 'Kurum adı, e-posta ve şifre zorunludur.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
  }

  const tenantId = `tenant_${crypto.randomBytes(8).toString('hex')}`;
  const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();

  const insertTenant = db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)');
  const insertUser = db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    insertTenant.run(tenantId, institutionName, now);
    insertUser.run(userId, tenantId, email, passwordHash, 'admin', now);
  });
  tx();

  const token = jwt.sign({ userId, tenantId, email, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });

  res.json({
    success: true,
    token,
    user: { id: userId, email, role: 'admin' },
    tenant: { id: tenantId, name: institutionName }
  });
});

// Kurum Yöneticisi Girişi (Login)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Hatalı e-posta veya şifre.' });
  }

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id) as any;
  const token = jwt.sign(
    { userId: user.id, tenantId: user.tenant_id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, role: user.role },
    tenant: { id: tenant.id, name: tenant.name }
  });
});

// Oturum Doğrulama (Me)
app.get('/api/auth/me', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user!.tenantId) as any;
  res.json({
    user: req.user,
    tenant: { id: tenant.id, name: tenant.name }
  });
});

// -------------------------------------------------------------
// PIN VE EŞLEŞME HAVUZU (Çakışma Korumalı & Çok Kurumlu)
// -------------------------------------------------------------

interface ActivePin {
  pin: string;
  deviceId: string;
  expiresAt: number;
}
const activePins = new Map<string, ActivePin>();
const kioskSockets = new Map<string, WebSocket>();
const tenantAdminSockets = new Map<string, Set<WebSocket>>(); // tenantId -> Set<WebSocket>

function generateUniquePin(deviceId: string): string {
  let pin = '';
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (activePins.has(pin));

  activePins.set(pin, {
    pin,
    deviceId,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 dakika TTL
  });

  return pin;
}

// PIN ile Cihaz Sahiplenme (Claiming - Giriş yapmış yöneticiye zimmetlenir)
app.post('/api/pair', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const { pin, name, location } = req.body;
  const tenantId = req.user!.tenantId;

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN kodu gereklidir.' });
  }

  const cleanPin = pin.trim();
  const entry = activePins.get(cleanPin);

  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş PIN kodu.' });
  }

  const pairingToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  db.prepare(`
    INSERT INTO devices (device_id, tenant_id, pairing_token, name, location, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      pairing_token = excluded.pairing_token,
      name = coalesce(?, devices.name),
      location = coalesce(?, devices.location),
      last_seen = excluded.last_seen
  `).run(entry.deviceId, tenantId, pairingToken, name || 'Yeni Pano', location || 'Giriş Kat', now, now, name, location);

  activePins.delete(cleanPin);

  // Kiosk'a eşleşmenin tamamlandığını bildir
  const kioskWs = kioskSockets.get(entry.deviceId);
  if (kioskWs && kioskWs.readyState === WebSocket.OPEN) {
    kioskWs.send(JSON.stringify({
      type: 'PAIRED_SUCCESS',
      pairingToken,
      deviceId: entry.deviceId
    }));
  }

  res.json({
    success: true,
    deviceId: entry.deviceId,
    name: name || 'Yeni Pano',
    location: location || 'Giriş Kat'
  });
});

// Kuruma Ait Cihazları Listele
app.get('/api/devices', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const devices = db.prepare('SELECT * FROM devices WHERE tenant_id = ? ORDER BY created_at DESC').all(tenantId) as any[];

  const enriched = devices.map((d) => {
    const isOnline = kioskSockets.get(d.device_id)?.readyState === WebSocket.OPEN;
    const telemetry = db.prepare('SELECT * FROM device_telemetry WHERE device_id = ?').get(d.device_id);
    const content = db.prepare('SELECT updated_at FROM device_contents WHERE device_id = ?').get(d.device_id) as any;
    return {
      ...d,
      isOnline,
      lastContentUpdate: content?.updated_at || null,
      telemetry: telemetry || null
    };
  });

  res.json(enriched);
});

// Cihaz Bilgilerini Güncelle
app.patch('/api/devices/:deviceId', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const { deviceId } = req.params;
  const { name, location } = req.body;
  const tenantId = req.user!.tenantId;

  db.prepare('UPDATE devices SET name = coalesce(?, name), location = coalesce(?, location) WHERE device_id = ? AND tenant_id = ?')
    .run(name, location, deviceId, tenantId);

  res.json({ success: true });
});

// Cihaz Eşleşmesini Kaldır (Sil)
app.delete('/api/devices/:deviceId', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const { deviceId } = req.params;
  const tenantId = req.user!.tenantId;

  db.prepare('DELETE FROM devices WHERE device_id = ? AND tenant_id = ?').run(deviceId, tenantId);
  db.prepare('DELETE FROM device_contents WHERE device_id = ? AND tenant_id = ?').run(deviceId, tenantId);

  const ws = kioskSockets.get(deviceId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'UNPAIRED' }));
  }

  res.json({ success: true });
});

// Acil Durum / Siren Tahliye Uyarısı Tetikleme (Kurum Bazlı)
app.post('/api/emergency', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  const { active, title, message } = req.body;
  const tenantId = req.user!.tenantId;

  const devices = db.prepare('SELECT device_id FROM devices WHERE tenant_id = ?').all(tenantId) as any[];
  const alertPayload = {
    type: 'EMERGENCY_ALERT',
    active: Boolean(active),
    title: title || 'DİKKAT! ACİL TAHLİYE UYARISI',
    message: message || 'Lütfen binayı acil çıkış kapılarını kullanarak derhal boşaltınız!',
    timestamp: Date.now()
  };

  let count = 0;
  devices.forEach((d) => {
    const ws = kioskSockets.get(d.device_id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(alertPayload));
      count++;
    }
  });

  res.json({ success: true, broadcastCount: count });
});

// -------------------------------------------------------------
// WEBSOCKET HUB (ÇOK KURUMLU ODALAR VE GERÇEK ZAMANLI İLETİŞİM)
// -------------------------------------------------------------

wss.on('connection', (ws: WebSocket) => {
  let role: 'KIOSK' | 'ADMIN' | null = null;
  let boundDeviceId: string | null = null;
  let boundTenantId: string | null = null;

  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw);

      switch (msg.type) {
        // Kiosk İlk Bağlantı
        case 'KIOSK_REGISTER': {
          const { deviceId, token } = msg;
          if (!deviceId) return;

          boundDeviceId = deviceId;
          role = 'KIOSK';
          kioskSockets.set(deviceId, ws);

          const row = db.prepare('SELECT tenant_id, pairing_token FROM devices WHERE device_id = ?').get(deviceId) as any;

          if (row && row.tenant_id && token && row.pairing_token === token) {
            boundTenantId = row.tenant_id;
            db.prepare('UPDATE devices SET last_seen = ? WHERE device_id = ?').run(Date.now(), deviceId);
            ws.send(JSON.stringify({ type: 'STATUS', paired: true }));

            // Varsa son içeriği doğrudan panoya ilet
            const lastContent = db.prepare('SELECT payload FROM device_contents WHERE device_id = ?').get(deviceId) as any;
            if (lastContent && lastContent.payload) {
              ws.send(JSON.stringify({
                type: 'UPDATE_CONTENT',
                payload: JSON.parse(lastContent.payload),
                timestamp: Date.now()
              }));
            }

            // Kurum adminlerine Kiosk ONLINE bildirimi
            const admins = tenantAdminSockets.get(row.tenant_id);
            admins?.forEach((a) => {
              if (a.readyState === WebSocket.OPEN) {
                a.send(JSON.stringify({ type: 'KIOSK_STATUS', deviceId, online: true }));
              }
            });
          } else {
            // Eşleşmemiş: Global benzersiz PIN üret
            const pin = generateUniquePin(deviceId);
            ws.send(JSON.stringify({ type: 'PIN_GENERATED', pin, ttlSec: 600 }));
          }
          break;
        }

        // Kiosk Donanım Telemetrisi
        case 'KIOSK_TELEMETRY': {
          if (role !== 'KIOSK' || !boundDeviceId) return;
          const { cpuUsage, memFreeMb, diskFreeGb, resolution, uptimeSec } = msg;

          db.prepare(`
            INSERT INTO device_telemetry (device_id, cpu_usage, mem_free_mb, disk_free_gb, resolution, uptime_sec, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
              cpu_usage = excluded.cpu_usage,
              mem_free_mb = excluded.mem_free_mb,
              disk_free_gb = excluded.disk_free_gb,
              resolution = excluded.resolution,
              uptime_sec = excluded.uptime_sec,
              updated_at = excluded.updated_at
          `).run(boundDeviceId, cpuUsage, memFreeMb, diskFreeGb, resolution, uptimeSec, Date.now());
          break;
        }

        // Admin Kurum Odasına Abone Olur (JWT ile yetkilendirilir)
        case 'ADMIN_SUBSCRIBE': {
          const { jwtToken } = msg;
          if (!jwtToken) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'JWT token gereklidir.' }));
            return;
          }

          try {
            const decoded = jwt.verify(jwtToken, JWT_SECRET) as any;
            boundTenantId = decoded.tenantId;
            role = 'ADMIN';

            if (!tenantAdminSockets.has(boundTenantId!)) {
              tenantAdminSockets.set(boundTenantId!, new Set());
            }
            tenantAdminSockets.get(boundTenantId!)!.add(ws);

            ws.send(JSON.stringify({
              type: 'SUBSCRIBED_SUCCESS',
              tenantId: boundTenantId
            }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Geçersiz JWT token.' }));
          }
          break;
        }

        // Admin İçerik Yayınlar (Seçili Cihaza veya Tüm Kurum Panolarına)
        case 'UPDATE_CONTENT': {
          if (role !== 'ADMIN' || !boundTenantId) return;
          const { payload, targetDeviceId, broadcastAll } = msg;
          const now = Date.now();
          const jsonStr = JSON.stringify(payload);

          const upsert = db.prepare(`
            INSERT INTO device_contents (device_id, tenant_id, payload, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
          `);

          if (broadcastAll) {
            const tenantDevices = db.prepare('SELECT device_id FROM devices WHERE tenant_id = ?').all(boundTenantId) as any[];
            tenantDevices.forEach((d) => {
              upsert.run(d.device_id, boundTenantId, jsonStr, now);
              const targetKiosk = kioskSockets.get(d.device_id);
              if (targetKiosk && targetKiosk.readyState === WebSocket.OPEN) {
                targetKiosk.send(JSON.stringify({ type: 'UPDATE_CONTENT', payload, timestamp: now }));
              }
            });
          } else if (targetDeviceId) {
            // Cihazın bu kuruma ait olduğunu doğrula
            const dev = db.prepare('SELECT device_id FROM devices WHERE device_id = ? AND tenant_id = ?').get(targetDeviceId, boundTenantId);
            if (dev) {
              upsert.run(targetDeviceId, boundTenantId, jsonStr, now);
              const targetKiosk = kioskSockets.get(targetDeviceId);
              if (targetKiosk && targetKiosk.readyState === WebSocket.OPEN) {
                targetKiosk.send(JSON.stringify({ type: 'UPDATE_CONTENT', payload, timestamp: now }));
              }
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('WS mesaj hatası:', err);
    }
  });

  ws.on('close', () => {
    if (role === 'KIOSK' && boundDeviceId) {
      kioskSockets.delete(boundDeviceId);
      if (boundTenantId) {
        const admins = tenantAdminSockets.get(boundTenantId);
        admins?.forEach((a) => {
          if (a.readyState === WebSocket.OPEN) {
            a.send(JSON.stringify({ type: 'KIOSK_STATUS', deviceId: boundDeviceId, online: false }));
          }
        });
      }
    } else if (role === 'ADMIN' && boundTenantId) {
      tenantAdminSockets.get(boundTenantId)?.delete(ws);
    }
  });

  ws.on('error', (err) => console.error('WS soket hatası:', err.message));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[Relay Hub Multi-Tenant + SQLite] Port ${PORT} üzerinde hazır.`);
});
