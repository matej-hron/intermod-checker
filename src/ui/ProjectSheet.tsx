import { useRef, useState } from 'react';
import { parseProject, serializeProject } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';

export function ProjectSheet() {
  const name = useProjectStore((s) => s.name);
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const setName = useProjectStore((s) => s.setName);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const clear = useAnalysisStore((s) => s.clear);

  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const exportProject = (): void => {
    const json = serializeProject(name, carriers, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name.replace(/[^\w-]+/g, '-') || 'project'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File): Promise<void> => {
    const parsed = parseProject(await file.text());
    if ('error' in parsed) {
      setImportError(parsed.error);
      return;
    }
    setImportError(null);
    loadProject(parsed);
    clear();
  };

  return (
    <>
      <button
        type="button"
        className="btn--ghost app-bar__project"
        onClick={() => dialog.current?.showModal()}
      >
        <span className="app-bar__name">{name || 'Untitled'}</span>
        <span className="visually-hidden">Open project options</span>
        <span aria-hidden="true">▾</span>
      </button>

      <dialog ref={dialog} className="sheet" aria-label="Project">
        <div className="sheet__body">
          <h2>Project</h2>

          <label className="field">
            Project name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Start a new project? This discards the current one unless you exported it first.',
                )
              ) {
                newProject();
                setImportError(null);
                clear();
              }
            }}
          >
            New project
          </button>
          <button type="button" onClick={exportProject}>
            Export JSON
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            aria-label="Import project JSON file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importProject(file);
              e.target.value = '';
            }}
          />

          {importError !== null && <p className="error">{importError}</p>}
          <p className="hint">
            Your frequencies stay in this browser — nothing is uploaded.
          </p>

          <button
            type="button"
            className="btn--primary"
            onClick={() => dialog.current?.close()}
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
