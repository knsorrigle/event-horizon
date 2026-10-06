import type { ReactNode } from 'react';
import type { MediaItem } from '../content/projects';

/**
 * Retro scientific data panel: hairline frame with corner ticks and a header
 * strip of tiny mono metadata, like a satellite-imaging printout.
 */
export function Panel({ code, title, aside, children, className = '' }: { code: string; title: string; aside?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="panel-head">
        <span>
          {code} · {title}
        </span>
        {aside && <span>{aside}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/** Missing content: an em dash in production, a visible TODO in dev. */
export function Pending({ what }: { what: string }) {
  return import.meta.env.DEV ? <span className="pending">[TODO: {what}]</span> : <span>—</span>;
}

export function SpecList({ rows }: { rows: readonly { k: string; v: ReactNode }[] }) {
  return (
    <dl className="spec">
      {rows.map((r) => (
        <div key={r.k}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A media plate: gridded frame with rulers and a crosshair, caption strip
 * below. Media is lazy and greyscale (the site has no hue). With no media,
 * a "no signal" plate holds the slot.
 */
export function Plate({ index, item }: { index: number; item: MediaItem | undefined }) {
  const fig = `Fig. ${String(index).padStart(2, '0')}`;
  const w = item?.width ?? 1600;
  const h = item?.height ?? 1000;
  return (
    <figure className="panel plate" data-reveal>
      <header className="panel-head">
        <span>{fig}</span>
        <span>
          {w} × {h}
        </span>
      </header>
      <div className="plate-field" style={{ aspectRatio: `${w} / ${h}` }}>
        {item?.kind === 'image' && <img src={item.src} alt={item.alt} width={w} height={h} loading="lazy" decoding="async" />}
        {item?.kind === 'video' && (
          <video src={item.src} poster={item.poster} width={w} height={h} preload="none" muted loop playsInline controls aria-label={item.alt} />
        )}
        {!item && (
          <p className="plate-empty" aria-hidden="true">
            No signal
          </p>
        )}
        <span className="plate-cross" aria-hidden="true" />
      </div>
      <figcaption className="panel-foot">
        <span>{fig}</span>
        <span className="flex-1 truncate">{item ? item.caption : <Pending what="media + caption" />}</span>
      </figcaption>
    </figure>
  );
}
