import { type ReactNode } from 'react';

export interface EditorLayoutProps {
  rail: ReactNode;
  panel: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
}

export function EditorLayout({ rail, panel, stage, timeline }: EditorLayoutProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="order-1 flex min-w-0 flex-1 flex-col lg:order-3">
        <div className="relative min-h-0 flex-1">{stage}</div>
        {timeline}
      </div>
      {rail}
      {panel}
    </div>
  );
}
