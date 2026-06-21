import { describe, expect, it } from 'vitest';
import {
  buildExportCommand,
  extFromMime,
  type BuiltCommand,
  type MultiExportParams,
} from '@/lib/ffmpeg/command';
import { DEFAULT_TEXT_STYLE, type TextAnim } from '@/types/editor';
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
    audioBitrate: 192,
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

  it('injects an eq/hue chain for a colored clip and nothing for a neutral one', () => {
    const g = graphOf(
      build([makeExportClip({ color: { brightness: 1.2, contrast: 1.1, saturation: 0.8, hue: 12 } })]),
    );
    expect(g).toContain('eq=brightness=0.200:contrast=1.100:saturation=0.800');
    expect(g).toContain('hue=h=12.00');
    expect(graphOf(build([makeExportClip()]))).not.toContain('eq=');
  });

  it('injects a chromakey filter for a keyed clip and nothing for an un-keyed one', () => {
    const g = graphOf(build([makeExportClip({ chromaKey: { color: '#00ff00', similarity: 0.3, blend: 0.1 } })]));
    expect(g).toContain('chromakey=0x00ff00:0.300:0.100');
    expect(graphOf(build([makeExportClip()]))).not.toContain('chromakey');
  });
});

describe('buildExportCommand grade intensity', () => {
  const colored = (intensity?: number) =>
    makeExportClip({ color: { brightness: 1.2, contrast: 1, saturation: 1, hue: 0, intensity } });

  it('keeps a linear chain at full strength', () => {
    const g = graphOf(build([colored(1)]));
    expect(g).toContain('eq=brightness=0.200');
    expect(g).not.toContain('split=2');
    expect(g).not.toContain('blend=all_expr');
  });

  it('splits and blends the grade over the original at partial strength', () => {
    const g = graphOf(build([colored(0.5)]));
    expect(g).toContain('split=2');
    expect(g).toContain("blend=all_expr='A*0.500+B*0.500'");
    expect(g).toContain('eq=brightness=0.200'); // graded on the split branch
  });

  it('drops the grade entirely at zero strength', () => {
    const g = graphOf(build([colored(0)]));
    expect(g).not.toContain('eq=');
    expect(g).not.toContain('blend=all_expr');
  });
});

describe('buildExportCommand LUT looks', () => {
  it('appends a lut3d node for a look and nothing for a plain clip', () => {
    const g = graphOf(
      build([makeExportClip({ color: { brightness: 1, contrast: 1, saturation: 1, hue: 0, lut: 'cinematic' } })]),
    );
    expect(g).toContain('lut3d=lut_cinematic.cube');
    expect(graphOf(build([makeExportClip()]))).not.toContain('lut3d');
  });

  it('blends a LUT over the original at partial intensity', () => {
    const g = graphOf(
      build([
        makeExportClip({ color: { brightness: 1, contrast: 1, saturation: 1, hue: 0, lut: 'noir', intensity: 0.5 } }),
      ]),
    );
    expect(g).toContain('lut3d=lut_noir.cube');
    expect(g).toContain('split=2');
    expect(g).toContain("blend=all_expr='A*0.500+B*0.500'");
  });
});

describe('buildExportCommand reverse', () => {
  it('reverses both video and audio for a reversed clip', () => {
    const g = graphOf(build([makeExportClip({ kind: 'video', reversed: true, hasAudio: true })]));
    expect(g).toContain('reverse,setpts=');
    expect(g).toContain('areverse,asetpts=');
  });

  it('leaves a normal clip with no reverse filters', () => {
    const g = graphOf(build([makeExportClip({ kind: 'video', hasAudio: true })]));
    expect(g).not.toContain('reverse');
  });
});

describe('buildExportCommand text animation', () => {
  const textClip = (textAnim?: TextAnim) =>
    makeExportClip({ kind: 'text', start: 0, in: 0, out: 4, hasAudio: false, text: DEFAULT_TEXT_STYLE, textAnim });

  it('fades text in and out over the ramps', () => {
    const g = graphOf(build([textClip({ in: 'fade', out: 'fade', duration: 0.4 })]));
    expect(g).toContain('fade=t=in:st=0.000:d=0.400:alpha=1');
    expect(g).toContain('fade=t=out:st=3.600:d=0.400:alpha=1');
  });

  it('offsets the overlay position for a slide animation', () => {
    const g = graphOf(build([textClip({ in: 'slideUp', out: null, duration: 0.5 })]));
    expect(g).toContain("y='");
    expect(g).toContain('(1-clip((t-0.000)/0.500,0,1))');
  });

  it('adds no fade for a text clip without animation', () => {
    expect(graphOf(build([textClip(undefined)]))).not.toContain('fade=t=in');
  });
});

