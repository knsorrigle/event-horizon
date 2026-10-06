import { toggleSound, useSoundState } from '../audio';

/**
 * The persistent sound switch, top centre on every route: a small animated
 * waveform when sound is on, a flat line when off. A real button with
 * aria-pressed, so it works from the keyboard.
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
      aria-label="Sound"
      title={label}
      onClick={toggleSound}
      className={`sound-toggle fixed top-4 left-1/2 z-20 -translate-x-1/2 cursor-pointer p-2 md:top-7 ${state === 'on' ? 'is-on' : ''} ${state === 'armed' ? 'is-armed' : ''}`}
    >
      <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
        <line x1="0" y1="6" x2="26" y2="6" className="sound-toggle__flat" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={1 + i * 5} y="0" width="2" height="12" rx="1" style={{ animationDelay: `${i * -0.23}s` }} />
        ))}
      </svg>
    </button>
  );
}
