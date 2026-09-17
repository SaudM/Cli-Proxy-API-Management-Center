import { useTranslation } from 'react-i18next';
import { IconChevronDown } from '@/components/ui/icons';
import type { AuthFileFingerprint } from '@/types/authFile';
import { fingerprintIdentityModeKey } from '@/features/authFiles/limits';
import styles from './AuthFileFingerprintSection.module.scss';

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

function KeyValueList({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record).filter(([, value]) => formatValue(value) !== '');
  if (entries.length === 0) return null;
  return (
    <dl className={styles.kv}>
      {entries.map(([key, value]) => (
        <div className={styles.kvRow} key={key}>
          <dt className={styles.kvKey}>{key}</dt>
          <dd className={styles.kvValue}>{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Read-only report of the identity the proxy presents upstream for this credential.
 * The backend already redacts secrets; the panel only renders what it is given.
 */
export function AuthFileFingerprintSection({ fingerprint }: { fingerprint?: AuthFileFingerprint }) {
  const { t } = useTranslation();
  if (!fingerprint) return null;
  const modeKey = fingerprintIdentityModeKey(fingerprint.identityMode);
  const modeLabel = modeKey ? t(modeKey) : fingerprint.identityMode;
  const hasWarnings = fingerprint.warnings.length > 0;
  const groups: Array<{ key: string; label: string; record: Record<string, unknown> }> = [
    { key: 'device', label: t('auth_files.fingerprint_device'), record: fingerprint.device },
    {
      key: 'transport',
      label: t('auth_files.fingerprint_transport'),
      record: fingerprint.transport,
    },
    { key: 'client', label: t('auth_files.fingerprint_client'), record: fingerprint.client },
    {
      key: 'overrides',
      label: t('auth_files.fingerprint_overrides'),
      record: fingerprint.credentialOverrides,
    },
  ];

  return (
    <details className={`${styles.section} ${hasWarnings ? styles.hasWarnings : ''}`}>
      <summary className={styles.summary}>
        <span className={styles.summaryContent}>
          <span className={styles.mode}>
            <span className={styles.eyebrow}>{t('auth_files.fingerprint_label')}</span>
            <span>{modeLabel}</span>
            {hasWarnings && (
              <span className={styles.warningBadge}>
                {t('auth_files.fingerprint_warning_count', { count: fingerprint.warnings.length })}
              </span>
            )}
          </span>
          {fingerprint.userAgent && (
            <span className={styles.userAgent} title={fingerprint.userAgent}>
              {fingerprint.userAgent}
            </span>
          )}
        </span>
        <IconChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </summary>
      <div className={styles.body}>
        <dl className={styles.kv}>
          {fingerprint.ccVersion && (
            <div className={styles.kvRow}>
              <dt className={styles.kvKey}>{t('auth_files.fingerprint_cc_version')}</dt>
              <dd className={styles.kvValue}>{fingerprint.ccVersion}</dd>
            </div>
          )}
          {fingerprint.authKind && (
            <div className={styles.kvRow}>
              <dt className={styles.kvKey}>{t('auth_files.fingerprint_auth_kind')}</dt>
              <dd className={styles.kvValue}>{fingerprint.authKind}</dd>
            </div>
          )}
          {fingerprint.session && (
            <div className={styles.kvRow}>
              <dt className={styles.kvKey}>{t('auth_files.fingerprint_session')}</dt>
              <dd className={styles.kvValue}>{fingerprint.session}</dd>
            </div>
          )}
        </dl>
        {groups.map(({ key, label, record }) =>
          Object.keys(record).length > 0 ? (
            <div className={styles.group} key={key}>
              <span className={styles.groupLabel}>{label}</span>
              <KeyValueList record={record} />
            </div>
          ) : null
        )}
        {hasWarnings && (
          <div className={styles.group}>
            <span className={styles.groupLabel}>{t('auth_files.fingerprint_warnings')}</span>
            <ul className={styles.warnings}>
              {fingerprint.warnings.map((warning, index) => (
                <li className={styles.warning} key={`${index}:${warning.slice(0, 24)}`}>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className={styles.note}>{t('auth_files.fingerprint_note')}</p>
      </div>
    </details>
  );
}
