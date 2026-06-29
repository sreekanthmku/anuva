type StepDotsProps = {
  total: number;
  current: number;
};

export function StepDots({ total, current }: StepDotsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        const isDone = index < current;

        return (
          <div
            key={index}
            className="h-1.5 rounded-full transition-all duration-200"
            style={{
              width: isActive ? 22 : 6,
              backgroundColor: isActive ? '#C97E92' : isDone ? '#5E3566' : 'rgba(62, 37, 66,0.12)',
            }}
          />
        );
      })}
    </div>
  );
}
