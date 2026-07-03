/**
 * Generates cleaner-preview.html — the J small card (grid of 3, varied lengths,
 * photo + initial-fallback variants) and the H3 ledger profile (desktop + 380px
 * mobile with the sticky price/Book band). Realistic data. Review before merge.
 *
 * The headshot is downscaled+embedded via the pre-installed Chromium so the file is
 * self-contained. Fonts load from Google here; the site self-hosts Newsreader/Jost.
 *
 * Usage: npx tsx scripts/generate-cleaner-preview.ts
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function findChrome(): string {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const g = execFileSync('bash', [
    '-lc',
    'ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1',
  ])
    .toString()
    .trim();
  if (g) return g;
  throw new Error('Chromium not found; set CHROME=/path/to/chrome');
}

function headshotDataUri(): string {
  const url = 'file://' + join(process.cwd(), 'public/images/cleaner woman.jpg').replace(/ /g, '%20');
  const html = `<!doctype html><body><pre id="o"></pre><script>
(async()=>{const img=new Image();await new Promise(r=>{img.onload=r;img.onerror=r;img.src=${JSON.stringify(url)};});
const S=260,c=document.createElement('canvas');c.width=S;c.height=S;const g=c.getContext('2d');
const s=Math.min(img.naturalWidth,img.naturalHeight);g.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,S,S);
document.getElementById('o').textContent='D:'+c.toDataURL('image/jpeg',0.85);})();
</script></body>`;
  const dir = mkdtempSync(join(tmpdir(), 'cl-'));
  const p = join(dir, 'h.html');
  writeFileSync(p, html);
  const dom = execFileSync(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--virtual-time-budget=15000',
    '--dump-dom',
    `file://${p}`,
  ]).toString();
  const m = dom.match(/D:(data:image\/jpeg;base64,[A-Za-z0-9+/=]+)/);
  return m ? m[1] : '';
}

const PHOTO = headshotDataUri();

const CHECK_BADGE = `<span class="vcheck"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg></span>`;
const stars = (r: number) => {
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  return (
    '<span class="stars">' +
    '★'.repeat(full) +
    (half ? '★' : '') +
    '☆'.repeat(5 - full - (half ? 1 : 0)) +
    '</span>'
  );
};

function avatar(size: number, photo: string, initial: string, verified: boolean): string {
  const inner = photo
    ? `<img src="${photo}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block">`
    : `<div class="initial" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${initial}</div>`;
  return `<div class="avatar" style="width:${size}px;height:${size}px">${inner}${verified ? CHECK_BADGE : ''}</div>`;
}

const CARDS = [
  {
    name: 'Maria Santos',
    loc: 'E4',
    rate: '16.00',
    rating: 4.9,
    count: 128,
    verified: true,
    available: true,
    photo: PHOTO,
    bio: 'Professional cleaner with 8 years of experience. I take pride in leaving every home spotless and fresh, using eco-friendly products safe for families and pets.',
  },
  {
    name: 'James Wilson',
    loc: 'SW9',
    rate: '16.00',
    rating: 4.8,
    count: 312,
    verified: true,
    available: false,
    photo: '',
    bio: 'Detail-oriented cleaner focused on kitchens and bathrooms.',
  },
  {
    name: 'Aisha Johnson',
    loc: 'SW11',
    rate: '20.00',
    rating: 4.7,
    count: 189,
    verified: true,
    available: false,
    photo: '',
    bio: 'End-of-tenancy and Airbnb specialist. Fast, thorough, always on time. I bring my own eco-friendly products for every visit.',
  },
];

const cardHtml = (c: (typeof CARDS)[number]) => `
<div class="card">
  <div class="card-top">
    ${avatar(80, c.photo, c.name.charAt(0), c.verified)}
    <div class="card-main">
      <div class="cname">${c.name}</div>
      <div class="crow">${stars(c.rating)}<span class="cmeta">${c.rating} (${c.count})</span></div>
      <div class="cmeta2">${c.loc} · from <span class="serif-price">£${c.rate}</span><span class="hr">/hr</span></div>
      ${c.available ? '<div class="avail"><span class="dot"></span>Available today</div>' : ''}
    </div>
  </div>
  <p class="cbio">${c.bio}</p>
  <a class="book" href="#">Book now</a>
</div>`;

// Profile sample (photo variant, Maria) — real-shape services & ratings.
const P = {
  name: 'Maria Santos',
  loc: 'E4 · Chingford, London',
  rating: 4.9,
  reviews: 128,
  verifications: ['ID Verified', 'Insured'],
  fromRate: '16.00',
  services: [
    ['Regular cleaning', '£16.00/hr'],
    ['Deep cleaning', '£22.00/hr'],
    ['End of tenancy', 'from £150.00'],
    ['Airbnb cleaning', 'from £45.00'],
  ] as [string, string][],
  bio: 'Professional cleaner with 8 years of experience across regular, deep and end-of-tenancy work. I take pride in leaving every home spotless and fresh, and I use eco-friendly products that are safe for families and pets.',
  years: 8,
  jobs: 520,
  response: '~8 min',
  languages: ['English', 'Polish', 'Romanian'],
  ratings: [
    ['Thoroughness', 4.9],
    ['Punctuality', 4.8],
    ['Communication', 4.9],
    ['Value for money', 4.7],
  ] as [string, number][],
  reviewList: [
    ['Sarah T.', 5, 'Absolutely spotless — Maria was thorough and lovely. Booking again.', true],
    ['David K.', 5, 'On time, professional, and the flat has never looked better.', true],
    ['Priya M.', 4, 'Great deep clean of the kitchen and bathrooms. Recommended.', true],
  ] as [string, number, string, boolean][],
};

const profileHtml = (withPhoto: boolean) => `
<div class="profile">
  <div class="ph-header">
    ${avatar(72, withPhoto ? PHOTO : '', P.name.charAt(0), true)}
    <div class="ph-id">
      <div class="ph-name">${P.name}</div>
      <div class="crow">${stars(P.rating)}<span class="cmeta">${P.rating} (${P.reviews} reviews)</span></div>
      <div class="ph-loc">${P.loc}</div>
      <div class="ph-verif">${P.verifications.map((v) => `<span>✓ ${v}</span>`).join('')}</div>
    </div>
  </div>
  <div class="ph-band">
    <div><span class="from-label">From</span> <span class="serif-price big">£${P.fromRate}</span><span class="hr">/hr</span></div>
    <a class="book book-band" href="#">Book now</a>
  </div>
  <div class="ledger">
    <div class="sec-label">About</div>
    <p class="labout">${P.bio}</p>
    <div class="langrow"><span class="langlabel">Languages</span><span class="langval">${P.languages.join(', ')}</span></div>
    <div class="sec-label">Detailed ratings</div>
    ${P.ratings
      .map(
        ([l, v]) =>
          `<div class="bar-row"><span class="bar-l">${l}</span><span class="bar"><span class="bar-fill" style="width:${(v / 5) * 100}%"></span></span><span class="bar-v">${v.toFixed(1)}</span></div>`
      )
      .join('')}
    <div class="sec-label">Reviews (${P.reviews})</div>
    ${P.reviewList
      .map(
        ([n, r, t, ver]) =>
          `<div class="rev"><div class="rev-top"><span class="rev-name">${n}${ver ? '<span class="vpill">Verified</span>' : ''}</span>${stars(r as number)}</div><p class="rev-txt">${t}</p></div>`
      )
      .join('')}
    <div class="sec-label">Experience</div>
    <div class="exp-row">${P.years} yrs · ${P.jobs} jobs · ${P.response} response</div>
    <div class="sec-label">Services &amp; rates</div>
    ${P.services.map(([n, p]) => `<div class="lrow"><span>${n}</span><span class="serif-price">${p}</span></div>`).join('')}
    <div class="sec-label">Availability</div>
    <div class="availcal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => `<div class="avc${[1, 2, 3, 4, 5].includes(i) ? ' on' : ''}">${d}</div>`).join('')}</div>
    <div class="availcap">Mon–Fri · 8:00 AM – 6:00 PM · book any available day</div>
  </div>
</div>`;

const css = `
:root{--primary:#16296b;--primary-hover:#203a85;--primary-soft:#e7ecf6;--ink:#1B2A4A;--ink-2:#3D5170;--ink-3:#7A8A9E;--line:#E4E9F0;--trust:#16a34a;--rating:#d97706;--wash:#f7f8fb;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#eef0f4;font-family:'Jost',system-ui,sans-serif;color:var(--ink);padding:28px 20px 80px;}
h1.t{font-family:'Newsreader',serif;font-weight:500;font-size:22px;margin:0 0 4px;}
.sub{font-size:13px;color:#6b7280;margin-bottom:8px;}
.note{font-size:12px;color:#b45309;margin-bottom:20px;}
.seclabel{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:34px 0 10px;}
.serif-price{font-family:'Newsreader',serif;font-weight:500;color:var(--ink);}
.hr{font-family:'Jost';font-size:.82em;color:var(--ink-3);}
.stars{color:var(--rating);letter-spacing:1px;font-size:13px;}
.avatar{position:relative;flex:none;}
.avatar .initial{border-radius:50%;background:var(--primary-soft);color:var(--primary);font-family:'Newsreader',serif;font-weight:500;display:flex;align-items:center;justify-content:center;}
.vcheck{position:absolute;bottom:-2px;right:-2px;width:24px;height:24px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;}
.vcheck svg{width:20px;height:20px;color:var(--trust);}
/* cards */
.grid{display:flex;gap:20px;flex-wrap:wrap;}
.card{width:320px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;}
.card-top{display:flex;gap:16px;align-items:flex-start;}
.card-main{min-width:0;flex:1;}
.cname{font-family:'Newsreader',serif;font-weight:600;font-size:19px;color:var(--ink);}
.crow{display:flex;align-items:center;gap:6px;margin-top:4px;}
.cmeta{font-size:12px;color:var(--ink-2);font-weight:300;}
.cmeta2{font-size:12.5px;color:var(--ink-3);margin-top:4px;}
.avail{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;font-weight:500;color:var(--ink);}
.avail .dot{width:8px;height:8px;border-radius:50%;background:var(--trust);}
.cbio{margin-top:12px;font-size:13px;font-weight:300;line-height:1.5;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.book{margin-top:16px;display:block;text-align:center;background:var(--primary);color:#fff;border-radius:10px;padding:12px;font-size:13px;font-weight:500;text-decoration:none;}
.tf-eyebrow{margin-top:16px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--primary);}
.tf-slots{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.slot{border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:12px;font-weight:500;color:var(--ink-2);cursor:pointer;transition:all .15s;}
.slot.on,.slot:hover{border-color:var(--primary);background:var(--primary);color:#fff;}
/* profile */
.profile{width:720px;max-width:100%;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;}
.profile.mob{width:380px;}
.ph-header{display:flex;gap:18px;align-items:center;padding:26px 28px 20px;}
.ph-name{font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:var(--ink);}
.ph-loc{font-size:13px;color:var(--ink-3);margin-top:3px;}
.ph-verif{display:flex;gap:14px;margin-top:8px;}
.ph-verif span{font-size:12px;font-weight:500;color:var(--trust);}
.ph-band{display:flex;align-items:center;justify-content:space-between;gap:16px;background:var(--wash);border-top:1px solid var(--ink);padding:16px 28px;}
.from-label{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);}
.serif-price.big{font-size:26px;}
.book-band{background:var(--primary);color:#fff;border-radius:10px;padding:11px 22px;font-size:13px;font-weight:500;text-decoration:none;white-space:nowrap;}
.ledger{padding:6px 28px 28px;}
.sec-label{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:24px 0 8px;}
.lrow{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-top:1px solid var(--line);font-size:14px;color:var(--ink-2);}
.exp-row{border-top:1px solid var(--line);padding:11px 0;font-size:14px;color:var(--ink-2);}
.langrow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding:11px 0;}
.langlabel{flex:none;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);}
.langval{flex:1;min-width:0;text-align:right;font-size:14px;color:var(--ink-2);}
.availcal{display:flex;gap:6px;padding-top:6px;}
.avc{flex:1;text-align:center;padding:10px 0;border-radius:8px;font-size:12px;font-weight:500;color:var(--ink-3);background:#f4f5f7;}
.avc.on{background:var(--primary-soft);color:var(--primary);}
.availcap{margin-top:8px;font-size:12px;color:var(--ink-3);}
.labout{font-size:14px;font-weight:300;line-height:1.7;color:var(--ink-2);padding-top:4px;}
.bar-row{display:flex;align-items:center;gap:12px;padding:7px 0;}
.bar-l{width:130px;font-size:13px;color:var(--ink-2);font-weight:300;}
.bar{flex:1;height:6px;border-radius:999px;background:var(--primary-soft);overflow:hidden;}
.bar-fill{display:block;height:100%;background:var(--rating);border-radius:999px;}
.bar-v{width:28px;text-align:right;font-size:13px;font-weight:500;}
.rev{padding:14px 0;border-top:1px solid var(--line);}
.rev-top{display:flex;align-items:center;justify-content:space-between;}
.rev-name{font-size:14px;font-weight:500;color:var(--ink);display:flex;align-items:center;gap:8px;}
.vpill{font-size:10px;font-weight:500;color:var(--trust);background:#f0fdf4;border-radius:999px;padding:2px 7px;}
.rev-txt{font-size:14px;font-weight:300;line-height:1.6;color:var(--ink-2);margin-top:6px;}
.framelabel{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:0 0 10px;}
.row2{display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap;}
/* mobile sticky band demo */
.mobwrap{width:380px;border:1px solid var(--line);border-radius:16px;overflow:hidden;position:relative;background:#fff;height:640px;}
.mobscroll{height:100%;overflow-y:auto;padding-bottom:70px;}
.mobscroll .profile{width:100%;border:none;border-radius:0;}
.mobscroll .ph-band{display:none;}
.mob-sticky{position:absolute;left:0;right:0;bottom:0;background:var(--wash);border-top:1px solid var(--ink);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
`;

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cleaner surfaces preview — J card + H3 profile</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<h1 class="t">Cleaner surfaces — J card + H3 ledger profile</h1>
<p class="sub">Realistic data. Card 1 shows the photo variant; cards 2 & 3 show the serif-initial fallback. Prices, verifications and ratings render the real data shape only.</p>
<p class="note">Preview note: headshot downscaled+embedded here; the live surfaces render the cleaner's real photo (User.image) when present, initial otherwise. "Insured"/"ID Verified" show only when true in the data.</p>

<div class="seclabel">J small card — grid of 3</div>
<div class="grid">${CARDS.map(cardHtml).join('')}</div>

<div class="seclabel">Time-first available card (J presentation) — slot pills unselected &amp; hover/selected</div>
<div class="grid">${[false, true]
  .map((sel) => {
    const slots = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM'];
    return `<div class="card" style="width:340px">
    <div class="card-top">${avatar(80, PHOTO, 'M', true)}<div class="card-main">
      <div class="cname">Maria Santos</div>
      <div class="crow">${stars(4.9)}<span class="cmeta">4.9 (128)</span></div>
      <div class="cmeta2">E4 · from <span class="serif-price">£16.00</span><span class="hr">/hr</span></div>
    </div></div>
    <p class="cbio" style="margin-top:12px">Professional cleaner with 8 years of experience — thorough, punctual, eco-friendly products.</p>
    <p class="tf-eyebrow">Available Tuesday 14 July</p>
    <div class="tf-slots">${slots.map((s, i) => `<span class="slot${sel && i === 2 ? ' on' : ''}">${s}</span>`).join('')}</div>
  </div>`;
  })
  .join('')}</div>
<p class="note" style="max-width:700px">Note: the slot pill IS the action (clicking books that slot — one-step, unchanged). "Selected" shown here is the hover/press state; there is no persistent selected-slot state or separate Book CTA in the live card (adding one would change booking behaviour — flagged separately).</p>

<div class="seclabel">H3 ledger profile — desktop (photo) &amp; initial-fallback header</div>
<div class="row2">
  <div><div class="framelabel">Desktop — photo variant</div>${profileHtml(true)}</div>
</div>

<div class="seclabel">Mobile ~380px — sticky price/Book band pinned to the viewport bottom</div>
<div class="framelabel">Scroll inside the frame; the band stays pinned</div>
<div class="mobwrap"><div class="mobscroll">${profileHtml(false)}</div>
  <div class="mob-sticky"><div><span class="from-label">From</span> <span class="serif-price big" style="font-size:22px">£${P.fromRate}</span><span class="hr">/hr</span></div><a class="book-band" href="#">Book now</a></div>
</div>

<div class="seclabel">Languages row — fit check at 360px (1 language vs many, same padding/hairline/label edge as Experience)</div>
<div style="width:360px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:2px 20px;">
  <div class="langrow"><span class="langlabel">Languages</span><span class="langval">English</span></div>
  <div class="langrow"><span class="langlabel">Languages</span><span class="langval">English, Polish, Romanian, Spanish, Portuguese</span></div>
</div>
</body></html>`;

writeFileSync(join(process.cwd(), 'cleaner-preview.html'), page, 'utf8');
// eslint-disable-next-line no-console
console.log('Wrote cleaner-preview.html' + (PHOTO ? '' : ' (WARNING: headshot embed failed)'));
