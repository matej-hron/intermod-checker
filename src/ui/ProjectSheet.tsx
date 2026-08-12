import { useRef, useState } from 'react';
import { MAX_PROJECTS, parseProject, serializeProject } from '../im';
import { useProjectStore } from '../state/projectStore';
import { formatTimeAgo } from './timeAgo';

export function ProjectSheet() {
  const name = useProjectStore((s) => s.name);
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const libraryFull = useProjectStore((s) => s.libraryFull);
  const newProject = useProjectStore((s) => s.newProject);
  const selectProject = useProjectStore((s) => s.selectProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const importAsProject = useProjectStore((s) => s.importAsProject);

  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const renameCancelled = useRef(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const closeSheet = (): void => {
    dialog.current?.close();
    setMenuId(null);
    setRenamingId(null);
  };

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
    importAsProject(parsed);
    closeSheet();
  };

  const commitRename = (): void => {
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    if (renamingId !== null) {
      const trimmed = renameValue.trim();
      if (trimmed) renameProject(renamingId, trimmed);
      setRenamingId(null);
    }
  };

  const now = Date.now();

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

      <dialog ref={dialog} className="sheet sheet--tall" aria-label="Projects">
        <div className="sheet__body">
          <div className="sheet__header">
            <h2>Projects</h2>
            <button
              type="button"
              className="btn--primary"
              disabled={libraryFull}
              onClick={() => {
                newProject();
                closeSheet();
              }}
            >
              + New
            </button>
          </div>

          {libraryFull && (
            <p className="error">
              You have reached the limit of {MAX_PROJECTS} projects. Delete one to add another.
            </p>
          )}

          <ul className="projects">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              const isMenuOpen = menuId === p.id;
              const isRenaming = renamingId === p.id;
              const subtitle = `${p.carrierCount} ${p.carrierCount === 1 ? 'mic' : 'mics'} · ${formatTimeAgo(p.updatedAt, now)}`;

              return (
                <li key={p.id} className={isActive ? 'project project--active' : 'project'}>
                  {isRenaming ? (
                    <input
                      className="project__rename-input"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { commitRename(); }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          renameCancelled.current = true;
                          setRenamingId(null);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="project__open"
                      aria-label={`Open ${p.name}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => {
                        selectProject(p.id);
                        closeSheet();
                      }}
                    >
                      <span className="project__name">
                        {isActive && <span aria-hidden="true">✓ </span>}
                        {p.name || 'Untitled'}
                      </span>
                      <span className="project__meta">{subtitle}</span>
                    </button>
                  )}

                  {!isRenaming && (
                    <button
                      type="button"
                      className="project__more"
                      aria-label={`More actions for ${p.name}`}
                      aria-expanded={isMenuOpen}
                      onClick={() => setMenuId(isMenuOpen ? null : p.id)}
                    >
                      <span aria-hidden="true">⋯</span>
                    </button>
                  )}

                  {isMenuOpen && (
                    <div className="project__menu">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.name);
                          setMenuId(null);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={libraryFull}
                        onClick={() => {
                          duplicateProject(p.id);
                          closeSheet();
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete "${p.name}"? This cannot be undone.`)) {
                            deleteProject(p.id);
                            setMenuId(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="projects__file">
            <button
              type="button"
              disabled={libraryFull}
              onClick={() => fileInput.current?.click()}
            >
              Import JSON…
            </button>
            <button type="button" onClick={exportProject}>
              Export current
            </button>
          </div>

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
          <p className="hint">
            Projects are stored in this browser. Export a project to keep a copy.
          </p>
        </div>
      </dialog>
    </>
  );
}
