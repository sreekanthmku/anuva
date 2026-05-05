import { BottomNav } from './components/BottomNav';

type PlaceholderCoreRouteProps = {
  title: string;
  subtitle: string;
};

export default function PlaceholderCoreRoute({ title, subtitle }: PlaceholderCoreRouteProps) {
  return (
    <main className="min-h-mobile flex flex-col bg-surface px-6 pb-28 pt-10 text-on-surface">
      <section className="flex-1">
        <h1
          className="text-[34px] leading-[1.1] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontVariationSettings: '"opsz" 144' }}
        >
          {title}
        </h1>
        <p className="mt-3 text-[14px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          {subtitle}
        </p>
      </section>

      <BottomNav />
    </main>
  );
}

