import { privacyContent } from '../data/dummy';
import { Card, PageIntro, SectionLabel } from '../shell/ui';

function ListCard({ items, check }: { items: readonly string[]; check?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <ul>
        {items.map((item, index) => (
          <li
            key={item}
            className={`flex min-h-[48px] items-start gap-3 px-5 py-3.5 text-[14.5px] leading-snug text-on-surface ${
              index < items.length - 1 ? 'border-b border-border-default' : ''
            }`}
          >
            {check ? (
              <span className="mt-0.5 text-success" aria-hidden>
                ✓
              </span>
            ) : (
              <span className="mt-0.5 text-outline" aria-hidden>
                ·
              </span>
            )}
            <span className="font-medium">{item.replace(/\s*✓\s*$/, '')}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PrivacyRoute() {
  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow={privacyContent.eyebrow}
        title={privacyContent.title}
        subline={privacyContent.subline}
      />

      <section>
        <SectionLabel>{privacyContent.sharedLabel}</SectionLabel>
        <ListCard items={privacyContent.shared} check />
      </section>

      <section>
        <SectionLabel>{privacyContent.privateLabel}</SectionLabel>
        <ListCard items={privacyContent.privateItems} />
      </section>
    </div>
  );
}
