import { toggleSound, useSoundState } from '../audio';

/**
 * The persistent sound switch, top centre on every route (under the handle on
 * phones, where the centre is too narrow): a small animated waveform when
 * sound is on, a flat line when off, with a SOUND ON / OFF label
 * so the state reads without decoding the icon. A real button with
 * aria-pressed, so it works from the keyboard (the state word is hidden from
 * assistive tech, which gets it from aria-pressed instead).
 */
export function SoundToggle() {
  const state = useSoundState();
  const on = state !== 'off';
  const label = state === 'on' ? 'Sound on' : state === 'armed' ? 'Sound on (starts on your next click)' : 'Sound off';

  return (
    <button
      type="button"
      data-sound-control
      aria-pressed={on}
      title={label}
      onClick={toggleSound}
      className={`sound-toggle fixed top-[38px] right-3 z-20 flex cursor-pointer items-center gap-2.5 p-2 md:top-7 md:right-auto md:left-1/2 md:-translate-x-1/2 ${state === 'on' ? 'is-on' : ''} ${state === 'armed' ? 'is-armed' : ''}`}
    >
      <span className="sound-toggle__text label whitespace-nowrap">
        Sound <span aria-hidden="true" className="sound-toggle__state">{on ? 'on' : 'off'}</span>
      </span>
      <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
        <line x1="0" y1="6" x2="26" y2="6" className="sound-toggle__flat" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={1 + i * 5} y="0" width="2" height="12" rx="1" style={{ animationDelay: `${i * -0.23}s` }} />
        ))}
      </svg>
    </button>
  );
}
