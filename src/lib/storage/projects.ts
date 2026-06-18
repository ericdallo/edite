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

export async function saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const db = await getDB();
  await db.put(SNAP_STORE, snapshot);
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
