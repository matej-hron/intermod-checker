import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  LIBRARY_VERSION,
  MAX_PROJECTS,
  PROJECT_VERSION,
  activeProject,
  createProject,
  deleteProject,
  duplicateProject,
  isFull,
  migrateSingleProject,
  newLibrary,
  parseLibrary,
  renameProject,
  selectProject,
  serializeLibrary,
  touchProject,
  type Carrier,
  type Library,
} from '../index';

function carriers(label = 'Mic 1'): Carrier[] {
  return [{ id: 'c1', label, freqKHz: 510000, locked: false }];
}

function base(): Library {
  return newLibrary('p1', carriers(), 1000);
}

describe('newLibrary', () => {
  it('starts with one active Untitled project', () => {
    const lib = base();
    expect(lib.version).toBe(LIBRARY_VERSION);
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p1');
    expect(activeProject(lib).name).toBe('Untitled');
    expect(activeProject(lib).updatedAt).toBe(1000);
  });
});

describe('createProject', () => {
  it('adds a project and makes it active', () => {
    const lib = createProject(base(), 'Ponec', 2000, 'p2', carriers());
    expect(lib.projects).toHaveLength(2);
    expect(lib.activeId).toBe('p2');
    expect(activeProject(lib).name).toBe('Ponec');
  });

  it('falls back to Untitled for a blank name', () => {
    const lib = createProject(base(), '   ', 2000, 'p2', carriers());
    expect(activeProject(lib).name).toBe('Untitled');
  });

  it('refuses to exceed the cap', () => {
    let lib = base();
    for (let i = 2; i <= MAX_PROJECTS; i += 1) {
      lib = createProject(lib, `p${i}`, 1000 + i, `id${i}`, carriers());
    }
    expect(isFull(lib)).toBe(true);
    const same = createProject(lib, 'one too many', 9999, 'overflow', carriers());
    expect(same).toBe(lib);
  });
});

describe('renameProject', () => {
  it('renames and stamps the edit', () => {
    const lib = renameProject(base(), 'p1', 'Svatba', 5000);
    expect(lib.projects[0].name).toBe('Svatba');
    expect(lib.projects[0].updatedAt).toBe(5000);
  });

  it('keeps Untitled for a blank name', () => {
    expect(renameProject(base(), 'p1', '  ', 5000).projects[0].name).toBe('Untitled');
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(renameProject(lib, 'nope', 'x', 5000)).toBe(lib);
  });
});

describe('duplicateProject', () => {
  it('copies the carriers under a copy name and activates it', () => {
    const lib = duplicateProject(renameProject(base(), 'p1', 'Ponec', 1000), 'p1', 3000, 'p2');
    expect(lib.projects).toHaveLength(2);
    expect(lib.activeId).toBe('p2');
    expect(activeProject(lib).name).toBe('Ponec copy');
    expect(activeProject(lib).carriers).toEqual(carriers());
  });

  it('does not share carrier objects with the original', () => {
    const lib = duplicateProject(base(), 'p1', 3000, 'p2');
    const original = lib.projects.find((p) => p.id === 'p1')!;
    const copy = lib.projects.find((p) => p.id === 'p2')!;
    expect(copy.carriers[0]).not.toBe(original.carriers[0]);
    expect(copy.settings).not.toBe(original.settings);
  });

  it('refuses to exceed the cap', () => {
    let lib = base();
    for (let i = 2; i <= MAX_PROJECTS; i += 1) {
      lib = createProject(lib, `p${i}`, 1000 + i, `id${i}`, carriers());
    }
    expect(duplicateProject(lib, 'p1', 9999, 'overflow')).toBe(lib);
  });
});

