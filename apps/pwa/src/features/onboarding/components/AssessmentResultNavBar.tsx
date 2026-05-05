type AssessmentResultNavBarProps = {
  onBack: () => void;
};

export function AssessmentResultNavBar({ onBack }: AssessmentResultNavBarProps) {
  return (
    <section className="flex items-center justify-between px-[22px] pb-2.5 pt-0">
      <button
        type="button"
        onClick={onBack}
        className="bg-transparent p-0 text-[13px] text-on-surface-variant"
        style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
      >
        ← Back
      </button>
      <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
    </section>
  );
}
