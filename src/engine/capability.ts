// Decide up front whether this device should get the live renderer or the
// static fallback (same DOM, a pre-rendered image behind it).

interface ConnectionInfo {
  saveData?: boolean;
}

export type FallbackReason = 'forced' | 'save-data' | 'no-webgl2' | 'software-renderer' | 'no-float-targets';

export function fallbackReason(): FallbackReason | null {
  if (new URLSearchParams(window.location.search).has('fallback')) return 'forced';

  const conn = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
  if (conn?.saveData) return 'save-data';

  // A context type can be requested only once per canvas, hence two canvases.
  if (!document.createElement('canvas').getContext('webgl2')) return 'no-webgl2';
  // failIfMajorPerformanceCaveat refuses software rasterisers (SwiftShader,
  // llvmpipe): a raymarcher there would run at single-digit fps.
  const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  if (!gl) return 'software-renderer';
  // The pipeline renders HDR into half-float targets.
  const floatTargets = gl.getExtension('EXT_color_buffer_half_float') ?? gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (!floatTargets) return 'no-float-targets';
  return null;
}
