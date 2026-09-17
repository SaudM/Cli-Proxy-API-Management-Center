import { useTranslation } from 'react-i18next';
import type { AuthFileFingerprint } from '@/types/authFile';
import { summarizeFingerprintIdentity } from '@/features/authFiles/limits';
import styles from './AuthFileIdentityLine.module.scss';

const SOURCE_KEYS: Record<string, string> = {
  pool: 'auth_files.identity_source_pool',
  'platform-pool': 'auth_files.identity_source_pool',
  credential: 'auth_files.identity_source_credential',
  global: 'auth_files.identity_source_global',
  config: 'auth_files.identity_source_global',
  'stabilized-cache': 'auth_files.identity_source_stabilized',
  direct: 'auth_files.identity_source_direct',
  none: 'auth_files.identity_source_none',
};

/**
 * One always-visible line with the identity the proxy presents for this credential:
 * egress proxy, device platform and cloaked timezone, each tagged with where the
 * value came from (pool / manual / global). Details stay in the fingerprint section.
 */
export function AuthFileIdentityLine({ fingerprint }: { fingerprint?: AuthFileFingerprint }) {
  const { t } = useTranslation();
  const summary = summarizeFingerprintIdentity(fingerprint);
  if (!summary) return null;
  const source = (value: string | undefined) => {
    const key = value ? SOURCE_KEYS[value] : undefined;
    return key ? <span className={styles.source}>{t(key)}</span> : null;
  };
  return (
    <p className={styles.line} title={t('auth_files.identity_title')}>
      <span className={styles.item} title={t('auth_files.identity_proxy')}>
        <span className={styles.label}>{t('auth_files.identity_proxy')}</span>
        <span className={styles.value}>{summary.proxy}</span>
        {source(summary.proxySource)}
      </span>
      {summary.platform && (
        <span className={styles.item} title={t('auth_files.identity_platform')}>
          <span className={styles.label}>{t('auth_files.identity_platform')}</span>
          <span className={styles.value}>{summary.platform}</span>
          {source(summary.platformSource)}
        </span>
      )}
      {summary.timezone && (
        <span className={styles.item} title={t('auth_files.identity_timezone')}>
          <span className={styles.label}>{t('auth_files.identity_timezone')}</span>
          <span className={styles.value}>{summary.timezone}</span>
        </span>
      )}
    </p>
  );
}
