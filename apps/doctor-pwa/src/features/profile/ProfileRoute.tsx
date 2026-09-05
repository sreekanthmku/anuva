import { useCallback, useEffect, useState } from 'react';
import { ChangePasswordSheet } from '../auth/ChangePasswordSheet';
import { useDoctorIdentity } from '../auth/identity';
import { Avatar, PageHeading } from '../shell/AppShell';
import { BellIcon, ChevronRightIcon, LockIcon, SignOutIcon } from '../shell/icons';
import { Card, ErrorNote } from '../shell/ui';
import {
  disableDoctorPush,
  enableDoctorPush,
  hasRegisteredDevice,
  isPushConfigured,
  pushPermission,
} from '../../lib/push';

type PushState = 'on' | 'off' | 'blocked' | 'unavailable';

function readPushState(): PushState {
  if (!isPushConfigured()) return 'unavailable';

  const permission = pushPermission();
  if (permission === 'unavailable') return 'unavailable';
  if (permission === 'denied') return 'blocked';
  if (permission === 'granted' && hasRegisteredDevice()) return 'on';

  return 'off';
}

const PUSH_COPY: Record<PushState, string> = {
  on: 'This device gets a push for new bookings, cancellations, and new questions.',
  off: 'Get a push on this device for new bookings, cancellations, and questions.',
  blocked:
    'Notifications are blocked for this site in your browser settings. Allow them there, then switch this on.',
  unavailable: 'Push notifications are not available in this browser.',
};

function PushToggle() {
  const [state, setState] = useState<PushState>(readPushState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permission can be changed in browser settings while the tab sits open.
  useEffect(() => {
    const sync = () => setState(readPushState());
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const toggle = useCallback(async () => {
    if (busy || state === 'unavailable' || state === 'blocked') return;

    setBusy(true);
    setError(null);

    try {
      if (state === 'on') {
        await disableDoctorPush();
        setState('off');
        return;
      }

      const result = await enableDoctorPush();
      if (result.ok) {
        setState('on');
      } else {
        setState(result.reason === 'not_granted' ? 'blocked' : 'off');
        setError(result.message);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, state]);

  const on = state === 'on';
  const disabled = busy || state === 'unavailable' || state === 'blocked';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-fixed text-primary">
          <BellIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[14px] text-on-surface">Push notifications</div>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-on-surface-variant">
            {PUSH_COPY[state]}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Push notifications on this device"
          disabled={disabled}
          onClick={() => void toggle()}
          className={`mt-0.5 h-[28px] w-[50px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-40 ${
            on ? 'bg-primary' : 'bg-outline-variant'
          }`}
        >
          <span
            className={`block h-[22px] w-[22px] rounded-full bg-surface-raised shadow transition-transform ${
              on ? 'translate-x-[22px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
    </Card>
  );
}

function ActionRow({
  icon,
  label,
  description,
  tone = 'default',
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 p-4 text-left"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          tone === 'danger' ? 'bg-error/12 text-error' : 'bg-primary-fixed text-primary'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block font-semibold text-[14px] ${tone === 'danger' ? 'text-error' : 'text-on-surface'}`}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-on-surface-variant">
          {description}
        </span>
      </span>
      <span className="shrink-0 text-outline">
        <ChevronRightIcon size={17} />
      </span>
    </button>
  );
}

export function ProfileRoute() {
  const identity = useDoctorIdentity();
  const [changingPassword, setChangingPassword] = useState(false);

  const isAdmin = identity.scope === 'admin';
  const displayName = isAdmin ? 'Anuva admin' : (identity.specialistName ?? identity.username);

  return (
    <>
      <PageHeading eyebrow="Account" title="Your" accent="profile" />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size={56} />
          <div className="min-w-0">
            <div className="truncate font-display text-[21px] leading-tight text-on-surface">
              {displayName}
            </div>
            <div className="mt-1 text-[12.5px] text-on-surface-variant">@{identity.username}</div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px]">
          <div className="rounded-[14px] bg-surface-container-low px-3 py-2.5">
            <dt className="text-[10.5px] uppercase tracking-[0.12em] text-outline">Access</dt>
            <dd className="mt-1 font-semibold text-on-surface">
              {isAdmin ? 'Admin: all doctors' : 'Doctor: own bookings'}
            </dd>
          </div>
          <div className="rounded-[14px] bg-surface-container-low px-3 py-2.5">
            <dt className="text-[10.5px] uppercase tracking-[0.12em] text-outline">Q&amp;A queue</dt>
            <dd className="mt-1 font-semibold text-on-surface">
              {isAdmin ? 'Read-only' : 'Can answer'}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="mt-3">
        <PushToggle />
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Card>
          <ActionRow
            icon={<LockIcon />}
            label="Change password"
            description="Signs out every other device you are logged in on."
            onClick={() => setChangingPassword(true)}
          />
        </Card>

        <Card>
          <ActionRow
            icon={<SignOutIcon />}
            label="Sign out"
            description="Ends this session on this device."
            tone="danger"
            onClick={identity.signOut}
          />
        </Card>
      </div>

      <p className="mt-6 text-center text-[11.5px] leading-[1.5] text-outline">
        Lost your password? Ask the Anuva team to set a new one for you.
      </p>

      {changingPassword ? <ChangePasswordSheet onClose={() => setChangingPassword(false)} /> : null}
    </>
  );
}
