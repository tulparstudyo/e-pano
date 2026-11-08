import fs from 'fs';
import path from 'path';

export interface Tenant {
  id: string;
  name: string;
  created_at: number;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: number;
}

export interface Device {
  device_id: string;
  tenant_id: string | null;
  pairing_token: string | null;
  name: string;
  location: string;
  last_seen: number;
  created_at: number;
}

export interface DeviceContent {
  device_id: string;
  tenant_id: string;
  payload: string; // JSON String of BoardPayload
  updated_at: number;
}

export interface DeviceTelemetry {
  device_id: string;
  cpu_usage: number;
  mem_free_mb: number;
  disk_free_gb: number;
  resolution: string;
  uptime_sec: number;
  updated_at: number;
}

interface DatabaseSchema {
  tenants: Tenant[];
  users: User[];
  devices: Device[];
  deviceContents: Record<string, DeviceContent>; // device_id -> DeviceContent
  deviceTelemetry: Record<string, DeviceTelemetry>; // device_id -> DeviceTelemetry
}

const defaultData: DatabaseSchema = {
  tenants: [],
  users: [],
  devices: [],
  deviceContents: {},
  deviceTelemetry: {}
};

export class JsonDatabase {
  private filePath: string;
  private data: DatabaseSchema;

  constructor(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    this.filePath = path.join(dirPath, 'database.json');
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return { ...defaultData, ...JSON.parse(raw) };
      } catch (err) {
        console.error('[DB] database.json okuma hatası, varsayılan başlatılıyor:', err);
      }
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  private save(): void {
    const tempPath = `${this.filePath}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  // --- Tenants ---
  findTenantById(id: string): Tenant | undefined {
    return this.data.tenants.find((t) => t.id === id);
  }

  createTenant(tenant: Tenant): void {
    this.data.tenants.push(tenant);
    this.save();
  }

  // --- Users ---
  findUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: User): void {
    this.data.users.push(user);
    this.save();
  }

  // --- Devices ---
  findDeviceById(deviceId: string): Device | undefined {
    return this.data.devices.find((d) => d.device_id === deviceId);
  }

  findDevicesByTenant(tenantId: string): Device[] {
    return this.data.devices.filter((d) => d.tenant_id === tenantId);
  }

  upsertDevice(device: Device): void {
    const idx = this.data.devices.findIndex((d) => d.device_id === device.device_id);
    if (idx >= 0) {
      this.data.devices[idx] = { ...this.data.devices[idx], ...device };
    } else {
      this.data.devices.push(device);
    }
    this.save();
  }

  updateDeviceLastSeen(deviceId: string, timestamp: number): void {
    const dev = this.data.devices.find((d) => d.device_id === deviceId);
    if (dev) {
      dev.last_seen = timestamp;
      this.save();
    }
  }

  updateDeviceMeta(deviceId: string, tenantId: string, name?: string, location?: string): void {
    const dev = this.data.devices.find((d) => d.device_id === deviceId && d.tenant_id === tenantId);
    if (dev) {
      if (name) dev.name = name;
      if (location) dev.location = location;
      this.save();
    }
  }

  deleteDevice(deviceId: string, tenantId: string): void {
    this.data.devices = this.data.devices.filter((d) => !(d.device_id === deviceId && d.tenant_id === tenantId));
    delete this.data.deviceContents[deviceId];
    delete this.data.deviceTelemetry[deviceId];
    this.save();
  }

  // --- Device Content ---
  getDeviceContent(deviceId: string): DeviceContent | undefined {
    return this.data.deviceContents[deviceId];
  }

  upsertDeviceContent(content: DeviceContent): void {
    this.data.deviceContents[content.device_id] = content;
    this.save();
  }

  // --- Device Telemetry ---
  getDeviceTelemetry(deviceId: string): DeviceTelemetry | undefined {
    return this.data.deviceTelemetry[deviceId];
  }

  upsertDeviceTelemetry(telemetry: DeviceTelemetry): void {
    this.data.deviceTelemetry[telemetry.device_id] = telemetry;
    this.save();
  }
}
