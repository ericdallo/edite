import { type PointerEvent as ReactPointerEvent } from 'react';

export interface PlayheadProps {
  left: number;
  onGrab: (e: ReactPointerEvent) => void;
}

export function Playhead({ left, onGrab }: PlayheadProps) {
  return (
    <div className="pointer-events-none absolute bottom-0 top-0 z-30" style={{ left }}>
      <div
        onPointerDown={onGrab}
        className="pointer-events-auto absolute -top-1 left-1/2 h-4 w-4 -translate-x-1/2 touch-none cursor-ew-resize rounded-[3px] bg-accent shadow-md lg:h-3.5 lg:w-3.5"
      />
      <div className="absolute bottom-0 top-0 w-px -translate-x-1/2 bg-accent" />
    </div>
  );
}
