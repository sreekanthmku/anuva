import { useTranslation } from 'react-i18next';
import type { GrievanceOfficer } from '@anuva/shared';

/**
 * The named Grievance Officer, once one is set on the API: name (and designation), phone and hours.
 * Nothing until then — the email alone is shown by the screen around it.
 */
export function GrievanceOfficerDetails({ officer, className }: { officer: GrievanceOfficer; className?: string }) {
  const { t } = useTranslation();
  if (!officer.name) return null;
  return (
    <span className={`block ${className ?? ''}`}>
      {officer.designation
        ? t('legal.grievanceOfficerWithRole', { name: officer.name, designation: officer.designation })
        : t('legal.grievanceOfficer', { name: officer.name })}
      {officer.phone ? <span className="block">{t('legal.grievancePhone', { phone: officer.phone })}</span> : null}
      {officer.hours ? <span className="block">{t('legal.grievanceHours', { hours: officer.hours })}</span> : null}
    </span>
  );
}
