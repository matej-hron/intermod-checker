import { describe, it, expect } from 'vitest';
import { serializeProject, parseProject, isProjectFile, PROJECT_VERSION } from '../project';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

const carriers: Carrier[] = [
  { id: 'a', label: 'Lead vocal', freqKHz: 510000 },
  { id: 'b', label: 'Guitar', freqKHz: 530000 },
];

describe('project files', () => {
  it('round-trips a project', () => {
    const json = serializeProject('Main stage', carriers, DEFAULT_SETTINGS);
    const parsed = parseProject(json);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.version).toBe(PROJECT_VERSION);
    expect(parsed.name).toBe('Main stage');
    expect(parsed.carriers).toEqual(carriers);
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects malformed JSON', () => {
    const parsed = parseProject('{not json');
    expect('error' in parsed).toBe(true);
  });

  it('rejects a file that is not a project', () => {
    const parsed = parseProject(JSON.stringify({ hello: 'world' }));
    expect('error' in parsed).toBe(true);
  });

  it('rejects a newer file version', () => {
    const parsed = parseProject(
      JSON.stringify({
        version: PROJECT_VERSION + 1,
        name: 'x',
        carriers,
        settings: DEFAULT_SETTINGS,
      }),
    );
    expect('error' in parsed).toBe(true);
  });

  it('fills in missing settings keys with the defaults', () => {
    const parsed = parseProject(
      JSON.stringify({
        version: PROJECT_VERSION,
        name: 'x',
        carriers,
        settings: { bandMinKHz: 470000 },
      }),
    );
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.settings.bandMinKHz).toBe(470000);
    expect(parsed.settings.highOrder).toBe(DEFAULT_SETTINGS.highOrder);
  });

  it('rejects a file with duplicate carrier identifiers', () => {
    const json = JSON.stringify({
      version: 1,
      name: 'p',
      carriers: [
        { id: 'x', label: 'a', freqKHz: 510000 },
        { id: 'x', label: 'b', freqKHz: 530000 },
      ],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProject(json);
    expect('error' in parsed).toBe(true);
  });

  it('replaces non-numeric settings with the defaults', () => {
    const json = JSON.stringify({
      version: 1,
      name: 'p',
      carriers: [
        { id: 'a', label: 'a', freqKHz: 510000 },
        { id: 'b', label: 'b', freqKHz: 530000 },
      ],
      settings: { ...DEFAULT_SETTINGS, bandMinKHz: 'not-a-number', oddOnly: 'yes' },
    });
    const parsed = parseProject(json);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.settings.bandMinKHz).toBe(DEFAULT_SETTINGS.bandMinKHz);
    expect(parsed.settings.oddOnly).toBe(DEFAULT_SETTINGS.oddOnly);
  });

  it('does not treat a mistyped settings object as a project file', () => {
    expect(isProjectFile({ version: 1, name: 'p', carriers: [], settings: {} })).toBe(false);
  });
});
