import { openDB, type IDBPDatabase } from 'idb';
import type { ProjectSnapshot } from '@/types/editor';
import { uid } from '@/lib/ids';

const DB_NAME = 'edite-db';
const VERSION = 1;
const SNAP_STORE = 'snapshots';
const MEDIA_STORE = 'media';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SNAP_STORE)) {
          db.createObjectStore(SNAP_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Keep the original creation time across re-saves; fall back to the incoming one. */
export function resolveCreatedAt(
  existing: ProjectSnapshot | undefined,
  incoming: ProjectSnapshot,
): number {
  return existing?.createdAt ?? incoming.createdAt;
}

/** Keep the stored poster when a routine save doesn't carry a fresh one. */
export function resolveThumbnail(
  existing: ProjectSnapshot | undefined,
  incoming: ProjectSnapshot,
): string | undefined {
  return incoming.thumbnail ?? existing?.thumbnail;
}

export async function saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(SNAP_STORE, snapshot.id)) as ProjectSnapshot | undefined;
  await db.put(SNAP_STORE, {
    ...snapshot,
    createdAt: resolveCreatedAt(existing, snapshot),
    thumbnail: resolveThumbnail(existing, snapshot),
  });
}

/** Persist just the poster for a project, leaving everything else untouched. */
export async function setProjectThumbnail(id: string, thumbnail: string): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(SNAP_STORE, id)) as ProjectSnapshot | undefined;
  if (!existing) return;
  await db.put(SNAP_STORE, { ...existing, thumbnail });
}

export async function saveMedia(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put(MEDIA_STORE, blob, id);
}

export async function getSnapshot(id: string): Promise<ProjectSnapshot | undefined> {
  const db = await getDB();
  return db.get(SNAP_STORE, id);
}

export async function getMedia(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get(MEDIA_STORE, id);
}

export async function listSnapshots(): Promise<ProjectSnapshot[]> {
  const db = await getDB();
  const all = (await db.getAll(SNAP_STORE)) as ProjectSnapshot[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Lightweight project descriptor for the projects list UI. */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  clipCount: number;
  mediaCount: number;
  thumbnail?: string;
}

export function toProjectSummary(snap: ProjectSnapshot): ProjectSummary {
  return {
    id: snap.id,
    name: snap.name,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
    clipCount: snap.clips.length,
    mediaCount: snap.media.length,
    thumbnail: snap.thumbnail,
  };
}

/** All stored projects as summaries, most recently updated first. */
export async function listProjects(): Promise<ProjectSummary[]> {
  return (await listSnapshots()).map(toProjectSummary);
}

/**
 * Media blobs are shared by id (a duplicated project reuses them), so deleting a
 * project may only drop the blobs that no surviving project still references.
 */
export function orphanedMediaIds(
  deletedMediaIds: string[],
  remaining: ProjectSnapshot[],
): string[] {
  const stillUsed = new Set<string>();
  for (const snap of remaining) {
    for (const m of snap.media) stillUsed.add(m.id);
  }
  return deletedMediaIds.filter((mid) => !stillUsed.has(mid));
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const snap = (await db.get(SNAP_STORE, id)) as ProjectSnapshot | undefined;
  await db.delete(SNAP_STORE, id);
  if (!snap) return;
  const remaining = (await db.getAll(SNAP_STORE)) as ProjectSnapshot[];
  const orphans = orphanedMediaIds(
    snap.media.map((m) => m.id),
    remaining,
  );
  await Promise.all(orphans.map((mid) => db.delete(MEDIA_STORE, mid)));
}

/** Copy a project under a fresh id; media blobs are shared, not duplicated. */
export async function duplicateProject(id: string, name?: string): Promise<string | null> {
  const db = await getDB();
  const snap = (await db.get(SNAP_STORE, id)) as ProjectSnapshot | undefined;
  if (!snap) return null;
  const now = Date.now();
  const copy: ProjectSnapshot = {
    ...snap,
    id: uid(),
    name: name ?? `${snap.name || 'Untitled project'} copy`,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(SNAP_STORE, copy);
  return copy.id;
}

/** Rename a stored project (no effect when it doesn't exist). */
export async function renameProject(id: string, name: string): Promise<void> {
  const db = await getDB();
  const snap = (await db.get(SNAP_STORE, id)) as ProjectSnapshot | undefined;
  if (!snap) return;
  await db.put(SNAP_STORE, { ...snap, name, updatedAt: Date.now() });
}

const LAST_KEY = 'edite:lastProjectId';

export function setLastProjectId(id: string): void {
  localStorage.setItem(LAST_KEY, id);
}

export function getLastProjectId(): string | null {
  return localStorage.getItem(LAST_KEY);
}

export function clearLastProjectId(): void {
  localStorage.removeItem(LAST_KEY);
}
