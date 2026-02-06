import type { BadgeOptions } from './types.js';

function getColor(score: number, passed: boolean): string {
  if (!passed) return '#e05d44'; // red
  if (score >= 80) return '#44cc11'; // green
  if (score >= 50) return '#dfb317'; // yellow
  return '#e05d44'; // red
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateBadge(score: number, passed: boolean, options?: Partial<BadgeOptions>): string {
  const label = options?.label ?? 'app review';
  const color = getColor(score, passed);
  const statusText = passed ? `${score}/100` : `fail ${score}/100`;

  const labelWidth = label.length * 6.5 + 10;
  const statusWidth = statusText.length * 6.5 + 10;
  const totalWidth = labelWidth + statusWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(statusText)}">
  <title>${escapeXml(label)}: ${escapeXml(statusText)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text aria-hidden="true" x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(statusText)}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${escapeXml(statusText)}</text>
  </g>
</svg>`;
}
