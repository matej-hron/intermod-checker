import {
  MAX_ORDER,
  MAX_CARRIERS,
  MIN_CARRIERS,
  type Carrier,
  type Settings,
  type ValidationIssue,
} from './types';

export function validate(
  carriers: readonly Carrier[],
  settings: Settings,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (settings.bandMinKHz >= settings.bandMaxKHz) {
    issues.push({
      field: 'settings',
      message: 'The band start must be lower than the band end.',
      carrierIds: [],
    });
  }
  if (settings.lowOrder < 2) {
    issues.push({
      field: 'settings',
      message: 'The lowest order must be at least 2.',
      carrierIds: [],
    });
  }
  if (!Number.isInteger(settings.lowOrder) || !Number.isInteger(settings.highOrder)) {
    issues.push({
      field: 'settings',
      message: 'The orders must be whole numbers.',
      carrierIds: [],
    });
  }
  // Nothing else bounds highOrder, and enumeration cost explodes with it, so an
  // imported or hand-edited value has to be caught before it reaches the engine.
  if (settings.highOrder > MAX_ORDER) {
    issues.push({
      field: 'settings',
      message: `The highest order must not exceed ${MAX_ORDER}.`,
      carrierIds: [],
    });
  }
  if (settings.lowOrder > settings.highOrder) {
    issues.push({
      field: 'settings',
      message: 'The lowest order must not exceed the highest order.',
      carrierIds: [],
    });
  }
  if (settings.suggestionStepKHz <= 0) {
    issues.push({
      field: 'settings',
      message: 'The suggestion step must be greater than zero.',
      carrierIds: [],
    });
  }
  if (settings.nearHitWindowKHz < 0 || settings.deviationKHz < 0) {
    issues.push({
      field: 'settings',
      message: 'The near-hit window and deviation must not be negative.',
      carrierIds: [],
    });
  }
  if (settings.minSpacingKHz < 0) {
    issues.push({
      field: 'settings',
      message: 'The minimum spacing must not be negative.',
      carrierIds: [],
    });
  }

  if (carriers.length < MIN_CARRIERS) {
    issues.push({
      field: 'carriers',
      message: `Add at least ${MIN_CARRIERS} frequencies to run an analysis.`,
      carrierIds: [],
    });
  }
  if (carriers.length > MAX_CARRIERS) {
    issues.push({
      field: 'carriers',
      message: `Remove frequencies — at most ${MAX_CARRIERS} are supported.`,
      carrierIds: [],
    });
  }

  // analyze() keys its per-carrier hit map by id, so a repeated id would
  // silently discard one carrier's results instead of failing loudly.
  const seenIds = new Set<string>();
  const reportedDuplicateIds = new Set<string>();
  for (const c of carriers) {
    if (seenIds.has(c.id) && !reportedDuplicateIds.has(c.id)) {
      reportedDuplicateIds.add(c.id);
      issues.push({
        field: 'carriers',
        message: 'Two entries share the same identifier.',
        carrierIds: [c.id],
      });
    }
    seenIds.add(c.id);
  }

  for (const c of carriers) {
    if (!Number.isInteger(c.freqKHz)) {
      issues.push({
        field: 'frequency',
        message: 'Frequencies must be whole kilohertz.',
        carrierIds: [c.id],
      });
      continue;
    }
    if (c.freqKHz < settings.bandMinKHz || c.freqKHz > settings.bandMaxKHz) {
      issues.push({
        field: 'frequency',
        message: `${(c.freqKHz / 1000).toFixed(3)} MHz is outside the selected band.`,
        carrierIds: [c.id],
      });
    }
  }

  const sorted = [...carriers].sort((a, b) => a.freqKHz - b.freqKHz);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const gap = current.freqKHz - previous.freqKHz;
    if (gap === 0) {
      issues.push({
        field: 'frequency',
        message: 'Duplicate frequency — every transmitter needs its own.',
        carrierIds: [previous.id, current.id],
      });
    } else if (gap < settings.minSpacingKHz) {
      issues.push({
        field: 'frequency',
        message: `Spacing of ${gap} kHz is below the minimum of ${settings.minSpacingKHz} kHz.`,
        carrierIds: [previous.id, current.id],
      });
    }
  }

  return issues;
}
