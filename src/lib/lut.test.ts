import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCustomLut, LUT_LOOKS, lutFileName, lutUrl, packLut, parseCube, sampleLut } from '@/lib/lut';

// A 2^3 identity cube (red varies fastest), with comment / header lines to skip.
const IDENTITY_2 = `# test cube
TITLE "Id"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

describe('parseCube', () => {
  it('reads the size and triplets, ignoring headers/comments', () => {
    const { size, data } = parseCube(IDENTITY_2);
    expect(size).toBe(2);
    expect(data.length).toBe(2 * 2 * 2 * 3);
    expect(Array.from(data.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it('rejects a malformed cube', () => {
    expect(() => parseCube('TITLE "x"\n0 0 0\n')).toThrow();
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(); // too few rows
  });
});

describe('packLut', () => {
  it('packs blue slices left-to-right as an RGB byte texture', () => {
    const packed = packLut(parseCube(IDENTITY_2));
    expect(packed.size).toBe(2);
    expect(packed.width).toBe(4); // size * size
    expect(packed.height).toBe(2);
    expect(packed.pixels.length).toBe(4 * 2 * 3);
    // (b=0,g=0,r=1) -> tile x=1, y=0 -> pure red
    expect(Array.from(packed.pixels.slice(3, 6))).toEqual([255, 0, 0]);
    // (b=0,g=1,r=0) -> row y=1, x=0 -> pure green
    expect(Array.from(packed.pixels.slice(12, 15))).toEqual([0, 255, 0]);
  });
});

describe('lut ids', () => {
  it('builds a safe FS filename', () => {
    expect(lutFileName('cinematic')).toBe('lut_cinematic.cube');
    expect(lutFileName('custom:ab/cd')).toBe('lut_custom_ab_cd.cube');
  });

  it('resolves bundled URLs but not custom ones', () => {
    expect(lutUrl('cinematic')).toContain('luts/cinematic.cube');
    expect(lutUrl('custom:x')).toBeNull();
    expect(isCustomLut('custom:x')).toBe(true);
    expect(isCustomLut('cinematic')).toBe(false);
  });
});

describe('bundled look assets', () => {
  const luts = join(process.cwd(), 'public', 'luts');

  it('has a .cube and a thumbnail for every registered look', () => {
    for (const look of LUT_LOOKS) {
      expect(existsSync(join(luts, `${look.id}.cube`)), `${look.id}.cube missing`).toBe(true);
      expect(existsSync(join(luts, 'thumbs', `${look.id}.png`)), `${look.id}.png missing`).toBe(true);
    }
  });

  it('has the baseline (original) thumbnail for the None option', () => {
    expect(existsSync(join(luts, 'thumbs', '_original.png'))).toBe(true);
  });
});

describe('sampleLut', () => {
  it('reproduces the input for an identity cube (trilinear)', () => {
    const cube = parseCube(IDENTITY_2);
    for (const [r, g, b] of [
      [0, 0, 0],
      [1, 1, 1],
      [0.25, 0.5, 0.75],
      [0.1, 0.9, 0.3],
    ] as const) {
      const [rr, gg, bb] = sampleLut(cube, r, g, b);
      expect(rr).toBeCloseTo(r, 5);
      expect(gg).toBeCloseTo(g, 5);
      expect(bb).toBeCloseTo(b, 5);
    }
  });
});
