import type {
  AuthFileActiveHours,
  AuthFileClientVersions,
  AuthFileConcurrencyLimit,
  AuthFileFingerprint,
  AuthFileLimitWindow,
  AuthFileLimitsSnapshot,
  AuthFileSessionLimit,
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

const normalizeSessions = (value: unknown): AuthFileSessionLimit | null => {
  if (!isRecord(value)) return null;
  return {
    limit: readCount(value.limit),
    active: readCount(value.active),
    windowSeconds: readCount(value.window_seconds),
  };
};

const normalizeActiveHours = (value: unknown): AuthFileActiveHours | null => {
  if (!isRecord(value)) return null;
  const nextChangeAt = readString(value.next_change_at);
  const nextChangeInSeconds =
    typeof value.next_change_in_seconds === 'number' && Number.isFinite(value.next_change_in_seconds)
      ? Math.floor(value.next_change_in_seconds)
      : undefined;
  return {
    window: readString(value.window),
    awake: value.awake !== false,
    ...(nextChangeAt ? { nextChangeAt } : {}),
    ...(nextChangeInSeconds !== undefined ? { nextChangeInSeconds } : {}),
  };
};

/**
 * Normalizes the backend `limits` object. A malformed object is dropped rather than
 * rendered as "unlimited", so a contract change cannot masquerade as a relaxed limit.
 * The daily / session / active-hours parts are optional so older backends still render.
 */
export function normalizeAuthFileLimits(value: unknown): AuthFileLimitsSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const rpm = normalizeWindow(value.rpm);
  const tpm = normalizeWindow(value.tpm);
  const maxConcurrent = normalizeConcurrency(value.max_concurrent);
  if (!rpm || !tpm || !maxConcurrent) return undefined;
  const rpd = normalizeWindow(value.rpd);
  const tpd = normalizeWindow(value.tpd);
  const maxSessions = normalizeSessions(value.max_sessions);
  const activeHours = normalizeActiveHours(value.active_hours);
  const timezone = readString(value.timezone);
  return {
    rpm,
    tpm,
    maxConcurrent,
    ...(rpd ? { rpd } : {}),
    ...(tpd ? { tpd } : {}),
    ...(maxSessions ? { maxSessions } : {}),
    ...(activeHours ? { activeHours } : {}),
    ...(timezone ? { timezone } : {}),
  };
}

/** Normalizes `fingerprint.clients`; dropped when the list is empty or malformed. */
export function normalizeAuthFileClientVersions(value: unknown): AuthFileClientVersions | undefined {
  if (!isRecord(value) || !Array.isArray(value.versions)) return undefined;
  const versions = value.versions.flatMap((item) => {
    if (!isRecord(item)) return [];
    const version = readString(item.version);
    if (!version) return [];
    const lastSeen = readString(item.last_seen);
    return [
      {
        version,
        requests: readCount(item.requests),
        baseline: item.baseline === true,
        ...(lastSeen ? { lastSeen } : {}),
      },
    ];
  });
  if (versions.length === 0) return undefined;
  return { baseline: readString(value.baseline), windowHours: readCount(value.window_hours), versions };
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
  const clients = normalizeAuthFileClientVersions(value.clients);
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
    ...(clients ? { clients } : {}),
    warnings,
  };
}
