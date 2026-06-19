import { Github, Globe } from 'lucide-react';
import { REPO_URL, SITE_URL } from '@/lib/constants';

export function AboutSettings() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-ink-muted">
        edite is a free, 100% in-browser video editor. Your media never leaves your device — everything
        runs locally and is stored in your browser.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={SITE_URL}
          title="Open edite.video"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Globe size={15} /> Website
        </a>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          title="View source on GitHub"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Github size={15} /> GitHub
        </a>
      </div>
    </div>
  );
}
