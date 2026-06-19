import type { ProjectSnapshot } from '@/types/editor';
import { uid } from '@/lib/ids';

/** Identifies a file as an edite project bundle (a ZIP renamed `.edite`). */
export const BUNDLE_FORMAT = 'edite-project';
/**
 * Bump only on a breaking change to the bundle shape. Readers accept any
 * version <= this and reject newer ones; additive fields/entries should NOT
 * bump it, so older bundles keep importing.
 */
export const BUNDLE_VERSION = 1;

/** Path of the JSON descriptor inside the ZIP. */
export const MANIFEST_PATH = 'manifest.json';
/** Folder holding raw media bytes, one entry per (original) media id. */
export const MEDIA_DIR = 'media';

export const mediaEntryPath = (mediaId: string): string => `${MEDIA_DIR}/${mediaId}`;

export interface BundleApp {
  name: string;
  version?: string;
}

export interface BundleManifest {
  format: string;
  version: number;
  exportedAt: number;
  app?: BundleApp;
  project: ProjectSnapshot;
}

/** Wrap a stored snapshot in a versioned, self-describing manifest. */
export function buildManifest(project: ProjectSnapshot, app: BundleApp = { name: 'edite' }): BundleManifest {
  return { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: Date.now(), app, project };
}

export type ParseResult =
  | { ok: true; manifest: BundleManifest }
  | { ok: false; error: string };

function looksLikeSnapshot(p: unknown): p is ProjectSnapshot {
  if (!p || typeof p !== 'object') return false;
  const s = p as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    Array.isArray(s.media) &&
    Array.isArray(s.tracks) &&
    Array.isArray(s.clips)
  );
}

/** Validate an untrusted parsed manifest, with friendly errors for the UI. */
export function parseManifest(data: unknown): ParseResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: "This doesn't look like an edite project file." };
  }
  const m = data as Record<string, unknown>;
  if (m.format !== BUNDLE_FORMAT) {
    return { ok: false, error: "This doesn't look like an edite project file." };
  }
  if (typeof m.version !== 'number') {
    return { ok: false, error: 'This project file is missing its version.' };
  }
  if (m.version > BUNDLE_VERSION) {
    return { ok: false, error: 'This project was made with a newer version of edite. Please update and try again.' };
  }
  if (!looksLikeSnapshot(m.project)) {
    return { ok: false, error: 'This project file is corrupted or incomplete.' };
  }
  return {
    ok: true,
    manifest: {
      format: m.format,
      version: m.version,
      exportedAt: typeof m.exportedAt === 'number' ? m.exportedAt : Date.now(),
      app: (m.app as BundleApp | undefined) ?? undefined,
      project: m.project,
    },
  };
}

export interface RemapResult {
  snapshot: ProjectSnapshot;
  /** original media id -> freshly assigned media id (used to place ZIP bytes). */
  mediaIdMap: Record<string, string>;
}

/**
 * Rewrite an imported project with fresh project + media ids so an import never
 * clobbers or shares storage with existing projects (re-importing makes a copy).
 * Pure: pass `makeId` for deterministic tests.
 */
export function remapForImport(manifest: BundleManifest, makeId: () => string = uid): RemapResult {
  const p = manifest.project;
  const mediaIdMap: Record<string, string> = {};
  for (const m of p.media) mediaIdMap[m.id] = makeId();
  const now = Date.now();
  const media = p.media.map((m) => ({ ...m, id: mediaIdMap[m.id] }));
  const clips = p.clips.map((c) =>
    c.mediaId && mediaIdMap[c.mediaId] ? { ...c, mediaId: mediaIdMap[c.mediaId] } : c,
  );
  const snapshot: ProjectSnapshot = { ...p, id: makeId(), media, clips, createdAt: now, updatedAt: now };
  return { snapshot, mediaIdMap };
}

/** Filesystem-safe download name for a project bundle. */
export function bundleFileName(name: string): string {
  const slug =
    (name || 'project')
      .trim()
      .replace(/[^\w.-]+/g, '_')
      .replace(/^[_.]+|_+$/g, '') || 'project';
  return `${slug}.edite`;
}
