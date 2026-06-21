/**
 * True when SharedArrayBuffer is usable — i.e. the page is cross-origin isolated
 * — so the multi-thread ffmpeg core can run. Pure (takes the global to test) so
 * the loader's choice is unit-testable. Without isolation the caller falls back
 * to the single-thread core, leaving behaviour unchanged.
 */
export function multiThreadAvailable(
  g: { crossOriginIsolated?: boolean; SharedArrayBuffer?: unknown } = globalThis,
): boolean {
  return g.crossOriginIsolated === true && typeof g.SharedArrayBuffer !== 'undefined';
}
