'use client';

import { useMemo, useState } from 'react';
import type { GeneratedFile } from '@/lib/types';
import { Empty } from './ui';

function bytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

/** Groups by top-level folder so a popup/ or content/ directory reads as a unit.
 *  manifest.json is forced to the top because it is the file people check first. */
function group(files: GeneratedFile[]) {
  const groups = new Map<string, GeneratedFile[]>();
  for (const f of files) {
    const slash = f.path.indexOf('/');
    const key = slash === -1 ? '/' : f.path.slice(0, slash);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
}

export function FileBrowser({ files }: { files: GeneratedFile[] }) {
  const ordered = useMemo(
    () =>
      [...files].sort((a, b) => {
        if (a.path === 'manifest.json') return -1;
        if (b.path === 'manifest.json') return 1;
        return a.path.localeCompare(b.path);
      }),
    [files],
  );

  const [selected, setSelected] = useState<string>(ordered[0]?.path ?? '');
  const current = ordered.find((f) => f.path === selected) ?? ordered[0];

  if (!ordered.length) {
    return <Empty>No files yet. They arrive when the build finishes.</Empty>;
  }

  return (
    <div className="browser">
      <div className="tree">
        {group(ordered).map(([dir, entries]) => (
          <div key={dir}>
            <div className="tree-group">{dir === '/' ? 'root' : `${dir}/`}</div>
            {entries.map((f) => {
              const leaf = f.path.includes('/') ? f.path.slice(f.path.indexOf('/') + 1) : f.path;
              return (
                <button
                  key={f.path}
                  type="button"
                  className="tree-item"
                  aria-current={f.path === current?.path}
                  onClick={() => setSelected(f.path)}
                >
                  <span className="truncate">{leaf}</span>
                  <span className="faint">{bytes(f.bytes)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="viewer">
        <div className="viewer-head">
          <span className="mono small truncate">{current?.path}</span>
          <span className="spacer" />
          <span className="tiny faint">{current ? bytes(current.bytes) : ''}</span>
        </div>
        {/* Rendered as text only. This is model-generated code and is never
            evaluated, injected as HTML, or given a script context. */}
        <pre>
          <code>{current?.content}</code>
        </pre>
      </div>
    </div>
  );
}
