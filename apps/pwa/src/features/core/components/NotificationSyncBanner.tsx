type NotificationSyncBannerProps = {
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
};

export function NotificationSyncBanner({ message, onRetry, onDismiss }: NotificationSyncBannerProps) {
  return (
    <div
      className="mb-4 rounded-[16px] border px-4 py-3"
      style={{
        borderColor: 'rgba(219, 200, 57, 0.35)',
        background: 'rgba(219, 200, 57, 0.1)',
      }}
      role="status"
    >
      <p className="text-[13px] leading-relaxed text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
        {message}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-secondary px-4 py-2 text-[12px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Retry registration
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full px-4 py-2 text-[12px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
