type BookingEyebrowProps = {
  children: string;
  mint?: boolean;
  /** Lets a radio group below take this as its name. */
  id?: string;
};

export function BookingEyebrow({ children, mint = false, id }: BookingEyebrowProps) {
  return (
    <div
      id={id}
      className={`mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${mint ? 'text-primary' : 'text-outline'}`}
    >
      <span aria-hidden="true" className={`h-px w-3 ${mint ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Mulish", sans-serif' }}>{children}</span>
    </div>
  );
}
