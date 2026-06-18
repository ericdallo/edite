/** Domain constants shared across the store, timeline and export pipeline. */

/** Shortest allowed clip/source span, in seconds. */
export const MIN_CLIP = 0.06;

/** Default timeline length given to a still image (seconds). */
export const IMAGE_DEFAULT_DUR = 3;

/** Max number of undo checkpoints kept in memory. */
export const HISTORY_LIMIT = 100;

/** Hard bounds for a clip's playback speed multiplier. */
export const CLIP_SPEED_MIN = 0.1;
export const CLIP_SPEED_MAX = 16;

/** Hard bounds for the timeline zoom factor. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 12;

/** Text overlay font size bounds, as a fraction of the canvas height. */
export const TEXT_SIZE_MIN = 0.02;
export const TEXT_SIZE_MAX = 0.4;
