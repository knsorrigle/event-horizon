import { Link } from '../app/router';

// Phase 4 builds the real case-study layout; this stub proves the route.
export function Work({ slug }: { slug: string }) {
  return (
    <main id="main" className="flex min-h-svh flex-col justify-between px-5 py-6 md:px-10 md:py-9">
      <Link href="/" className="label text-ink-2 hover:text-ink-1">
        ← Back to orbit
      </Link>
      <h1 className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.85] font-light text-ink-1">{slug}</h1>
    </main>
  );
}

export function NotFound() {
  return (
    <main id="main" className="flex min-h-svh flex-col justify-between px-5 py-6 md:px-10 md:py-9">
      <Link href="/" className="label text-ink-2 hover:text-ink-1">
        ← Back to orbit
      </Link>
      <h1 className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.85] font-light text-ink-1">
        Nothing escapes here.
      </h1>
    </main>
  );
}
