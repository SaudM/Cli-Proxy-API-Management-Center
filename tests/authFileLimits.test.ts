import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import { normalizeAuthFilesResponse } from '../src/services/api/authFiles';
import {
  normalizeAuthFileFingerprint,
  normalizeAuthFileLimits,
} from '../src/services/api/authFileLimits';
import {
  buildClaudeDeviceProfilePatch,
  fingerprintIdentityModeKey,
  formatCompactCount,
  formatLimitUsage,
  hasLimitActivity,
  isValidActiveHoursText,
  isValidLimitText,
  parseLimitText,
  readActiveHoursOverride,
  readClaudeDeviceProfile,
  readKebabAwareLimitOverride,
  readLimitOverride,
  readMaxConcurrentOverride,
  readProxyPoolLabel,
} from '../src/features/authFiles/limits';
import { buildAuthFileFieldsPatch } from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import type { PrefixProxyEditorState } from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { AuthFileLimitsSection } from '../src/features/authFiles/components/AuthFileLimitsSection';
import { AuthFileFingerprintSection } from '../src/features/authFiles/components/AuthFileFingerprintSection';
import type { AuthFilesResponse } from '../src/types/authFile';

const limitsPayload = {
  rpm: { limit: 60, used: 3, resets_in_seconds: 41 },
  tpm: { limit: 400000, used: 12345, resets_in_seconds: 9 },
  max_concurrent: { limit: 8, in_flight: 1 },
};

const fingerprintPayload = {
  identity_mode: 'cloak-claude-code-cli',
  user_agent: 'claude-cli/2.1.258 (external, cli)',
  cc_version: '2.1.258',
  auth_kind: 'oauth',
  session: 'derived-or-per-api-key-1h',
  client: { 'x-app': 'cli' },
  device: { os: 'Linux', arch: 'x64', source: 'credential', id: 'abcdef***' },
  transport: { tls: 'utls-node', http: '1.1', proxy: 'socks5://redacted@proxy:1080' },
  credential_overrides: { device_profile: { os: 'Linux', arch: 'x64' } },
  warnings: ['stabilize-device-profile is off'],
};

describe('limits normalization', () => {
  test('maps the backend limits object to camelCase counters', () => {
    expect(normalizeAuthFileLimits(limitsPayload)).toEqual({
      rpm: { limit: 60, used: 3, resetsInSeconds: 41 },
      tpm: { limit: 400000, used: 12345, resetsInSeconds: 9 },
      maxConcurrent: { limit: 8, inFlight: 1 },
    });
  });

  test('drops malformed objects instead of rendering them as unlimited', () => {
    expect(normalizeAuthFileLimits(undefined)).toBeUndefined();
    expect(normalizeAuthFileLimits({ rpm: { limit: 1 } })).toBeUndefined();
    expect(normalizeAuthFileLimits('x')).toBeUndefined();
  });

  test('attaches limits, fingerprint and overrides on the auth-files response', () => {
    const response = normalizeAuthFilesResponse({
      files: [
        {
          name: 'a.json',
          rpm: 30,
          max_concurrent: 2,
          limits: limitsPayload,
          fingerprint: fingerprintPayload,
        },
        { name: 'b.json' },
      ],
    } as unknown as AuthFilesResponse);
    const [a, b] = response.files;
    expect(a.rpm).toBe(30);
    expect(a.tpm).toBeUndefined();
    expect(a.maxConcurrent).toBe(2);
    expect(a.limitsSnapshot?.rpm.used).toBe(3);
    expect(a.fingerprint?.identityMode).toBe('cloak-claude-code-cli');
    expect(a.fingerprint?.warnings).toEqual(['stabilize-device-profile is off']);
    expect(b.limitsSnapshot).toBeUndefined();
    expect(b.fingerprint).toBeUndefined();
  });
});

