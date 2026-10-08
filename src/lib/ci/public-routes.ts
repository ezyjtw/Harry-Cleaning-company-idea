// Hash law (CLAUDE.md, James-ruled 2026-10-06): the one canonical list of the
// 28 baselined public routes lives in docs/public-routes.json. Humans read the
// copy in CLAUDE.md (a unit test keeps the two identical); the hash tool and
// CI read this module, so neither can drift from the law.
import list from '../../../docs/public-routes.json';

export const PUBLIC_ROUTES: readonly string[] = list.routes;

/**
 * The content hash input for a served public page: scripts stripped, script
 * and stylesheet chunk links and asset version stamps normalised, so two
 * builds of identical content hash identically (build ids and chunk names
 * differ per build). Same method as the B1b sweep.
 */
export function normaliseForHash(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link[^>]*(?:_next|\.js)[^>]*>/g, '')
    .replace(/\?v=[0-9]+/g, '')
    .replace(/\/_next\/static\/[^"' )]+/g, '/_next/static/X');
}

/** Routes that are in CLAUDE.md's hash-law list, parsed from its bullet list. */
export function routesFromClaudeMd(markdown: string): string[] {
  const start = markdown.indexOf('<!-- public-routes:start -->');
  const end = markdown.indexOf('<!-- public-routes:end -->');
  if (start < 0 || end < 0) return [];
  return markdown
    .slice(start, end)
    .split('\n')
    .map((l) => /^-\s+`([^`]+)`/.exec(l.trim())?.[1])
    .filter((r): r is string => !!r);
}
