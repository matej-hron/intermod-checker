/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

describe('Task 3 setup redesign source', () => {
  it('updates CarrierList to use the heading block, icon actions, and explicit state classes', () => {
    const source = read('ui/CarrierList.tsx');

    expect(source).toContain("import { Icon } from './Icon';");
    expect(source).toContain('<div className="panel__heading">');
    expect(source).toContain('<span className="eyebrow">Setup</span>');
    expect(source).toContain('<h2>Frequency plan</h2>');
    expect(source).toContain('<p className="hint">{carriers.length} active frequencies</p>');
    expect(source).toContain("const classes = ['carrier'];");
    expect(source).toContain("if (flagged.has(carrier.id)) classes.push('carrier--invalid');");
    expect(source).toContain("if (conflicted.has(carrier.id)) classes.push('carrier--conflict');");
    expect(source).toContain("if (result && !conflicted.has(carrier.id)) classes.push('carrier--clear');");
    expect(source).toContain('className={classes.join(\' \')}');
    expect(source).toContain('className="carrier__state-mark"');
    expect(source).toContain('<Icon name="add" />');
    expect(source).toContain("carrier.locked ? 'lock' : 'unlock'");
    expect(source).toContain('<Icon name="delete" />');
    expect(source).not.toContain('🔒');
    expect(source).not.toContain('🔓');
    expect(source).not.toContain('🗑');
  });

  it('groups CarrierSheet sections with icon controls and no inline styles', () => {
    const source = read('ui/CarrierSheet.tsx');

    expect(source).toContain("import { Icon } from './Icon';");
    expect(source).toContain('<div className="sheet__header">');
    expect(source).toContain('dialog.current?.close()');
    expect(source).toContain('className="sheet__close"');
    expect(source).toContain('className="sheet__section sheet__section--frequency"');
    expect(source).toContain('className="sheet__section sheet__section--device"');
    expect(source).toContain('className="sheet__section sheet__section--actions"');
    expect(source).toContain('<span className="eyebrow">Frequency</span>');
    expect(source).toContain('<span className="eyebrow">Device</span>');
    expect(source).toContain('<span className="eyebrow">Actions</span>');
    expect(source).toContain('<Icon name="close"');
    expect(source).toContain('<Icon name="tune"');
    expect(source).toContain('<Icon name="delete"');
    expect(source).not.toContain('style={{');
  });

  it('updates SettingsPanel to show the current summary and grouped field classes', () => {
    const source = read('ui/SettingsPanel.tsx');

    expect(source).toContain("import { DEFAULT_SETTINGS, kHzToMHzText } from '../im';");
    expect(source).toContain('{kHzToMHzText(settings.bandMinKHz)}–{kHzToMHzText(settings.bandMaxKHz)} MHz');
    expect(source).toContain("{' · '}orders {settings.lowOrder}–{settings.highOrder}");
    expect(source).toContain("{' · '}{settings.minSpacingKHz} kHz spacing");
    expect(source).toContain('className="field-group field-group--band"');
    expect(source).toContain('className="field-group field-group--order"');
    expect(source).toContain('className="field-group field-group--spacing"');
  });

  it('adds the new setup styling hooks to components.css', () => {
    const source = read('styles/components.css');

    expect(source).toContain('.panel__heading');
    expect(source).toContain('.eyebrow');
    expect(source).toContain('.carrier__state-mark');
    expect(source).toContain('.carrier--conflict');
    expect(source).toContain('.carrier--clear');
    expect(source).toContain('.sheet__close');
    expect(source).toContain('.sheet__section');
    expect(source).toContain('.field-group');
    expect(source).toContain('.live-check');
  });
});
