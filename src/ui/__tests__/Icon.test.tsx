import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from '../Icon';

describe('Icon', () => {
  it('renders every supported icon as a hidden SVG that inherits colour', () => {
    const names: IconName[] = [
      'lock',
      'unlock',
      'delete',
      'add',
      'analyse',
      'tune',
      'project',
      'close',
      'more',
    ];

    for (const name of names) {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).not.toContain('<title');
    }
  });
});
