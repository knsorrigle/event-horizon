import { useEffect, useRef } from 'react';
import { getEngine, getRenderMode } from '../engine/engineStore';
import { onTick } from '../loop/ticker';

/** True when the page was opened with ?debug (works in production builds). */
export const debugEnabled = new URLSearchParams(window.location.search).has('debug');

/** Hidden instrument panel: fps, adaptive quality rung, resolution, steps. */
export function DebugPanel() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let acc = Infinity;
    return onTick((_t, dms) => {
      acc += dms;
      if (acc < 250 || !ref.current) return;
      acc = 0;
      const e = getEngine();
      const mode = getRenderMode();
      if (!e) {
        ref.current.textContent = `mode     ${mode}`;
        return;
      }
      const s = e.stats;
      ref.current.textContent = [
        `mode     ${mode}`,
        `fps      ${s.fps.toFixed(1)}  (${e.quality.frameMs.toFixed(1)} ms avg)`,
        `quality  ${s.qualityLevel + 1}/${e.quality.levels}`,
        `scale    ${s.renderScale.toFixed(2)}× dpr`,
        `march    ${s.marchWidth}×${s.marchHeight}`,
        `steps    ${s.maxSteps}`,
        `r        ${e.cameraRadius.toFixed(3)} Rs`,
      ].join('\n');
    });
  }, []);

  return <pre ref={ref} aria-hidden="true" className="debug-panel" />;
}
