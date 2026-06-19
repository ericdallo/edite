import type { Clip, MediaItem, Track } from '@/types/editor';
import { clipTransformAt, speedSlices, transitionFades } from '@/lib/timeline';
import type { ExportClip } from './command';

export interface ExportPlan {
  /** Clips flattened bottom -> top, the order ffmpeg composites them in. */
  clips: ExportClip[];
  /** media id per clip, aligned with `clips`. */
  clipMediaIds: string[];
  /** unique media (bytes) referenced by the plan. */
  media: { id: string; blob: Blob }[];
}

/**
 * Turn the editor document into a flat, render-ready plan: visible clips on
 * visible tracks, ordered bottom track -> top track and, within a track, by
 * start time. Hidden tracks/clips and clips whose media is gone are dropped.
 */
export function buildExportPlan(tracks: Track[], clips: Clip[], media: MediaItem[]): ExportPlan {
  const mediaById = new Map(media.map((m) => [m.id, m]));

  const ordered = tracks
    .filter((t) => !t.hidden)
    .flatMap((t) =>
      clips
        .filter((c) => c.trackId === t.id && !c.hidden && (c.text != null || mediaById.has(c.mediaId)))
        .sort((a, b) => a.start - b.start)
        .map((clip) => ({ clip, track: t })),
    );

  // Each entry pairs an export clip with its source media id ('' for text), so a
  // single timeline clip can expand into several inputs (e.g. a speed curve).
  const built = ordered.flatMap(({ clip, track }): { ec: ExportClip; mediaId: string }[] => {
    if (clip.text) {
      return [
        {
          ec: {
            kind: 'text',
            start: clip.start,
            in: clip.in,
            out: clip.out,
            speed: 1,
            rect: clip.rect,
            opacity: clip.opacity,
            hasAudio: false,
            muted: true,
            flipH: false,
            flipV: false,
            rotation: 0,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
            text: clip.text,
            textAnim: clip.textAnim,
          },
          mediaId: '',
        },
      ];
    }
    const m = mediaById.get(clip.mediaId)!;
    const frozen = clip.freeze != null;
    // Audio-only when the media is audio or the clip was detached from its video.
    const audioOnly = m.kind === 'audio' || clip.audioOnly === true;
    // Fold transitions into the audio fades so adjacent clips audibly cross-fade.
    const fades = transitionFades(clips, clip);

    // A speed-curved video clip becomes a run of tiled constant-speed segments;
    // each reuses the normal setpts/atempo path so preview and export match.
    const slices = !frozen && !audioOnly && m.kind === 'video' ? speedSlices(clip) : null;
    const animated = (clip.keyframes?.length ?? 0) >= 2;
    if (slices) {
      const last = slices.length - 1;
      return slices.map((sl, i) => ({
        ec: {
          kind: 'video',
          start: clip.start + sl.tStart,
          in: sl.inStart,
          out: sl.inEnd,
          speed: sl.speed,
          // A speed curve already tiles the clip into segments, so keyframes are
          // sampled per slice (stepped) here rather than expressed continuously.
          rect: animated ? clipTransformAt(clip, clip.start + (sl.tStart + sl.tEnd) / 2).rect : clip.rect,
          opacity: clip.opacity,
          hasAudio: m.hasAudio,
          muted: clip.muted || track.muted,
          flipH: clip.flipH ?? false,
          flipV: clip.flipV ?? false,
          rotation: clip.rotation ?? 0,
          volume: clip.volume ?? 1,
          // Fades belong to the whole clip: ramp in on the first segment, out on the last.
          fadeIn: i === 0 ? fades.fadeIn : 0,
          fadeOut: i === last ? fades.fadeOut : 0,
          color: clip.color,
          chromaKey: clip.chromaKey,
          // The transition (dissolve/dip) attaches to the first segment.
          transition: i === 0 ? clip.transition : undefined,
        },
        mediaId: clip.mediaId,
      }));
    }

    return [
      {
        ec: {
          // A frozen clip renders as a single held frame (a looped image input);
          // audio-only clips contribute sound with no video layer.
          kind: frozen ? 'image' : audioOnly ? 'audio' : m.kind,
          start: clip.start,
          in: clip.in,
          out: clip.out,
          speed: clip.speed,
          rect: clip.rect,
          opacity: clip.opacity,
          hasAudio: m.hasAudio,
          muted: clip.muted || track.muted,
          flipH: clip.flipH ?? false,
          flipV: clip.flipV ?? false,
          rotation: clip.rotation ?? 0,
          volume: clip.volume ?? 1,
          fadeIn: fades.fadeIn,
          fadeOut: fades.fadeOut,
          reversed: clip.reversed,
          freeze: clip.freeze,
          color: clip.color,
          chromaKey: clip.chromaKey,
          transition: clip.transition,
          keyframes: clip.keyframes,
        },
        mediaId: clip.mediaId,
      },
    ];
  });

  const exportClips = built.map((b) => b.ec);
  // '' marks text clips so operations rasterizes a PNG instead of loading media.
  const clipMediaIds = built.map((b) => b.mediaId);
  const usedIds = [...new Set(clipMediaIds.filter((id) => id !== ''))];
  const exportMedia = usedIds.map((id) => ({ id, blob: mediaById.get(id)!.blob }));

  return { clips: exportClips, clipMediaIds, media: exportMedia };
}
