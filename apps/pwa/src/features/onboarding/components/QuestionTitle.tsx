type QuestionTitleProps = {
  prompt: string;
};

export function QuestionTitle({ prompt }: QuestionTitleProps) {
  const words = prompt.split(' ');
  const lastWord = words.pop();
  const leadingWords = words.join(' ');

  return (
    <>
      {leadingWords}{' '}
      <em
        className="not-italic text-primary"
        style={{
          fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
          fontStyle: 'italic',
          fontWeight: 400,
          fontVariationSettings: '"opsz" 144',
          letterSpacing: '-0.02em',
        }}
      >
        {lastWord}
      </em>
    </>
  );
}
