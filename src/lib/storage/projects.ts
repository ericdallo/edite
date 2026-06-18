import { openDB, type IDBPDatabase } from 'idb';
import type { ProjectSnapshot } from '@/types/editor';

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

export async function saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const db = await getDB();
  const existing = (await db.get(SNAP_STORE, snapshot.id)) as ProjectSnapshot | undefined;
  await db.put(SNAP_STORE, { ...snapshot, createdAt: resolveCreatedAt(existing, snapshot) });
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
}

export function toProjectSummary(snap: ProjectSnapshot): ProjectSummary {
  return {
    id: snap.id,
    name: snap.name,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
    clipCount: snap.clips.length,
    mediaCount: snap.media.length,
  };
}

/** All stored projects as summaries, most recently updated first. */
export async function listProjects(): Promise<ProjectSummary[]> {
  return (await listSnapshots()).map(toProjectSummary);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(SNAP_STORE, id);
  await db.delete(MEDIA_STORE, id);
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
