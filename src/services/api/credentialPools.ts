import { apiClient } from './client';

export interface ProxyPoolEntryView {
  /** Redacted by the backend (credentials replaced), safe to display. */
  url: string;
  label?: string;
  timezone?: string;
  assigned: number;
}

export interface PlatformPoolEntryView {
  os: string;
  arch: string;
  weight: number;
  assigned: number;
}

export type DeviceProfileDefaultSource = 'built-in' | 'config' | 'server-local';

/** Effective global Claude Code baseline for credentials without overrides. */
export interface DeviceProfileDefaults {
  userAgent: string;
  packageVersion: string;
  runtimeVersion: string;
  os: string;
  arch: string;
  timeout: string;
  timezone: string;
  sources: Partial<Record<keyof Omit<DeviceProfileDefaults, 'sources'>, DeviceProfileDefaultSource>>;
}

export interface CredentialPools {
  proxyPool: ProxyPoolEntryView[];
  platformPool: PlatformPoolEntryView[];
  stabilizeDeviceProfile: boolean;
  /** Absent on backends that predate the baseline echo. */
  deviceProfileDefaults?: DeviceProfileDefaults;
}

const DEFAULT_FIELDS: Array<[keyof Omit<DeviceProfileDefaults, 'sources'>, string]> = [
  ['userAgent', 'user_agent'],
  ['packageVersion', 'package_version'],
  ['runtimeVersion', 'runtime_version'],
  ['os', 'os'],
  ['arch', 'arch'],
  ['timeout', 'timeout'],
  ['timezone', 'timezone'],
];

const readSource = (value: unknown): DeviceProfileDefaultSource | undefined =>
  value === 'built-in' || value === 'config' || value === 'server-local' ? value : undefined;

function normalizeDeviceProfileDefaults(value: unknown): DeviceProfileDefaults | undefined {
  if (!isRecord(value)) return undefined;
  const sourcesRecord = isRecord(value.sources) ? value.sources : {};
  const defaults = {
    sources: {} as DeviceProfileDefaults['sources'],
  } as DeviceProfileDefaults;
  for (const [key, wire] of DEFAULT_FIELDS) {
    defaults[key] = readString(value[wire]);
    const source = readSource(sourcesRecord[wire]);
    if (source) defaults.sources[key] = source;
  }
  return defaults.userAgent ? defaults : undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function normalizeCredentialPools(payload: unknown): CredentialPools {
  const record = isRecord(payload) ? payload : {};
  const proxyPool = Array.isArray(record['proxy-pool'])
    ? record['proxy-pool'].reduce<ProxyPoolEntryView[]>((result, item) => {
        if (!isRecord(item)) return result;
        const url = readString(item.url);
        if (!url) return result;
        const label = readString(item.label);
        const timezone = readString(item.timezone);
        result.push({
          url,
          assigned: readCount(item.assigned),
          ...(label ? { label } : {}),
          ...(timezone ? { timezone } : {}),
        });
        return result;
      }, [])
    : [];
  const platformPool = Array.isArray(record['platform-pool'])
    ? record['platform-pool'].reduce<PlatformPoolEntryView[]>((result, item) => {
        if (!isRecord(item)) return result;
        const os = readString(item.os);
        const arch = readString(item.arch);
        if (!os && !arch) return result;
        result.push({
          os,
          arch,
          weight: readCount(item.weight) || 1,
          assigned: readCount(item.assigned),
        });
        return result;
      }, [])
    : [];
  const deviceProfileDefaults = normalizeDeviceProfileDefaults(record['device-profile-defaults']);
  return {
    proxyPool,
    platformPool,
    stabilizeDeviceProfile: record['stabilize-device-profile'] === true,
    ...(deviceProfileDefaults ? { deviceProfileDefaults } : {}),
  };
}

export const credentialPoolsApi = {
  /** GET /credential-pools — absent on backends without pool support (404). */
  get: async (): Promise<CredentialPools> =>
    normalizeCredentialPools(await apiClient.get<unknown>('/credential-pools')),
};
