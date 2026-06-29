type NotificationPermissionDialogProps = {
  open: boolean;
  isRegistering?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
};

export function NotificationPermissionDialog({
  open,
  isRegistering = false,
  onAccept,
  onDismiss,
}: NotificationPermissionDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-[calc(var(--bottom-nav-height)+16px)] pt-4 sm:items-center sm:pb-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Dismiss notification prompt"
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-prompt-title"
        aria-describedby="notification-prompt-desc"
        className="relative w-full max-w-[360px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-5"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border text-on-surface-variant transition-opacity hover:opacity-90"
          style={{
            background: '#EFE4D8',
            borderColor: 'rgba(180, 159, 176, 0.35)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 0 1-6 0v-1m6 0H9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2
          id="notification-prompt-title"
          className="mb-2 text-[20px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 400 }}
        >
          Stay in the loop?
        </h2>
        <p
          id="notification-prompt-desc"
          className="mb-5 text-[13px] leading-relaxed text-on-surface-variant"
        >
          Gentle reminders for symptom logging and your weekly summary. You can change this anytime
          in Profile.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={isRegistering}
            className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-60"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {isRegistering ? 'Registering device…' : 'Enable notifications'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-[13px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
