import { projects } from '../content/projects';
import { setFocused } from '../engine/interaction';

/**
 * The projects as real, crawlable links. Visually hidden, but focusable:
 * tabbing to one lights its body and shows its annotation; Enter launches the
 * same slingshot a click on the body does. Works with no canvas at all.
 */
export function ProjectList({ onLaunch }: { onLaunch: (index: number) => void }) {
  return (
    <nav aria-label="Projects" className="sr-sticky">
      <h2>Projects</h2>
      <ul>
        {projects.map((p, i) => (
          <li key={p.slug}>
            <a
              href={`/work/${p.slug}`}
              onFocus={() => setFocused(i + 1)}
              onBlur={() => setFocused(0)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onLaunch(i);
              }}
            >
              {p.name}: {p.oneLiner}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Static-fallback index: with no orbiting bodies to click, the projects are
 * listed visibly. Mouse-only duplicate of ProjectList (which keeps serving
 * keyboard and assistive tech), so it's hidden from both.
 */
export function ProjectIndex({ onLaunch }: { onLaunch: (index: number) => void }) {
  return (
    <ol className="project-index w-full max-w-[34rem]" aria-hidden="true">
      {projects.map((p, i) => (
        <li key={p.slug} data-line>
          <a
            href={`/work/${p.slug}`}
            tabIndex={-1}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onLaunch(i);
            }}
          >
            <span className="font-mono text-[10px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
            <span className="font-display text-[clamp(1.4rem,2.2vw,2rem)] leading-none text-ink-1">{p.name}</span>
            <span className="hidden font-display text-[0.95rem] font-light text-ink-2 md:block">{p.oneLiner}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