describe('fingerprint normalization', () => {
  test('keeps nested groups and requires an identity mode', () => {
    const fingerprint = normalizeAuthFileFingerprint(fingerprintPayload);
    expect(fingerprint?.ccVersion).toBe('2.1.258');
    expect(fingerprint?.device.os).toBe('Linux');
    expect(fingerprint?.transport.proxy).toBe('socks5://redacted@proxy:1080');
    expect(normalizeAuthFileFingerprint({ user_agent: 'x' })).toBeUndefined();
  });

  test('maps known identity modes to i18n keys and leaves unknown ones raw', () => {
    expect(fingerprintIdentityModeKey('cloak-claude-code-cli')).toBe(
      'auth_files.fingerprint_mode_cloak_claude_code_cli'
    );
    expect(fingerprintIdentityModeKey('caller-passthrough')).toBe(
      'auth_files.fingerprint_mode_caller_passthrough'
    );
    expect(fingerprintIdentityModeKey('mystery')).toBeNull();
  });
});

describe('limit text helpers', () => {
  test('parses and validates non-negative integers', () => {
    expect(parseLimitText('')).toBeUndefined();
    expect(parseLimitText(' 42 ')).toBe(42);
    expect(parseLimitText('0')).toBe(0);
    expect(parseLimitText('-1')).toBeUndefined();
    expect(parseLimitText('1.5')).toBeUndefined();
    expect(isValidLimitText('')).toBe(true);
    expect(isValidLimitText('7')).toBe(true);
    expect(isValidLimitText('abc')).toBe(false);
  });

  test('reads overrides from either spelling and ignores negatives', () => {
    expect(readLimitOverride(5)).toBe(5);
    expect(readLimitOverride(-5)).toBeUndefined();
    expect(readLimitOverride('12')).toBe(12);
    expect(readMaxConcurrentOverride({ 'max-concurrent': 3 })).toBe(3);
    expect(readMaxConcurrentOverride({ max_concurrent: 0 })).toBe(0);
  });

  test('formats usage with ∞ for unlimited and compact tokens', () => {
    expect(formatLimitUsage(3, 60)).toBe('3 / 60');
    expect(formatLimitUsage(3, 0)).toBe('3 / ∞');
    expect(formatLimitUsage(12345, 400000, true)).toBe('12.3k / 400k');
    expect(formatCompactCount(4_000_000)).toBe('4M');
    expect(formatCompactCount(950)).toBe('950');
  });

  test('hides the row when nothing is configured or in flight', () => {
    expect(hasLimitActivity(undefined)).toBe(false);
    expect(
      hasLimitActivity({
        rpm: { limit: 0, used: 0, resetsInSeconds: 0 },
        tpm: { limit: 0, used: 0, resetsInSeconds: 0 },
        maxConcurrent: { limit: 0, inFlight: 0 },
      })
    ).toBe(false);
    expect(
      hasLimitActivity({
        rpm: { limit: 0, used: 0, resetsInSeconds: 0 },
        tpm: { limit: 0, used: 0, resetsInSeconds: 0 },
        maxConcurrent: { limit: 0, inFlight: 1 },
      })
    ).toBe(true);
  });
});

describe('device profile helpers', () => {
  test('reads both key spellings and preserves the software triple', () => {
    const profile = readClaudeDeviceProfile({
      device_profile: {
        'user-agent': 'claude-cli/2.1.258 (external, cli)',
        package_version: '0.112.1',
        runtime_version: 'v26.3.0',
        os: 'Linux',
      },
    });
    expect(profile.os).toBe('Linux');
    expect(profile.arch).toBe('');
    expect(profile.userAgent).toBe('claude-cli/2.1.258 (external, cli)');
    expect(buildClaudeDeviceProfilePatch({ ...profile, arch: 'x64' })).toEqual({
      user_agent: 'claude-cli/2.1.258 (external, cli)',
      package_version: '0.112.1',
      runtime_version: 'v26.3.0',
      os: 'Linux',
      arch: 'x64',
    });
    expect(buildClaudeDeviceProfilePatch({ os: '', arch: '' })).toBeNull();
  });
});

