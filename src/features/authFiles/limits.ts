import type { AuthFileFingerprint, AuthFileLimitsSnapshot } from '@/types/authFile';

/** Backend identity modes reported in `fingerprint.identity_mode`. */
export const FINGERPRINT_IDENTITY_MODES = [
  'cloak-claude-code-cli',
  'caller-passthrough',
  'fixed',
  'go-default',
  'suppressed',
] as const;

export type FingerprintIdentityMode = (typeof FINGERPRINT_IDENTITY_MODES)[number];

const IDENTITY_MODE_SET = new Set<string>(FINGERPRINT_IDENTITY_MODES);

/** i18n key for a fingerprint identity mode; unknown modes fall back to the raw value. */
export function fingerprintIdentityModeKey(mode: string): string | null {
  return IDENTITY_MODE_SET.has(mode)
    ? `auth_files.fingerprint_mode_${mode.replace(/-/g, '_')}`
    : null;
}

/** Stainless platform vocabulary accepted by the backend for Claude device profiles. */
export const CLAUDE_DEVICE_PROFILE_OS = ['MacOS', 'Windows', 'Linux', 'FreeBSD'] as const;
export const CLAUDE_DEVICE_PROFILE_ARCH = ['arm64', 'x64', 'x86'] as const;

const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;

/** Parses an optional non-negative integer text field; empty means "unset". */
export function parseLimitText(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** True when the text is empty or a non-negative safe integer. */
export function isValidLimitText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || parseLimitText(trimmed) !== undefined;
}

/** Reads a per-credential override from an auth file JSON; negative or invalid values are unset. */
export function readLimitOverride(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') return parseLimitText(value);
  return undefined;
}

/** Reads `max_concurrent`, accepting the kebab spelling used in YAML-derived files. */
export function readMaxConcurrentOverride(value: Record<string, unknown>): number | undefined {
  return readLimitOverride(
    value.max_concurrent !== undefined ? value.max_concurrent : value['max-concurrent']
  );
}

/** Whether the limits row is worth showing: a configured limit or any live usage. */
export function hasLimitActivity(snapshot: AuthFileLimitsSnapshot | undefined): boolean {
  if (!snapshot) return false;
  const { rpm, tpm, maxConcurrent } = snapshot;
  return (
    rpm.limit > 0 ||
    tpm.limit > 0 ||
    maxConcurrent.limit > 0 ||
    rpm.used > 0 ||
    tpm.used > 0 ||
    maxConcurrent.inFlight > 0
  );
}

/** Compact count formatting for token totals: 950 → "950", 12_345 → "12.3k", 4_000_000 → "4M". */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1000) return String(Math.floor(value));
  if (value < 1_000_000) return trimZero(value / 1000) + 'k';
  return trimZero(value / 1_000_000) + 'M';
}

function trimZero(value: number): string {
  const fixed = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** "used / limit" with ∞ for unlimited; tokens use compact notation. */
export function formatLimitUsage(used: number, limit: number, compact = false): string {
  const usedText = compact ? formatCompactCount(used) : String(used);
  const limitText = limit > 0 ? (compact ? formatCompactCount(limit) : String(limit)) : '∞';
  return `${usedText} / ${limitText}`;
}

/** Usage ratio in [0, 1]; 0 when unlimited so unlimited never renders as "full". */
export function limitUsageRatio(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(1, used / limit);
}

export type ClaudeDeviceProfileValues = {
  os: string;
  arch: string;
  /** Software triple present in the file; preserved verbatim, edited only via the file. */
  userAgent?: string;
  packageVersion?: string;
  runtimeVersion?: string;
};

/** Reads `device_profile` from an auth file JSON, accepting both key spellings. */
export function readClaudeDeviceProfile(value: Record<string, unknown>): ClaudeDeviceProfileValues {
  const raw = value.device_profile;
  const object =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const read = (...keys: string[]): string => {
    for (const key of keys) {
      const item = object[key];
      if (typeof item === 'string' && item.trim()) return item.trim();
    }
    return '';
  };
  const userAgent = read('user_agent', 'user-agent');
  const packageVersion = read('package_version', 'package-version');
  const runtimeVersion = read('runtime_version', 'runtime-version');
  return {
    os: read('os'),
    arch: read('arch'),
    ...(userAgent ? { userAgent } : {}),
    ...(packageVersion ? { packageVersion } : {}),
    ...(runtimeVersion ? { runtimeVersion } : {}),
  };
}

/** Serializes a device profile back to the backend object; null clears it. */
export function buildClaudeDeviceProfilePatch(
  values: ClaudeDeviceProfileValues
): Record<string, string> | null {
  const patch: Record<string, string> = {};
  if (values.userAgent) patch.user_agent = values.userAgent;
  if (values.packageVersion) patch.package_version = values.packageVersion;
  if (values.runtimeVersion) patch.runtime_version = values.runtimeVersion;
  if (values.os) patch.os = values.os;
  if (values.arch) patch.arch = values.arch;
  return Object.keys(patch).length > 0 ? patch : null;
}

export type FingerprintIdentitySummary = {
  /** Proxy host:port with scheme and credentials stripped, or "direct" / "none". */
  proxy: string;
  proxySource?: string;
  /** "MacOS / arm64" style platform, empty when unknown. */
  platform: string;
  platformSource?: string;
  timezone: string;
};

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Strips scheme and userinfo from a (redacted) proxy URL for compact display. */
export function proxyDisplayHost(url: string): string {
  return url.replace(/^[a-z0-9+.-]+:\/\/(?:[^@/]*@)?/i, '').replace(/\/$/, '');
}

/** Condenses a fingerprint report into the three identity facts worth showing on a card. */
export function summarizeFingerprintIdentity(
  fingerprint: AuthFileFingerprint | undefined
): FingerprintIdentitySummary | null {
  if (!fingerprint) return null;
  const transport = fingerprint.transport;
  const device = fingerprint.device;
  const proxyRaw = readString(transport.proxy);
  const proxySource = readString(transport.source) || undefined;
  const proxy =
    !proxyRaw || proxyRaw === 'direct' || proxyRaw === 'global-default'
      ? proxyRaw || 'none'
      : proxyDisplayHost(proxyRaw);
  const os = readString(device.os);
  const arch = readString(device.arch);
  const platform = [os, arch].filter(Boolean).join(' / ');
  const platformSource = readString(device.source) || undefined;
  const timezone = readString(fingerprint.client.current_date_timezone);
  const label = readString(transport.label);
  return {
    proxy: label ? `${label} · ${proxy}` : proxy,
    ...(proxySource ? { proxySource } : {}),
    platform,
    ...(platformSource ? { platformSource } : {}),
    timezone,
  };
}
