import type { Ref } from 'react';
import { site } from '../content/site';
import { Readouts } from './Readouts';

/**
 * Fixed instrument chrome over the whole fall: observation label + current
 * chapter (top-left), handle + live readouts (top-right).
 */
export function Frame({ chapterRef }: { chapterRef: Ref<HTMLSpanElement> }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-5 md:px-10 md:pt-8">
      <p className="label leading-[1.9] text-ink-2">
        Event Horizon
        <br />
        <span className="text-ink-3" ref={chapterRef} aria-live="off">
          I · Approach
        </span>
      </p>
      <div className="flex flex-col items-end gap-10 md:gap-14">
        <p className="label text-ink-2">@{site.handle}</p>
        <Readouts className="scrim" />
      </div>
    </div>
  );
}
