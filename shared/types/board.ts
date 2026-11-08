export type LayoutType = 
  | 'layout-classic-school' 
  | 'layout-hospital-triaj' 
  | 'layout-corporate-grid';

export interface ThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
  tickerSpeed?: number; // Saniye cinsinden tur suresi
}

export interface TextComponent {
  type: 'text' | 'richtext';
  label: string;
  value: string;
}

export interface MediaItem {
  id: string;
  url: string;
  mediaType: 'image' | 'video';
  hash?: string;
  size?: number;
}

export interface MediaSliderComponent {
  type: 'media_slider';
  label: string;
  durationSec: number;
  items: MediaItem[];
}

export interface RepeaterTableComponent {
  type: 'repeater_table';
  label: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface TickerComponent {
  type: 'ticker';
  label: string;
  messages: string[];
}

export type BoardComponent = 
  | TextComponent 
  | MediaSliderComponent 
  | RepeaterTableComponent 
  | TickerComponent;

export interface BoardPayload {
  version: string;
  layoutId: LayoutType;
  updatedAt: string;
  theme?: ThemeConfig;
  components: {
    title?: TextComponent;
    slider?: MediaSliderComponent;
    infoTable?: RepeaterTableComponent;
    ticker?: TickerComponent;
    [key: string]: BoardComponent | undefined;
  };
}

// WebSocket Mesaj Protokolu
export type WsClientMessage = 
  | { type: 'KIOSK_REGISTER'; deviceId: string; token?: string | null }
  | { type: 'ADMIN_SUBSCRIBE'; pairingToken: string }
  | { type: 'UPDATE_CONTENT'; payload: BoardPayload };

export type WsServerMessage = 
  | { type: 'PIN_GENERATED'; pin: string; ttlSec: number }
  | { type: 'PAIRED_SUCCESS'; pairingToken: string; deviceId: string }
  | { type: 'STATUS'; paired: boolean }
  | { type: 'ROOM_JOINED'; deviceId: string; kioskOnline: boolean }
  | { type: 'KIOSK_STATUS'; online: boolean }
  | { type: 'UPDATE_CONTENT'; payload: BoardPayload; timestamp: number }
  | { type: 'ERROR'; message: string };
