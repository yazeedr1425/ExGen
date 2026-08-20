import type { JobEvent } from '@/lib/types';

const STAGE_LABEL: Record<string, string> = {
  queued: 'Job created',
  planning: 'Planning',
  generating: 'Writing files',
  validating: 'Validating',
  repairing: 'Repairing',
  packaging: 'Packaging',
  ready: 'Ready',
  failed: 'Failed',
  published: 'Pushed to GitHub',
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function JobTimeline({ events }: { events: JobEvent[] }) {
  if (!events.length) {
    return <p className="muted small">No progress reported yet.</p>;
  }

  return (
    <ul className="timeline">
      {events.map((e) => {
        const dot =
          e.stage === 'failed' ? 'dot dot-err' : e.stage === 'ready' ? 'dot dot-ok' : 'dot dot-active';
        return (
          <li key={e.id}>
            <span className={dot} aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <strong className="small">{STAGE_LABEL[e.stage] ?? e.stage}</strong>
              {e.message && <div className="small muted">{e.message}</div>}
            </span>
            <span className="tiny faint mono">{time(e.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
