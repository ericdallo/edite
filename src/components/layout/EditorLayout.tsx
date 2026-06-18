import { type ReactNode } from 'react';

export interface EditorLayoutProps {
  rail: ReactNode;
  panel: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
}

export function EditorLayout({ rail, panel, stage, timeline }: EditorLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1">
      {rail}
      {panel}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">{stage}</div>
        {timeline}
      </div>
    </div>
  );
}
