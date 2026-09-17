import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '../src/i18n/index';
import { normalizeCredentialPools } from '../src/services/api/credentialPools';
import { CredentialPoolsView } from '../src/features/config/components/blocks/CredentialPoolsView';

const payload = {
  'proxy-pool': [
    {
      url: 'socks5://redacted@103.11.120.63:443',
      label: 'jp-tokyo-4',
      timezone: 'Asia/Tokyo',
      assigned: 1,
    },
    { url: 'socks5://redacted@103.5.250.159:443', assigned: 0 },
    { url: '' },
  ],
  'platform-pool': [
    { os: 'MacOS', arch: 'arm64', weight: 6, assigned: 1 },
    { os: 'Windows', arch: 'x64', weight: 2, assigned: 0 },
  ],
  'stabilize-device-profile': true,
};

describe('credential pools', () => {
  test('normalizes both pools and drops empty urls', () => {
    const pools = normalizeCredentialPools(payload);
    expect(pools.proxyPool).toHaveLength(2);
    expect(pools.proxyPool[0]).toEqual({
      url: 'socks5://redacted@103.11.120.63:443',
      label: 'jp-tokyo-4',
      timezone: 'Asia/Tokyo',
      assigned: 1,
    });
    expect(pools.platformPool[1]).toEqual({ os: 'Windows', arch: 'x64', weight: 2, assigned: 0 });
    expect(pools.stabilizeDeviceProfile).toBe(true);
    expect(normalizeCredentialPools(null)).toEqual({
      proxyPool: [],
      platformPool: [],
      stabilizeDeviceProfile: false,
    });
  });

  test('view renders labels, hosts, weights and assigned counts', async () => {
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(
      createElement(CredentialPoolsView, {
        data: normalizeCredentialPools(payload),
        loading: false,
        error: null,
        onReload: () => {},
      })
    );
    expect(html).toContain('jp-tokyo-4');
    expect(html).toContain('103.11.120.63:443');
    expect(html).toContain('Asia/Tokyo');
    expect(html).toContain('MacOS / arm64');
    expect(html).toContain('weight 6 · ~75%');
    expect(html).toContain('1 credential');
    expect(html).toContain('stabilize-device-profile: on');
    expect(html).not.toContain('redacted@');
  });
});
