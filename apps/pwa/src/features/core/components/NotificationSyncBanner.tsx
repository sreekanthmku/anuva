type NotificationSyncBannerProps = {
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
};

export function NotificationSyncBanner({
  message,
  onRetry,
  onDismiss,
}: NotificationSyncBannerProps) {
  return (
    <div
      className="mb-4 rounded-[16px] border border-tertiary/35 bg-tertiary-container px-4 py-3"
      role="status"
    >
      <p
        className="text-[13px] leading-relaxed text-on-surface"
        style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
      >
        {message}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-secondary px-4 py-2 text-[12px] font-semibold text-on-secondary"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          Retry registration
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-4 py-2 text-[12px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
