import { describe, it, expect } from 'vitest';
import { serializeProject, parseProject, PROJECT_VERSION } from '../project';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

const carriers: Carrier[] = [
  { id: 'a', label: 'Lead vocal', freqKHz: 510000, locked: false },
  { id: 'b', label: 'Guitar', freqKHz: 530000, locked: false },
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

});

describe('v2 migration', () => {
  it('loads a version 1 file with locked false and no exclusions', () => {
    const json = JSON.stringify({
      version: 1,
      name: 'Old',
      carriers: [
        { id: 'a', label: 'Mic 1', freqKHz: 510000 },
        { id: 'b', label: 'Mic 2', freqKHz: 530000 },
      ],
      settings: { bandMinKHz: 500000, bandMaxKHz: 700000 },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers.every((c) => c.locked === false)).toBe(true);
    expect(parsed.settings.exclusions).toEqual([]);
  });

  it('round-trips a version 2 file', () => {
    const carriers = [
      { id: 'a', label: 'Mic 1', freqKHz: 510000, locked: true },
      { id: 'b', label: 'Mic 2', freqKHz: 530000, locked: false },
    ];
    const settings = {
      ...DEFAULT_SETTINGS,
      exclusions: [
        { id: 'x1', label: 'Local DTV', startKHz: 566000, endKHz: 574000 },
      ],
    };
    const parsed = parseProject(serializeProject('P', carriers, settings));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.version).toBe(2);
    expect(parsed.carriers).toEqual(carriers);
    expect(parsed.settings.exclusions).toEqual(settings.exclusions);
  });

  it('rejects a version 3 file', () => {
    const parsed = parseProject(
      JSON.stringify({ version: 3, name: 'Future', carriers: [], settings: {} }),
    );
    expect('error' in parsed).toBe(true);
  });

  it('normalizes a reversed exclusion range on load', () => {
    const json = JSON.stringify({
      version: 2,
      name: 'P',
      carriers: [{ id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false }],
      settings: {
        exclusions: [{ id: 'x', label: 'Backwards', startKHz: 600000, endKHz: 560000 }],
      },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.settings.exclusions[0]).toEqual({
      id: 'x',
      label: 'Backwards',
      startKHz: 560000,
      endKHz: 600000,
    });
  });

  it('drops malformed exclusions rather than passing NaN to the engine', () => {
    const json = JSON.stringify({
      version: 2,
      name: 'P',
      carriers: [{ id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false }],
      settings: { exclusions: [{ id: 'x', label: 'Bad', startKHz: '560000', endKHz: 600000 }] },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.settings.exclusions).toEqual([]);
  });
});
