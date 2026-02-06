import { generateBadge } from '../../src/badge/generator.js';

describe('generateBadge', () => {
  it('should generate valid SVG', () => {
    const svg = generateBadge(85, true);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('should include score text', () => {
    const svg = generateBadge(85, true);
    expect(svg).toContain('85/100');
  });

  it('should include label text', () => {
    const svg = generateBadge(85, true);
    expect(svg).toContain('app review');
  });

  it('should use custom label', () => {
    const svg = generateBadge(85, true, { label: 'iOS Review' });
    expect(svg).toContain('iOS Review');
  });

  it('should use green for high scores (>=80)', () => {
    const svg = generateBadge(80, true);
    expect(svg).toContain('#44cc11');
  });

  it('should use yellow for medium scores (>=50, <80)', () => {
    const svg = generateBadge(65, true);
    expect(svg).toContain('#dfb317');
  });

  it('should use red for low scores (<50)', () => {
    const svg = generateBadge(30, true);
    expect(svg).toContain('#e05d44');
  });

  it('should use red for failed regardless of score', () => {
    const svg = generateBadge(90, false);
    expect(svg).toContain('#e05d44');
    expect(svg).toContain('fail');
  });

  it('should include fail text when not passed', () => {
    const svg = generateBadge(45, false);
    expect(svg).toContain('fail 45/100');
  });

  it('should have proper ARIA attributes', () => {
    const svg = generateBadge(85, true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label=');
  });

  it('should escape XML special characters in label', () => {
    const svg = generateBadge(85, true, { label: 'test<>&"' });
    expect(svg).toContain('test&lt;&gt;&amp;&quot;');
    expect(svg).not.toContain('test<>&"');
  });

  it('should handle score of 0', () => {
    const svg = generateBadge(0, false);
    expect(svg).toContain('0/100');
  });

  it('should handle score of 100', () => {
    const svg = generateBadge(100, true);
    expect(svg).toContain('100/100');
  });
});
