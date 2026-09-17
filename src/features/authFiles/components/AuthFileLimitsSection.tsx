import { useTranslation } from 'react-i18next';
import type { AuthFileLimitsSnapshot } from '@/types/authFile';
import { formatLimitUsage, hasLimitActivity, limitUsageRatio } from '@/features/authFiles/limits';
import styles from './AuthFileLimitsSection.module.scss';

type MeterProps = {
  label: string;
  title: string;
  used: number;
  limit: number;
  compact?: boolean;
};

function LimitMeter({ label, title, used, limit, compact }: MeterProps) {
  const ratio = limitUsageRatio(used, limit);
  const saturated = limit > 0 && used >= limit;
  return (
    <span className={`${styles.meter} ${saturated ? styles.saturated : ''}`} title={title}>
      <span className={styles.meterLabel}>{label}</span>
      <span className={styles.meterValue}>{formatLimitUsage(used, limit, compact)}</span>
      {limit > 0 && (
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

/**
 * Effective rpm / tpm / concurrency limits with live usage. Hidden when nothing is
 * configured and nothing is in flight, so unlimited idle credentials stay quiet.
 */
export function AuthFileLimitsSection({ snapshot }: { snapshot?: AuthFileLimitsSnapshot }) {
  const { t } = useTranslation();
  if (!hasLimitActivity(snapshot) || !snapshot) return null;
  const { rpm, tpm, maxConcurrent } = snapshot;
  const resets = (seconds: number) =>
    seconds > 0 ? t('auth_files.limits_resets_in', { seconds }) : t('auth_files.limits_idle');
  return (
    <div className={styles.section} role="group" aria-label={t('auth_files.limits_label')}>
      <span className={styles.eyebrow}>{t('auth_files.limits_label')}</span>
      <LimitMeter
        label={t('auth_files.limits_rpm')}
        title={`${t('auth_files.limits_rpm_title')} · ${resets(rpm.resetsInSeconds)}`}
        used={rpm.used}
        limit={rpm.limit}
      />
      <LimitMeter
        label={t('auth_files.limits_tpm')}
        title={`${t('auth_files.limits_tpm_title')} · ${resets(tpm.resetsInSeconds)}`}
        used={tpm.used}
        limit={tpm.limit}
        compact
      />
      <LimitMeter
        label={t('auth_files.limits_concurrent')}
        title={t('auth_files.limits_concurrent_title')}
        used={maxConcurrent.inFlight}
        limit={maxConcurrent.limit}
      />
    </div>
  );
}
