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

/** Max per-clip audio gain (2 = +100% boost). Preview caps at 1.0; export applies the full gain. */
export const CLIP_VOLUME_MAX = 2;

/** Longest audio fade in/out, in seconds (also bounded by the clip's length). */
export const AUDIO_FADE_MAX = 5;

/** Default hold length for an inserted freeze frame (seconds). */
export const FREEZE_DEFAULT_DUR = 2;

/**
 * A clip's speed curve is realised as this many constant-speed slices (for the
 * timeline integral, preview, and export segmentation). More = smoother ramps
 * but more ffmpeg segments on export.
 */
export const SPEED_CURVE_SLICES = 12;

/** Hard bounds for the timeline zoom factor. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 12;

/** Text overlay font size bounds, as a fraction of the canvas height. */
export const TEXT_SIZE_MIN = 0.02;
export const TEXT_SIZE_MAX = 0.4;

/** Public site (served from the custom domain) and source repository. */
export const SITE_URL = 'https://edite.video';
export const REPO_URL = 'https://github.com/ericdallo/edite';
