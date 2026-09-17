import type {
  AuthFileConcurrencyLimit,
  AuthFileFingerprint,
  AuthFileLimitWindow,
  AuthFileLimitsSnapshot,
} from '@/types/authFile';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readCount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return 0;
};

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readObject = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const normalizeWindow = (value: unknown): AuthFileLimitWindow | null => {
  if (!isRecord(value)) return null;
  return {
    limit: readCount(value.limit),
    used: readCount(value.used),
    resetsInSeconds: readCount(value.resets_in_seconds),
  };
};

const normalizeConcurrency = (value: unknown): AuthFileConcurrencyLimit | null => {
  if (!isRecord(value)) return null;
  return { limit: readCount(value.limit), inFlight: readCount(value.in_flight) };
};

/**
 * Normalizes the backend `limits` object. A malformed object is dropped rather than
 * rendered as "unlimited", so a contract change cannot masquerade as a relaxed limit.
 */
export function normalizeAuthFileLimits(value: unknown): AuthFileLimitsSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const rpm = normalizeWindow(value.rpm);
  const tpm = normalizeWindow(value.tpm);
  const maxConcurrent = normalizeConcurrency(value.max_concurrent);
  if (!rpm || !tpm || !maxConcurrent) return undefined;
  return { rpm, tpm, maxConcurrent };
}

/** Normalizes the backend `fingerprint` object; unknown sub-fields are kept for display. */
export function normalizeAuthFileFingerprint(value: unknown): AuthFileFingerprint | undefined {
  if (!isRecord(value)) return undefined;
  const identityMode = readString(value.identity_mode);
  if (!identityMode) return undefined;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter(
        (item): item is string => typeof item === 'string' && item.trim() !== ''
      )
    : [];
  const ccVersion = readString(value.cc_version);
  const authKind = readString(value.auth_kind);
  const session = readString(value.session);
  return {
    identityMode,
    userAgent: readString(value.user_agent),
    ...(ccVersion ? { ccVersion } : {}),
    ...(authKind ? { authKind } : {}),
    ...(session ? { session } : {}),
    client: readObject(value.client),
    device: readObject(value.device),
    transport: readObject(value.transport),
    credentialOverrides: readObject(value.credential_overrides),
    warnings,
  };
}
