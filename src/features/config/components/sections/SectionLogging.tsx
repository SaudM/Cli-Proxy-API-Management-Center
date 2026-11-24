import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { CONFIG_TAB_ICONS, SECTION_INDEX_LABELS } from '../../constants';
import type { ConfigSectionProps } from '../../types';
import { SectionCard } from '../SectionCard';
import { FieldAnchor, FieldGroup, FieldStack, ToggleRow } from '../fields/FieldPrimitives';
import { DebugToggle, LoggingToFileToggle } from '../fields/sharedFields';
import { getValidationMessage } from '../blocks/shared';
import { CONFIG_FIELD_SEARCH_INDEX } from '../../searchIndex';
import styles from './SectionLogging.module.scss';

const Icon = CONFIG_TAB_ICONS.logging;

// YAML key for a field id, derived from the search index (single source of truth),
// e.g. commercialMode -> "commercial-mode". Shown above each field.
const YAML_KEY_BY_FIELD: Record<string, string> = Object.fromEntries(
  CONFIG_FIELD_SEARCH_INDEX.filter((entry) => entry.sectionId === 'logging').map((entry) => [
    entry.fieldId,
    (entry.yamlKeys ?? []).join('.'),
  ])
);
const keyOf = (fieldId: string): string => YAML_KEY_BY_FIELD[fieldId] ?? '';

/** 03 日志与诊断：日志输出、容量、商业模式（重启生效）与使用统计。 */
export function SectionLogging({
  values,
  validationErrors,
  disabled,
  animateIn,
  onChange,
}: ConfigSectionProps) {
  const { t } = useTranslation();
  const logsMaxSizeError = getValidationMessage(t, validationErrors?.logsMaxTotalSizeMb);
  const errorLogsMaxFilesError = getValidationMessage(t, validationErrors?.errorLogsMaxFiles);
  const redisUsageQueueRetentionError = getValidationMessage(
    t,
    validationErrors?.redisUsageQueueRetentionSeconds
  );

  return (
    <SectionCard
      indexLabel={SECTION_INDEX_LABELS.logging}
      icon={<Icon size={16} />}
      title={t('config_management.visual.sections.logging.title')}
      description={
        <>
          {t('config_management.visual.sections.logging.description')}{' '}
          <span className={styles.keyHint}>
            {t('config_management.visual.sections.logging.yaml_keys_hint')}
          </span>
        </>
      }
      animateIn={animateIn}
    >
      <div className={styles.columns}>
        <FieldGroup title={t('config_management.visual.sections.logging.group_output')}>
          <FieldStack>
            <div className={styles.key}>{keyOf('loggingToFile')}</div>
            <LoggingToFileToggle values={values} disabled={disabled} onChange={onChange} />
            <div className={styles.key}>{keyOf('requestLog')}</div>
            <FieldAnchor fieldId="requestLog">
              <ToggleRow
                title={t('config_management.visual.sections.system.request_log')}
                description={t('config_management.visual.sections.system.request_log_desc')}
                checked={values.requestLog}
                disabled={disabled}
                onChange={(requestLog) => onChange({ requestLog })}
              />
            </FieldAnchor>
            <div className={styles.key}>{keyOf('debug')}</div>
            <DebugToggle values={values} disabled={disabled} onChange={onChange} />
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t('config_management.visual.sections.logging.group_capacity')}>
          <FieldStack>
            <div className={styles.key}>{keyOf('logsMaxTotalSizeMb')}</div>
            <FieldAnchor fieldId="logsMaxTotalSizeMb">
              <Input
                label={t('config_management.visual.sections.system.logs_max_size')}
                type="number"
                placeholder="0"
                value={values.logsMaxTotalSizeMb}
                onChange={(e) => onChange({ logsMaxTotalSizeMb: e.target.value })}
                disabled={disabled}
                error={logsMaxSizeError}
              />
            </FieldAnchor>
            <div className={styles.key}>{keyOf('errorLogsMaxFiles')}</div>
            <FieldAnchor fieldId="errorLogsMaxFiles">
              <Input
                label={t('config_management.visual.sections.system.error_logs_max_files')}
                type="number"
                placeholder="10"
                value={values.errorLogsMaxFiles}
                onChange={(e) => onChange({ errorLogsMaxFiles: e.target.value })}
                disabled={disabled}
                error={errorLogsMaxFilesError}
              />
            </FieldAnchor>
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t('config_management.visual.sections.logging.group_commercial')}>
          <FieldStack>
            <div className={styles.key}>{keyOf('commercialMode')}</div>
            <FieldAnchor fieldId="commercialMode">
              <ToggleRow
                title={t('config_management.visual.sections.system.commercial_mode')}
                description={t('config_management.visual.sections.system.commercial_mode_desc')}
                checked={values.commercialMode}
                disabled={disabled}
                onChange={(commercialMode) => onChange({ commercialMode })}
              />
            </FieldAnchor>
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t('config_management.visual.sections.logging.group_usage')}>
          <FieldStack>
            <div className={styles.key}>{keyOf('usageStatisticsEnabled')}</div>
            <FieldAnchor fieldId="usageStatisticsEnabled">
              <ToggleRow
                title={t('config_management.visual.sections.system.usage_statistics_enabled')}
                description={t(
                  'config_management.visual.sections.system.usage_statistics_enabled_desc'
                )}
                checked={values.usageStatisticsEnabled}
                disabled={disabled}
                onChange={(usageStatisticsEnabled) => onChange({ usageStatisticsEnabled })}
              />
            </FieldAnchor>
            <div className={styles.key}>{keyOf('redisUsageQueueRetentionSeconds')}</div>
            <FieldAnchor fieldId="redisUsageQueueRetentionSeconds">
              <Input
                label={t('config_management.visual.sections.system.redis_usage_retention')}
                type="number"
                min={1}
                max={3600}
                placeholder="60"
                value={values.redisUsageQueueRetentionSeconds}
                onChange={(e) => onChange({ redisUsageQueueRetentionSeconds: e.target.value })}
                disabled={disabled}
                hint={t('config_management.visual.sections.system.redis_usage_retention_hint')}
                error={redisUsageQueueRetentionError}
              />
            </FieldAnchor>
          </FieldStack>
        </FieldGroup>
      </div>
    </SectionCard>
  );
}
