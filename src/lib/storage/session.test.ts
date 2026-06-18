import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@/types/editor';
import { mediaMetaFromItems, snapshotFromState } from '@/lib/storage/session';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';

describe('mediaMetaFromItems', () => {
  it('drops the runtime-only url and blob fields', () => {
    const [meta] = mediaMetaFromItems([makeMedia({ id: 'm1', fileName: 'clip.mp4' })]);
    expect(meta).not.toHaveProperty('url');
    expect(meta).not.toHaveProperty('blob');
    expect(meta).toMatchObject({ id: 'm1', fileName: 'clip.mp4', kind: 'video' });
  });
});

describe('snapshotFromState', () => {
  it('maps document state to a persistable snapshot', () => {
    const snap = snapshotFromState({
      projectId: 'p1',
      projectName: 'My Project',
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [makeClip({ id: 'c1' })],
      aspect: '16:9',
      muted: true,
      exportSettings: DEFAULT_EXPORT_SETTINGS,
    });
    expect(snap.id).toBe('p1');
    expect(snap.name).toBe('My Project');
    expect(snap.aspect).toBe('16:9');
    expect(snap.muted).toBe(true);
    expect(snap.clips).toHaveLength(1);
    expect(snap.media[0]).not.toHaveProperty('blob');
    expect(typeof snap.createdAt).toBe('number');
    expect(snap.updatedAt).toBeGreaterThanOrEqual(snap.createdAt);
  });
});
