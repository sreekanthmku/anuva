export function BookingFormHeader() {
  return (
    <header className="sticky top-0 z-30 shrink-0 bg-surface px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
      <div
        className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        style={{
          backgroundColor: 'rgba(94, 53, 102, 0.16)',
          borderColor: 'rgba(94, 53, 102, 0.3)',
        }}
      >
        <span
          className="text-[9.5px] uppercase tracking-[0.15em] text-primary"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          ★ Included free · first consult
        </span>
      </div>
      <h1 className="font-display mb-1.5 max-w-[22rem] text-[28px] leading-[1.15] text-on-surface">
        Book with a{' '}
        <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces", sans-serif' }}>
          specialist
        </em>
      </h1>
      <p
        className="text-[12px] text-on-surface-variant"
        style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
      >
        30-minute video call · reschedule anytime
      </p>
    </header>
  );
}
