import { describe, expect, it } from 'vitest';
import {
  buildExportCommand,
  extFromMime,
  type BuiltCommand,
  type MultiExportParams,
} from '@/lib/ffmpeg/command';
import { DEFAULT_TEXT_STYLE } from '@/types/editor';
import { makeExportClip } from '@/test/factories';
import type { ExportClip } from '@/lib/ffmpeg/command';

function build(clips: ExportClip[], over: Partial<MultiExportParams> = {}): BuiltCommand {
  const names = clips.map((_, i) => `in_${i}.mp4`);
  return buildExportCommand(names, {
    canvasW: 1920,
    canvasH: 1080,
    fps: 30,
    duration: 6,
    clips,
    format: 'mp4',
    quality: 'high',
    globalMuted: false,
    background: '#000000',
    ...over,
  });
}

const graphOf = (cmd: BuiltCommand) => cmd.args[cmd.args.indexOf('-filter_complex') + 1];
const strOf = (cmd: BuiltCommand) => cmd.args.join(' ');

describe('extFromMime', () => {
  it('maps known container/image mime types', () => {
    expect(extFromMime('video/webm')).toBe('webm');
    expect(extFromMime('video/quicktime')).toBe('mov');
    expect(extFromMime('video/x-matroska')).toBe('mkv');
    expect(extFromMime('image/png')).toBe('png');
    expect(extFromMime('image/jpeg')).toBe('jpg');
  });

  it('falls back to mp4 for unknown types', () => {
    expect(extFromMime('application/octet-stream')).toBe('mp4');
    expect(extFromMime('')).toBe('mp4');
  });
});

describe('buildExportCommand inputs', () => {
  it('loops images with a framerate and duration; videos are plain inputs', () => {
    const img = build([makeExportClip({ kind: 'image', start: 0, in: 0, out: 5 })]);
    expect(strOf(img)).toContain('-loop 1 -framerate 30 -t 5.000 -i in_0.mp4');

    const vid = build([makeExportClip({ kind: 'video' })]);
    expect(strOf(vid)).not.toContain('-loop');
    expect(strOf(vid)).toContain('-i in_0.mp4');
  });
});

describe('buildExportCommand text', () => {
  it('loops a text overlay like a still and gates it to its window', () => {
    const cmd = build([
      makeExportClip({ kind: 'text', start: 0, in: 0, out: 4, hasAudio: false, text: DEFAULT_TEXT_STYLE }),
    ]);
    expect(strOf(cmd)).toContain('-loop 1 -framerate 30 -t 4.000 -i in_0.mp4');
    expect(graphOf(cmd)).toContain("enable='between(t,0.000,4.000)'");
    expect(strOf(cmd)).toContain('-an');
  });
});

describe('buildExportCommand video graph', () => {
  it('lays a background canvas at the requested size and fps', () => {
    expect(graphOf(build([makeExportClip()]))).toContain('color=c=0x000000:s=1920x1080:r=30');
  });

  it('uses the chosen background color', () => {
    expect(graphOf(build([makeExportClip()], { background: '#22d3ee' }))).toContain('color=c=0x22d3ee');
  });

  it('applies flips and rotation before the scale, only when set', () => {
    expect(graphOf(build([makeExportClip({ flipH: true })]))).toContain('hflip,scale=');
    expect(graphOf(build([makeExportClip({ flipV: true })]))).toContain('vflip,scale=');
    expect(graphOf(build([makeExportClip({ rotation: 90 })]))).toContain('transpose=1,scale=');
    expect(graphOf(build([makeExportClip({ rotation: 270 })]))).toContain('transpose=2,scale=');
    const plain = graphOf(build([makeExportClip()]));
    expect(plain).not.toContain('hflip');
    expect(plain).not.toContain('transpose');
  });

  it('gates each clip to its timeline window and holds the last frame at the edge', () => {
    const cmd = build([makeExportClip({ kind: 'video', start: 2, in: 0, out: 4, speed: 1 })]);
    expect(graphOf(cmd)).toContain("enable='between(t,2.000,6.000)':eof_action=repeat");
  });

  it('shifts a clip PTS to its start so overlay frames line up', () => {
    expect(graphOf(build([makeExportClip({ kind: 'video', start: 2, in: 0, out: 4, speed: 1 })]))).toContain(
      'setpts=PTS-STARTPTS+2.000/TB',
    );
  });

  it('divides PTS by speed for sped-up clips', () => {
    expect(graphOf(build([makeExportClip({ kind: 'video', start: 0, speed: 2 })]))).toContain(
      'setpts=(PTS-STARTPTS)/2',
    );
  });

  it('applies an opacity mixer only when opacity < 1', () => {
    expect(graphOf(build([makeExportClip({ opacity: 0.5 })]))).toContain('colorchannelmixer=aa=0.500');
    expect(graphOf(build([makeExportClip({ opacity: 1 })]))).not.toContain('colorchannelmixer');
  });
});

