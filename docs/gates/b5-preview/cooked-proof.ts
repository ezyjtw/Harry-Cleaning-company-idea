/* eslint-disable no-console */
// STRING-LAW proof (CLAUDE.md): the DELIVERED injection, cooked as the engine
// cooks it, never the source text. Usage: tsx cooked-proof.ts <App.tsx> [cleanApp.tsx]
import { readFileSync } from 'node:fs';

import ts from 'typescript';

const NAMES = ['HIDE_CHROME_JS', 'SEAM_KILL_JS', 'PREFETCH_KILL_JS', 'DRESSED_JS', 'PERF_JS'];

function load(path: string) {
  const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const decls = new Map<string, ts.Expression>();
  src.forEachChild(function visit(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) decls.set(n.name.text, n.initializer);
    n.forEachChild(visit);
  });
  const cook = (e: ts.Expression): string => {
    if (ts.isNoSubstitutionTemplateLiteral(e) || ts.isStringLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e))
      return e.head.text + e.templateSpans.map((s) => cook(s.expression) + s.literal.text).join('');
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return cook(e.left) + cook(e.right);
    if (ts.isParenthesizedExpression(e)) return cook(e.expression);
    if (ts.isNumericLiteral(e)) return e.text;
    if (ts.isIdentifier(e) && decls.has(e.text)) return cook(decls.get(e.text) as ts.Expression);
    throw new Error(`cannot cook ${ts.SyntaxKind[e.kind]} ${e.getText().slice(0, 60)}`);
  };
  const values: Record<string, string | null> = {};
  const lone: string[] = [];
  for (const n of NAMES) {
    const e = decls.get(n);
    values[n] = e ? cook(e) : null;
    if (e) {
      const raw = e.getText();
      // A lone backslash in the raw source: one not part of a doubled pair.
      const m = raw.match(/(?<!\\)\\(?!\\)/g);
      if (m) lone.push(`${n}: ${m.length}`);
    }
  }
  return { values, lone };
}

const [file, clean] = process.argv.slice(2);
const t = load(file);
const delivered = NAMES.filter((n) => t.values[n] !== null).map((n) => t.values[n]).join('');
let parse = 'clean';
try {
  // The proof IS a parse of the delivered string (STRING-LAW): nothing runs it.
  // eslint-disable-next-line no-new-func
  new Function(delivered);
} catch (e) {
  parse = `SYNTAX ERROR: ${(e as Error).message}`;
}
const out: string[] = [
  `${file}`,
  `  blocks present: ${NAMES.filter((n) => t.values[n] !== null).join(', ')}`,
  `  delivered length ${delivered.length}; new Function(delivered): ${parse}`,
  `  lone backslashes in raw literals: ${t.lone.length ? t.lone.join('; ') : 'none'}`,
];
if (clean) {
  const c = load(clean);
  const cleanDelivered = NAMES.filter((n) => n !== 'PERF_JS' && c.values[n] !== null).map((n) => c.values[n]).join('');
  const twinWithoutPerf = NAMES.filter((n) => n !== 'PERF_JS' && t.values[n] !== null).map((n) => t.values[n]).join('');
  out.push(`  identical to the clean commit apart from PERF_JS: ${twinWithoutPerf === cleanDelivered}`);
}
console.log(out.join('\n'));
if (parse !== 'clean') process.exitCode = 1;
