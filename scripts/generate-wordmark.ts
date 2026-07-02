/**
 * Renders the "RENA" wordmark PNG for emails from the site's Etna brand font,
 * matching the navbar treatment (font-etna, weight 600, tracking-widest / 0.1em,
 * colour ink #1B2A4A). Output: transparent PNG at public/icons/rena-wordmark-email.png.
 *
 * Uses the pre-installed Chromium (no extra deps): a headless page loads the local
 * Etna OTF (embedded as a data-URI so no file-access flags are needed), draws the
 * wordmark onto a canvas sized exactly to the glyphs, and exports a transparent PNG.
 *
 * Usage:
 *   npx tsx scripts/generate-wordmark.ts
 *   CHROME=/path/to/chrome npx tsx scripts/generate-wordmark.ts   # override binary
 *
 * Re-run only if the brand font / treatment changes; the PNG is committed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function findChrome(): string {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  // Playwright's bundled Chromium (this environment).
  const globed = execFileSync('bash', [
    '-lc',
    'ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1',
  ])
    .toString()
    .trim();
  if (globed && existsSync(globed)) return globed;
  throw new Error('Chromium not found; set CHROME=/path/to/chrome');
}

const otfB64 = readFileSync(join(process.cwd(), 'public/fonts/etna-free-font.otf')).toString(
  'base64'
);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
@font-face{font-family:'EtnaEmail';src:url(data:font/otf;base64,${otfB64}) format('opentype');font-weight:600;font-style:normal;}
html,body{margin:0;background:transparent;}
</style></head><body>
<pre id="out"></pre>
<script>
(async function(){
  try{
    await document.fonts.load("600 240px 'EtnaEmail'");
    await document.fonts.ready;
    const text='RENA', size=240, ls=Math.round(size*0.1);
    const meas=document.createElement('canvas').getContext('2d');
    meas.font="600 "+size+"px 'EtnaEmail'"; meas.letterSpacing=ls+'px';
    const m=meas.measureText(text);
    const asc=Math.ceil(m.actualBoundingBoxAscent||size*0.72);
    const desc=Math.ceil(m.actualBoundingBoxDescent||size*0.05);
    const padX=Math.round(size*0.06), padY=Math.round(size*0.10);
    const w=Math.ceil(m.width - ls + padX*2);
    const h=asc+desc+padY*2;
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d');
    g.clearRect(0,0,w,h);
    g.font="600 "+size+"px 'EtnaEmail'"; g.letterSpacing=ls+'px';
    g.textBaseline='alphabetic'; g.fillStyle='#1B2A4A';
    g.fillText(text, padX, padY+asc);
    document.getElementById('out').textContent="RESULT:"+w+"x"+h+":"+c.toDataURL('image/png');
  }catch(e){ document.getElementById('out').textContent="ERR:"+e.message; }
})();
</script></body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'wordmark-'));
const htmlPath = join(dir, 'wordmark.html');
writeFileSync(htmlPath, html, 'utf8');

const dom = execFileSync(findChrome(), [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--virtual-time-budget=12000',
  '--dump-dom',
  `file://${htmlPath}`,
]).toString();

const match = dom.match(/RESULT:(\d+)x(\d+):data:image\/png;base64,([A-Za-z0-9+/=]+)/);
if (!match) {
  const err = dom.match(/ERR:[^<]*/);
  throw new Error(`Render failed: ${err ? err[0] : 'no result in DOM'}`);
}

const [, w, h, b64] = match;
const out = join(process.cwd(), 'public/icons/rena-wordmark-email.png');
writeFileSync(out, Buffer.from(b64, 'base64'));
// eslint-disable-next-line no-console
console.log(`Wrote ${out} (${w}x${h}).`);
