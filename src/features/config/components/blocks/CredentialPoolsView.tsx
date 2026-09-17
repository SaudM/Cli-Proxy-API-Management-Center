import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { CredentialPools } from '@/services/api/credentialPools';
import styles from './CredentialPoolsView.module.scss';

export type CredentialPoolsViewProps = {
  data: CredentialPools | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
};

const proxyHost = (url: string): string => url.replace(/^[a-z0-9+.-]+:\/\/(?:[^@/]*@)?/i, '');

/**
 * Read-only echo of the automatic assignment pools. Editing the lists stays in the
 * YAML source editor; this view exists so the effective defaults are visible at a
 * glance, including how many credentials currently land on each entry.
 */
export function CredentialPoolsView({ data, loading, error, onReload }: CredentialPoolsViewProps) {
  const { t } = useTranslation();
  const base = 'config_management.visual.sections.headers';
  const totalWeight = data?.platformPool.reduce((sum, entry) => sum + entry.weight, 0) ?? 0;

  return (
    <div className={styles.view} role="group" aria-label={t(`${base}.pools_title`)}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>{t(`${base}.pools_title`)}</div>
          <div className={styles.desc}>{t(`${base}.pools_desc`)}</div>
        </div>
        <Button variant="secondary" size="sm" onClick={onReload} disabled={loading}>
          {loading ? <LoadingSpinner size={12} /> : t(`${base}.pools_refresh`)}
        </Button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {data && (
        <div className={styles.columns}>
          <div className={styles.column}>
            <div className={styles.columnTitle}>
              {t(`${base}.pools_proxy_title`)}
              <span className={styles.count}>{data.proxyPool.length}</span>
            </div>
            {data.proxyPool.length === 0 ? (
              <div className={styles.empty}>{t(`${base}.pools_empty`)}</div>
            ) : (
              <ul className={styles.list}>
                {data.proxyPool.map((entry) => (
                  <li className={styles.row} key={entry.url}>
                    <span className={styles.primary}>{entry.label || proxyHost(entry.url)}</span>
                    {entry.label && (
                      <span className={styles.secondary}>{proxyHost(entry.url)}</span>
                    )}
                    {entry.timezone && <span className={styles.secondary}>{entry.timezone}</span>}
                    <span className={styles.assigned}>
                      {t(`${base}.pools_assigned`, { count: entry.assigned })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.column}>
            <div className={styles.columnTitle}>
              {t(`${base}.pools_platform_title`)}
              <span className={styles.count}>{data.platformPool.length}</span>
            </div>
            <div className={styles.secondary}>
              {data.stabilizeDeviceProfile
                ? t(`${base}.pools_stabilize_on`)
                : t(`${base}.pools_stabilize_off`)}
            </div>
            {data.platformPool.length === 0 ? (
              <div className={styles.empty}>{t(`${base}.pools_empty`)}</div>
            ) : (
              <ul className={styles.list}>
                {data.platformPool.map((entry) => (
                  <li className={styles.row} key={`${entry.os}/${entry.arch}`}>
                    <span className={styles.primary}>
                      {[entry.os, entry.arch].filter(Boolean).join(' / ')}
                    </span>
                    <span className={styles.secondary}>
                      {t(`${base}.pools_weight`, {
                        weight: entry.weight,
                        percent:
                          totalWeight > 0 ? Math.round((entry.weight / totalWeight) * 100) : 0,
                      })}
                    </span>
                    <span className={styles.assigned}>
                      {t(`${base}.pools_assigned`, { count: entry.assigned })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <div className={styles.hint}>{t(`${base}.pools_yaml_hint`)}</div>
    </div>
  );
}
