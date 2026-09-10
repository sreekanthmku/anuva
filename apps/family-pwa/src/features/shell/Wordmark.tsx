/**
 * "Anuva Family" — the app's name, set the way the brand sets it: Fraunces for the name, the script
 * face for the one tagline it is allowed. Shared by the signed-in header and the two
 * unauthenticated screens so the doorway and the room match.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/anuva-logo-icon.png"
        alt=""
        className="h-10 w-10 shrink-0 object-contain"
        aria-hidden
      />
      <div className="min-w-0">
        <div className="truncate font-display text-[17px] font-medium leading-tight tracking-[0.01em] text-primary">
          Anuva Family
        </div>
        <p className="font-script text-[14px] leading-tight text-secondary">a soft place to land.</p>
      </div>
    </div>
  );
}