const baseEditor = (json: Record<string, unknown>): PrefixProxyEditorState => ({
  fileName: 'claude.json',
  fileInfoText: '',
  loading: false,
  saving: false,
  error: null,
  originalText: JSON.stringify(json),
  rawText: JSON.stringify(json),
  invalidContentPreview: '',
  json,
  providerKey: 'claude',
  prefix: '',
  proxyUrl: '',
  priority: '',
  weight: '',
  weightError: null,
  disableCooling: false,
  disableCoolingTouched: false,
  websockets: false,
  websocketsTouched: false,
  usingApi: false,
  usingApiTouched: false,
  note: '',
  noteTouched: false,
  excludedModelsText: '',
  excludedModelsTouched: false,
  headersText: '',
  headersTouched: false,
  headersError: null,
  rpm: '',
  tpm: '',
  maxConcurrent: '',
  limitsError: null,
  deviceProfileOs: '',
  deviceProfileArch: '',
  deviceProfileTouched: false,
  deviceProfileSoftware: '',
});

const resolve = (key: string) => key;

describe('auth file fields patch: limits and device profile', () => {
  test('sets, clears and leaves limits untouched', () => {
    const editor = {
      ...baseEditor({ rpm: 30, tpm: 1000 }),
      rpm: '60',
      tpm: '',
      maxConcurrent: '2',
    };
    expect(buildAuthFileFieldsPatch(editor, resolve)).toEqual({
      rpm: 60,
      tpm: null,
      max_concurrent: 2,
    });
    const unchanged = { ...baseEditor({ rpm: 30 }), rpm: '30' };
    expect(buildAuthFileFieldsPatch(unchanged, resolve)).toEqual({});
  });

  test('explicit 0 is a real override and negatives are rejected', () => {
    const zero = { ...baseEditor({}), rpm: '0' };
    expect(buildAuthFileFieldsPatch(zero, resolve)).toEqual({ rpm: 0 });
    const negative = { ...baseEditor({}), tpm: '-1' };
    expect(() => buildAuthFileFieldsPatch(negative, resolve)).toThrow(
      'auth_files.limit_invalid_integer'
    );
  });

  test('device profile keeps the software triple and clears when emptied', () => {
    const json = {
      device_profile: {
        user_agent: 'claude-cli/2.1.258 (external, cli)',
        package_version: '0.112.1',
        runtime_version: 'v26.3.0',
        os: 'MacOS',
      },
    };
    const changed = {
      ...baseEditor(json),
      deviceProfileOs: 'Linux',
      deviceProfileArch: 'x64',
      deviceProfileTouched: true,
    };
    expect(buildAuthFileFieldsPatch(changed, resolve)).toEqual({
      device_profile: {
        user_agent: 'claude-cli/2.1.258 (external, cli)',
        package_version: '0.112.1',
        runtime_version: 'v26.3.0',
        os: 'Linux',
        arch: 'x64',
      },
    });
    const cleared = {
      ...baseEditor({ device_profile: { os: 'Linux' } }),
      deviceProfileOs: '',
      deviceProfileArch: '',
      deviceProfileTouched: true,
    };
    expect(buildAuthFileFieldsPatch(cleared, resolve)).toEqual({ device_profile: null });
    const untouched = {
      ...baseEditor({ device_profile: { os: 'Linux' } }),
      deviceProfileOs: 'Linux',
    };
    expect(buildAuthFileFieldsPatch(untouched, resolve)).toEqual({});
  });

  test('non-Claude providers never emit a device profile patch', () => {
    const codex = {
      ...baseEditor({}),
      providerKey: 'codex',
      deviceProfileOs: 'Linux',
      deviceProfileTouched: true,
    };
    expect(buildAuthFileFieldsPatch(codex, resolve)).toEqual({});
  });
});

