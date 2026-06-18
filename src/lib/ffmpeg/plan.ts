import type { Clip, MediaItem, Track } from '@/types/editor';
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

  const exportClips: ExportClip[] = ordered.map(({ clip, track }) => {
    if (clip.text) {
      return {
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
        text: clip.text,
      };
    }
    const m = mediaById.get(clip.mediaId)!;
    return {
      kind: m.kind,
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
    };
  });

  // Text clips have no source media; '' marks them so operations rasterizes a PNG instead.
  const clipMediaIds = ordered.map(({ clip }) => (clip.text ? '' : clip.mediaId));
  const usedIds = [...new Set(clipMediaIds.filter((id) => id !== ''))];
  const exportMedia = usedIds.map((id) => ({ id, blob: mediaById.get(id)!.blob }));

  return { clips: exportClips, clipMediaIds, media: exportMedia };
}
