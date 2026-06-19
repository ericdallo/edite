import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS, type ProjectSnapshot } from '@/types/editor';
import {
  BUNDLE_FORMAT,
  BUNDLE_VERSION,
  buildManifest,
  bundleFileName,
  parseManifest,
  remapForImport,
} from '@/lib/storage/bundle';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';

function makeSnapshot(over: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const media = [makeMedia({ id: 'm1' }), makeMedia({ id: 'm2' })].map(({ url, blob, ...m }) => m);
  return {
    id: 'p1',
    name: 'Project 1',
    createdAt: 100,
    updatedAt: 200,
    media,
    tracks: [makeTrack({ id: 't1' })],
    clips: [
      makeClip({ id: 'c1', mediaId: 'm1' }),
      makeClip({ id: 'c2', mediaId: 'm2' }),
      makeClip({ id: 'text', mediaId: '' }),
    ],
    aspect: 'original',
    background: '#000000',
    muted: false,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    ...over,
  };
}

describe('buildManifest', () => {
  it('wraps a snapshot with the format header', () => {
    const m = buildManifest(makeSnapshot());
    expect(m.format).toBe(BUNDLE_FORMAT);
    expect(m.version).toBe(BUNDLE_VERSION);
    expect(m.app?.name).toBe('edite');
    expect(m.project.id).toBe('p1');
  });
});

describe('parseManifest', () => {
  it('accepts a well-formed manifest', () => {
    const res = parseManifest(buildManifest(makeSnapshot()));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.manifest.project.name).toBe('Project 1');
  });

  it('rejects a non-object / wrong format', () => {
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest({ format: 'something-else', version: 1, project: {} }).ok).toBe(false);
  });

  it('rejects a newer bundle version', () => {
    const res = parseManifest({ format: BUNDLE_FORMAT, version: BUNDLE_VERSION + 1, project: makeSnapshot() });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/newer version/i);
  });

  it('rejects a corrupted project', () => {
    expect(parseManifest({ format: BUNDLE_FORMAT, version: 1, project: { id: 'x' } }).ok).toBe(false);
  });
});

describe('remapForImport', () => {
  it('assigns fresh project + media ids and remaps clip.mediaId', () => {
    let n = 0;
    const makeId = () => `new${++n}`;
    const { snapshot, mediaIdMap } = remapForImport(buildManifest(makeSnapshot()), makeId);

    // media ids are remapped, keyed by the original id
    expect(Object.keys(mediaIdMap)).toEqual(['m1', 'm2']);
    expect(snapshot.media.map((m) => m.id)).toEqual([mediaIdMap['m1'], mediaIdMap['m2']]);

    // clips follow their media; the text clip (empty mediaId) is untouched
    const byId = Object.fromEntries(snapshot.clips.map((c) => [c.id, c.mediaId]));
    expect(byId['c1']).toBe(mediaIdMap['m1']);
    expect(byId['c2']).toBe(mediaIdMap['m2']);
    expect(byId['text']).toBe('');

    // project id is fresh and distinct from media ids
    expect(snapshot.id).not.toBe('p1');
    expect(snapshot.id.startsWith('new')).toBe(true);
  });

  it('stamps fresh timestamps', () => {
    const before = Date.now();
    const { snapshot } = remapForImport(buildManifest(makeSnapshot({ createdAt: 1, updatedAt: 2 })));
    expect(snapshot.createdAt).toBeGreaterThanOrEqual(before);
    expect(snapshot.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('bundleFileName', () => {
  it('slugifies the project name and adds .edite', () => {
    expect(bundleFileName('My Project!')).toBe('My_Project.edite');
    expect(bundleFileName('  spaced  ')).toBe('spaced.edite');
  });

  it('falls back when the name is empty', () => {
    expect(bundleFileName('')).toBe('project.edite');
    expect(bundleFileName('***')).toBe('project.edite');
  });
});
