import type { CustomFont } from '@/types/editor';
import { uid } from '@/lib/ids';

/** The first family name in a CSS stack, unquoted (what `FontFace` registers under). */
function primaryFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '');
}

/** Tidy a font file name into a display label (`My-Font.woff2` -> `My Font`). */
export function fontLabelFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom font';
}

const FONT_EXT = /\.(ttf|otf|woff2?|ttc)$/i;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the font file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Register a font family with the document so the canvas preview and the export
 * rasterizer (which both read `document.fonts`) can use it. No-ops outside the
 * browser and skips families that are already present.
 */
export async function registerFont(family: string, dataUrl: string): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  const name = primaryFamily(family);
  if (!name) return;
  let exists = false;
  document.fonts.forEach((f) => {
    if (f.family === name) exists = true;
  });
  if (exists) return;
  const face = new FontFace(name, `url(${dataUrl})`);
  await face.load();
  document.fonts.add(face);
}

/** Re-register a project's imported fonts (best-effort; a bad font is skipped). */
export async function registerCustomFonts(fonts: CustomFont[]): Promise<void> {
  await Promise.all(fonts.map((f) => registerFont(f.family, f.dataUrl).catch(() => undefined)));
}

/**
 * Read a user-picked font file, register it, and return the {@link CustomFont}
 * to store on the project. Throws on an unsupported file or invalid font data.
 */
export async function createCustomFont(file: File): Promise<CustomFont> {
  if (!FONT_EXT.test(file.name)) {
    throw new Error('Use a .ttf, .otf, .woff or .woff2 font file.');
  }
  const dataUrl = await fileToDataUrl(file);
  const id = `font:${uid()}`;
  // A unique, spaces-free CSS identifier so families never collide.
  const cssName = `efont-${id.replace(/[^a-z0-9]/gi, '')}`;
  const family = `${cssName}, sans-serif`;
  await registerFont(family, dataUrl);
  return { id, label: fontLabelFromFileName(file.name), family, dataUrl };
}
