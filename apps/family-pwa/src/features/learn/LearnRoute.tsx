import { learnContent } from '../data/dummy';
import { Card, PageIntro, SectionLabel } from '../shell/ui';

export function LearnRoute() {
  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow={learnContent.eyebrow}
        title={learnContent.title}
        subline={learnContent.subline}
      />

      <Card className="overflow-hidden bg-secondary-container/50 px-5 py-5">
        <SectionLabel>{learnContent.nudge.label}</SectionLabel>
        <h2 className="font-display text-[22px] leading-[1.2] text-on-surface">
          {learnContent.nudge.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {learnContent.nudge.body}
        </p>
      </Card>

      <Card className="px-5 py-5">
        <SectionLabel>{learnContent.tip.label}</SectionLabel>
        <h2 className="font-display text-[18px] leading-snug text-on-surface">
          {learnContent.tip.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {learnContent.tip.body}
        </p>
      </Card>

      <section>
        <SectionLabel>{learnContent.topicsLabel}</SectionLabel>
        <Card className="overflow-hidden">
          <ul>
            {learnContent.topics.map((topic, index) => (
              <li
                key={topic}
                className={`flex min-h-[52px] items-center justify-between gap-3 px-5 py-3.5 text-[14.5px] text-on-surface ${
                  index < learnContent.topics.length - 1 ? 'border-b border-border-default' : ''
                }`}
              >
                <span className="font-medium leading-snug">{topic}</span>
                <span className="text-outline" aria-hidden>
                  ›
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
