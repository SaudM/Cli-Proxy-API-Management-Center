import { describe, expect, test } from 'bun:test';
import {
  buildAuthFileTemplateText,
  normalizeAuthFileTemplate,
  normalizeAuthFileTemplateProviders,
} from '../src/services/api/authFileTemplate';
import { normalizeUploadWarnings } from '../src/services/api/authFiles';

const payload = {
  provider: 'claude',
  label: 'Claude (OAuth)',
  file_name: 'claude-<email>.json',
  template: {
    type: 'claude',
    access_token: '<access_token>',
    refresh_token: '<refresh_token>',
    expired: '<2026-01-01T00:00:00Z>',
  },
  optional: { email: '<you@example.com>', rpm: 0, device_profile: { os: '', arch: '' } },
  fields: [
    { key: 'type', required: true, example: 'claude', description: 'Provider marker' },
    { key: 'access_token', required: true, example: '<access_token>', description: 'token' },
    { key: 'email', required: false, example: '<you@example.com>', description: 'mail' },
    { key: '', required: true },
    'junk',
  ],
};

describe('auth file template', () => {
  test('normalizes the provider list and one template', () => {
    expect(
      normalizeAuthFileTemplateProviders({
        providers: [{ provider: 'claude', label: 'Claude', file_name: 'claude-<email>.json' }, {}],
      })
    ).toEqual([{ provider: 'claude', label: 'Claude', fileName: 'claude-<email>.json' }]);
    const template = normalizeAuthFileTemplate(payload);
    expect(template?.provider).toBe('claude');
    expect(template?.fileName).toBe('claude-<email>.json');
    expect(Object.keys(template?.template ?? {})).toEqual([
      'type',
      'access_token',
      'refresh_token',
      'expired',
    ]);
    expect(template?.fields).toHaveLength(3);
    expect(normalizeAuthFileTemplate({ provider: 'x' })).toBeUndefined();
  });

  test('builds minimal and extended JSON text', () => {
    const template = normalizeAuthFileTemplate(payload)!;
    const minimal = JSON.parse(buildAuthFileTemplateText(template, false));
    expect(Object.keys(minimal)).toEqual(['type', 'access_token', 'refresh_token', 'expired']);
    const extended = JSON.parse(buildAuthFileTemplateText(template, true));
    expect(extended.email).toBe('<you@example.com>');
    expect(extended.device_profile).toEqual({ os: '', arch: '' });
    expect(buildAuthFileTemplateText(template, false).endsWith('\n')).toBe(true);
  });
});

describe('upload warnings', () => {
  test('keys a single-upload list by the requested name and keeps batch maps', () => {
    expect(normalizeUploadWarnings(['missing refresh_token'], ['a.json'])).toEqual({
      'a.json': ['missing refresh_token'],
    });
    expect(normalizeUploadWarnings({ 'b.json': ['x'], 'c.json': [], 'd.json': 'nope' }, [])).toEqual({
      'b.json': ['x'],
    });
    expect(normalizeUploadWarnings(undefined, ['a.json'])).toEqual({});
  });
});
