import { useTranslation } from 'react-i18next';
import { ConsentSwitch } from './ConsentSwitch';

/**
 * Her choice to share period updates with one person. The caller sends
 * `FAMILY_PERIOD_SHARING_CONSENT_VERSION` with it. Off by default.
 */
export function PeriodSharingSwitch({
  enabled,
  onChange,
  name,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
  /** Whose phone this is about, once someone has joined. Absent on an invite link. */
  name?: string;
}) {
  const { t } = useTranslation();
  return (
    <ConsentSwitch
      enabled={enabled}
      onChange={onChange}
      label={name ? t('family.period.labelFor', { name }) : t('family.period.label')}
      notice={t('family.period.notice')}
      failedText={t('family.period.failed')}
    />
  );
}
