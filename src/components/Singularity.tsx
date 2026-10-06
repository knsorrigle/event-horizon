import { chapters, contact, site } from '../content/site';
import { Pending } from './Panel';
import { lenis } from '../loop/ticker';

/** Keyboard focus on a contact link: bring the (fully revealed) end of the page into view. */
function revealContact(): void {
  if (lenis) lenis.scrollTo(lenis.limit, { immediate: true, force: true });
  else window.scrollTo(0, document.documentElement.scrollHeight);
}

function href(kind: 'email' | 'url' | 'file', value: string): string {
  return kind === 'email' ? `mailto:${value}` : value;
}

function display(kind: 'email' | 'url' | 'file', value: string): string {
  if (kind === 'file') return 'PDF';
  return value.replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/**
 * V · Singularity: past the horizon. A quiet beat of black (handled by the
 * scroll animation), then the contact block emerges and stays.
 */
export function Singularity() {
  const s = chapters.singularity;
  const rows = contact.filter((c) => c.value !== null || import.meta.env.DEV);

  return (
    <section id="singularity" aria-labelledby="contact-title" className="relative h-[230vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <div data-chapter-content className="flex h-full flex-col items-center justify-center px-5 text-center">
          <p data-line className="label mb-6 text-ink-3">
            {s.numeral} · {s.name}
          </p>
          <h2 id="contact-title" data-split className="contact-title">
            {s.headline}
          </h2>
          <p data-line className="mt-5 font-display text-[clamp(1.05rem,1.6vw,1.35rem)] font-light text-ink-2">
            {s.note}
          </p>

          <ul className="contact-list mt-12 w-full max-w-[30rem] text-left">
            {rows.map((c) => (
              <li key={c.label} data-line>
                <span className="label text-ink-3">{c.label}</span>
                {c.value ? (
                  <a
                    href={href(c.kind, c.value)}
                    className="contact-link"
                    onFocus={revealContact}
                    {...(c.kind === 'email' ? {} : { target: '_blank', rel: 'noreferrer' })}
                  >
                    {display(c.kind, c.value)} ↗
                  </a>
                ) : (
                  <Pending what={`${c.label.toLowerCase()} link`} />
                )}
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute inset-x-0 bottom-6 text-center font-mono text-[10px] text-ink-3" aria-hidden="true">
          © {new Date().getFullYear()} {site.name} · r = 1 · t → ∞ · keep falling ↓
        </p>
      </div>
    </section>
  );
}