describe('sections render', () => {
  test('limits section renders meters and hides when idle', async () => {
    await i18n.changeLanguage('en');
    const snapshot = normalizeAuthFileLimits(limitsPayload)!;
    const html = renderToStaticMarkup(createElement(AuthFileLimitsSection, { snapshot }));
    expect(html).toContain('3 / 60');
    expect(html).toContain('12.3k / 400k');
    expect(html).toContain('1 / 8');
    const idle = normalizeAuthFileLimits({
      rpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      tpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      max_concurrent: { limit: 0, in_flight: 0 },
    });
    expect(renderToStaticMarkup(createElement(AuthFileLimitsSection, { snapshot: idle }))).toBe('');
  });

  test('fingerprint section renders the mode, warnings and redacted transport', async () => {
    await i18n.changeLanguage('en');
    const fingerprint = normalizeAuthFileFingerprint(fingerprintPayload);
    const html = renderToStaticMarkup(createElement(AuthFileFingerprintSection, { fingerprint }));
    expect(html).toContain('Cloaked as Claude Code CLI');
    expect(html).toContain('claude-cli/2.1.258 (external, cli)');
    expect(html).toContain('stabilize-device-profile is off');
    expect(html).toContain('socks5://redacted@proxy:1080');
    expect(html).toContain('1 warning');
    expect(renderToStaticMarkup(createElement(AuthFileFingerprintSection, {}))).toBe('');
  });
});

describe('identity summary', () => {
  test('condenses proxy, platform and timezone with sources', async () => {
    const { summarizeFingerprintIdentity, proxyDisplayHost } =
      await import('../src/features/authFiles/limits');
    const fingerprint = normalizeAuthFileFingerprint({
      ...fingerprintPayload,
      transport: { ...fingerprintPayload.transport, source: 'pool', label: 'jp-tokyo-4' },
      device: { os: 'MacOS', arch: 'arm64', source: 'platform-pool' },
      client: { current_date_timezone: 'Asia/Tokyo' },
    });
    expect(summarizeFingerprintIdentity(fingerprint)).toEqual({
      proxy: 'jp-tokyo-4 · proxy:1080',
      proxySource: 'pool',
      platform: 'MacOS / arm64',
      platformSource: 'platform-pool',
      timezone: 'Asia/Tokyo',
    });
    expect(proxyDisplayHost('socks5://redacted@103.11.120.63:443/')).toBe('103.11.120.63:443');
    expect(summarizeFingerprintIdentity(undefined)).toBeNull();
  });

  test('identity line renders sources and hides without a fingerprint', async () => {
    await i18n.changeLanguage('en');
    const { AuthFileIdentityLine } =
      await import('../src/features/authFiles/components/AuthFileIdentityLine');
    const fingerprint = normalizeAuthFileFingerprint({
      ...fingerprintPayload,
      transport: { proxy: 'socks5://redacted@1.2.3.4:443', source: 'pool', label: 'jp-1' },
    });
    const html = renderToStaticMarkup(createElement(AuthFileIdentityLine, { fingerprint }));
    expect(html).toContain('jp-1 · 1.2.3.4:443');
    expect(html).toContain('pool');
    expect(html).toContain('Linux / x64');
    expect(renderToStaticMarkup(createElement(AuthFileIdentityLine, {}))).toBe('');
  });
});

describe('limits normalization: day budgets, sessions, active hours', () => {
  test('keeps the optional shape fields and drops malformed ones', () => {
    const snapshot = normalizeAuthFileLimits({
      rpm: { limit: 30, used: 1, resets_in_seconds: 10 },
      tpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      max_concurrent: { limit: 4, in_flight: 0 },
      rpd: { limit: 600, used: 12, resets_in_seconds: 3600 },
      tpd: { limit: 15000000, used: 200000, resets_in_seconds: 3600 },
      max_sessions: { limit: 4, active: 2, window_seconds: 900 },
      active_hours: { window: '08:30-01:00', awake: false, next_change_at: '2026-09-18T23:30:00Z', next_change_in_seconds: 120 },
      timezone: 'Asia/Tokyo',
    });
    expect(snapshot?.rpd).toEqual({ limit: 600, used: 12, resetsInSeconds: 3600 });
    expect(snapshot?.maxSessions).toEqual({ limit: 4, active: 2, windowSeconds: 900 });
    expect(snapshot?.activeHours).toEqual({
      window: '08:30-01:00',
      awake: false,
      nextChangeAt: '2026-09-18T23:30:00Z',
      nextChangeInSeconds: 120,
    });
    expect(snapshot?.timezone).toBe('Asia/Tokyo');
    expect(hasLimitActivity(snapshot)).toBe(true);

    const legacy = normalizeAuthFileLimits({
      rpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      tpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      max_concurrent: { limit: 0, in_flight: 0 },
      rpd: 'nope',
    });
    expect(legacy?.rpd).toBeUndefined();
    expect(hasLimitActivity(legacy)).toBe(false);
  });

  test('an active-hours window alone makes the limits row visible', () => {
    const snapshot = normalizeAuthFileLimits({
      rpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      tpm: { limit: 0, used: 0, resets_in_seconds: 0 },
      max_concurrent: { limit: 0, in_flight: 0 },
      active_hours: { window: '09:00-18:00', awake: true },
    });
    expect(hasLimitActivity(snapshot)).toBe(true);
  });
});

