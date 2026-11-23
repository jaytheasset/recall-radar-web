import type { APIRoute } from 'astro';
import { categoryRoutes, siteRecalls } from '../lib/recall-data';
import { sourceLandingPages } from '../lib/source-landing-pages';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/', '/checker', '/countries', '/product-types', '/recall-search-guide', '/about', '/contact', '/privacy',
    ...sourceLandingPages.map(({ route }) => route),
    ...categoryRoutes.filter(({ category }) => category !== 'unknown').map(({ href }) => href),
    ...siteRecalls.map(({ detailPath }) => detailPath)
  ];
  const locations = [...new Set(paths)].map((path) => {
    const url = new URL(`${path.replace(/\/+$/, '')}/`, site);
    return `  <url><loc>${escapeXml(url.href)}</loc></url>`;
  });

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
  );
};