describe('buildExportCommand audio', () => {
  it('delays and mixes audio from each unmuted clip', () => {
    const cmd = build([
      makeExportClip({ start: 0, hasAudio: true }),
      makeExportClip({ start: 5, hasAudio: true }),
    ]);
    const g = graphOf(cmd);
    expect(g).toContain('adelay=');
    expect(g).toContain('amix=inputs=2');
    expect(strOf(cmd)).toContain('-map [aout]');
    expect(strOf(cmd)).toContain('-c:a aac');
  });

  it('time-stretches audio for non-1x clips', () => {
    expect(graphOf(build([makeExportClip({ speed: 2, hasAudio: true })]))).toContain('atempo');
    expect(graphOf(build([makeExportClip({ speed: 1, hasAudio: true })]))).not.toContain('atempo');
  });

  it('omits audio for muted clips, global mute, and gif', () => {
    expect(strOf(build([makeExportClip({ muted: true })]))).toContain('-an');
    expect(strOf(build([makeExportClip()], { globalMuted: true }))).toContain('-an');
    const gif = build([makeExportClip()], { format: 'gif' });
    expect(strOf(gif)).toContain('-an');
    expect(gif.mime).toBe('image/gif');
    expect(gif.outputName).toBe('output.gif');
  });

  it('skips clips that report no audio stream', () => {
    expect(graphOf(build([makeExportClip({ hasAudio: false })]))).not.toContain('amix');
  });
});

describe('buildExportCommand per-clip audio', () => {
  it('applies a volume gain only when it differs from 1', () => {
    expect(graphOf(build([makeExportClip({ volume: 1.5 })]))).toContain('volume=1.500');
    expect(graphOf(build([makeExportClip({ volume: 0.2 })]))).toContain('volume=0.200');
    expect(graphOf(build([makeExportClip({ volume: 1 })]))).not.toContain('volume=');
  });

  it('adds fade-in and fade-out over the clip timeline length', () => {
    const g = graphOf(build([makeExportClip({ in: 0, out: 5, speed: 1, fadeIn: 1, fadeOut: 2 })]));
    expect(g).toContain('afade=t=in:st=0:d=1.000');
    expect(g).toContain('afade=t=out:st=3.000:d=2.000');
  });

  it('positions the fade-out using the post-speed length', () => {
    // out-in = 4 at 2x => 2s on the timeline; a 0.5s fade-out starts at 1.5s.
    const g = graphOf(build([makeExportClip({ in: 0, out: 4, speed: 2, fadeOut: 0.5 })]));
    expect(g).toContain('afade=t=out:st=1.500:d=0.500');
  });

  it('omits fades when they are zero', () => {
    expect(graphOf(build([makeExportClip({ fadeIn: 0, fadeOut: 0 })]))).not.toContain('afade');
  });
});

describe('buildExportCommand audio-only clips', () => {
  it('contributes audio but no video overlay', () => {
    const cmd = build([makeExportClip({ kind: 'audio', hasAudio: true })]);
    const g = graphOf(cmd);
    expect(g).toContain('[0:a]atrim=');
    expect(g).not.toContain('overlay=');
    expect(strOf(cmd)).toContain('-map [vout]');
    expect(strOf(cmd)).toContain('-map [aout]');
  });

  it('uses a plain (non-looped) input for audio', () => {
    const s = strOf(build([makeExportClip({ kind: 'audio' })]));
    expect(s).toContain('-i in_0.mp4');
    expect(s).not.toContain('-loop');
  });

  it('mixes an audio-only clip alongside a video clip', () => {
    const cmd = build([
      makeExportClip({ kind: 'video', start: 0, hasAudio: true }),
      makeExportClip({ kind: 'audio', start: 0, hasAudio: true }),
    ]);
    const g = graphOf(cmd);
    expect(g).toContain('overlay='); // the video clip still composites
    expect(g).toContain('[1:a]atrim='); // the audio clip still sounds
    expect(g).toContain('amix=inputs=2');
  });
});

describe('buildExportCommand codecs', () => {
  it('uses libx264 + faststart for mp4', () => {
    const s = strOf(build([makeExportClip()], { format: 'mp4' }));
    expect(s).toContain('-c:v libx264');
    expect(s).toContain('-pix_fmt yuv420p');
    expect(s).toContain('-movflags +faststart');
    expect(s).toContain('-map [vout]');
  });

  it('uses vp9 + opus for webm', () => {
    const s = strOf(build([makeExportClip({ hasAudio: true })], { format: 'webm' }));
    expect(s).toContain('-c:v libvpx-vp9');
    expect(s).toContain('-c:a libopus');
  });
});