describe('active hours text', () => {
  test('accepts empty and HH:MM-HH:MM windows, rejects the rest', () => {
    expect(isValidActiveHoursText('')).toBe(true);
    expect(isValidActiveHoursText(' 08:30-01:00 ')).toBe(true);
    expect(isValidActiveHoursText('09:00-18:00')).toBe(true);
    expect(isValidActiveHoursText('09:00-09:00')).toBe(false);
    expect(isValidActiveHoursText('24:00-01:00')).toBe(false);
    expect(isValidActiveHoursText('8-9')).toBe(false);
  });

  test('reads overrides with kebab fallbacks', () => {
    expect(readActiveHoursOverride(' 08:30-01:00 ')).toBe('08:30-01:00');
    expect(readActiveHoursOverride(5)).toBeUndefined();
    expect(readProxyPoolLabel({ 'proxy-pool-label': ' jp-1 ' })).toBe('jp-1');
    expect(readProxyPoolLabel({ proxy_pool_label: 'jp-2', 'proxy-pool-label': 'jp-1' })).toBe('jp-2');
    expect(readKebabAwareLimitOverride({ 'max-sessions': 3 }, 'max_sessions', 'max-sessions')).toBe(3);
  });
});

describe('fingerprint clients', () => {
  test('normalizes the version list and drops empty ones', () => {
    const fingerprint = normalizeAuthFileFingerprint({
      identity_mode: 'cloak-claude-code-cli',
      user_agent: 'claude-cli/2.1.258 (external, cli)',
      clients: {
        baseline: '2.1.258',
        window_hours: 24,
        versions: [
          { version: '2.1.258', requests: 12, baseline: true, last_seen: '2026-09-18T00:00:00Z' },
          { version: '2.1.301', requests: 1, baseline: false },
          { requests: 3 },
        ],
      },
    });
    expect(fingerprint?.clients?.baseline).toBe('2.1.258');
    expect(fingerprint?.clients?.versions).toHaveLength(2);
    expect(fingerprint?.clients?.versions[0]).toEqual({
      version: '2.1.258',
      requests: 12,
      baseline: true,
      lastSeen: '2026-09-18T00:00:00Z',
    });
    const none = normalizeAuthFileFingerprint({ identity_mode: 'fixed', clients: { versions: [] } });
    expect(none?.clients).toBeUndefined();
  });
});

describe('auth file fields patch: shape overrides', () => {
  test('emits day, session, hours and pin changes and clears them with null / empty', () => {
    const original = { rpd: 600, active_hours: '08:30-01:00', proxy_pool_label: 'jp-1' };
    const patch = buildAuthFileFieldsPatch(
      {
        ...baseEditor(original),
        rpd: '',
        tpd: '100',
        maxSessions: '4',
        activeHours: '',
        activeHoursTouched: true,
        proxyPoolLabel: '',
        proxyPoolLabelTouched: true,
      },
      resolve
    );
    expect(patch.rpd).toBeNull();
    expect(patch.tpd).toBe(100);
    expect(patch.max_sessions).toBe(4);
    expect(patch.active_hours).toBe('');
    expect(patch.proxy_pool_label).toBeNull();

    expect(() =>
      buildAuthFileFieldsPatch(
        { ...baseEditor({}), activeHours: '9-5', activeHoursTouched: true },
        resolve
      )
    ).toThrow('auth_files.active_hours_invalid');
  });
});
