import { FULL_RECT, type Clip, type MediaItem, type Track } from '@/types/editor';
import type { ExportClip } from '@/lib/ffmpeg/command';

let seq = 0;
const nextId = (prefix: string) => `${prefix}${++seq}`;

export function makeMedia(over: Partial<MediaItem> = {}): MediaItem {
  const id = over.id ?? nextId('m');
  return {
    id,
    kind: 'video',
    fileName: `${id}.mp4`,
    mimeType: 'video/mp4',
    size: 1024,
    duration: 10,
    width: 1920,
    height: 1080,
    hasAudio: true,
    url: `blob:${id}`,
    blob: new Blob(['x'], { type: 'video/mp4' }),
    ...over,
  };
}

export function makeTrack(over: Partial<Track> = {}): Track {
  const id = over.id ?? nextId('t');
  return { id, name: id, hidden: false, muted: false, ...over };
}

export function makeClip(over: Partial<Clip> = {}): Clip {
  const id = over.id ?? nextId('c');
  return {
    id,
    mediaId: 'm1',
    trackId: 't1',
    start: 0,
    in: 0,
    out: 10,
    speed: 1,
    rect: { ...FULL_RECT },
    opacity: 1,
    muted: false,
    hidden: false,
    flipH: false,
    flipV: false,
    rotation: 0,
    ...over,
  };
}

export function makeExportClip(over: Partial<ExportClip> = {}): ExportClip {
  return {
    kind: 'video',
    start: 0,
    in: 0,
    out: 5,
    speed: 1,
    rect: { ...FULL_RECT },
    opacity: 1,
    hasAudio: true,
    muted: false,
    flipH: false,
    flipV: false,
    rotation: 0,
    ...over,
  };
}
