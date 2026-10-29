import { useTranslation } from 'react-i18next';
import { ConsentSwitch } from './ConsentSwitch';

/**
 * Her choice to have one person alerted if her chat with Anu shows a crisis or a medical emergency.
 * The caller sends `FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION` with it. Off by default. Without a name
 * it is the choice on her invite link, for whoever joins with it.
 */
export function EmergencyAlertsSwitch({
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
      label={name ? t('family.emergency.labelFor', { name }) : t('family.emergency.label')}
      notice={name ? t('family.emergency.notice', { name }) : t('family.emergency.noticeInvite')}
      failedText={t('family.emergency.failed')}
    />
  );
}
