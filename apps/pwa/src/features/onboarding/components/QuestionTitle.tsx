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
          fontFamily: '"Fraunces", sans-serif',
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        {lastWord}
      </em>
    </>
  );
}
