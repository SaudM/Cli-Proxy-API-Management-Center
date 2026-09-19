import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import {
  authFileTemplateApi,
  buildAuthFileTemplateText,
  type AuthFileTemplate,
  type AuthFileTemplateProvider,
} from '@/services/api/authFileTemplate';
import styles from './AuthFileTemplateModal.module.scss';

export type AuthFileTemplateModalProps = {
  open: boolean;
  onClose: () => void;
};

const readStatus = (err: unknown): number | undefined => {
  if (!err || typeof err !== 'object') return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
};

/**
 * Minimal auth-file template for uploads: the operator picks a provider, copies or
 * downloads the JSON with only the required keys (optional tuning keys on demand),
 * fills in the placeholders and uploads it. Field descriptions come from the panel's
 * own translations, keyed by field name, with the backend's English text as fallback.
 */
export function AuthFileTemplateModal({ open, onClose }: AuthFileTemplateModalProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [providers, setProviders] = useState<AuthFileTemplateProvider[]>([]);
  const [provider, setProvider] = useState('claude');
  const [template, setTemplate] = useState<AuthFileTemplate | null>(null);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    authFileTemplateApi
      .listProviders()
      .then((list) => {
        if (cancelled) return;
        setProviders(list);
        if (list.length > 0 && !list.some((item) => item.provider === provider)) {
          setProvider(list[0].provider);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          readStatus(err) === 404
            ? t('auth_files.template_unsupported')
            : err instanceof Error
              ? err.message
              : String(err)
        );
      });
    return () => {
      cancelled = true;
    };
    // The provider is only seeded from the list on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !provider) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    authFileTemplateApi
      .get(provider)
      .then((result) => {
        if (cancelled) return;
        setTemplate(result ?? null);
        if (!result) setError(t('auth_files.template_unsupported'));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          readStatus(err) === 404
            ? t('auth_files.template_unsupported')
            : err instanceof Error
              ? err.message
              : String(err)
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, provider, t]);

  const text = useMemo(
    () => (template ? buildAuthFileTemplateText(template, includeOptional) : ''),
    [template, includeOptional]
  );
  const fileName = template?.fileName?.replace('<email>', 'you@example.com') || `${provider}.json`;

  const handleCopy = useCallback(async () => {
    if (!text) return;
    const ok = await copyToClipboard(text);
    showNotification(
      ok ? t('auth_files.template_copied') : t('notification.copy_failed'),
      ok ? 'success' : 'error'
    );
  }, [text, showNotification, t]);

  const handleDownload = useCallback(() => {
    if (!text) return;
    downloadBlob({ filename: fileName, blob: new Blob([text], { type: 'application/json' }) });
  }, [text, fileName]);

  const describe = (key: string, fallback: string) => {
    const translationKey = `auth_files.template_field_${key}`;
    const translated = t(translationKey);
    return translated === translationKey ? fallback : translated;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('auth_files.template_title')}
      width={720}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="secondary" onClick={() => void handleCopy()} disabled={!text}>
            {t('auth_files.template_copy')}
          </Button>
          <Button onClick={handleDownload} disabled={!text}>
            {t('auth_files.template_download')}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.desc}>{t('auth_files.template_desc')}</p>
        <div className={styles.controls}>
          <div className={styles.control}>
            <span className={styles.label}>{t('auth_files.template_provider')}</span>
            <Select
              size="sm"
              value={provider}
              ariaLabel={t('auth_files.template_provider')}
              options={providers.map((item) => ({ value: item.provider, label: item.label }))}
              onChange={(value) => setProvider(value)}
              disabled={providers.length === 0}
            />
          </div>
          <label className={styles.control}>
            <span className={styles.label}>{t('auth_files.template_include_optional')}</span>
            <ToggleSwitch checked={includeOptional} onChange={setIncludeOptional} />
          </label>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {loading && !template ? (
          <LoadingSpinner size={16} />
        ) : (
          text && (
            <pre className={styles.code} aria-label={t('auth_files.template_title')}>
              {text}
            </pre>
          )
        )}
        {template && (
          <>
            <p className={styles.hint}>
              {t('auth_files.template_file_name_hint', { name: fileName })}
            </p>
            <dl className={styles.fields}>
              {template.fields
                .filter((field) => field.required || includeOptional)
                .map((field) => (
                  <div className={styles.fieldRow} key={field.key}>
                    <dt className={styles.fieldKey}>
                      <code>{field.key}</code>
                      <span className={field.required ? styles.required : styles.optional}>
                        {field.required
                          ? t('auth_files.template_required')
                          : t('auth_files.template_optional')}
                      </span>
                    </dt>
                    <dd className={styles.fieldDesc}>{describe(field.key, field.description)}</dd>
                  </div>
                ))}
            </dl>
          </>
        )}
      </div>
    </Modal>
  );
}
