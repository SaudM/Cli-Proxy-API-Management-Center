import { useTranslation } from 'react-i18next';
import type { AuthFileLimitsSnapshot } from '@/types/authFile';
import {
  formatClockInZone,
  formatLimitUsage,
  hasLimitActivity,
  limitUsageRatio,
} from '@/features/authFiles/limits';
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
 * Effective limits with live usage: the per-minute caps, the daily budget, the session
 * cap and the active-hours window. Hidden when nothing is configured and nothing is in
 * flight, so unlimited idle credentials stay quiet.
 */
export function AuthFileLimitsSection({ snapshot }: { snapshot?: AuthFileLimitsSnapshot }) {
  const { t } = useTranslation();
  if (!hasLimitActivity(snapshot) || !snapshot) return null;
  const { rpm, tpm, maxConcurrent, rpd, tpd, maxSessions, activeHours, timezone } = snapshot;
  const resets = (seconds: number) =>
    seconds > 0 ? t('auth_files.limits_resets_in', { seconds }) : t('auth_files.limits_idle');
  const dayResets = (seconds: number) =>
    seconds > 0 ? t('auth_files.limits_day_resets_in', { hours: Math.ceil(seconds / 3600) }) : '';
  const showDay = Boolean(rpd && (rpd.limit > 0 || rpd.used > 0)) || Boolean(tpd && (tpd.limit > 0 || tpd.used > 0));
  const showSessions = Boolean(maxSessions && (maxSessions.limit > 0 || maxSessions.active > 0));
  const showHours = Boolean(activeHours && activeHours.window !== '');
  const nextEdge =
    activeHours?.nextChangeAt !== undefined ? formatClockInZone(activeHours.nextChangeAt, timezone) : '';
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
      {showDay && rpd && (
        <LimitMeter
          label={t('auth_files.limits_rpd')}
          title={`${t('auth_files.limits_rpd_title')} · ${dayResets(rpd.resetsInSeconds)}`}
          used={rpd.used}
          limit={rpd.limit}
        />
      )}
      {showDay && tpd && (
        <LimitMeter
          label={t('auth_files.limits_tpd')}
          title={`${t('auth_files.limits_tpd_title')} · ${dayResets(tpd.resetsInSeconds)}`}
          used={tpd.used}
          limit={tpd.limit}
          compact
        />
      )}
      {showSessions && maxSessions && (
        <LimitMeter
          label={t('auth_files.limits_sessions')}
          title={t('auth_files.limits_sessions_title', {
            minutes: Math.round(maxSessions.windowSeconds / 60),
          })}
          used={maxSessions.active}
          limit={maxSessions.limit}
        />
      )}
      {showHours && activeHours && (
        <span
          className={`${styles.meter} ${activeHours.awake ? '' : styles.asleep}`}
          title={t('auth_files.limits_active_hours_title', {
            window: activeHours.window,
            timezone: timezone ?? '',
          })}
        >
          <span className={styles.meterLabel}>{t('auth_files.limits_active_hours')}</span>
          <span className={styles.meterValue}>
            {activeHours.awake
              ? t('auth_files.limits_awake_until', { time: nextEdge })
              : t('auth_files.limits_asleep_until', { time: nextEdge })}
          </span>
        </span>
      )}
    </div>
  );
}
