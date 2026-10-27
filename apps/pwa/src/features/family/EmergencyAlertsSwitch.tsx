import { useTranslation } from 'react-i18next';
import { ConsentSwitch } from './ConsentSwitch';

/**
 * Her choice to have one person alerted if her chat with Anu shows a crisis or a medical emergency.
 * The caller sends `FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION` with it. Off by default, and only for
 * someone who has already joined — she picks who, knowing who they are.
 */
export function EmergencyAlertsSwitch({
  enabled,
  onChange,
  name,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => Promise<void>;
  name: string;
}) {
  const { t } = useTranslation();
  return (
    <ConsentSwitch
      enabled={enabled}
      onChange={onChange}
      label={t('family.emergency.labelFor', { name })}
      notice={t('family.emergency.notice', { name })}
      failedText={t('family.emergency.failed')}
    />
  );
}
