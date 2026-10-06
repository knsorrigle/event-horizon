import { useLayoutEffect } from 'react';
import { Link } from '../app/router';
import { projects } from '../content/projects';
import { parkRig, resetRig } from '../scroll/rig';

// Phase 4 builds the real case-study layout; this stub proves the route and
// parks the camera beside the project's body (also on a direct page load).
export function Work({ slug }: { slug: string }) {
  const index = projects.findIndex((p) => p.slug === slug);
  const project = projects[index];

  useLayoutEffect(() => {
    if (index < 0) return;
    parkRig(index);
    return () => resetRig();
  }, [index]);

  if (!project) return <NotFound />;

  return (
    <main id="main" className="flex min-h-svh flex-col justify-between px-5 py-6 md:px-10 md:py-9">
      <Link href="/" className="label text-ink-2 hover:text-ink-1">
        ← Back to orbit
      </Link>
      <div className="scrim">
        <h1 className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.85] font-light text-ink-1">{project.name}</h1>
        <p className="mt-4 max-w-[40ch] font-display text-[1.25rem] font-light text-ink-2">{project.oneLiner}</p>
      </div>
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