describe('buildExportCommand shapes', () => {
  it('loops a shape overlay like a still and composites it', () => {
    const cmd = build([
      makeExportClip({
        kind: 'shape',
        start: 0,
        in: 0,
        out: 4,
        hasAudio: false,
        shape: { kind: 'star', fill: '#ffffff', stroke: '#000000', strokeWidth: 0, radius: 0 },
      }),
    ]);
    expect(strOf(cmd)).toContain('-loop 1 -framerate 30 -t 4.000 -i in_0.mp4');
    expect(graphOf(cmd)).toContain('overlay=');
    expect(strOf(cmd)).toContain('-an');
  });
});

describe('buildExportCommand keyframes', () => {
  const kfClip = (over: Partial<ExportClip> = {}) =>
    makeExportClip({
      kind: 'video',
      start: 0,
      in: 0,
      out: 6,
      speed: 1,
      keyframes: [
        { at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
        { at: 6, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } },
      ],
      ...over,
    });

  it('animates scale and position with per-frame t expressions', () => {
    const g = graphOf(build([kfClip()]));
    // a static cover-crop, then a uniform per-frame downscale
    expect(g).toMatch(/scale=w='if\(lt\(t,/);
    // overlay position is a t-expression, evaluated per frame, still gated to its window
    expect(g).toContain("overlay=x='if(lt(t,");
    expect(g).toContain("eval=frame:enable='between(t,0.000,6.000)'");
  });

  it('leaves a single-keyframe (or none) clip with a static rect', () => {
    const oneKf = graphOf(build([kfClip({ keyframes: [{ at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } }] })]));
    expect(oneKf).not.toContain('eval=frame');
    expect(graphOf(build([makeExportClip()]))).not.toContain('eval=frame');
  });
});

