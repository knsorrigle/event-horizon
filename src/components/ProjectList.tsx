import { projects } from '../content/projects';
import { setFocused } from '../engine/interaction';

/**
 * The projects as real, crawlable links. Visually hidden, but focusable:
 * tabbing to one lights its body and shows its annotation; Enter launches the
 * same slingshot a click on the body does. Works with no canvas at all.
 */
export function ProjectList({ onLaunch }: { onLaunch: (index: number) => void }) {
  return (
    <nav aria-label="Projects" className="sr-only">
      <h3>Projects</h3>
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
