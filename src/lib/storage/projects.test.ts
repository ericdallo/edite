import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS, type ProjectSnapshot } from '@/types/editor';
import { resolveCreatedAt, toProjectSummary } from '@/lib/storage/projects';
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
    clips: [makeClip({ id: 'c1' }), makeClip({ id: 'c2' }), makeClip({ id: 'c3' })],
    aspect: 'original',
    background: '#000000',
    muted: false,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    ...over,
  };
}

describe('resolveCreatedAt', () => {
  it('keeps the existing createdAt across re-saves', () => {
    const existing = makeSnapshot({ createdAt: 50 });
    const incoming = makeSnapshot({ createdAt: 999 });
    expect(resolveCreatedAt(existing, incoming)).toBe(50);
  });

  it('uses the incoming createdAt for a brand-new project', () => {
    const incoming = makeSnapshot({ createdAt: 999 });
    expect(resolveCreatedAt(undefined, incoming)).toBe(999);
  });
});

describe('toProjectSummary', () => {
  it('projects a snapshot to a list descriptor with counts', () => {
    expect(toProjectSummary(makeSnapshot())).toEqual({
      id: 'p1',
      name: 'Project 1',
      createdAt: 100,
      updatedAt: 200,
      clipCount: 3,
      mediaCount: 2,
    });
  });
});
