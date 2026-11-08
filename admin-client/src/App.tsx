import React, { useState, useEffect, useRef } from 'react';
import { WysiwygCanvas } from './components/WysiwygCanvas';
import { DynamicEditorModal } from './components/DynamicEditorModal';

const RELAY_HTTP = import.meta.env.VITE_RELAY_HTTP || 'https://pano.teknovip.net';
const RELAY_WS = import.meta.env.VITE_RELAY_WS || 'wss://pano.teknovip.net';

interface UserInfo {
  id: string;
  email: string;
  role: string;
}

interface TenantInfo {
  id: string;
  name: string;
}

interface DeviceItem {
  device_id: string;
  name: string;
  location: string;
  isOnline: boolean;
  lastContentUpdate?: number | null;
  telemetry?: {
    cpu_usage: number;
    mem_free_mb: number;
    disk_free_gb: number;
    resolution: string;
    uptime_sec: number;
  } | null;
}

const defaultBoardPayload = {
  version: '1.0.0',
  layoutId: 'layout-classic-school',
  updatedAt: new Date().toISOString(),
  theme: {
    primaryColor: '#1e3a8a',
    fontFamily: 'Inter',
    tickerSpeed: 25
  },
  components: {
    title: {
      type: 'text',
      label: 'Ana Başlık / Kurum Adı',
      value: 'TEKNOVİP DİJİTAL DUYURU MERKEZİ'
    },
    slider: {
      type: 'media_slider',
      label: 'Görsel & Video Duyurular',
      durationSec: 8,
      items: []
    },
    infoTable: {
      type: 'repeater_table',
      label: 'Günün Görevlileri & İletişim',
      columns: ['Görev Yeri', 'Ad Soyad', 'Dahili'],
      rows: [
        { 'Görev Yeri': 'Zemin Kat', 'Ad Soyad': 'Ahmet Yılmaz', 'Dahili': '101' },
        { 'Görev Yeri': '1. Kat', 'Ad Soyad': 'Ayşe Kaya', 'Dahili': '102' }
      ]
    },
    ticker: {
      type: 'ticker',
      label: 'Alt Bant Kayan Yazı',
      messages: [
        'Sistemimiz tek tıkla canlı yayına hazırdır.',
        'Acil durumlarda üst menüdeki siren butonunu kullanabilirsiniz.'
      ]
    }
  }
};

