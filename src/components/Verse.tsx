/** A short stacked uppercase caption block, like a print's margin note. */
export function Verse({ lines, index, className = '' }: { lines: readonly string[]; index: string; className?: string }) {
  return (
    <div className={`verse tidal ${className}`}>
      <p className="mb-3 font-mono text-[10px] text-ink-3" data-line aria-hidden="true">
        {index}
      </p>
      <p className="label leading-[2] text-ink-2">
        {lines.map((line, i) => (
          <span key={i} className="block" data-line>
            {/* trailing space so screen readers don't run lines together */}
            {line}{' '}
          </span>
        ))}
      </p>
    </div>
  );
}
