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
      className="flex w-full items-center gap-3.5 rounded-[20px] border px-4 py-3.5 text-left transition-colors"
      style={{
        backgroundColor: isSelected ? '#FFFFFF' : '#EFE4D8',
        borderColor: isSelected ? '#5E3566' : 'rgba(94, 53, 102, 0.2)',
      }}
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
        style={{ borderColor: isSelected ? '#5E3566' : '#B49FB0' }}
      >
        {isSelected && <span className="h-[9px] w-[9px] rounded-full bg-primary" />}
      </span>
      <span
        style={{
          fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
          fontWeight: isSelected ? 500 : 400,
          letterSpacing: '-0.005em',
        }}
        className="text-[14px] text-on-surface"
      >
        {label}
      </span>
    </button>
  );
}
