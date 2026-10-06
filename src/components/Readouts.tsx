import { useEffect, useRef } from 'react';
import { getEngine } from '../engine/engineStore';
import { params } from '../engine/params';
import { staticRedshift, timeDilation } from '../engine/physics';
import { onTick } from '../loop/ticker';

/**
 * Instrument readouts computed from the live camera radius. Written straight
 * into text nodes ~10×/s; React never re-renders for them.
 */
export function Readouts({ className = '' }: { className?: string }) {
  const rRef = useRef<HTMLSpanElement>(null);
  const tRef = useRef<HTMLSpanElement>(null);
  const zRef = useRef<HTMLSpanElement>(null);
  const iRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let acc = Infinity;
    return onTick((_t, dms) => {
      acc += dms;
      if (acc < 100) return;
      acc = 0;
      const r = getEngine()?.cameraRadius ?? params.camera.distance;
      if (rRef.current) rRef.current.textContent = r.toFixed(2);
      if (tRef.current) tRef.current.textContent = timeDilation(r).toFixed(4);
      if (zRef.current) zRef.current.textContent = staticRedshift(r).toFixed(4);
      if (iRef.current) iRef.current.textContent = (90 - params.camera.elevationDeg).toFixed(1);
    });
  }, []);

  return (
    <dl className={`readouts ${className}`}>
      <div>
        <dt>r</dt>
        <dd>
          <span ref={rRef}>40.00</span> R<sub>s</sub>
        </dd>
      </div>
      <div>
        <dt>t_dilation</dt>
        <dd ref={tRef}>1.0127</dd>
      </div>
      <div>
        <dt>z</dt>
        <dd ref={zRef}>0.0127</dd>
      </div>
      <div>
        <dt>i</dt>
        <dd>
          <span ref={iRef}>83.5</span>°
        </dd>
      </div>
    </dl>
  );
}
