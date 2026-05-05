type AnswerOptionProps = {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
};

export function AnswerOption({ label, isSelected, onSelect }: AnswerOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3.5 rounded-starchart-lg border px-4 py-3.5 text-left transition-colors"
      style={{
        backgroundColor: isSelected ? '#2E2A6E' : '#1d1a21',
        borderColor: isSelected ? '#cebdff' : 'rgba(167, 139, 250, 0.2)',
      }}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
        style={{ borderColor: isSelected ? '#cebdff' : '#948e9d' }}
      >
        {isSelected && <span className="h-[9px] w-[9px] rounded-full bg-primary" />}
      </span>
      <span
        style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', fontWeight: isSelected ? 500 : 400, letterSpacing: '-0.005em' }}
        className="text-[14px] text-on-surface"
      >
        {label}
      </span>
    </button>
  );
}