export const App: React.FC = () => {
  // Auth Durumu
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pano_jwt_token'));
  const [user, setUser] = useState<UserInfo | null>(() => {
    const u = localStorage.getItem('pano_user');
    return u ? JSON.parse(u) : null;
  });
  const [tenant, setTenant] = useState<TenantInfo | null>(() => {
    const t = localStorage.getItem('pano_tenant');
    return t ? JSON.parse(t) : null;
  });

  // Giriş / Kayıt Form Durumları
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authInstName, setAuthInstName] = useState('');
  const [authError, setAuthError] = useState('');

  // Filo (Fleet) ve Cihaz Durumları
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('broadcast'); // 'broadcast' veya specific device_id
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [pairPin, setPairPin] = useState('');
  const [pairName, setPairName] = useState('');
  const [pairLocation, setPairLocation] = useState('');

  // Editör ve İçerik Durumları
  const [boardData, setBoardData] = useState(() => {
    const local = localStorage.getItem('draft_board_data');
    return local ? JSON.parse(local) : defaultBoardPayload;
  });
  const [activeEditingKey, setActiveEditingKey] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<string>('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Oturum Bilgilerini Kaydetme
  const handleAuthSuccess = (jwtToken: string, userData: UserInfo, tenantData: TenantInfo) => {
    setToken(jwtToken);
    setUser(userData);
    setTenant(tenantData);
    localStorage.setItem('pano_jwt_token', jwtToken);
    localStorage.setItem('pano_user', JSON.stringify(userData));
    localStorage.setItem('pano_tenant', JSON.stringify(tenantData));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setTenant(null);
    localStorage.removeItem('pano_jwt_token');
    localStorage.removeItem('pano_user');
    localStorage.removeItem('pano_tenant');
    if (wsRef.current) wsRef.current.close();
  };

  // Cihazları Çek
  const fetchDevices = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${RELAY_HTTP}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.warn('Cihaz listesi alınamadı:', err);
    }
  };

  // Oturum açıldığında periyodik olarak cihazları çek
  useEffect(() => {
    if (!token) return;
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // WebSocket Kurum Odasına Bağlanma
  useEffect(() => {
    if (!token) return;

    let ws: WebSocket;
    let timer: any = null;

    function connect() {
      ws = new WebSocket(RELAY_WS);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'ADMIN_SUBSCRIBE',
          jwtToken: token
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'KIOSK_STATUS') {
            setDevices((prev) =>
              prev.map((d) => (d.device_id === msg.deviceId ? { ...d, isOnline: msg.online } : d))
            );
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        timer = setTimeout(connect, 4000);
      };
    }

    connect();

    return () => {
      clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [token]);

  // Giriş / Kayıt İşlemi
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = authMode === 'login'
      ? { email: authEmail, password: authPassword }
      : { institutionName: authInstName, email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${RELAY_HTTP}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        handleAuthSuccess(data.token, data.user, data.tenant);
      } else {
        setAuthError(data.error || 'İşlem başarısız.');
      }
    } catch (err) {
      setAuthError('Sunucuya bağlanılamadı. Lütfen internet ve sunucu durumunu kontrol edin.');
    }
  };

  // Yeni Pano Eşleştirme (PIN Claiming)
  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairPin.trim()) return;

    try {
      const res = await fetch(`${RELAY_HTTP}/api/pair`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pin: pairPin.trim(),
          name: pairName.trim() || 'Yeni Pano',
          location: pairLocation.trim() || 'Giriş Kat'
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Pano başarıyla kurumunuza bağlandı!');
        setIsPairModalOpen(false);
        setPairPin('');
        setPairName('');
        setPairLocation('');
        fetchDevices();
      } else {
        alert(data.error || 'Eşleştirme başarısız.');
      }
    } catch (err) {
      alert('Eşleştirme hatası.');
    }
  };

  // Canlı Panoya Yayınla
  const handlePublish = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('WebSocket bağlantısı aktif değil.');
      return;
    }

    const payload = {
      ...boardData,
      updatedAt: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify({
      type: 'UPDATE_CONTENT',
      payload,
      targetDeviceId: selectedTarget === 'broadcast' ? null : selectedTarget,
      broadcastAll: selectedTarget === 'broadcast'
    }));

    setPublishStatus('İçerik Panolara İletildi!');
    setTimeout(() => setPublishStatus(''), 3000);
  };

  // Acil Durum / Siren Tahliye Uyarısı
  const handleToggleEmergency = async () => {
    const nextState = !isEmergencyActive;
    if (nextState) {
      const ok = confirm('DİKKAT: Tüm panolarda kırmızı ACİL TAHLİYE ekranı gösterilecektir. Onaylıyor musunuz?');
      if (!ok) return;
    }

    try {
      const res = await fetch(`${RELAY_HTTP}/api/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          active: nextState,
          title: 'DİKKAT! ACİL BİNA TAHLİYE UYARISI',
          message: 'Lütfen panik yapmadan acil çıkış kapılarını kullanarak binayı derhal boşaltınız!'
        })
      });
      if (res.ok) {
        setIsEmergencyActive(nextState);
      }
    } catch (err) {
      alert('Acil durum sinyali gönderilemedi.');
    }
  };

  // ==========================================
  // EKRAN 1: GİRİŞ YAPILMAMIŞSA (AUTH EKRANI)
  // ==========================================
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600/20 text-blue-400 rounded-xl mb-3 border border-blue-500/30">
              📺
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Teknovip Pano Studio</h1>
            <p className="text-xs text-slate-400 mt-1">pano.teknovip.net Dijital Duyuru Ağı</p>
          </div>

          <div className="flex border-b border-slate-800 mb-6 text-sm font-semibold">
            <button
              className={`flex-1 pb-2 transition ${authMode === 'login' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-500'}`}
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
            >
              Giriş Yap
            </button>
            <button
              className={`flex-1 pb-2 transition ${authMode === 'register' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-500'}`}
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
            >
              Yeni Kurum Kaydı
            </button>
          </div>

          {authError && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 text-xs p-3 rounded-lg mb-4">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Kurum / Okul / Hastane Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Teknovip Anadolu Lisesi"
                  value={authInstName}
                  onChange={(e) => setAuthInstName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Yönetici E-Posta</label>
              <input
                type="email"
                required
                placeholder="admin@teknovip.net"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Şifre</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-blue-900/30"
            >
              {authMode === 'login' ? 'Yönetim Paneline Giriş' : 'Kurumu Kaydet ve Başla'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // EKRAN 2: OTURUM AÇIKKEN (ADMIN STUDIO)
  // ==========================================
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sol Panel: Filo Yönetimi, Şablon ve Cihaz Kontrolü */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* Kurum Başlığı ve Çıkış */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white truncate max-w-[170px]" title={tenant?.name}>
                {tenant?.name}
              </h2>
              <span className="text-[11px] text-slate-400 truncate block max-w-[170px]" title={user?.email}>
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded bg-rose-950/40 border border-rose-900/50"
            >
              Çıkış
            </button>
          </div>

          {/* Acil Durum / Siren Butonu */}
          <button
            onClick={handleToggleEmergency}
            className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-lg ${
              isEmergencyActive
                ? 'bg-red-600 text-white animate-pulse shadow-red-600/50'
                : 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/80'
            }`}
          >
            <span>🚨</span>
            <span>{isEmergencyActive ? 'ACİL DURUM MODU AKTİF (DURDUR)' : 'ACİL TAHLİYE SİRENİ BAŞLAT'}</span>
          </button>

          {/* Pano Filosu (Cihaz Listesi) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Bağlı Panolar ({devices.length})
              </span>
              <button
                onClick={() => setIsPairModalOpen(true)}
                className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-bold"
              >
                + PIN Eşleştir
              </button>
            </div>

            {/* Yayın Hedefi Seçimi */}
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-blue-500"
            >
              <option value="broadcast">📢 TÜM PANOLARA YAYINLA ({devices.length} Ekran)</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.isOnline ? '🟢' : '⚪'} {d.name} ({d.location})
                </option>
              ))}
            </select>

            {/* Cihaz Kartları Listesi */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {devices.length === 0 ? (
                <div className="text-center p-3 text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  Henüz bağlı pano bulunmuyor. Kiosk ekranındaki 6 haneli PIN ile eşleştirin.
                </div>
              ) : (
                devices.map((dev) => (
                  <div
                    key={dev.device_id}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between transition ${
                      selectedTarget === dev.device_id
                        ? 'bg-blue-950/40 border-blue-500/80'
                        : 'bg-slate-950 border-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-200">{dev.name}</div>
                      <div className="text-[10px] text-slate-500">{dev.location}</div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        dev.isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {dev.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      {dev.telemetry && (
                        <span className="text-[9px] text-slate-500 mt-0.5">
                          CPU: %{dev.telemetry.cpu_usage}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ekran Şablonu Seçici */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Ekran Şablonu (Layout)
            </label>
            <select
              value={boardData.layoutId}
              onChange={(e) => setBoardData({ ...boardData, layoutId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="layout-classic-school">🏫 Okul: Klasik Duyuru & Nöbetçi</option>
              <option value="layout-hospital-triaj">🏥 Hastane: Poliklinik & Triyaj</option>
              <option value="layout-corporate-grid">🏢 Kurumsal: Bilgi & Medya Izgarası</option>
            </select>
          </div>
        </div>

        {/* Alt Yayınlama Çubuğu */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 space-y-2">
          {publishStatus && (
            <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 p-2 rounded-lg">
              {publishStatus}
            </div>
          )}
          <button
            onClick={handlePublish}
            disabled={devices.length === 0}
            className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition ${
              devices.length > 0
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer shadow-blue-900/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            🚀 {selectedTarget === 'broadcast' ? 'Tüm Panolara Yayınla' : 'Seçili Panoya Yayınla'}
          </button>
        </div>
      </aside>

      {/* Sağ Panel: Canlı WYSIWYG Önizleme */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 relative overflow-hidden">
        <div className="mb-4 text-xs font-medium text-slate-400 flex items-center gap-2">
          <span>Sunucu: <strong className="text-blue-400">pano.teknovip.net</strong></span>
          <span className="text-slate-600">•</span>
          <span>Hedef: <strong className="text-amber-400">{selectedTarget === 'broadcast' ? 'Tüm Panolar' : 'Tekil Pano'}</strong></span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">Düzenlemek için bileşene tıklayın</span>
        </div>

        <WysiwygCanvas
          boardData={boardData}
          onSelectComponent={(key) => setActiveEditingKey(key)}
        />

        {/* Dinamik Bileşen Modal Editörü */}
        {activeEditingKey && (
          <DynamicEditorModal
            componentKey={activeEditingKey}
            data={(boardData.components as any)[activeEditingKey]}
            isOpen={Boolean(activeEditingKey)}
            onClose={() => setActiveEditingKey(null)}
            onSave={(key, updated) => {
              setBoardData((prev: any) => ({
                ...prev,
                components: {
                  ...prev.components,
                  [key]: updated
                }
              }));
            }}
            uploadEndpoint={`${RELAY_HTTP}/api/upload`}
          />
        )}

        {/* PIN Eşleştirme Modalı */}
        {isPairModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-base font-bold text-white mb-3">Yeni Pano Eşleştir</h3>
              <p className="text-xs text-slate-400 mb-4">
                Kiosk ekranında görünen 6 haneli PIN kodunu girerek cihazı kurumunuza bağlayın.
              </p>

              <form onSubmit={handlePairSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">6 Haneli PIN</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="849201"
                    value={pairPin}
                    onChange={(e) => setPairPin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-center font-mono text-xl tracking-widest text-amber-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Pano Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Giriş Ana Pano"
                    value={pairName}
                    onChange={(e) => setPairName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Konum / Kat</label>
                  <input
                    type="text"
                    placeholder="Örn: Zemin Kat / Danışma"
                    value={pairLocation}
                    onChange={(e) => setPairLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPairModalOpen(false)}
                    className="flex-1 py-2 border border-slate-700 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-800"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-900/30"
                  >
                    Panoyu Ekle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