describe('buildExportCommand transitions', () => {
  it('cross-dissolves the incoming clip with an alpha fade over the overlap', () => {
    const g = graphOf(
      build([
        makeExportClip({ kind: 'video', start: 0, in: 0, out: 5 }),
        makeExportClip({ kind: 'video', start: 4, in: 0, out: 5, transition: { type: 'dissolve', duration: 1 } }),
      ]),
    );
    expect(g).toContain('fade=t=in:st=4.000:d=1.000:alpha=1');
    expect(g).not.toContain('color=c=black'); // dissolve adds no dip layer
  });

  it('dips through a color for a fade transition', () => {
    const g = graphOf(
      build([
        makeExportClip({ kind: 'video', start: 0, in: 0, out: 5 }),
        makeExportClip({ kind: 'video', start: 4, in: 0, out: 5, transition: { type: 'fadeBlack', duration: 1 } }),
      ]),
    );
    expect(g).toContain('fade=t=in:st=4.500:d=0.500:alpha=1'); // clip revealed in the 2nd half
    expect(g).toContain('color=c=black');
    expect(g).toContain("between(t,4.000,5.000)"); // dip gated to the overlap
    expect(graphOf(build([makeExportClip({ start: 4, transition: { type: 'fadeWhite', duration: 1 } })]))).toContain(
      'color=c=white',
    );
  });

  it('slides the incoming clip in with an animated overlay offset (no alpha fade)', () => {
    const g = graphOf(
      build([
        makeExportClip({ kind: 'video', start: 0, in: 0, out: 5 }),
        makeExportClip({ kind: 'video', start: 4, in: 0, out: 5, transition: { type: 'slideRight', duration: 1 } }),
      ]),
    );
    expect(g).toContain("overlay=x='"); // position is a t-expression
    expect(g).toContain('clip((t-4.000)/1.000,0,1)'); // decays over the overlap
    expect(g).not.toContain('alpha=1'); // slides don't fade alpha
    expect(g).not.toContain('geq='); // and don't mask
  });

  it('reveals a wipe behind a geq alpha mask gated to the overlap', () => {
    const g = graphOf(
      build([
        makeExportClip({ kind: 'video', start: 0, in: 0, out: 5 }),
        makeExportClip({ kind: 'video', start: 4, in: 0, out: 5, transition: { type: 'wipeRight', duration: 1 } }),
      ]),
    );
    expect(g).toContain("geq=r='r(X,Y)'");
    expect(g).toContain("a='alpha(X,Y)*lte(X,W*clip((T-4.000)/1.000,0,1))'");
    expect(g).toContain("enable='between(t,4.000,5.000)'"); // mask only during the overlap
    expect(g).not.toContain('color=c=black'); // no dip layer
  });

  it('reveals an iris with a radial geq mask', () => {
    const g = graphOf(
      build([
        makeExportClip({ kind: 'video', start: 0, in: 0, out: 5 }),
        makeExportClip({ kind: 'video', start: 4, in: 0, out: 5, transition: { type: 'circleOpen', duration: 1 } }),
      ]),
    );
    expect(g).toContain('hypot(X-W/2,Y-H/2)');
  });

  it('leaves clips without a transition untouched', () => {
    expect(graphOf(build([makeExportClip()]))).not.toContain('alpha=1');
    expect(graphOf(build([makeExportClip()]))).not.toContain('geq=');
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

  it('defaults to CRF when no custom bitrate is set', () => {
    expect(strOf(build([makeExportClip()], { format: 'mp4' }))).toContain('-crf 20');
    const webm = strOf(build([makeExportClip()], { format: 'webm' }));
    expect(webm).toContain('-b:v 0');
    expect(webm).toContain('-crf 30');
  });

  it('honours the chosen audio bitrate', () => {
    expect(strOf(build([makeExportClip({ hasAudio: true })], { audioBitrate: 256 }))).toContain('-b:a 256k');
    expect(strOf(build([makeExportClip({ hasAudio: true })], { format: 'webm', audioBitrate: 128 }))).toContain(
      '-b:a 128k',
    );
  });

  it('switches to target video bitrate (VBR) when a custom bitrate is set', () => {
    const mp4 = strOf(build([makeExportClip()], { format: 'mp4', videoBitrate: 8000 }));
    expect(mp4).toContain('-b:v 8000k');
    expect(mp4).toContain('-maxrate 8000k');
    expect(mp4).not.toContain('-crf');

    const webm = strOf(build([makeExportClip()], { format: 'webm', videoBitrate: 6000 }));
    expect(webm).toContain('-b:v 6000k');
    expect(webm).not.toContain('-b:v 0');
    expect(webm).not.toContain('-crf');
  });

  it('builds an optimised palette for gif and stays silent', () => {
    const cmd = build([makeExportClip()], { format: 'gif' });
    expect(graphOf(cmd)).toContain('palettegen');
    expect(graphOf(cmd)).toContain('paletteuse');
    expect(strOf(cmd)).toContain('-an');
  });
});

describe('buildExportCommand audio-only', () => {
  it('exports mp3 with libmp3lame, no video, and the chosen bitrate', () => {
    const cmd = build([makeExportClip({ hasAudio: true })], { format: 'mp3', audioBitrate: 256 });
    const s = strOf(cmd);
    expect(s).toContain('-c:a libmp3lame');
    expect(s).toContain('-b:a 256k');
    expect(s).toContain('-vn');
    expect(s).toContain('-map [aout]');
    expect(s).not.toContain('[vout]');
    expect(cmd.outputName).toBe('output.mp3');
    expect(cmd.mime).toBe('audio/mpeg');
  });

  it('exports wav as uncompressed pcm with no video', () => {
    const cmd = build([makeExportClip({ hasAudio: true })], { format: 'wav' });
    const s = strOf(cmd);
    expect(s).toContain('-c:a pcm_s16le');
    expect(s).toContain('-vn');
    expect(cmd.mime).toBe('audio/wav');
    expect(cmd.outputName).toBe('output.wav');
  });

  it('mixes multiple audio sources without a video map', () => {
    const cmd = build(
      [makeExportClip({ start: 0, hasAudio: true }), makeExportClip({ start: 5, hasAudio: true })],
      { format: 'mp3' },
    );
    expect(graphOf(cmd)).toContain('amix=inputs=2');
    expect(strOf(cmd)).not.toContain('-map [vout]');
  });
});

describe('blend modes', () => {
  it('renders a masked planar blend for a blended clip', () => {
    const g = graphOf(build([makeExportClip({ blendMode: 'screen' })]));
    expect(g).toContain('blend=all_mode=screen');
    expect(g).toContain('format=gbrp'); // blend needs planar RGB
    expect(g).toContain('alphamerge'); // re-applies the clip's alpha as a mask
  });

  it('maps soft light to the ffmpeg name', () => {
    expect(graphOf(build([makeExportClip({ blendMode: 'softlight' })]))).toContain('blend=all_mode=softlight');
  });

  it('uses the plain overlay path and no blend when unset', () => {
    const g = graphOf(build([makeExportClip()]));
    expect(g).not.toContain('blend=all_mode');
    expect(g).toContain('overlay=');
  });
});
