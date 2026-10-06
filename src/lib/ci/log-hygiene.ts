// RENA-066 (register, B1b): the CI grep's logic. A console call in src/lib or
// src/app/api fails when its ARGUMENTS (interpolations and every argument
// after the first) carry a payload, a recipient (`to`), an email, a phone, a
// postcode, an address, a body or a subject. Words inside the message text do
// not count. src/lib/log.ts and tests are excluded.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const HYGIENE_ROOTS = ['src/lib', 'src/app/api'];
const SKIP = [/\.test\.tsx?$/, /^src\/lib\/log\.ts$/];
const CONSOLE = /console\.(log|info|warn|error|debug)\(/;
const BAD =
  /\b(payload|email|e-mail|phone|mobile|postcode|address|body|htmlBody|subject)\b|\.to\b|\bto\b(?=\s*[,)}])/i;

export function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listSourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !SKIP.some((r) => r.test(p))) out.push(p);
  }
  return out;
}

/** The argument expressions of a console call: interpolations plus everything after the first argument. */
export function argumentText(statement: string): string {
  const open = statement.search(CONSOLE);
  const inner = statement.slice(statement.indexOf('(', open) + 1);
  const interps = Array.from(inner.matchAll(/\$\{([^}]*)\}/g)).map((m) => m[1]);
  const rest = inner.replace(/^\s*(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1\s*,?/, '');
  const restNoStrings = rest.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, '""');
  return [...interps, restNoStrings].join(' ');
}

/** Violations in source text, as `line: text` strings (line numbers 1-based). */
export function violationsInSource(source: string): Array<{ line: number; text: string }> {
  const hits: Array<{ line: number; text: string }> = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!CONSOLE.test(lines[i])) continue;
    let stmt = lines[i];
    let j = i;
    while (!/\);\s*$/.test(stmt) && j < i + 8 && j + 1 < lines.length) {
      j += 1;
      stmt += `\n${lines[j]}`;
    }
    if (BAD.test(argumentText(stmt))) hits.push({ line: i + 1, text: lines[i].trim() });
  }
  return hits;
}

export function findViolations(files: string[]): string[] {
  return files.flatMap((file) =>
    violationsInSource(readFileSync(file, 'utf8')).map((h) => `${file}:${h.line}: ${h.text}`)
  );
}
