import { useEffect, useRef, useState } from 'react';
import { getWaveformPeaks, slicePeaks } from '@/lib/media/waveform';

export interface WaveformProps {
  mediaId: string;
  blob: Blob;
  /** trimmed source range (seconds) and the media's full length */
  inSec: number;
  outSec: number;
  duration: number;
  /** displayed size in CSS pixels */
  width: number;
  height: number;
  className?: string;
}

/** Cap the canvas backing width so a long, zoomed-in clip can't allocate a huge buffer. */
const MAX_BACKING = 2000;

/** Draws a clip's audio peaks as centered bars on a canvas. */
export function Waveform({ mediaId, blob, inSec, outSec, duration, width, height, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    let alive = true;
    getWaveformPeaks(mediaId, blob)
      .then((p) => {
        if (alive) setPeaks(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mediaId, blob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const w = Math.max(1, Math.min(MAX_BACKING, Math.floor(width)));
    const h = Math.max(1, Math.floor(height));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const barW = 2;
    const gap = 1;
    const count = Math.max(1, Math.floor(w / (barW + gap)));
    const bars = slicePeaks(peaks, inSec, outSec, duration, count);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const mid = h / 2;
    for (let i = 0; i < bars.length; i++) {
      const bh = Math.max(1, bars[i] * (h - 2));
      ctx.fillRect(i * (barW + gap), mid - bh / 2, barW, bh);
    }
  }, [peaks, width, height, inSec, outSec, duration]);

  return <canvas ref={canvasRef} className={className} style={{ width, height }} />;
}
