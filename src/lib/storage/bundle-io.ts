import { unzip, zip, type AsyncZippable, type Unzipped } from 'fflate';
import {
  MANIFEST_PATH,
  buildManifest,
  bundleFileName,
  mediaEntryPath,
  parseManifest,
  remapForImport,
} from '@/lib/storage/bundle';
import { getMedia, getSnapshot, saveMedia, saveSnapshot } from '@/lib/storage/projects';

function zipAsync(files: AsyncZippable): Promise<Uint8Array> {
  // Media is already compressed (level 0 = store); the JSON manifest compresses well.
  return new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))),
  );
}

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) =>
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data))),
  );
}

/** Copy into a fresh ArrayBuffer-backed array so the DOM Blob types accept it. */
function toBlobBytes(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(u.byteLength);
  out.set(u);
  return out;
}

/** Build a downloadable `.edite` bundle (ZIP) for a stored project. */
export async function exportProjectBundle(
  id: string,
): Promise<{ blob: Blob; fileName: string } | null> {
  const snap = await getSnapshot(id);
  if (!snap) return null;

  const files: AsyncZippable = {
    [MANIFEST_PATH]: new TextEncoder().encode(JSON.stringify(buildManifest(snap))),
  };
  for (const meta of snap.media) {
    const blob = await getMedia(meta.id);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    files[mediaEntryPath(meta.id)] = [bytes, { level: 0 }];
  }

  const zipped = await zipAsync(files);
  return {
    blob: new Blob([toBlobBytes(zipped)], { type: 'application/zip' }),
    fileName: bundleFileName(snap.name),
  };
}

export type ImportResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

/** Read a `.edite` bundle and store it as a fresh project (new project + media ids). */
export async function importProjectBundle(file: Blob): Promise<ImportResult> {
  let entries: Unzipped;
  try {
    entries = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: 'That file is not a valid .edite project.' };
  }

  const manifestBytes = entries[MANIFEST_PATH];
  if (!manifestBytes) {
    return { ok: false, error: "This doesn't look like an edite project file." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch {
    return { ok: false, error: 'This project file is corrupted.' };
  }

  const parsed = parseManifest(parsedJson);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { snapshot, mediaIdMap } = remapForImport(parsed.manifest);
  for (const meta of parsed.manifest.project.media) {
    const bytes = entries[mediaEntryPath(meta.id)];
    if (!bytes) return { ok: false, error: 'This project file is missing some media.' };
    await saveMedia(
      mediaIdMap[meta.id],
      new Blob([toBlobBytes(bytes)], { type: meta.mimeType || 'application/octet-stream' }),
    );
  }
  await saveSnapshot(snapshot);
  return { ok: true, id: snapshot.id, name: snapshot.name };
}