describe('deleteProject', () => {
  it('removes a project and keeps the active one', () => {
    const lib = deleteProject(
      createProject(base(), 'second', 2000, 'p2', carriers()),
      'p1',
      3000,
      'fresh',
      carriers(),
    );
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p2');
  });

  it('activates the most recently edited survivor when the active one goes', () => {
    let lib = base();
    lib = createProject(lib, 'older', 2000, 'p2', carriers());
    lib = createProject(lib, 'newest', 4000, 'p3', carriers());
    lib = touchProject(lib, 'p2', 'older', carriers(), DEFAULT_SETTINGS, 9000);
    lib = selectProject(lib, 'p3');
    const after = deleteProject(lib, 'p3', 10000, 'fresh', carriers());
    expect(after.activeId).toBe('p2');
  });

  it('leaves a fresh Untitled when the last project is deleted', () => {
    const lib = deleteProject(base(), 'p1', 3000, 'fresh', carriers('Mic 1'));
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('fresh');
    expect(activeProject(lib).name).toBe('Untitled');
    expect(activeProject(lib).carriers).toHaveLength(1);
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(deleteProject(lib, 'nope', 3000, 'fresh', carriers())).toBe(lib);
  });
});

describe('selectProject', () => {
  it('moves the active id without stamping an edit', () => {
    const lib = selectProject(createProject(base(), 'b', 2000, 'p2', carriers()), 'p1');
    expect(lib.activeId).toBe('p1');
    expect(lib.projects.find((p) => p.id === 'p1')!.updatedAt).toBe(1000);
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(selectProject(lib, 'nope')).toBe(lib);
  });
});

describe('touchProject', () => {
  it('writes the open project back and stamps it', () => {
    const next = carriers('Renamed');
    const lib = touchProject(base(), 'p1', 'Ponec', next, DEFAULT_SETTINGS, 7000);
    expect(activeProject(lib).name).toBe('Ponec');
    expect(activeProject(lib).carriers).toEqual(next);
    expect(activeProject(lib).updatedAt).toBe(7000);
  });
});

describe('serialize and parse', () => {
  it('round-trips', () => {
    const lib = createProject(base(), 'Ponec', 2000, 'p2', carriers());
    expect(parseLibrary(serializeLibrary(lib))).toEqual(lib);
  });

  it('returns null for junk', () => {
    expect(parseLibrary('not json')).toBeNull();
    expect(parseLibrary('[]')).toBeNull();
    expect(parseLibrary('{"version":1}')).toBeNull();
  });

  it('returns null for a library from a newer app', () => {
    const lib = base();
    expect(parseLibrary(JSON.stringify({ ...lib, version: LIBRARY_VERSION + 1 }))).toBeNull();
  });

  it('drops one unreadable project and keeps the rest', () => {
    const lib = createProject(base(), 'good', 2000, 'p2', carriers());
    const raw = JSON.parse(serializeLibrary(lib)) as Record<string, unknown>;
    (raw.projects as unknown[])[1] = { id: 'p1', name: 'broken', updatedAt: 1, carriers: 'not a list' };
    const parsed = parseLibrary(JSON.stringify(raw));
    expect(parsed).not.toBeNull();
    expect(parsed!.projects).toHaveLength(1);
    expect(parsed!.projects[0].id).toBe('p2');
  });

  it('returns null when every project is unreadable', () => {
    expect(
      parseLibrary(JSON.stringify({ version: LIBRARY_VERSION, activeId: 'p1', projects: [{ id: 'p1' }] })),
    ).toBeNull();
  });

  it('repairs an activeId that names no project', () => {
    const lib = { ...base(), activeId: 'ghost' };
    const parsed = parseLibrary(JSON.stringify(lib));
    expect(parsed!.activeId).toBe('p1');
  });
});

describe('migrateSingleProject', () => {
  it('wraps a v3 single project as the only library member', () => {
    const single = JSON.stringify({
      version: PROJECT_VERSION,
      name: 'Ponec',
      carriers: carriers(),
      settings: DEFAULT_SETTINGS,
    });
    const lib = migrateSingleProject(single, 'p1', 4242)!;
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p1');
    expect(activeProject(lib).name).toBe('Ponec');
    expect(activeProject(lib).updatedAt).toBe(4242);
  });

  it('returns null when the old payload is unreadable', () => {
    expect(migrateSingleProject('junk', 'p1', 1)).toBeNull();
  });
});
