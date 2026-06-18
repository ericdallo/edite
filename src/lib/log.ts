/**
 * Lightweight console logger. ffmpeg lines go to console.debug (enable "Verbose"
 * in Chrome devtools to see them live); stages and failures are logged loudly so
 * a failed export is always diagnosable from the console.
 */
const TAG = '%c edite ';
const TAG_STYLE = 'background:#8b5cf6;color:#fff;border-radius:4px;font-weight:600';

export const logger = {
  info: (...args: unknown[]) => console.info(TAG, TAG_STYLE, ...args),
  warn: (...args: unknown[]) => console.warn(TAG, TAG_STYLE, ...args),
  error: (...args: unknown[]) => console.error(TAG, TAG_STYLE, ...args),
  group: (label: string) => console.groupCollapsed(TAG, TAG_STYLE, label),
  groupEnd: () => console.groupEnd(),
  ffmpeg: (line: string) => console.debug('%c ffmpeg ', 'background:#22d3ee;color:#04222b', line),
};
