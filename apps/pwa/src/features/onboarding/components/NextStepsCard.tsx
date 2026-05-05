type NextStepsCardProps = {
  steps: [string, string][];
};

export function NextStepsCard({ steps }: NextStepsCardProps) {
  return (
    <article className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[22px]">
      <div className="mb-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
        <span className="h-px w-3 bg-primary/60" />
        <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>What happens next</span>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <div key={step[0]} className="flex items-start gap-3.5">
            <span
              className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-primary bg-primary/15 text-[12px] text-primary"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="pt-0.5">
              <p className="text-[14px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {step[0]}
              </p>
              <p className="mt-0.5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {step[1]}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
