/**
 * Generates section-preview.html — the restyled S3 "Our services" section rendered
 * standalone (desktop + a ~380px mobile frame), interactive tabs, realistic data,
 * incl. the proposed 3-item tick-list copy for all 5 services. For review before merge.
 *
 * Service photos are downscaled to embedded JPEG data-URIs (via the pre-installed
 * Chromium) so the file is self-contained and opens anywhere. Preview loads
 * Newsreader/Jost from Google Fonts for convenience; the real site self-hosts them.
 *
 * Usage: npx tsx scripts/generate-section-preview.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function findChrome(): string {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const globed = execFileSync('bash', [
    '-lc',
    'ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1',
  ])
    .toString()
    .trim();
  if (globed) return globed;
  throw new Error('Chromium not found; set CHROME=/path/to/chrome');
}

// Mirrors messages/en.json Services + the SERVICE_IMAGES map in ServicesSection.tsx.
const SERVICES = [
  {
    id: 'regular',
    title: 'Regular cleaning',
    description:
      'Weekly or fortnightly visits with your preferred cleaner. Consistent quality at a time that works for you.',
    price: 'From £14/hr',
    includes: [
      'All rooms, kitchen & bathrooms',
      'Your own products or theirs',
      'Same cleaner, flexible schedule',
    ],
    file: 'public/images/Regular cleaning.png',
    soon: false,
  },
  {
    id: 'same-day',
    title: 'Same day cleaning',
    description:
      "Need a cleaner today? We'll match you with a vetted, available cleaner near you for a same-day visit.",
    price: 'From £18/hr',
    includes: [
      'Matched with an available cleaner',
      'Vetted & background-checked',
      'Booked and cleaned today',
    ],
    file: 'public/images/Same day cleaning.png',
    soon: true,
  },
  {
    id: 'deep',
    title: 'Deep cleaning',
    description:
      'Top-to-bottom. Inside appliances, skirting boards, and every corner. A thorough reset for your home.',
    price: 'From £20/hr',
    includes: [
      'Inside appliances & cupboards',
      'Skirting boards, doors & frames',
      'Every corner, top to bottom',
    ],
    file: 'public/images/Deep cleaning.png',
    soon: false,
  },
  {
    id: 'end-of-tenancy',
    title: 'End of tenancy',
    description:
      'Landlord-ready cleaning with a satisfaction guarantee. Give yourself the best chance of your deposit back.',
    price: 'From £150',
    includes: [
      'Landlord-ready checklist',
      'Backed by a satisfaction guarantee',
      'Best chance of your deposit back',
    ],
    file: 'public/images/End of Tenancy.png',
    soon: false,
  },
  {
    id: 'airbnb',
    title: 'Airbnb cleaning',
    description:
      'Fast, reliable turnarounds between guests. Checklist-based, linen-ready, every time.',
    price: 'From £45',
    includes: [
      'Fast turnarounds between guests',
      'Checklist-based every visit',
      'Linen change & restock',
    ],
    file: 'public/images/Air BnB cleaning.png',
    soon: false,
  },
];

// Downscale all photos to embedded JPEG data-URIs via headless Chromium canvas.
function downscaleImages(): Record<string, string> {
  const items = SERVICES.map((s) => ({
    id: s.id,
    url: 'file://' + join(process.cwd(), s.file).replace(/ /g, '%20'),
  }));
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="out"></pre>
<script>
(async function(){
  const items=${JSON.stringify(items)};
  const out={};
  for(const it of items){
    await new Promise((res)=>{
      const img=new Image();
      img.onload=()=>{
        const W=760, scale=W/img.naturalWidth, H=Math.round(img.naturalHeight*scale);
        const c=document.createElement('canvas'); c.width=W; c.height=H;
        c.getContext('2d').drawImage(img,0,0,W,H);
        out[it.id]=c.toDataURL('image/jpeg',0.82);
        res();
      };
      img.onerror=()=>{ out[it.id]=''; res(); };
      img.src=it.url;
    });
  }
  document.getElementById('out').textContent='JSON:'+JSON.stringify(out);
})();
</script></body></html>`;
  const dir = mkdtempSync(join(tmpdir(), 'section-'));
  const p = join(dir, 'dl.html');
  writeFileSync(p, html);
  const dom = execFileSync(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--virtual-time-budget=20000',
    '--dump-dom',
    `file://${p}`,
  ]).toString();
  const m = dom.match(/JSON:(\{.*\})/);
  if (!m) throw new Error('image downscale failed');
  return JSON.parse(m[1]);
}

const imgs = downscaleImages();

const dataScript = `const SERVICES=${JSON.stringify(
  SERVICES.map((s) => ({ ...s, img: imgs[s.id] || '' }))
)};`;

const page = `<!doctype html><html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>S3 — Our services section preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--primary:#16296b;--primary-hover:#203a85;--primary-soft:#e7ecf6;--ink:#1B2A4A;--ink-2:#3D5170;--ink-3:#7A8A9E;--line:#E4E9F0;--trust:#16a34a;--rating:#d97706;--wash-to:#eef3fb;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#eef0f4;font-family:'Jost',system-ui,sans-serif;color:var(--ink);padding:28px 20px 60px;}
  .head{max-width:1200px;margin:0 auto 22px;}
  .head h1{font-family:'Newsreader',serif;font-weight:500;font-size:22px;margin-bottom:4px;}
  .head p{font-size:13px;color:#6b7280;}
  .note{font-size:12px;color:#b45309;margin-top:6px;}
  .frames{display:flex;gap:36px;align-items:flex-start;flex-wrap:wrap;justify-content:center;}
  .framelabel{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:0 0 8px 2px;}
  .desktop{width:1000px;max-width:100%;}
  .mobile{width:380px;}
  .sec{background:#fff;}
  .sec .eyebrow{font-size:11px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--primary);margin-bottom:8px;}
  .sec h2{font-family:'Newsreader',serif;font-weight:500;line-height:1.1;color:var(--ink);margin-bottom:26px;}
  .desktop .sec h2{font-size:42px;} .mobile .sec h2{font-size:30px;margin-bottom:18px;}
  .card{border:1px solid var(--line);border-radius:22px;overflow:hidden;background:#fff;}
  .tabs{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;}
  .tabs::-webkit-scrollbar{display:none;}
  .tab{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:none;border-radius:999px;padding:9px 16px;font-family:'Jost';font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em;text-indent:.06em;background:transparent;color:var(--ink-2);cursor:pointer;transition:all .15s;}
  .tab.active{background:var(--primary);color:#fff;}
  .tab.soon{color:var(--ink-3);cursor:default;}
  .chip{border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0;text-indent:0;padding:2px 6px;}
  .panel{display:grid;grid-template-columns:1.05fr .95fr;min-height:235px;}
  .content{padding:36px;}
  .content h3{font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:var(--ink);margin-bottom:8px;}
  .content .desc{font-size:14px;line-height:1.6;color:var(--ink-2);max-width:440px;margin-bottom:20px;}
  .inc{list-style:none;margin-bottom:24px;}
  .inc li{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;}
  .inc svg{flex:none;margin-top:2px;color:var(--trust);}
  .inc span{font-size:13px;line-height:1.35;color:var(--ink);}
  .priceRow{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  .price{font-family:'Newsreader',serif;font-weight:500;font-size:24px;color:var(--ink);}
  .price .hr{font-family:'Jost';font-weight:400;font-size:15px;color:var(--ink-2);}
  .cta{display:inline-block;background:var(--primary);color:#fff;border-radius:10px;padding:12px 24px;font-family:'Jost';font-weight:500;font-size:14px;text-decoration:none;}
  .photo{position:relative;overflow:hidden;min-height:235px;}
  .photo img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;}
  .photo .ph{width:100%;height:100%;background:linear-gradient(135deg,var(--primary-soft),var(--wash-to));}
  /* mobile frame overrides */
  .mobile .panel{display:flex;flex-direction:column;}
  .mobile .photo{min-height:0;height:180px;order:1;}
  .mobile .content{order:2;padding:22px;}
  .mobile .cta{display:block;text-align:center;width:100%;}
  .copytable{max-width:1000px;margin:44px auto 0;background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 24px;}
  .copytable h3{font-family:'Newsreader',serif;font-weight:600;font-size:18px;margin-bottom:12px;}
  .copytable .row{padding:12px 0;border-top:1px solid var(--line);}
  .copytable .row:first-of-type{border-top:none;}
  .copytable .svc{font-weight:600;font-size:13px;color:var(--primary);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
  .copytable .bul{font-size:13px;color:var(--ink-2);}
</style></head>
<body>
<div class="head">
  <h1>S3 — “Our services” section restyle</h1>
  <p>Desktop + mobile (~380px). Click the tabs to switch services. Same Day is disabled with a SOON chip.</p>
  <p class="note">Preview note: service photos are downscaled+embedded for a self-contained file; the live section uses the existing full-res images. Fonts load from Google here; the site self-hosts Newsreader/Jost.</p>
</div>
<div class="frames">
  <div class="desktop"><div class="framelabel">Desktop</div><div class="sec"><div class="eyebrow">Our services</div><h2>Whatever your home needs</h2><div id="cardD"></div></div></div>
  <div class="mobile"><div class="framelabel">Mobile ~380px</div><div class="sec"><div class="eyebrow">Our services</div><h2>Whatever your home needs</h2><div id="cardM"></div></div></div>
</div>
<div class="copytable" id="copy"></div>
<script>
${dataScript}
const CHECK='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
function priceHtml(p){const hr=/\\/hr\\s*$/.test(p);const main=hr?p.replace(/\\/hr\\s*$/,''):p;return '<span class="price">'+main+(hr?'<span class="hr">/hr</span>':'')+'</span>';}
function render(rootId, active){
  const root=document.getElementById(rootId);
  const s=SERVICES[active];
  const tabs=SERVICES.map((x,i)=>{
    const cls='tab'+(i===active?' active':'')+(x.soon?' soon':'');
    const chip=x.soon?'<span class="chip">Soon</span>':'';
    return '<button class="'+cls+'" data-i="'+i+'" '+(x.soon?'disabled':'')+'>'+x.title.toUpperCase()+chip+'</button>';
  }).join('');
  const photo=s.img?'<img src="'+s.img+'" alt="'+s.title+'">':'<div class="ph"></div>';
  const inc=s.includes.map(b=>'<li>'+CHECK+'<span>'+b+'</span></li>').join('');
  root.innerHTML='<div class="card"><div class="tabs">'+tabs+'</div>'+
    '<div class="panel"><div class="content"><h3>'+s.title+'</h3><p class="desc">'+s.description+'</p>'+
    '<ul class="inc">'+inc+'</ul><div class="priceRow">'+priceHtml(s.price)+'<a class="cta" href="#">Book a Cleaner Now</a></div></div>'+
    '<div class="photo">'+photo+'</div></div></div>';
  root.querySelectorAll('.tab').forEach(b=>{ if(!b.disabled) b.addEventListener('click',()=>render(rootId, +b.dataset.i)); });
}
render('cardD',0); render('cardM',0);
document.getElementById('copy').innerHTML='<h3>Proposed “what’s included” copy — all 5 services (for approval)</h3>'+
  SERVICES.map(s=>'<div class="row"><div class="svc">'+s.title+' · '+s.price+'</div><div class="bul">'+s.includes.join('  ·  ')+'</div></div>').join('');
</script>
</body></html>`;

writeFileSync(join(process.cwd(), 'section-preview.html'), page, 'utf8');
// eslint-disable-next-line no-console
console.log('Wrote section-preview.html');
