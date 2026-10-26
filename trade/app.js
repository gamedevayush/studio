// Lets Trade front end. Everything arrives encrypted (data.enc, t/<id>.enc) and is opened
// in the browser with a key derived from his password. No framework, no build step.
// timemachine.js: Trade Check engine (Day Trader pack port). signals.js and universe.js are copied from live/src at build.
import { timeMachine, verdict, historyRun, sizeTrade, riskCheck, DEFAULT_RULES, istDay } from './timemachine.js';
import { UNIVERSE } from './universe.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

// ---------- icons ----------
const ICONS = {
  home: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
  library: '<path d="M12 3 21 8l-9 5-9-5 9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  videos: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
  mine: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="m14.5 7.5 3 3"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
  candles: '<path d="M8 3v3M8 17v4M16 6v3M16 15v3"/><rect x="5.5" y="6" width="5" height="11" rx="1"/><rect x="13.5" y="9" width="5" height="6" rx="1"/>',
  signal: '<path d="m3 17 5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  options: '<path d="M4 19V9M9 19V5M14 19v-8M19 19V8"/>',
  backtest: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M10 8h5M10 12h5"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- navigation ----------
const MAIN = [
  { id: 'home', href: '#/', label: 'Overview', short: 'Home', icon: 'home' },
  { id: 'live', href: '#/live', label: 'Live Market', short: 'Live', icon: 'signal' },
  { id: 'library', href: '#/library', label: 'Strategy Library', short: 'Library', icon: 'library' },
  { id: 'videos', href: '#/videos', label: 'YouTube Research', short: 'Videos', icon: 'videos', dock: false },
  { id: 'mine', href: '#/mine', label: 'My Strategies', short: 'Mine', icon: 'mine' },
  { id: 'race', href: '#/race', label: 'Paper Race', short: 'Race', icon: 'journal', dock: false },
  { id: 'check', href: '#/check', label: 'Trade Check', short: 'Check', icon: 'backtest', dock: false },
  { id: 'scan', href: '#/scan', label: 'Stock Scanner', short: 'Scanner', icon: 'search', dock: false },
  { id: 'news', href: '#/news', label: 'Market News', short: 'News', icon: 'globe', dock: false },
];

// What he has decided so far for the sections that come in later stages.
const LATER = [
  { id: 'charts', label: 'Live Charts', stage: 4, icon: 'candles', lines: [
    '5 min chart for entries, 1 hr and above for trend',
    'Candles, higher high / lower low, support-resistance, rectangle, breakout, retest',
    'Supertrend, MACD, RSI'] },
  { id: 'signals', label: 'Trading Signals', stage: 4, icon: 'signal', lines: [
    'Instant alerts as soon as the setup forms (right when the candle closes)',
    'Every signal contains entry, stop-loss, target, and rationale',
    'Alerts only. Orders are placed manually by you; the system will never execute orders automatically.'] },
  { id: 'options', label: 'Options Analysis', stage: 5, icon: 'options', lines: [
    'Nifty / Bank Nifty options',
    'Dedicated option premium charts',
    'Open Interest and OI change'] },
  { id: 'backtest', label: 'Backtesting', stage: 3, icon: 'backtest', lines: [
    'Win rate, average profit/loss, max drawdown, risk-reward',
    'Factoring in brokerage, regulatory charges, and slippage',
    'YouTube strategies and your custom strategies will be tested separately',
    'Past performance is no guarantee of future results. Weaknesses will also be highlighted.'] },
  { id: 'alerts', label: 'Alerts', stage: 4, icon: 'bell', lines: [
    'Via Telegram',
    'Now: every new strategy (new YouTube uploads, books, manuals)',
    'Now: live market alerts 9:15-3:30 (see Live Market)',
    'Later: choose which alerts to get from the site'] },
  { id: 'journal', label: 'Trade Journal', stage: 5, icon: 'journal', lines: [
    'Every alert signal alongside your actual executed trade',
    'Includes trade outcomes to verify which strategies actually work'] },
];

const STAGES = [
  'Website + strategy library (books, manuals, new YouTube uploads)',
  'Your custom rules converted into testable conditions',
  'Historical data + backtesting',
  'Live data, signals, and Telegram alerts (live watch running)',
  'Options, crypto, and trade journal',
];

const SECTIONS = [
  ['setup', 'Setup', 'Pre-conditions that must form first'],
  ['entry', 'Entry', 'When to enter'],
  ['stopLoss', 'Stop-loss', ''],
  ['target', 'Target', ''],
  ['exit', 'Exit', 'Trailing, time-based, or alternative exits'],
  ['filters', 'Filters', 'Confirmation criteria and when to avoid trades'],
];

const STATUS = {
  extracted: 'Strategy extracted',
  transcribed: 'Waiting for strategy check',
  queued: 'In queue',
  failed: 'Failed',
  'no-strategy': 'No strategy found',
  skipped: 'Skipped',
};

const STYLE_NAMES = { options: 'Options', intraday: 'Intraday', swing: 'Swing', crypto: 'Crypto',
  investing: 'Investing', futures: 'Futures', commodity: 'Commodity', forex: 'Forex' };

// ---------- formatting ----------
const clock = (sec) => {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
};
const hours = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const views = (n) => {
  if (!n) return '';
  if (n >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const date = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const ago = (iso) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  if (min < 2880) return 'yesterday';
  if (min < 43200) return `${Math.round(min / 1440)}d ago`;
  return date(iso);
};
const yt = (id, t) => `https://www.youtube.com/watch?v=${id}${t ? `&t=${Math.floor(t)}s` : ''}`;
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const pacificDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// ---------- crypto ----------
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (buf) => {
  const a = new Uint8Array(buf); let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
};

let META, KEY, DATA;
const transcripts = new Map();

// Same derivation as scripts/build.mjs: the first 32 of 64 PBKDF2 bytes are the AES key.
async function deriveKey(pw, extractable) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64d(META.salt), iterations: META.iterations }, base, 512);
  return crypto.subtle.importKey('raw', new Uint8Array(bits).slice(0, 32), 'AES-GCM', extractable, ['decrypt']);
}

async function openBox(url, key) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`load ${res.status}`);
  const box = await res.json();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(box.iv) }, key, b64d(box.ct));
  if (!box.z) return new TextDecoder().decode(plain);
  // transcripts are gzipped before encryption (scripts/build.mjs)
  return new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

// On Studio, a visitor of the home page already has Studio's COOP/COEP service worker, and an
// old copy of it would isolate this page too (blocking YouTube thumbnails and fonts). The current
// worker skips /studio/trade/, so fetch it and reload once.
async function leaveIsolation() {
  if (!window.crossOriginIsolated || !navigator.serviceWorker) return false;
  if (sessionStorage.getItem('lt.swfix')) return false;
  sessionStorage.setItem('lt.swfix', '1');
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    // Reloading before the new worker takes control would just get the old headers again.
    const takenOver = new Promise((done) => {
      navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
      setTimeout(done, 4000);
    });
    await reg.update().catch(() => {});
    if (reg.installing || reg.waiting) await takenOver;
  }
  location.reload();
  return true;
}

async function boot() {
  try { if (await leaveIsolation()) return; } catch { /* keep going isolated */ }
  try {
    META = await (await fetch('meta.json', { cache: 'no-store' })).json();
  } catch {
    showLock('Failed to load site. Please check your internet connection and refresh.');
    return;
  }
  const saved = LS.get('lt.key');
  if (saved && LS.get('lt.salt') === META.salt) {
    try {
      KEY = await crypto.subtle.importKey('raw', b64d(saved), 'AES-GCM', false, ['decrypt']);
      DATA = JSON.parse(await openBox('data.enc', KEY));
      return start();
    } catch {
      LS.del('lt.key'); // password changed since this device saved it
    }
  }
  showLock();
}

function showLock(msg = '') {
  $('#app').hidden = true;
  $('#lock').hidden = false;
  $('#lock-err').textContent = msg;
  $('#pw').focus();
}

$('#lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#unlock'), err = $('#lock-err');
  const remember = $('#remember').checked;
  btn.disabled = true; btn.textContent = 'Opening…'; err.textContent = '';
  try {
    const key = await deriveKey($('#pw').value, remember);
    DATA = JSON.parse(await openBox('data.enc', key));
    if (remember) {
      LS.set('lt.key', b64e(await crypto.subtle.exportKey('raw', key)));
      LS.set('lt.salt', META.salt);
    }
    KEY = key;
    $('#pw').value = '';
    start();
  } catch (ex) {
    err.textContent = ex.name === 'OperationError' ? 'Incorrect password.' : 'Failed to load, please try again.';
  } finally {
    btn.disabled = false; btn.textContent = 'Open';
  }
});

function lock() {
  LS.del('lt.key');
  location.hash = '#/';
  location.reload();
}

// ---------- data helpers ----------
let CH = {}, ALL = [], VID = {}, DOC = {};

function prepare() {
  CH = Object.fromEntries(DATA.channels.map((c) => [c.id, c]));
  VID = Object.fromEntries(DATA.videos.map((v) => [v.id, v]));
  DOC = Object.fromEntries((DATA.docs || []).map((d) => [d.docId, d]));
  ALL = [...DATA.mine, ...DATA.strategies];
  if (!DATA.videos.some((v) => v.st === 'extracted')) ui.vid.st = 'all';
}

const rulesOf = (s) => SECTIONS.flatMap(([k]) => s.rules?.[k] || []);
const counts = (s) => {
  const r = rulesOf(s);
  return { stated: r.filter((x) => x.basis === 'stated').length,
    inferred: r.filter((x) => x.basis === 'inferred').length, missing: (s.missing || []).length };
};
const meter = (c) => {
  const n = { idea: 1, partial: 2, full: 3 }[c] || 0;
  return `<span class="meter" title="${esc(c)}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
};
const COMPLETE = { full: 'Complete', partial: 'Incomplete', idea: 'Concept only' };
// Where a strategy came from: his own rules, a book/manual he shared, or a new YouTube upload.
const srcName = (s) => s.source === 'mine' ? 'My Strategy'
  : s.source === 'doc' ? (DOC[s.docId]?.short || DOC[s.docId]?.title || s.docId)
  : CH[s.channel]?.name || s.channel;
const srcLabel = (s) => s.source === 'mine'
  ? '<span class="card-src"><span class="dot"></span>My Strategy</span>'
  : `<span class="card-src">${esc(srcName(s))}</span>`;
const untested = (s) => s.source === 'doc' && DOC[s.docId]?.kind === 'manual';

// ---------- shell ----------
function navItem(item, current) {
  return `<a class="nav-item${item.id === current ? ' on' : ''}" href="${item.href || `#/later/${item.id}`}">
    ${icon(item.icon)}<span>${esc(item.label)}</span>${item.stage ? `<span class="tag">S${item.stage}</span>` : ''}</a>`;
}

function renderShell(current) {
  $('#side').innerHTML = `
    <a class="brand" href="#/"><span class="logo" aria-hidden="true"></span><span>Lets Trade</span></a>
    <div class="nav-label">Research</div>
    ${MAIN.map((i) => navItem(i, current)).join('')}
    <div class="nav-label">Market · Later</div>
    ${LATER.map((i) => navItem(i, current)).join('')}
    <div class="side-foot"><span title="${esc(DATA.builtAt || '')}">${DATA.builtAt ? `Updated ${esc(ago(DATA.builtAt))}` : ''}</span>
      <button class="icon-btn" data-action="lock" aria-label="Lock" title="Lock">${icon('lock')}</button></div>`;
  const laterOn = LATER.some((l) => l.id === current) || MAIN.some((i) => i.dock === false && i.id === current);
  $('#dock').innerHTML = MAIN.filter((i) => i.dock !== false).map((i) =>
    `<a href="${i.href}" class="${i.id === current ? 'on' : ''}">${icon(i.icon)}<span>${i.short}</span></a>`).join('') +
    `<button data-action="sheet" class="${laterOn ? 'on' : ''}">${icon('more')}<span>More</span></button>`;
}

function openSheet() {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-label="More sections">
    ${MAIN.filter((i) => i.dock === false).map((i) => navItem(i, null)).join('')}
    <div class="nav-label">Market · Later</div>
    ${LATER.map((i) => navItem(i, null)).join('')}
    <button class="nav-item" data-action="lock" style="width:100%;background:none;border:0;cursor:pointer">${icon('lock')}<span>Lock</span></button>
  </div>`;
  sheet.hidden = false;
}

// ---------- pages ----------
function pageHome() {
  const v = DATA.videos;
  const by = (st) => v.filter((x) => x.st === st);
  const used = DATA.usage?.day === pacificDay() ? DATA.usage.seconds || 0 : 0;
  const latest = [...ALL].filter((s) => s.source !== 'doc')
    .sort((a, b) => (b.extractedAt || b.updatedAt || '').localeCompare(a.extractedAt || a.updatedAt || '')).slice(0, 6);
  const fromDocs = DATA.strategies.filter((s) => s.source === 'doc').length;
  const fromVideos = DATA.strategies.length - fromDocs;
  const waiting = by('queued').length + by('failed').length + by('transcribed').length;

  return `
  <div class="page-head"><div><div class="kicker">Overview</div><h1>Trading desk</h1>
    <p>Strategies from the books and manuals you shared, new expert videos and your own rules. Live market alerts are next.</p></div></div>

  <div class="panel" id="home-race" style="margin-bottom:16px"><div class="panel-head"><h2>Paper Race · standings</h2><a href="#/race">Open the race</a></div>
    <div class="empty">Loading…</div></div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Strategies</div><div class="stat-value">${ALL.length}</div>
      <div class="stat-sub">${fromDocs} from books · ${fromVideos} from videos · ${DATA.mine.length} mine</div></div>
    <div class="stat"><div class="stat-label">Backtest-ready</div><div class="stat-value">${ALL.filter((s) => s.testable).length}</div>
      <div class="stat-sub">every rule can be checked by a computer</div></div>
    <div class="stat"><div class="stat-label">New videos checked</div><div class="stat-value">${by('extracted').length + by('no-strategy').length + by('skipped').length}</div>
      <div class="stat-sub">${by('extracted').length} with a strategy · ${waiting} waiting</div></div>
    <div class="stat"><div class="stat-label">Next video check</div><div class="stat-value">${nextCheck()}</div>
      <div class="stat-sub">twice a day, 8:00 and 18:00 IST</div></div>
  </div>

  <div class="grid-2">
    <div class="stack">
      <div class="panel">
        <div class="panel-head"><h2>Sources</h2><a href="#/library">Library</a></div>
        <div class="list-rows">${(DATA.docs || []).map((d) => `
          <a class="row" href="#/library" data-src="${esc(d.docId)}" style="grid-template-columns:1fr auto">
            <div><div class="row-title">${esc(d.title)}</div>
            <div class="row-sub">${esc(d.publisher || '')} · ${d.pages} pages · ${esc(d.trust || '')}</div></div>
            <span class="mono">${d.count}</span></a>`).join('')}
          <a class="row" href="#/videos" style="grid-template-columns:1fr auto">
            <div><div class="row-title">New uploads: ${DATA.channels.map((c) => esc(c.name)).join(', ')}</div>
            <div class="row-sub">Checked twice a day, transcribed and read by free Gemini. Old videos are not read.</div></div>
            <span class="mono">${fromVideos}</span></a></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>New from videos</h2><a href="#/videos">Videos</a></div>
        ${latest.length ? `<div class="list-rows">${latest.map((s) => `
          <a class="row" href="#/s/${esc(s.sid)}" style="grid-template-columns:1fr auto">
            <div><div class="row-title">${esc(s.name)}</div>
            <div class="row-sub">${esc(srcName(s))} · ${esc(ago(s.extractedAt || s.updatedAt))}</div></div>
            ${meter(s.completeness)}</a>`).join('')}</div>`
        : `<div class="empty"><strong>No new-video strategies yet</strong>When a channel uploads a strategy video, it appears here and on Telegram.</div>`}
      </div>
    </div>

    <div class="stack">
      <div class="panel">
        <div class="panel-head"><h2>Market sites</h2></div>
        <div class="list-rows">${(DATA.links || []).map((l) => `
          <a class="row" href="${esc(l.url)}" target="_blank" rel="noopener" style="grid-template-columns:1fr auto">
            <div><div class="row-title">${esc(l.name)}</div><div class="row-sub">${esc(l.use)}</div></div>${icon('ext')}</a>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Video pipeline</h2></div>
        <div class="facts">
          <div class="fact"><span>Channels</span><span>${DATA.channels.map((c) => esc(c.name)).join(', ')}</span></div>
          <div class="fact"><span>New video check</span><span>8:00 and 18:00 IST</span></div>
          <div class="fact" style="display:block"><div style="display:flex;justify-content:space-between">
            <span class="muted">Gemini today (free)</span><span class="mono">${hours(used)} / ${hours(DATA.budget)}</span></div>
            <div class="bar"><i style="width:${Math.min(100, used / DATA.budget * 100).toFixed(1)}%"></i></div></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Roadmap</h2></div>
        <div class="roadmap">${STAGES.map((t, i) => `
          <div class="step${i === 0 ? ' now' : ''}"><span class="step-n">${i + 1}</span><span>${esc(t)}</span>
          ${i === 0 ? '<span class="tag tag-accent">Current</span>' : i === 3 ? '<span class="tag">Next</span>' : ''}</div>`).join('')}</div>
      </div>
    </div>
  </div>`;
}

// Next tracker run (8:00 or 18:00 IST), worked out in India time whatever the device clock zone.
function nextCheck() {
  const ist = new Date(Date.now() + 330 * 60000);
  const h = ist.getUTCHours() + ist.getUTCMinutes() / 60;
  return h < 8 ? '8:00' : h < 18 ? '18:00' : '8:00 tmrw';
}

// Library filters are remembered per device.
const ui = {
  lib: Object.assign({ q: '', src: 'all', ch: 'all', style: 'all', tf: 'all', comp: 'all', test: false, sort: 'new' },
    JSON.parse(LS.get('lt.lib') || '{}')),
  vid: { ch: 'all', st: 'extracted', q: '', limit: 60 },
};

function chipRow(label, key, options, state) {
  return `<div class="chips"><span class="lbl">${esc(label)}</span>${options.map(([v, text, n]) =>
    `<button class="chip" data-f="${key}" data-v="${esc(v)}" aria-pressed="${String(state[key]) === String(v)}">${esc(text)}${n !== undefined ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
}

function pageLibrary() {
  const f = ui.lib;
  const tfs = [...new Set(ALL.flatMap((s) => s.timeframes || []))];
  const styles = ['options', 'intraday', 'swing', 'crypto'];
  return `
  <div class="page-head"><div><div class="kicker">Strategy Library</div><h1>Strategies</h1>
    <p>Every rule shows whether it is <b>stated in the source</b> (with the page or video time) or <b>inferred</b> by AI. Anything the source leaves out is tagged.</p></div></div>
  <div class="toolbar">
    <label class="search">${icon('search')}<input class="input" id="lib-q" type="search" placeholder="Search: rectangle, supertrend, bank nifty…" value="${esc(f.q)}"></label>
    <details class="filters" ${filtersOpen() ? 'open' : ''}><summary>Filters${activeFilters()}</summary><div class="toolbar">
    ${chipRow('Source', 'src', [['all', 'All', ALL.length],
      ...(DATA.docs || []).map((d) => [d.docId, d.short || d.title, d.count]),
      ['expert', 'New videos', DATA.strategies.filter((s) => s.source === 'expert').length], ['mine', 'Mine', DATA.mine.length]], f)}
    ${f.src === 'expert' ? chipRow('Channel', 'ch', [['all', 'All'], ...DATA.channels.map((c) => [c.id, c.name])], f) : ''}
    ${chipRow('Style', 'style', [['all', 'All'], ...styles.map((s) => [s, STYLE_NAMES[s]])], f)}
    ${tfs.length ? chipRow('Timeframe', 'tf', [['all', 'All'], ...tfs.sort().map((t) => [t, t])], f) : ''}
    ${chipRow('Rules', 'comp', [['all', 'All'], ['full', 'Complete'], ['partial', 'Incomplete'], ['idea', 'Concept only']], f)}
    <div class="chips"><span class="lbl"></span>
      <button class="chip" data-toggle="test" aria-pressed="${f.test}">Backtest-ready only</button>
      <select class="input" id="lib-sort" style="width:auto;height:30px;padding:0 10px;font-size:12.5px">
        <option value="new"${f.sort === 'new' ? ' selected' : ''}>Newest first</option>
        <option value="views"${f.sort === 'views' ? ' selected' : ''}>Most views</option>
      </select></div>
    </div></details>
  </div>
  <div id="lib-results"></div>`;
}

// On phones the filter block starts folded so the strategies are visible first.
let filtersOpenState = null;
const filtersOpen = () => filtersOpenState ?? window.innerWidth > 900;
function activeFilters() {
  const f = ui.lib;
  const n = ['src', 'style', 'tf', 'comp'].filter((k) => f[k] !== 'all').length +
    (f.src === 'expert' && f.ch !== 'all' ? 1 : 0) + (f.test ? 1 : 0);
  return n ? ` <span class="tag tag-accent">${n}</span>` : '';
}

function libResults() {
  const f = ui.lib;
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = ALL.filter((s) => {
    if (f.src !== 'all' && s.source !== f.src && s.docId !== f.src) return false;
    if (f.src === 'expert' && f.ch !== 'all' && s.channel !== f.ch) return false;
    if (f.style !== 'all' && !(s.styles || []).includes(f.style)) return false;
    if (f.tf !== 'all' && !(s.timeframes || []).includes(f.tf)) return false;
    if (f.comp !== 'all' && s.completeness !== f.comp) return false;
    if (f.test && !s.testable) return false;
    if (!words.length) return true;
    const hay = [s.name, s.summary, s.videoTitle, srcName(s), ...(s.indicators || []), ...(s.patterns || []),
      ...(s.instruments || []), ...(s.timeframes || []), ...rulesOf(s).map((r) => r.text)].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => f.sort === 'views'
    ? (b.views || 0) - (a.views || 0)
    : (b.extractedAt || b.updatedAt || '').localeCompare(a.extractedAt || a.updatedAt || '') ||
      (a.docId || '').localeCompare(b.docId || '') || (a.n || 0) - (b.n || 0));

  $('#lib-results').innerHTML = `<div class="result-line">${list.length} ${list.length === 1 ? 'strategy' : 'strategies'}</div>` +
    (list.length ? `<div class="cards">${list.map(card).join('')}</div>`
      : `<div class="panel empty"><strong>No results found</strong>${ALL.length ? 'Try clearing some filters.' : 'The library is empty.'}</div>`);
}

function card(s) {
  const c = counts(s);
  const tags = [...(s.styles || []).map((x) => STYLE_NAMES[x] || x), ...(s.timeframes || []), ...(s.indicators || []).slice(0, 3)];
  return `<a class="card" href="#/s/${esc(s.sid)}">
    <div class="card-top">${srcLabel(s)}<span>${s.kind === 'concept' ? 'Concept' : 'Strategy'}</span></div>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.summary)}</p>
    ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${s.testable ? '<span class="tag tag-accent">Backtest-ready</span>' : ''}${untested(s) ? '<span class="tag tag-down">Untested</span>' : ''}</div>` : ''}
    <div class="card-foot">${meter(s.completeness)}<span>${c.stated} stated · ${c.inferred} inferred · ${c.missing} missing</span></div>
  </a>`;
}

function pageStrategy(sid) {
  const s = ALL.find((x) => x.sid === sid);
  if (!s) return `<a class="back" href="#/library">${icon('back')}Library</a><div class="panel empty"><strong>Strategy not found</strong>It may have been modified or removed. Please reopen from the library.</div>`;
  const mine = s.source === 'mine';
  const doc = s.source === 'doc' ? DOC[s.docId] || { title: s.docId } : null;
  const statedLabel = mine ? 'Defined by you' : doc ? 'Stated in document' : 'Stated in video';
  const dir = { long: '<span class="tag tag-up">Long / Buy</span>', short: '<span class="tag tag-down">Short / Sell</span>',
    both: '<span class="tag tag-up">Buy</span> <span class="tag tag-down">Sell</span>' }[s.direction] || '<span class="faint">Unspecified</span>';
  const list = (a) => (a && a.length ? esc(a.join(', ')) : '<span class="faint">Unspecified</span>');

  const rule = (r) => r.basis === 'stated'
    ? `<li class="rule"><div class="rule-text">${esc(r.text)}</div><div class="rule-meta">
        ${Number.isFinite(r.t) && s.source === 'expert' ? `<a class="ts" href="${yt(s.videoId, r.t)}" target="_blank" rel="noopener">▶ ${clock(r.t)}</a>` : ''}
        ${Number.isFinite(r.p) && doc ? `<span class="ts">p. ${r.p}</span>` : ''}
        <span>${statedLabel}</span></div>${r.quote ? `<div class="rule-why">“${esc(r.quote)}”</div>` : ''}</li>`
    : `<li class="rule inferred"><div class="rule-text">${esc(r.text)}</div>
        <div class="rule-meta"><span>Inferred by AI</span></div>${r.why ? `<div class="rule-why">${esc(r.why)}</div>` : ''}</li>`;

  return `
  <a class="back" href="#/library">${icon('back')}Library</a>
  <div class="detail-head">
    <div class="kicker">${mine ? 'My Strategy' : doc ? `${doc.kind === 'manual' ? 'Manual' : 'Book'} · ${esc(doc.publisher || doc.title)}` : `Expert · ${esc(CH[s.channel]?.name)}`}${s.kind === 'concept' ? ' · Concept' : ''}</div>
    <h1>${esc(s.name)}</h1>
    <div class="src">${mine
      ? `<span>${s.status === 'final' ? 'Final' : 'Draft'}</span><span>Updated ${esc(date(s.updatedAt))}</span>`
      : doc ? `<span>${esc(doc.title)}</span><span>PDF, ${doc.pages} pages</span><span>Shared ${esc(date(doc.addedAt))}</span>`
      : `<a href="${yt(s.videoId)}" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center">${esc(s.videoTitle)} ${icon('ext')}</a>
         ${s.published ? `<span>${esc(date(s.published))}</span>` : ''}${s.views ? `<span>${views(s.views)} views</span>` : ''}`}</div>
    <p class="summary">${esc(s.summary)}</p>
    ${untested(s) ? `<p class="summary" style="color:var(--down)">${esc(doc.trust)}</p>` : ''}
    <div class="legend"><span><i class="sw sw-stated"></i>${statedLabel}</span>
      <span><i class="sw sw-inferred"></i>Inferred by AI</span><span><i class="sw sw-missing"></i>Unspecified</span></div>
  </div>

  <div class="grid-2">
    <div class="stack">
      <div class="panel rules">${SECTIONS.map(([k, label, sub]) => {
        const items = s.rules?.[k] || [];
        return `<div class="rule-sec"><h2>${label}${sub ? `<div class="faint" style="font-size:11.5px;margin-top:2px">${sub}</div>` : ''}</h2>
          ${items.length ? `<ul class="rule-list">${items.map(rule).join('')}</ul>` : '<div class="rule-none">Unspecified</div>'}</div>`;
      }).join('')}</div>
      ${(s.missing || []).length ? `<div class="panel"><div class="panel-head"><h2>${mine ? 'Pending decision' : doc ? 'Not defined in document' : 'Not stated in video'}</h2></div>
        <div class="panel-body"><ul class="missing-list">${s.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div></div>` : ''}
      ${(s.cautions || []).length ? `<div class="panel"><div class="panel-head"><h2>${mine ? 'Points to note' : doc ? 'Warnings' : 'Expert warnings'}</h2></div>
        <div class="panel-body"><ul class="plain-list">${s.cautions.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div></div>` : ''}
    </div>

    <div class="stack">
      <div class="panel facts">
        <div class="fact"><span>Direction</span><span>${dir}</span></div>
        <div class="fact"><span>Rules</span><span style="display:inline-flex;gap:8px;align-items:center">${meter(s.completeness)} ${COMPLETE[s.completeness] || ''}</span></div>
        <div class="fact"><span>Style</span><span>${list((s.styles || []).map((x) => STYLE_NAMES[x] || x))}</span></div>
        <div class="fact"><span>Instrument</span><span>${list(s.instruments)}</span></div>
        <div class="fact"><span>Timeframe</span><span>${list(s.timeframes)}</span></div>
        <div class="fact"><span>Indicators</span><span>${list(s.indicators)}</span></div>
        <div class="fact"><span>Patterns</span><span>${list(s.patterns)}</span></div>
        <div class="fact" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><span class="muted">Backtest</span>
          ${s.testable ? '<span class="tag tag-accent">Ready</span>' : '<span class="tag">Not ready</span>'}</div>
          ${s.testableWhy ? `<div class="faint" style="font-size:12.5px;margin-top:6px">${esc(s.testableWhy)}</div>` : ''}</div>
      </div>
      ${doc ? `<div class="panel"><div class="panel-head"><h2>About this source</h2></div>
        <div class="panel-body"><p style="margin:0 0 8px">${esc(doc.about || '')}</p><p class="muted" style="margin:0">${esc(doc.trust || '')}</p></div></div>` : ''}
      ${mine || doc ? '' : `<div class="panel"><a href="#/v/${esc(s.videoId)}" style="display:block;padding:12px">
        <img class="thumb" style="width:100%" src="${thumb(s.videoId)}" alt="" loading="lazy">
        <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:13px"><span>View transcript</span><span class="muted">${esc(CH[s.channel]?.name)}</span></div></a></div>`}
    </div>
  </div>`;
}

function videoList() {
  const f = ui.vid;
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = DATA.videos.filter((v) =>
    (f.ch === 'all' || v.c === f.ch) &&
    (f.st === 'all' || v.st === f.st || (f.st === 'queued' && v.st === 'failed')) &&
    words.every((w) => v.ti.toLowerCase().includes(w)));
  return list.sort((a, b) => (b.p || '').localeCompare(a.p || '') || (b.vw || 0) - (a.vw || 0));
}

function pageVideos() {
  const f = ui.vid;
  const inCh = DATA.videos.filter((v) => f.ch === 'all' || v.c === f.ch);
  const n = (st) => inCh.filter((v) => v.st === st || (st === 'queued' && v.st === 'failed')).length;
  return `
  <div class="page-head"><div><div class="kicker">YouTube Research</div><h1>Videos</h1>
    <p>New uploads from the three channels since 23 Oct 2026 (no Shorts or livestreams), checked twice a day at 8:00 and 18:00 IST. Old videos are not read.</p></div></div>
  <div class="toolbar">
    <label class="search">${icon('search')}<input class="input" id="vid-q" type="search" placeholder="Search video titles…" value="${esc(f.q)}"></label>
    ${chipRow('Channel', 'ch', [['all', 'All', DATA.videos.length], ...DATA.channels.map((c) => [c.id, c.name, DATA.videos.filter((v) => v.c === c.id).length])], f)}
    ${chipRow('Status', 'st', [['extracted', STATUS.extracted, n('extracted')], ['transcribed', STATUS.transcribed, n('transcribed')],
      ['queued', STATUS.queued, n('queued')], ['no-strategy', STATUS['no-strategy'], n('no-strategy')], ['skipped', STATUS.skipped, n('skipped')],
      ['all', 'All', inCh.length]], f)}
  </div>
  <div id="vid-results"></div>`;
}

function vidResults() {
  const list = videoList();
  const shown = list.slice(0, ui.vid.limit);
  $('#vid-results').innerHTML = `<div class="result-line">${list.length} videos</div>` + (list.length
    ? `<div class="panel list-rows">${shown.map((v) => `
      <a class="row" href="#/v/${esc(v.id)}">
        <img class="thumb" src="${thumb(v.id)}" alt="" loading="lazy">
        <div><div class="row-title">${esc(v.ti)}</div>
          <div class="row-sub">${[CH[v.c]?.name, date(v.p), v.vw ? `${views(v.vw)} views` : '', v.d ? clock(v.d) : '',
            v.st === 'skipped' ? `${v.l}: ${v.why || ''}` : ''].filter(Boolean).map(esc).join(' · ')}</div>
          ${v.err ? `<div class="row-sub" style="color:var(--down)">${esc(v.err.slice(0, 120))}</div>` : ''}</div>
        <span class="st st-${v.st}">${esc(STATUS[v.st] || v.st)}${v.ns ? ` · ${v.ns}` : ''}</span>
      </a>`).join('')}
      ${list.length > shown.length ? `<div class="more"><button class="btn" data-action="more-videos">Show more (${list.length - shown.length})</button></div>` : ''}</div>`
    : `<div class="panel empty"><strong>No videos match this filter</strong></div>`);
}

function pageVideo(id) {
  const v = VID[id];
  if (!v) return `<a class="back" href="#/videos">${icon('back')}Videos</a><div class="panel empty"><strong>Video not found</strong></div>`;
  const strategies = DATA.strategies.filter((s) => s.videoId === id);
  return `
  <a class="back" href="#/videos">${icon('back')}Videos</a>
  <div class="detail-head">
    <div class="kicker">${esc(CH[v.c]?.name)} · ${esc(STATUS[v.st] || v.st)}</div>
    <h1>${esc(v.ti)}</h1>
    <div class="src"><a href="${yt(v.id)}" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center">Open on YouTube ${icon('ext')}</a>
      ${v.p ? `<span>${esc(date(v.p))}</span>` : ''}${v.vw ? `<span>${views(v.vw)} views</span>` : ''}${v.d ? `<span>${clock(v.d)}</span>` : ''}</div>
    ${v.sum ? `<p class="summary">${esc(v.sum)}</p>` : ''}
    ${v.st === 'skipped' ? `<p class="muted" style="margin:0">Appears to be a ${esc(v.l)} video based on title (${esc(v.why || '')}), skipped.</p>` : ''}
    ${v.err ? `<p style="margin:0;color:var(--down)">${esc(v.err)}</p>` : ''}
  </div>
  ${strategies.length ? `<div class="cards" style="margin-bottom:16px">${strategies.map(card).join('')}</div>` : ''}
  ${v.tr ? `<div class="panel"><div class="panel-head"><h2>Transcript</h2><span class="faint" style="font-size:12px">Transcribed by Gemini · Click timestamp to view on YouTube</span></div>
    <div class="transcript" id="transcript"><p class="faint" style="display:block">Loading…</p></div></div>`
    : `<div class="panel empty"><strong>Transcript not generated yet</strong>${v.st === 'queued' ? 'Queued for the next check (8:00 or 18:00 IST).' : ''}</div>`}`;
}

async function loadTranscript(id) {
  const box = $('#transcript');
  if (!box) return;
  try {
    if (!transcripts.has(id)) transcripts.set(id, await openBox(`t/${id}.enc`, KEY));
    if (!document.body.contains(box)) return;
    const html = transcripts.get(id).split('\n').map((line) => {
      if (!line.trim() || line.startsWith('#') || line.startsWith('- ')) return '';
      const m = line.match(/^\[((?:\d+:)?\d{1,2}:\d{2})\]\s*(.*)$/);
      if (!m) return `<p><span></span><span>${esc(line)}</span></p>`;
      const sec = m[1].split(':').reduce((a, x) => a * 60 + Number(x), 0);
      const screen = /^\[screen:/i.test(m[2]);
      return `<p><a class="ts" href="${yt(id, sec)}" target="_blank" rel="noopener">${m[1]}</a><span class="${screen ? 'screen' : ''}">${esc(m[2])}</span></p>`;
    }).join('');
    box.innerHTML = html || '<p class="faint" style="display:block">Transcript is empty.</p>';
  } catch {
    box.innerHTML = '<p style="display:block;color:var(--down)">Failed to load transcript.</p>';
  }
}

function pageMine() {
  const mine = DATA.mine;
  const NOTE = { new: ['New', ''], discussed: ['Discussed', 'tag-accent'], done: ['Added to strategy', 'tag-up'] };
  return `
  <div class="page-head"><div><div class="kicker">My Strategies</div><h1>My Strategies</h1>
    <p>Your custom trading rules, separate from expert models. Explain your strategy in Claude Code, and each rule will be converted into structured parameters here. Add quick notes below for later reference.</p></div></div>
  <div class="grid-2">
    <div>${mine.length ? `<div class="cards">${mine.map(card).join('')}</div>`
      : `<div class="panel empty"><strong>No custom strategies saved yet</strong>Say "Lets Trade: add my strategy" in Claude Code. We will break it down step-by-step and save it here.</div>`}</div>
    <div class="stack">
      <form class="panel" id="note-form"><div class="panel-head"><h2>Quick note</h2><span class="faint" style="font-size:12px">Quick memory capture</span></div>
        <div class="panel-body">
          <textarea class="input" id="note-text" required maxlength="4000" placeholder="Example: Enter on retest after rectangle breakout, only when Supertrend is green. SL below the rectangle…"></textarea>
          <div class="form-row"><span class="form-msg" id="note-msg"></span><button class="btn btn-primary" id="note-save" type="submit">Save</button></div>
        </div></form>
      <div class="panel"><div class="panel-head"><h2>Notes</h2><span class="faint mono">${DATA.notes.length}</span></div>
        ${DATA.notes.length ? DATA.notes.map((n) => {
          const [label, cls] = NOTE[n.status] || NOTE.new;
          return `<div class="note"><div class="note-text">${esc(n.text)}</div>
            <div class="note-meta"><span>${esc(ago(n.at))}</span><span class="tag ${cls}">${label}</span></div>
            ${n.reply ? `<div class="muted" style="font-size:13px">${esc(n.reply)}</div>` : ''}</div>`;
        }).join('') : '<div class="empty">No notes recorded.</div>'}
      </div>
    </div>
  </div>`;
}

async function saveNote(e) {
  e.preventDefault();
  const text = $('#note-text').value.trim();
  const msg = $('#note-msg'), btn = $('#note-save');
  if (!text) return;
  msg.className = 'form-msg';
  if (!DATA.notesToken) {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
    msg.className = 'form-msg err';
    msg.textContent = 'Note saving token is not configured. Text has been copied to your clipboard; paste it into Claude Code.';
    return;
  }
  btn.disabled = true; msg.textContent = 'Saving…';
  const at = new Date().toISOString();
  const note = { id: at.replace(/[:.]/g, '-'), at, text, status: 'new' };
  try {
    const res = await fetch(`https://api.github.com/repos/${DATA.repo}/contents/data/notes/${note.id}.json`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${DATA.notesToken}`, accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        message: `note: ${text.slice(0, 60).replace(/\s+/g, ' ')}`,
        content: b64e(new TextEncoder().encode(JSON.stringify(note, null, 2) + '\n')),
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    DATA.notes.unshift(note);
    render();
    const m = $('#note-msg');
    if (m) { m.className = 'form-msg ok'; m.textContent = 'Saved successfully. We will convert this into a strategy rule during our next session.'; }
  } catch (ex) {
    msg.className = 'form-msg err';
    msg.textContent = `Failed to save (${ex.message}). Please try again.`;
    btn.disabled = false;
  }
}

function pageLater(id) {
  const l = LATER.find((x) => x.id === id);
  if (!l) return pageHome();
  return `
  <div class="page-head"><div><div class="kicker">Stage ${l.stage} · In development</div><h1>${esc(l.label)}</h1>
    <p>This section is scheduled for a future release stage. Planned features so far:</p></div></div>
  <div class="panel"><div class="panel-body"><ul class="later-list">${l.lines.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>`;
}

// ---------- live market ----------
let liveTimer = null, liveData = null;
const IST = () => { const d = new Date(Date.now() + 330 * 60000); return { day: d.toISOString().slice(0, 10), m: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() }; };
const marketOpen = (st) => { const t = IST(); return t.dow > 0 && t.dow < 6 && t.m >= 555 && t.m <= 930 && st?.closedDay !== t.day; };
const num = (n, d = 2) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }));
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const istTime = (ms) => { const d = new Date(ms + 330 * 60000); return hm(d.getUTCHours() * 60 + d.getUTCMinutes()); };

function pageLive() {
  return `
  <div class="page-head"><div><div class="kicker">Live Market</div><h1>Nifty · Bank Nifty · Sensex · Crypto</h1>
    <p id="live-status">Connecting…</p></div></div>
  <div id="live-body"><div class="panel empty"><strong>Loading live data…</strong></div></div>`;
}

// points [[x, price]]; x is the IST minute of the day for indices (9:15-15:30), epoch minutes for crypto (last 24 h).
function spark(points, prevClose, [x0, xEnd] = [555, 930]) {
  if (points.length < 2) return '<div class="faint" style="font-size:12px;padding:18px 0">No ticks yet today</div>';
  const W = 300, H = 64, xs = points.map((p) => p[0]), ys = points.map((p) => p[1]).concat(prevClose ? [prevClose] : []);
  const x1 = Math.max(xEnd, ...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
  const X = (m) => ((m - x0) / (x1 - x0)) * W, Y = (v) => H - 4 - ((v - y0) / dy) * (H - 8);
  const up = points[points.length - 1][1] >= (prevClose ?? points[0][1]);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:64px;display:block" role="img" aria-label="Today's price line">
    ${prevClose ? `<line x1="0" x2="${W}" y1="${Y(prevClose).toFixed(1)}" y2="${Y(prevClose).toFixed(1)}" stroke="var(--line-2)" stroke-dasharray="3 3"/>` : ''}
    <polyline fill="none" stroke="var(--${up ? 'up' : 'down'})" stroke-width="1.6" points="${points.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/></svg>`;
}

function liveCard(w) {
  const up = (w.chg ?? 0) >= 0, cls = up ? 'up' : 'down';
  const trend = w.ema9 && w.ema20 ? (w.ema9 > w.ema20 ? '<span class="tag tag-up">EMA 9 above 20</span>' : '<span class="tag tag-down">EMA 9 below 20</span>') : '';
  const st = w.stDir ? `<span class="tag tag-${w.stDir === 1 ? 'up' : 'down'}">Supertrend ${w.stDir === 1 ? 'green' : 'red'} ${num(w.st, 0)}</span>` : '';
  return `<div class="panel live-card" data-chart="${esc(w.sym)}" role="button" tabindex="0" aria-label="Open the ${esc(w.name)} chart" style="padding:16px;display:grid;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div><div class="muted" style="font-size:12.5px">${esc(w.name)} · ${esc(w.exch)}</div>
        <div style="font:500 26px/1.2 var(--mono);letter-spacing:-.02em">${num(w.ltp)}</div></div>
      <div style="text-align:right;color:var(--${cls});font-family:var(--mono);font-size:13px">${w.chg === undefined ? '' : `${up ? '+' : ''}${num(w.chg)}<br>${up ? '+' : ''}${num(w.chgPct)}%`}</div>
    </div>
    ${spark(w.spark || [], w.prevClose)}
    <div class="tags">${trend}${st}<span class="chart-hint">${icon('candles')}Chart</span></div>
    <div class="facts" style="margin:0 -16px -16px">
      <div class="fact"><span>Day high / low</span><span class="mono">${num(w.high)} / ${num(w.low)}</span></div>
      <div class="fact"><span>Yesterday high / low</span><span class="mono">${num(w.pdh)} / ${num(w.pdl)}</span></div>
      <div class="fact"><span>Opening range (9:15-9:30)</span><span class="mono">${num(w.orh)} / ${num(w.orl)}</span></div>
      <div class="fact"><span>Previous close</span><span class="mono">${num(w.prevClose)}</span></div>
    </div></div>`;
}

// Crypto prices: 4 decimals under 50 (XRP), else 2.
const cnum = (n) => num(n, n !== null && n !== undefined && Math.abs(n) < 50 ? 4 : 2);

function cryptoCard(c, nowMin) {
  const up = (c.chg ?? 0) >= 0, cls = up ? 'up' : 'down';
  const trend = c.ema9 && c.ema20 ? (c.ema9 > c.ema20 ? '<span class="tag tag-up">1 h EMA 9 above 20</span>' : '<span class="tag tag-down">1 h EMA 9 below 20</span>') : '';
  const st = c.stDir ? `<span class="tag tag-${c.stDir === 1 ? 'up' : 'down'}">1 h Supertrend ${c.stDir === 1 ? 'green' : 'red'} ${cnum(c.st)}</span>` : '';
  return `<div class="panel live-card" data-chart="${esc(c.sym)}" role="button" tabindex="0" aria-label="Open the ${esc(c.name)} chart" style="padding:16px;display:grid;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
      <div><div class="muted" style="font-size:12.5px">${esc(c.name)} · ${esc(c.pair)} · Delta</div>
        <div style="font:500 26px/1.2 var(--mono);letter-spacing:-.02em">$${cnum(c.ltp)}</div></div>
      <div style="text-align:right;color:var(--${cls});font-family:var(--mono);font-size:13px">${c.chg === undefined ? '' : `${up ? '+' : ''}${cnum(c.chg)}<br>${up ? '+' : ''}${num(c.chgPct)}% 24 h`}</div>
    </div>
    ${spark(c.spark || [], c.open24, [nowMin - 1440, nowMin])}
    <div class="tags">${trend}${st}<span class="chart-hint">${icon('candles')}Chart</span></div>
    <div class="facts" style="margin:0 -16px -16px">
      <div class="fact"><span>24 h high / low</span><span class="mono">${cnum(c.high24)} / ${cnum(c.low24)}</span></div>
      <div class="fact"><span>Yesterday high / low (IST day)</span><span class="mono">${cnum(c.pdh)} / ${cnum(c.pdl)}</span></div>
      <div class="fact"><span>Price 24 h ago</span><span class="mono">${cnum(c.open24)}</span></div>
    </div></div>`;
}

function alertRows(list, n) {
  return list.length ? `<div class="list-rows">${list.map((a) => `
    <div class="row" style="grid-template-columns:52px 1fr;cursor:default">
      <span class="mono faint">${istTime(a.at)}</span>
      <div><div class="row-title">${esc(a.name)} · <span style="color:var(--${/↑/.test(a.title) || a.dir === 'up' ? 'up' : /↓/.test(a.title) || a.dir === 'down' ? 'down' : 'text'})">${esc(a.title)}</span></div>
        <div class="row-sub">${esc(a.body)}</div>
        ${a.plan ? `<div class="row-sub mono">${a.plan.dir === 'up' ? 'Buy' : 'Sell'}-stop ${n(a.plan.entry)} · stop ${n(a.plan.stop)} · 2R ${n(a.plan.target)}${a.ref ? ` · ${esc(a.ref)}` : ''}
          · <a href="${checkLink({ sym: a.sym, dir: a.plan.dir, entry: a.plan.entry, stop: a.plan.stop, target: a.plan.target, at: a.at,
            rule: ['orb', 'ema-pullback'].includes(a.kind) ? `detect:${a.kind}` : 'none', from: `the ${istTime(a.at)} alert (its entry is a stop order; the replays assume it filled)` })}" style="color:var(--accent)">Check this trade</a></div>` : ''}</div>
    </div>`).join('')}</div>`
    : '<div class="empty">No alerts yet. They also arrive on Telegram.</div>';
}

function cryptoSection(cr, now) {
  if (!cr) return '';
  const nowMin = Math.floor(now / 60000);
  return `
    <div class="page-head" style="margin-top:28px"><div><div class="kicker">Crypto · Delta Exchange India · 24 hours</div><h2 style="margin:0">Ethereum · Solana · XRP</h2>
      <p>${cr.lastRun ? `Updated ${istTime(cr.lastRun)} IST · prices every minute, setups on each closed 1 hour candle` : 'Starting up: the first prices arrive within a few minutes.'}</p></div></div>
    ${cr.error ? `<div class="panel" style="margin-bottom:12px;padding:12px 16px;color:var(--down)">Last problem: ${esc(cr.error)}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px">${cr.coins.map((c) => cryptoCard(c, nowMin)).join('')}</div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>Crypto alerts · last 24 hours</h2><span class="faint mono">${cr.alerts.length}</span></div>${alertRows(cr.alerts, cnum)}</div>
      <div class="panel"><div class="panel-head"><h2>What triggers a crypto alert</h2></div>
        <div class="panel-body"><ul class="plain-list">
          <li>Quick move: ${cr.rules.movePct}% or more within ${cr.rules.moveMin} minutes (at most one per ${cr.rules.cooldown} min per coin)</li>
          <li>Yesterday's high or low (IST day) broken on a 1 hour close</li>
          <li>9/20 EMA pullback with a strong 1 hour close (plan: AI Manual setups 1 and 10)</li>
          <li>Supertrend (10,3) turns green or red on a 1 hour close (Varsity ch. 20)</li>
        </ul><p class="faint" style="margin:10px 0 0;font-size:12.5px">Prices in US dollars from Delta Exchange India perpetual futures (public data, no account). No opening range: crypto trades all day. Alerts only, never orders; the setups were written for Indian intraday charts and are untested on crypto.</p></div></div>
    </div>`;
}

function renderLive() {
  const box = $('#live-body'), line = $('#live-status');
  if (!box) return;
  const d = liveData;
  if (!d) return;
  if (d.error) {
    line.textContent = 'Could not reach the live watch.';
    box.innerHTML = `<div class="panel empty"><strong>${esc(d.error)}</strong>It retries every 30 seconds.</div>`;
    return;
  }
  const open = marketOpen(d.status);
  line.innerHTML = !d.status.token ? 'Waiting for the Upstox token. The live watch is deployed and checks every minute once it is added.'
    : open ? `Market open · updated ${d.status.lastRun ? istTime(d.status.lastRun) : '–'} IST · refreshes every 30 s`
    : `Market closed · showing ${esc(d.day)}${d.status.closedDay === IST().day ? ' (exchange holiday today)' : ''}`;
  box.innerHTML = `
    ${d.status.lastError ? `<div class="panel" style="margin-bottom:12px;padding:12px 16px;color:var(--down)">Last problem: ${esc(d.status.lastError)}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px">${d.watch.map(liveCard).join('')}</div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><h2>Alerts · ${esc(d.day)}</h2><span class="faint mono">${d.alerts.length}</span></div>
        ${alertRows(d.alerts, num)}</div>
      <div class="panel"><div class="panel-head"><h2>What triggers an alert</h2></div>
        <div class="panel-body"><ul class="plain-list">
          <li>Quick move: ${d.rules.movePct}% or more within ${d.rules.moveMin} minutes (at most one per ${d.rules.cooldown} min per index)</li>
          <li>Opening range break: a 5 min close beyond the 9:15-9:30 high/low (plan: AI Manual setup 61)</li>
          <li>Yesterday's high or low broken on a 5 min close</li>
          <li>9/20 EMA pullback with a strong close (plan: AI Manual setups 1 and 10)</li>
          <li>Supertrend (10,3) turns green or red on a 5 min close (Varsity ch. 20)</li>
        </ul><p class="faint" style="margin:10px 0 0;font-size:12.5px">Alerts only, never orders. Plans come from untested library setups; check the chart before acting. Indices have no volume, so volume rules are not used.</p></div></div>
    </div>
    ${cryptoSection(d.crypto, d.now)}`;
  box.onclick = (e) => { const el = e.target.closest('[data-chart]'); if (el) openChart(el.dataset.chart); };
  box.onkeydown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-chart]')) { e.preventDefault(); openChart(e.target.dataset.chart); }
  };
}

async function loadLive() {
  if (!DATA.live?.url || !DATA.live?.key) {
    liveData = { error: 'The live watch is not connected to this site yet.' };
    return renderLive();
  }
  try {
    const res = await fetch(`${DATA.live.url}/live`, { headers: { 'x-live-key': DATA.live.key }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Live watch answered ${res.status}`);
    liveData = await res.json();
  } catch (ex) {
    liveData = { error: ex.message || 'Network error' };
  }
  renderLive();
}

function startLive() {
  clearInterval(liveTimer);
  loadLive();
  liveTimer = setInterval(() => {
    if (!location.hash.startsWith('#/live')) { clearInterval(liveTimer); return; }
    // Crypto trades all day, so the page keeps refreshing outside Indian market hours too.
    if (document.visibilityState === 'visible') loadLive();
  }, 30000);
}

// ---------- chart (tap a card on the Live page) ----------
// TradingView Lightweight Charts (site/lwc.js, Apache 2.0, loaded on first use). The library shows UTC, so
// times are shifted by +5:30 to read as IST. Data: worker /chart (candles + EMA/Supertrend + levels + alerts).
let chartView = null; // { sym, tf, coin, chart, s: series, lines, timer, fit }
const IST_S = 19800;
const TF_LABEL = { 15: '15 min', 60: '1 hour' };
const EMA20_COLOR = '#7aa2f7';
const ALERT_SHORT = { orb: 'OR', pdh: 'Y high', pdl: 'Y low', 'ema-pullback': 'EMA', supertrend: 'ST', move: 'Move' };

function loadChartLib() {
  if (window.LightweightCharts) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'lwc.js';
    s.onload = ok;
    s.onerror = () => fail(new Error('the chart library did not load'));
    document.head.appendChild(s);
  });
}

function openChart(sym) {
  closeChart(false);
  const coin = Boolean(liveData?.crypto?.coins?.some((c) => c.sym === sym));
  const m = document.createElement('div');
  m.className = 'chart-modal';
  m.id = 'chart-modal';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="chart-box">
    <div class="chart-head">
      <div style="min-width:0"><div class="chart-title" id="chart-title">${esc(sym)}</div>
        <div class="faint" id="chart-sub" style="font-size:12px;margin-top:2px">Loading…</div></div>
      <div class="chart-tools">
        <div class="chips">${[15, 60].map((tf) => `<button class="chip" data-tf="${tf}">${TF_LABEL[tf]}</button>`).join('')}</div>
        <button class="icon-btn" id="chart-close" aria-label="Close chart">${icon('close')}</button>
      </div>
    </div>
    <div class="chart-area" id="chart-area"></div>
    <div class="chart-legend">
      <span><i style="background:var(--accent)"></i>EMA 9</span><span><i style="background:${EMA20_COLOR}"></i>EMA 20</span>
      <span><i style="background:linear-gradient(90deg,var(--up) 50%,var(--down) 50%)"></i>Supertrend 10,3</span>
      <span><i class="dash"></i>Yesterday high / low</span>${coin ? '' : '<span><i class="dots"></i>Opening range</span>'}
      <span>▲ ▼ alert fired</span>
      <span class="faint">Lines use this chart's candles; ${coin ? 'crypto setups alert on 1 hour candles' : 'index setups alert on 5 min candles'}.</span>
    </div>
  </div>`;
  document.body.appendChild(m);
  document.body.style.overflow = 'hidden';
  history.pushState({ chart: sym }, '', location.href); // phone back button closes the chart
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('#chart-close')) return closeChart(true);
    const b = e.target.closest('[data-tf]');
    if (b) setChartTf(Number(b.dataset.tf));
  });
  chartView = { sym, coin, tf: coin ? 60 : 15 };
  chartView.timer = setInterval(() => {
    if (document.visibilityState === 'visible' && (chartView?.coin || marketOpen(liveData?.status))) loadChart();
  }, 30000);
  setChartTf(chartView.tf);
}

function closeChart(useBack) {
  if (!chartView) return;
  clearInterval(chartView.timer);
  chartView.chart?.remove();
  chartView = null;
  $('#chart-modal')?.remove();
  document.body.style.overflow = '';
  if (useBack && history.state?.chart) history.back();
}
window.addEventListener('popstate', () => closeChart(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChart(true); });

function setChartTf(tf) {
  const v = chartView;
  v.tf = tf;
  document.querySelectorAll('#chart-modal [data-tf]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.tf) === tf)));
  v.chart?.remove();
  v.chart = null;
  v.fit = true;
  loadChart();
}

async function loadChart() {
  const v = chartView;
  if (!v) return;
  const tf = v.tf;
  try {
    await loadChartLib();
    const res = await fetch(`${DATA.live.url}/chart?sym=${encodeURIComponent(v.sym)}&tf=${tf}`, { headers: { 'x-live-key': DATA.live.key }, cache: 'no-store' });
    if (!res.ok) throw new Error(`the live watch answered ${res.status}`);
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    if (chartView === v && v.tf === tf) drawChart(v, d); // skip if closed or switched meanwhile
  } catch (ex) {
    if (chartView === v) $('#chart-sub').textContent = `Could not load the chart: ${ex.message}`;
  }
}

function drawChart(v, d) {
  const L = window.LightweightCharts;
  const css = getComputedStyle(document.documentElement), cv = (n) => css.getPropertyValue(n).trim();
  const c = d.candles;
  const lastClose = c.length ? c[c.length - 1][4] : null;
  const dec = lastClose !== null && Math.abs(lastClose) < 50 ? 4 : 2;
  const T = (ms) => Math.floor(ms / 1000) + IST_S;

  const line = (color, extra = {}) => v.chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    crosshairMarkerVisible: false, ...extra });
  if (!v.chart) {
    v.chart = L.createChart($('#chart-area'), {
      autoSize: true,
      layout: { background: { type: 'solid', color: cv('--panel') }, textColor: cv('--muted'), fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
      grid: { vertLines: { color: cv('--line') }, horzLines: { color: cv('--line') } },
      rightPriceScale: { borderColor: cv('--line-2') },
      timeScale: { borderColor: cv('--line-2'), timeVisible: true, secondsVisible: false, rightOffset: 3 },
      crosshair: { mode: L.CrosshairMode.Normal },
      localization: { priceFormatter: (p) => num(p, dec) },
    });
    v.s = {
      candles: v.chart.addCandlestickSeries({ upColor: cv('--up'), downColor: cv('--down'), wickUpColor: cv('--up'), wickDownColor: cv('--down'),
        borderVisible: false, priceFormat: { type: 'price', precision: dec, minMove: 1 / 10 ** dec } }),
      ema9: line(cv('--accent')),
      ema20: line(EMA20_COLOR),
    };
    v.lines = [];
    v.stLines = [];
  }

  v.s.candles.setData(c.map((k) => ({ time: T(k[0]), open: k[1], high: k[2], low: k[3], close: k[4] })));
  const pts = (i) => c.filter((k) => k[i] !== null).map((k) => ({ time: T(k[0]), value: k[i] }));
  v.s.ema9.setData(pts(5));
  v.s.ema20.setData(pts(6));
  // Supertrend: one line per run of the same direction, so a flip shows as a break (the library joins across gaps).
  v.stLines.forEach((s) => v.chart.removeSeries(s));
  v.stLines = [];
  const runs = [];
  for (const k of c) {
    if (k[7] === null || k[8] === null) continue;
    if (!runs.length || runs[runs.length - 1].dir !== k[8]) runs.push({ dir: k[8], pts: [] });
    runs[runs.length - 1].pts.push({ time: T(k[0]), value: k[7] });
  }
  for (const r of runs) {
    const s = line(cv(r.dir === 1 ? '--up' : '--down'), { lineWidth: 2, lineType: L.LineType.WithSteps });
    s.setData(r.pts);
    v.stLines.push(s);
  }

  v.lines.forEach((p) => v.s.candles.removePriceLine(p));
  v.lines = [];
  const level = (price, title, color, lineStyle) => {
    if (price !== null && price !== undefined) v.lines.push(v.s.candles.createPriceLine({ price, title, color, lineWidth: 1, lineStyle, axisLabelVisible: true }));
  };
  level(d.levels.pdh, 'Y high', cv('--muted'), L.LineStyle.Dashed);
  level(d.levels.pdl, 'Y low', cv('--muted'), L.LineStyle.Dashed);
  level(d.levels.orh, 'OR high', cv('--accent'), L.LineStyle.Dotted);
  level(d.levels.orl, 'OR low', cv('--accent'), L.LineStyle.Dotted);

  // Each alert on the candle it belongs to: setups fire about a minute after their candle closed.
  const markers = [];
  for (const a of d.alerts) {
    const ref = a.at - (a.kind === 'move' ? 0 : 90000);
    let k = null;
    for (const x of c) { if (x[0] <= ref) k = x; else break; }
    if (!k) continue;
    const up = /↑/.test(a.title) || a.dir === 'up', down = /↓/.test(a.title) || a.dir === 'down';
    markers.push({ time: T(k[0]), position: down ? 'aboveBar' : 'belowBar', color: down ? cv('--down') : up ? cv('--up') : cv('--accent'),
      shape: down ? 'arrowDown' : up ? 'arrowUp' : 'circle', text: ALERT_SHORT[a.kind] || a.kind });
  }
  v.s.candles.setMarkers(markers.sort((a, b) => a.time - b.time));

  if (v.fit) { // open on the latest candles, about 8 px per candle
    const n = Math.max(30, Math.round($('#chart-area').clientWidth / 8));
    v.chart.timeScale().setVisibleLogicalRange({ from: c.length - n, to: c.length + 3 });
    v.fit = false;
  }

  const it = liveData?.watch?.find((w) => w.sym === v.sym) || liveData?.crypto?.coins?.find((x) => x.sym === v.sym) || {};
  const price = it.ltp ?? lastClose, fmtP = (n) => (v.coin ? `$${cnum(n)}` : num(n));
  $('#chart-title').innerHTML = `${esc(d.name)} <span class="mono">${fmtP(price)}</span>${it.chgPct !== undefined && it.chgPct !== null
    ? ` <span class="mono" style="color:var(--${it.chgPct >= 0 ? 'up' : 'down'});font-weight:500">${it.chgPct >= 0 ? '+' : ''}${num(it.chgPct)}%${v.coin ? ' 24 h' : ''}</span>` : ''}`;
  $('#chart-sub').textContent = `${TF_LABEL[d.tf]} candles · ${v.coin ? 'Delta Exchange, USD' : 'Upstox'} · ${istTime(d.at)} IST`
    + (v.coin || marketOpen(liveData?.status) ? ' · updates every 30 s' : ' · market closed');
}

// ---------- worker data (live watch) ----------
async function api(path) {
  if (!DATA.live?.url || !DATA.live?.key) throw new Error('the live watch is not connected to this site');
  const res = await fetch(`${DATA.live.url}${path}`, { headers: { 'x-live-key': DATA.live.key }, cache: 'no-store' });
  if (!res.ok) throw new Error(`the live watch answered ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  return d;
}
// Prices for the news MOVING line and Trade Check defaults when the Live page was not opened first.
async function ensureLive() {
  if (!liveData || liveData.error) { try { liveData = await api('/live'); } catch { /* pages work without it */ } }
  return liveData;
}
const INDEX_SYMS = ['NIFTY', 'BANKNIFTY', 'SENSEX'], COIN_SYMS = ['ETH', 'SOL', 'XRP'];
const symKind = (s) => (INDEX_SYMS.includes(s) ? 'index' : COIN_SYMS.includes(s) ? 'crypto' : UNIVERSE.some((u) => u.sym === s) ? 'stock' : null);
const symName = (s) => ({ NIFTY: 'Nifty 50', BANKNIFTY: 'Bank Nifty', SENSEX: 'Sensex', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP' }[s]
  || UNIVERSE.find((u) => u.sym === s)?.name || s);
const istDayNow = () => istDay(Date.now());

// ---------- Trade Check: Time Machine + position size + risk check ----------
const loadRules = () => { try { return { ...DEFAULT_RULES, ...JSON.parse(LS.get('lt-rules') || '{}') }; } catch { return { ...DEFAULT_RULES }; } };
const loadJournal = () => { try { return JSON.parse(LS.get('lt-journal') || '[]'); } catch { return []; } };
const RULE_LABEL = { none: 'None (a plan I typed)', orb15: '15 min opening range break (stop at the range middle)',
  'detect:orb': 'Live alert: opening range break (setup 61)', 'detect:ema-pullback': 'Live alert: 9/20 EMA pullback (setups 1/10)' };

// Link from an alert or a scanner hit to a prefilled Trade Check.
const checkLink = (p) => `#/check?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== null)).toString()}`;

function pageCheck() {
  const q = hashParams;
  const rules = loadRules();
  const sym = (q.get('sym') || 'NIFTY').toUpperCase();
  const at = Number(q.get('at')) || Date.now();
  const time = q.get('at') ? istTime(at) : null;
  const field = (id, label, value, extra = '') => `<label class="field"><span>${label}</span><input class="input mono" id="${id}" value="${esc(value ?? '')}" ${extra}></label>`;
  return `
  <div class="page-head"><div><div class="kicker">Trade Check · before you risk a rupee</div><h1>Time Machine, size and risk</h1>
    <p>Replays the rest of the session 10,000 times from the symbol's own recent 5 min bars, re-runs the same rule on every past session,
    sizes the trade to your max loss and checks it against your limits. A simulation, not a prediction. Nothing here places an order.</p></div></div>
  <form class="panel" id="check-form" style="margin-bottom:16px"><div class="panel-body" style="display:grid;gap:12px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
      <label class="field"><span>Symbol (index, coin or Nifty 200 stock)</span><input class="input mono" id="c-sym" list="c-syms" value="${esc(sym)}" autocapitalize="characters" required>
        <datalist id="c-syms">${[...INDEX_SYMS, ...COIN_SYMS, ...UNIVERSE.map((u) => u.sym)].map((s) => `<option value="${esc(s)}">${esc(symName(s))}</option>`).join('')}</datalist></label>
      <label class="field"><span>Direction</span><select class="input" id="c-dir"><option value="up"${q.get('dir') !== 'down' ? ' selected' : ''}>Long (buy)</option><option value="down"${q.get('dir') === 'down' ? ' selected' : ''}>Short (sell)</option></select></label>
      ${field('c-entry', 'Entry', q.get('entry'), 'inputmode="decimal" required')}
      ${field('c-stop', 'Stop', q.get('stop'), 'inputmode="decimal" required')}
      ${field('c-target', 'Target', q.get('target'), 'inputmode="decimal" required')}
      ${field('c-time', 'Entry time (IST)', time, 'placeholder="now" pattern="[0-2]?[0-9]:[0-5][0-9]"')}
      <label class="field"><span>Past record of</span><select class="input" id="c-rule">${Object.entries(RULE_LABEL).map(([k, v]) =>
        `<option value="${k}"${(q.get('rule') || 'none') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
    </div>
    <div class="form-row"><span class="form-msg" id="c-msg">${q.get('from') ? `From ${esc(q.get('from'))}.` : 'Fill the plan, or open one from an alert or a scanner hit.'}</span>
      <div style="display:flex;gap:8px"><button type="button" class="btn" id="c-now">Use price now</button><button class="btn btn-primary" id="c-run">Run the check</button></div></div>
  </div></form>
  <div id="check-out"></div>
  <div class="grid-2" style="margin-top:16px">
    <details class="panel" id="rules-panel"><summary class="panel-head" style="cursor:pointer"><h2>My limits</h2><span class="faint" style="font-size:12px">saved on this device</span></summary>
      <form class="panel-body" id="rules-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        ${field('r-capitalInr', 'Capital (₹)', rules.capitalInr, 'inputmode="decimal"')}
        ${field('r-maxLossInr', 'Max loss per trade (₹)', rules.maxLossInr, 'inputmode="decimal"')}
        ${field('r-maxDailyLossInr', 'Max loss per day (₹)', rules.maxDailyLossInr, 'inputmode="decimal"')}
        ${field('r-maxTradesPerDay', 'Trades per day', rules.maxTradesPerDay, 'inputmode="numeric"')}
        ${field('r-minRR', 'Min reward:risk', rules.minRR, 'inputmode="decimal"')}
        ${field('r-maxPositionPct', 'Max position (% of capital, stocks)', rules.maxPositionPct, 'inputmode="decimal"')}
        ${field('r-entryFrom', 'No entries before', rules.entryFrom)}
        ${field('r-entryTo', 'No entries after', rules.entryTo)}
        ${field('r-flatBy', 'Flat by (replays end)', rules.flatBy)}
        ${field('r-lot-NIFTY', 'Nifty lot size', rules.lot.NIFTY, 'inputmode="numeric"')}
        ${field('r-lot-BANKNIFTY', 'Bank Nifty lot size', rules.lot.BANKNIFTY, 'inputmode="numeric"')}
        ${field('r-lot-SENSEX', 'Sensex lot size', rules.lot.SENSEX, 'inputmode="numeric"')}
        ${field('r-maxLots', 'Max lots per trade', rules.maxLots, 'inputmode="numeric"')}
        ${field('r-cryptoCapitalUsd', 'Crypto capital ($)', rules.cryptoCapitalUsd, 'inputmode="decimal"')}
        ${field('r-cryptoMaxLossUsd', 'Crypto max loss per trade ($)', rules.cryptoMaxLossUsd, 'inputmode="decimal"')}
        ${field('r-cryptoMaxDailyLossUsd', 'Crypto max loss per day ($)', rules.cryptoMaxDailyLossUsd, 'inputmode="decimal"')}
        <div class="form-row" style="grid-column:1/-1;margin:0"><span class="form-msg" id="r-msg">Index sizes are futures lots. NSE/BSE change lot sizes every few months: check yours with the broker.</span>
          <button class="btn">Save limits</button></div>
      </form></details>
    <div class="panel"><div class="panel-head"><h2>Taken today</h2><span class="faint" style="font-size:12px">counts toward the day limits</span></div><div id="journal"></div></div>
  </div>`;
}

function startCheck() {
  ensureLive().then(() => { if (!hashParams.get('entry')) fillNow(); });
  renderJournal();
  $('#check-form').addEventListener('submit', (e) => { e.preventDefault(); runCheck(); });
  $('#c-now').addEventListener('click', fillNow);
  $('#rules-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = loadRules(), n = (id) => Number($(`#r-${id}`).value);
    for (const k of ['capitalInr', 'maxLossInr', 'maxDailyLossInr', 'maxTradesPerDay', 'minRR', 'maxPositionPct', 'maxLots', 'cryptoCapitalUsd', 'cryptoMaxLossUsd', 'cryptoMaxDailyLossUsd']) {
      if (Number.isFinite(n(k)) && n(k) >= 0) r[k] = n(k);
    }
    for (const k of ['entryFrom', 'entryTo', 'flatBy']) if (/^\d{1,2}:\d{2}$/.test($(`#r-${k}`).value.trim())) r[k] = $(`#r-${k}`).value.trim().padStart(5, '0');
    r.lot = { ...r.lot };
    for (const s of INDEX_SYMS) if (n(`lot-${s}`) > 0) r.lot[s] = n(`lot-${s}`);
    LS.set('lt-rules', JSON.stringify(r));
    $('#r-msg').textContent = 'Saved on this device.';
  });
  if (hashParams.get('entry') && hashParams.get('stop') && hashParams.get('target')) runCheck();
}

function fillNow() {
  const sym = $('#c-sym')?.value.trim().toUpperCase();
  const it = liveData?.watch?.find((w) => w.sym === sym) || liveData?.crypto?.coins?.find((c) => c.sym === sym);
  if (it?.ltp && $('#c-entry')) { $('#c-entry').value = it.ltp; $('#c-msg').textContent = `Entry set to the last price, ${istTime(it.at || Date.now())} IST. Set the stop and target.`; }
  else if ($('#c-msg')) $('#c-msg').textContent = 'No live price for this symbol here (stocks: take it from the scanner or your broker).';
}

function renderJournal() {
  const box = $('#journal');
  if (!box) return;
  const all = loadJournal(), today = all.filter((j) => j.day === istDayNow());
  box.innerHTML = today.length ? `<div class="list-rows">${today.map((j, i) => `
    <div class="row" style="grid-template-columns:52px 1fr auto;cursor:default"><span class="mono faint">${istTime(j.at)}</span>
      <div><div class="row-title">${esc(symName(j.sym))} · ${j.dir === 'up' ? 'long' : 'short'} ${esc(j.qty)} ${esc(j.unit)}</div>
        <div class="row-sub mono">entry ${esc(j.entry)} · stop ${esc(j.stop)} · max loss ${esc(j.cur)}${esc(j.maxLoss)}</div></div>
      <button class="icon-btn" data-del="${i}" aria-label="Remove">${icon('close')}</button></div>`).join('')}</div>`
    : '<div class="empty">Nothing marked as taken today.</div>';
  box.onclick = (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const keep = loadJournal(), t = keep.filter((j) => j.day === istDayNow());
    const gone = t[Number(b.dataset.del)];
    LS.set('lt-journal', JSON.stringify(keep.filter((j) => j !== gone && !(j.at === gone.at && j.sym === gone.sym))));
    renderJournal();
  };
}

let checkRun = 0;
async function runCheck() {
  const out = $('#check-out'), msg = $('#c-msg');
  const sym = $('#c-sym').value.trim().toUpperCase(), kind = symKind(sym);
  const dir = $('#c-dir').value, num3 = (id) => Number(String($(id).value).replace(/,/g, ''));
  const entry = num3('#c-entry'), stop = num3('#c-stop'), target = num3('#c-target');
  const rule = $('#c-rule').value, rules = loadRules();
  if (!kind) { msg.textContent = `${sym} is not one of the 3 indices, 3 coins or the Nifty 200 stocks.`; return; }
  if (![entry, stop, target].every((x) => x > 0)) { msg.textContent = 'Entry, stop and target must be numbers.'; return; }
  // Entry time: the alert's moment, a typed HH:MM on that day (IST), or now.
  const baseAt = Number(hashParams.get('at')) || Date.now();
  const t = $('#c-time').value.trim();
  let at = baseAt;
  if (/^\d{1,2}:\d{2}$/.test(t) && kind !== 'crypto') {
    const [h, m] = t.split(':').map(Number);
    at = Date.parse(`${istDay(baseAt)}T00:00:00+05:30`) + (h * 60 + m) * 60000;
  }
  const plan = { sym, kind, dir, entry, stop, target, at };
  const run = ++checkRun;
  out.innerHTML = '<div class="panel empty"><strong>Running…</strong>Fetching 5 min bars and replaying 10,000 sessions.</div>';
  try {
    const needHourly = kind === 'crypto' && rule.startsWith('detect');
    const [b5, b60] = await Promise.all([api(`/bars?sym=${encodeURIComponent(sym)}&tf=5`), needHourly ? api(`/bars?sym=${sym}&tf=60`) : null]);
    if (run !== checkRun) return;
    const tm = timeMachine(b5.candles, plan, { flatBy: rules.flatBy, hours: 24 });
    const ruleObj = rule === 'none' ? null : rule === 'orb15'
      ? (kind === 'crypto' ? null : { type: 'orb15', dir, rT: Math.abs(target - entry) / Math.abs(entry - stop) })
      : { type: 'detect', kind: rule.split(':')[1], dir };
    const hist = ruleObj ? historyRun(kind === 'crypto' ? b60.candles : b5.candles, plan, ruleObj, { flatBy: rules.flatBy, entryTo: rules.entryTo }) : null;
    const size = sizeTrade(plan, rules);
    const today = loadJournal().filter((j) => j.day === istDayNow());
    const risk = riskCheck(plan, size, rules, today, { marketOpen: kind === 'crypto' || marketOpen(liveData?.status) });
    out.innerHTML = checkResults(plan, tm, hist, size, risk, b5, ruleObj && kind === 'crypto' && rule === 'orb15');
    $('#c-take')?.addEventListener('click', () => {
      const j = loadJournal();
      j.push({ day: istDayNow(), at: Date.now(), sym, dir, entry, stop, target, qty: size.qty, unit: size.unit, maxLoss: size.maxLoss, cur: size.cur });
      LS.set('lt-journal', JSON.stringify(j.slice(-200)));
      renderJournal();
      $('#c-take').disabled = true;
      $('#c-take').textContent = 'Marked as taken';
    });
    msg.textContent = `${symName(sym)} · ${dir === 'up' ? 'long' : 'short'} · checked ${istTime(Date.now())} IST.`;
  } catch (ex) {
    if (run === checkRun) out.innerHTML = `<div class="panel empty"><strong>Could not run the check</strong>${esc(ex.message)}</div>`;
  }
}

function checkResults(plan, tm, hist, size, risk, b5, orbCrypto) {
  const P = (n) => (plan.kind === 'crypto' ? `$${cnum(n)}` : num(n));
  const tile = (label, v, sub, color) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value"${color ? ` style="color:var(--${color})"` : ''}>${v}</div><div class="stat-sub">${sub}</div></div>`;
  const vlines = verdict(tm);
  const tmBox = tm.error ? `<div class="panel empty"><strong>Time Machine could not run</strong>${esc(tm.error)}</div>` : `
    <div class="panel"><div class="panel-head"><h2>Time Machine · ${tm.replays.toLocaleString('en-IN')} replays</h2><span class="faint mono" style="font-size:12px">seed ${tm.seed}</span></div>
      <div class="panel-body" style="display:grid;gap:12px">
        <div class="stats" style="margin:0">${tile('Target first', `${tm.target} %`, `${(tm.rT).toFixed(2)}R`, 'up')}${tile('Stop first', `${tm.stop} %`, '-1R', 'down')}${tile('Neither', `${tm.neither} %`, `open at ${esc(tm.untilLabel)}`)}${tile('Green', `${tm.green} %`, 'target, or above the entry at the end')}</div>
        <div style="font-size:13.5px;line-height:1.6">
          <div><b>${esc(vlines[0] || '')}</b></div>${vlines.slice(1).map((l) => `<div>${esc(l)}</div>`).join('')}
          <div class="muted">Price at ${esc(tm.untilLabel)}: median ${P(tm.median)}, 90 % of replays between ${P(tm.p5)} and ${P(tm.p95)}. Average R ${tm.avgR > 0 ? '+' : ''}${tm.avgR}.</div>
          <div class="muted">${hist ? `History: ${esc(hist.label)}. Over ${hist.sessions} past ${plan.kind === 'crypto' ? 'days' : 'sessions'} it fired ${hist.fired} times: ${hist.target} target, ${hist.stop} stop, ${hist.neither} neither${hist.notFilled ? ` (+${hist.notFilled} whose stop-order entry never filled)` : ''}. Average R ${hist.avgR === null ? '–' : (hist.avgR > 0 ? '+' : '') + hist.avgR}.`
            : orbCrypto ? 'History: the opening range rule needs a market open, so crypto has none.' : 'History: pick a rule under "Past record of" to see how the same rule did on every past session.'}</div>
        </div>
        <div class="faint" style="font-size:12px">Built from ${tm.sessions} full past ${plan.kind === 'crypto' ? 'days of 5 min bars (Delta)' : 'sessions of 5 min bars (Upstox)'}, each bar drawn from the same time of day (±2 bars), ${tm.bars} bars per replay; a bar touching both counts as the stop, and a gap through the stop counts as -1R (a real fill can be worse). Not a prediction: news and events can do things those sessions never did. <a href="#/news">Check the news</a>.</div>
      </div></div>`;
  const cur = size.cur || (plan.kind === 'crypto' ? '$' : '₹');
  const sizeBox = `<div class="panel"><div class="panel-head"><h2>Position size</h2><span class="faint" style="font-size:12px">${plan.kind === 'index' ? 'index futures lots' : plan.kind === 'stock' ? 'shares' : 'coins'}</span></div>
    <div class="facts">${(size.limits || []).map((l) => `<div class="fact"><span>${esc(l.name)}<br><span class="faint mono" style="font-size:11.5px">${esc(l.math)}</span></span><span class="mono">${esc(l.qty)}${l.name === size.decidedBy ? ' ◀' : ''}</span></div>`).join('')}
      <div class="fact"><span>Result</span><span class="mono" style="${size.refused ? 'color:var(--down)' : ''}">${size.refused ? esc(size.refused) : `${size.qty} ${size.unit} · value ${cur}${num(size.value)} · max loss at the stop ${cur}${num(size.maxLoss)}`}</span></div></div>
    <div class="panel-body faint" style="font-size:12px;padding-top:10px">A stop is an order, not a promise: in a fast market it can fill worse. ${plan.kind === 'index' ? 'Options are sized differently (premium, not points).' : ''}</div></div>`;
  const riskBox = `<div class="panel"><div class="panel-head"><h2>Risk check</h2><span class="tag ${risk.pass ? 'tag-up' : 'tag-down'}">${risk.pass ? 'PASS' : 'BLOCK'}</span></div>
    <div class="facts">${risk.checks.map((c) => `<div class="fact"><span>${c.ok ? '✓' : '✗'} ${esc(c.name)}</span><span class="mono" style="font-size:12.5px;${c.ok ? '' : 'color:var(--down)'}">${esc(c.text)}</span></div>`).join('')}</div>
    <div class="panel-body" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span class="faint" style="font-size:12px">A PASS is a rules check, not a recommendation. Lets Trade never places orders.</span>
      ${risk.pass ? '<button class="btn" id="c-take">I took this trade</button>' : ''}</div></div>`;
  return `${tmBox}<div class="grid-2" style="margin-top:16px">${sizeBox}${riskBox}</div>`;
}

// ---------- Stock Scanner (Nifty 200) ----------
const SETUP_LABEL = { breakout_20d: '20 day breakout', breakdown_20d: '20 day breakdown', bull_flag: 'Bull flag', reclaim_ma20: 'Reclaimed 20 day average',
  oversold: 'Oversold (RSI under 30)', oversold_bounce: 'Oversold bounce' };
let scanFilter = 'all', scanData = null;

function pageScan() {
  return `
  <div class="page-head"><div><div class="kicker">Stock Scanner · Nifty 200</div><h1>Charts that match a rule</h1>
    <p>Opening range breaks during the session and daily setups before the open, on the 200 Nifty 200 stocks.
    A scan is a list of charts that match a rule, not a list of stocks to buy.</p></div></div>
  <div id="scan-body"><div class="panel empty"><strong>Loading the scan…</strong></div></div>`;
}

async function loadScan() {
  try { scanData = await api('/scan'); } catch (ex) { scanData = { error: ex.message }; }
  renderScan();
}

function renderScan() {
  const box = $('#scan-body');
  if (!box || !scanData) return;
  if (scanData.error) { box.innerHTML = `<div class="panel empty"><strong>Could not load the scan</strong>${esc(scanData.error)}</div>`; return; }
  const { orb, daily } = scanData, today = istDayNow();
  const orbToday = orb?.day === today ? orb : null;
  const orbRows = (orbToday?.hits || []).map((h) => {
    const mid = (h.orh + h.orl) / 2, risk = Math.abs(h.close - mid);
    const tgt = h.dir === 'up' ? h.close + 2 * risk : h.close - 2 * risk;
    const at = Date.parse(`${today}T00:00:00+05:30`) + h.time * 60000;
    return `<div class="row" style="grid-template-columns:52px 1fr auto;cursor:default">
      <span class="mono faint">${hm(h.time)}</span>
      <div><div class="row-title">${esc(h.sym)} <span class="faint" style="font-weight:400">${esc(h.name)}</span> · <span style="color:var(--${h.dir === 'up' ? 'up' : 'down'})">${h.dir === 'up' ? 'above ↑' : 'below ↓'} the range</span></div>
        <div class="row-sub mono">5 min close ${num(h.close)} (${h.pct > 0 ? '+' : ''}${num(h.pct)} % past ${num(h.dir === 'up' ? h.orh : h.orl)}) · range ${num(h.orl)}-${num(h.orh)} · ${esc(h.ind)}</div></div>
      <div style="display:flex;gap:6px"><button class="chip" data-chart="${esc(h.sym)}">Chart</button>
        <a class="chip" style="display:inline-flex;align-items:center" href="${checkLink({ sym: h.sym, dir: h.dir, entry: h.close, stop: Math.round(mid * 100) / 100, target: Math.round(tgt * 100) / 100, at, rule: 'orb15', from: `the scanner (${hm(h.time)} opening range break)` })}">Check</a></div></div>`;
  }).join('');
  const dHits = daily?.hits || [];
  const counts = {};
  for (const h of dHits) counts[h.setup] = (counts[h.setup] || 0) + 1;
  const shown = dHits.filter((h) => scanFilter === 'all' || h.setup === scanFilter);
  box.innerHTML = `
    <div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>Opening range breaks · ${esc(today)}</h2><span class="faint mono">${orbToday?.hits?.length || 0}</span></div>
      <div class="panel-body faint" style="font-size:12.5px;padding-bottom:0">${orbToday ? `Checked ${orbToday.at ? istTime(orbToday.at) : '–'} IST: ${orbToday.candidates ?? '–'} stocks past their 09:30 range on the quote, the ${orbToday.checked ?? 0} most traded confirmed on real 5 min candles each run. A hit is the first completed 5 min bar that CLOSES past the 15 minute range. Runs 09:30-14:45 on trading days.`
        : 'No opening range scan today yet. It runs every 5 minutes from 09:30 to 14:45 IST on trading days.'}</div>
      ${orbRows ? `<div class="list-rows" style="margin-top:8px">${orbRows}</div>` : `<div class="empty">${orbToday ? 'No confirmed breaks yet.' : ''}</div>`}</div>
    <div class="panel"><div class="panel-head"><h2>Daily setups${daily?.hits ? ` · closes of ${esc(dHits[0]?.asOf || daily.day)}` : ''}</h2><span class="faint mono">${shown.length}</span></div>
      ${daily?.inProgress !== undefined ? `<div class="empty">Scanning before the open: ${daily.inProgress} of ${daily.of} stocks read.</div>` : !daily ? '<div class="empty">No daily scan yet. It runs at 08:00-08:10 IST on trading days.</div>' : `
      <div class="panel-body" style="padding-bottom:0"><div class="chips">
        <button class="chip" data-sf="all" aria-pressed="${scanFilter === 'all'}">All <span class="n">${dHits.length}</span></button>
        ${Object.keys(SETUP_LABEL).filter((k) => counts[k]).map((k) => `<button class="chip" data-sf="${k}" aria-pressed="${scanFilter === k}">${esc(SETUP_LABEL[k])} <span class="n">${counts[k]}</span></button>`).join('')}</div>
        <p class="faint" style="font-size:12px;margin:10px 0 0">Ran ${istTime(daily.at)} IST on ${daily.scanned} stocks${daily.failed?.length ? ` (${daily.failed.length} failed)` : ''}. Setups use daily closes only. Most traded first.</p></div>
      <div class="list-rows" style="margin-top:8px">${shown.slice(0, 150).map((h) => `
        <div class="row" style="grid-template-columns:1fr auto;cursor:default">
          <div><div class="row-title">${esc(h.sym)} <span class="faint" style="font-weight:400">${esc(h.name)}</span> · <span style="color:var(--${h.dir === 'up' ? 'up' : 'down'})">${esc(SETUP_LABEL[h.setup] || h.setup)}</span></div>
            <div class="row-sub">${esc(h.note)} · close ${num(h.close)} (${h.chgPct > 0 ? '+' : ''}${num(h.chgPct)} %) · ${esc(h.ind)}</div></div>
          <button class="chip" data-chart="${esc(h.sym)}">Chart</button></div>`).join('')}</div>`}</div>`;
  box.onclick = (e) => {
    const c = e.target.closest('[data-chart]');
    if (c) return openChart(c.dataset.chart);
    const f = e.target.closest('[data-sf]');
    if (f) { scanFilter = f.dataset.sf; renderScan(); }
  };
}

// ---------- Market News ----------
let newsFilter = 'all', newsData = null, newsSeen = 0;
const NEWS_FILTERS = { all: 'All', india: 'Indian market', crypto: 'Crypto', watch: 'Names our symbols', earnings: 'Earnings', policy: 'RBI / Fed',
  macro: 'Macro', flows: 'FII / DII', global: 'Global', regulatory: 'Regulatory', deal: 'Deals', hack: 'Hacks' };

function pageNews() {
  return `
  <div class="page-head"><div><div class="kicker">Market News</div><h1>Headlines that move the market</h1>
    <p>Indian market and crypto headlines from the last 48 hours, tagged by what they touch. Headlines are leads, not facts:
    open the story before acting, and never trade on a headline alone.</p></div>
    <button class="btn" id="news-refresh">Refresh</button></div>
  <div id="news-body"><div class="panel empty"><strong>Loading headlines…</strong></div></div>`;
}

async function loadNews() {
  $('#news-refresh')?.addEventListener('click', loadNews);
  newsSeen = Number(LS.get('lt-news-seen')) || 0;
  try { [newsData] = await Promise.all([api('/news'), ensureLive()]); } catch (ex) { newsData = { error: ex.message }; }
  renderNews();
  if (newsData?.items?.length) LS.set('lt-news-seen', String(newsData.items[0].at));
}

function renderNews() {
  const box = $('#news-body');
  if (!box || !newsData) return;
  if (newsData.error) { box.innerHTML = `<div class="panel empty"><strong>Could not load the news</strong>${esc(newsData.error)}</div>`; return; }
  // MOVING: an index 1 % or more from yesterday's close, a coin 3 % or more over 24 hours.
  const moving = [...(liveData?.watch || []).filter((w) => Math.abs(w.chgPct || 0) >= 1).map((w) => `${w.name} ${w.chgPct > 0 ? '+' : ''}${num(w.chgPct)} % vs yesterday's close`),
    ...(liveData?.crypto?.coins || []).filter((c) => Math.abs(c.chgPct || 0) >= 3).map((c) => `${c.name} ${c.chgPct > 0 ? '+' : ''}${num(c.chgPct)} % in 24 hours`)];
  const items = newsData.items.filter((x) => newsFilter === 'all' || x.group === newsFilter || (newsFilter === 'watch' ? x.syms.length : x.tags.includes(newsFilter)));
  const count = (f) => newsData.items.filter((x) => f === 'all' || x.group === f || (f === 'watch' ? x.syms.length : x.tags.includes(f))).length;
  const when = (t) => (istDay(t) === istDayNow() ? istTime(t) : `${new Date(t + 330 * 60000).toUTCString().slice(5, 11)} ${istTime(t)}`);
  box.innerHTML = `
    ${moving.length ? `<div class="panel" style="margin-bottom:12px;padding:12px 16px"><b>MOVING</b> · ${moving.map(esc).join(' · ')}<span class="faint"> · a move with no headline is worth noticing too</span></div>` : ''}
    <div class="chips" style="margin-bottom:12px">${Object.entries(NEWS_FILTERS).filter(([k]) => k === 'all' || count(k)).map(([k, v]) =>
      `<button class="chip" data-nf="${k}" aria-pressed="${newsFilter === k}">${esc(v)} <span class="n">${count(k)}</span></button>`).join('')}</div>
    <div class="panel"><div class="list-rows">${items.length ? items.map((x) => `
      <a class="row" style="grid-template-columns:70px 1fr" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">
        <span class="mono faint" style="font-size:12px">${when(x.at)}</span>
        <div><div class="row-title">${x.at > newsSeen && newsSeen ? '<span class="tag tag-accent" style="margin-right:6px">New</span>' : ''}${esc(x.title)}</div>
          <div class="row-sub">${esc(x.src)}${x.syms.map((s) => ` · <span class="mono" style="color:var(--accent)">${esc(s)}</span>`).join('')}${x.tags.map((t) => ` · ${esc(t)}`).join('')}</div></div></a>`).join('')
      : '<div class="empty">No headlines under this filter.</div>'}</div></div>
    <p class="faint" style="font-size:12px;margin-top:10px">Sources: ${newsData.feeds.map((f) => `${esc(f.src)}${f.ok ? '' : ' (failed)'}`).join(', ')}. Updated ${istTime(newsData.at)} IST, kept 10 minutes. Times are IST.</p>`;
  box.onclick = (e) => { const f = e.target.closest('[data-nf]'); if (f) { newsFilter = f.dataset.nf; renderNews(); } };
}

// ---------- Paper Race: virtual ₹1,000 each, live prices, every action posted to the Telegram channel ----------
let raceData = null, raceTimer = null, raceSel = null, raceSide = 'long', raceQuote = null, raceTab = 'positions';
const rupee = (n) => `₹${num(n)}`;
const signed = (n, f = rupee) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f(Math.abs(n))}`;
const pnlColor = (n) => (n > 0 ? 'var(--up)' : n < 0 ? 'var(--down)' : 'var(--muted)');
const racePin = (id) => { try { return sessionStorage.getItem(`race-pin-${id}`) || ''; } catch { return ''; } };
const keepPin = (id, pin) => { try { sessionStorage.setItem(`race-pin-${id}`, pin); } catch { /* private mode */ } };

async function apiPost(path, body) {
  const res = await fetch(`${DATA.live.url}${path}`, { method: 'POST', headers: { 'x-live-key': DATA.live.key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({ error: `the live watch answered ${res.status}` }));
  if (d.error) throw new Error(d.error);
  return d;
}

function standingsRows(players, link) {
  return players.map((p, i) => `
    <${link ? 'a' : 'button'} class="row" ${link ? 'href="#/race"' : `data-pl="${p.id}"`} style="grid-template-columns:28px 1fr auto;width:100%;text-align:left;background:${!link && p.id === raceSel ? 'var(--panel-2)' : 'none'};border:0;border-top:1px solid var(--line);color:inherit;font:inherit;cursor:pointer">
      <span class="mono" style="color:${i === 0 ? 'var(--accent)' : 'var(--faint)'}">#${i + 1}</span>
      <div><div class="row-title">${esc(p.name)}</div><div class="row-sub">${p.positions.length} open · ${p.tradeCount} trades · cash ${rupee(p.cash)}</div></div>
      <div style="text-align:right;font-family:var(--mono)"><div>${rupee(p.equity)}</div><div style="font-size:12px;color:${pnlColor(p.pnl)}">${signed(p.pnl)} (${p.returnPct > 0 ? '+' : ''}${num(p.returnPct)} %)</div></div>
    </${link ? 'a' : 'button'}>`).join('');
}

async function loadHomeRace() {
  const box = $('#home-race');
  if (!box) return;
  try {
    const d = await api('/paper');
    if (!$('#home-race')) return;
    box.innerHTML = `<div class="panel-head"><h2>Paper Race · standings</h2><a href="#/race">Open the race</a></div>
      ${d.players.length ? `<div class="list-rows">${standingsRows(d.players, true)}</div>
        <div class="panel-body faint" style="font-size:12px;padding-top:10px">Virtual money only: ₹${num(d.startCash, 0)} each at live prices. ${d.season.startedAt ? `Running since ${new Date(d.season.startedAt + 330 * 60000).toUTCString().slice(5, 16)}.` : ''}</div>`
        : '<div class="empty"><strong>No one in the race yet</strong><a href="#/race">Add people</a> and each gets ₹1,000 of virtual money.</div>'}`;
  } catch (ex) {
    box.innerHTML = `<div class="panel-head"><h2>Paper Race</h2><a href="#/race">Open</a></div><div class="empty">${esc(ex.message)}</div>`;
  }
}

function pageRace() {
  return `
  <div class="page-head"><div><div class="kicker">Paper Race · virtual money</div><h1>Trade like it's real, learn for free</h1>
    <p>Each person gets ₹1,000 of virtual money and trades Nifty 200 stocks and ETH, SOL, XRP at live market prices: long or short,
    never more than their cash. Every order and exit is posted to the Telegram channel. No real money, no real orders.</p></div>
    <button class="btn" id="race-add-btn">Add person</button></div>
  <div class="panel" style="margin-bottom:16px;padding:10px 16px;border-color:var(--accent);color:var(--accent);font-size:13px">VIRTUAL MONEY · practice only · prices are live (stocks 09:15-15:30 IST on trading days, crypto 24 hours, crypto shown in ₹ at the live dollar rate)</div>
  <form class="panel" id="race-add" hidden style="margin-bottom:16px"><div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:end">
    <label class="field"><span>Name</span><input class="input" id="ra-name" maxlength="24" required></label>
    <label class="field"><span>4-digit PIN (to trade)</span><input class="input mono" id="ra-pin" inputmode="numeric" pattern="\\d{4}" maxlength="4" required></label>
    <button class="btn btn-primary">Add with ₹1,000</button></div><div class="panel-body form-msg" id="ra-msg" style="padding-top:0"></div></form>
  <div class="grid-2" style="align-items:start">
    <div id="race-account"></div>
    <div class="stack" style="display:grid;gap:16px">
      <div class="panel"><div class="panel-head"><h2>Standings</h2><span class="faint mono" id="race-upd"></span></div><div id="race-board"><div class="empty">Loading…</div></div></div>
      <details class="panel"><summary class="panel-head" style="cursor:pointer"><h2>Reset or leave</h2></summary><div class="panel-body" style="display:grid;gap:10px;font-size:13px">
        <div>Reset starts everyone again at ₹1,000 and clears all trades. Type RESET:</div>
        <div style="display:flex;gap:8px"><input class="input mono" id="race-reset-txt" placeholder="RESET" style="max-width:140px"><button class="btn" id="race-reset">Reset the race</button></div>
        <div class="faint">To leave the race, open your account and use "Leave the race" (needs your PIN).</div>
        <div class="form-msg" id="race-reset-msg"></div></div></details>
    </div>
  </div>`;
}

function startRace() {
  $('#race-add-btn').addEventListener('click', () => { $('#race-add').hidden = !$('#race-add').hidden; $('#ra-name').focus(); });
  $('#race-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await apiPost('/paper/player', { name: $('#ra-name').value, pin: $('#ra-pin').value });
      keepPin(r.id, $('#ra-pin').value);
      raceSel = r.id;
      $('#race-add').reset(); $('#race-add').hidden = true;
      await loadRace();
    } catch (ex) { $('#ra-msg').textContent = ex.message; }
  });
  $('#race-reset').addEventListener('click', async () => {
    try { await apiPost('/paper/reset', { confirm: $('#race-reset-txt').value.trim() }); $('#race-reset-msg').textContent = 'Reset. Everyone has ₹1,000 again.'; await loadRace(); }
    catch (ex) { $('#race-reset-msg').textContent = ex.message; }
  });
  $('#race-board').addEventListener('click', (e) => { const b = e.target.closest('[data-pl]'); if (b) { raceSel = Number(b.dataset.pl); raceQuote = null; renderRace(); } });
  loadRace();
  clearInterval(raceTimer);
  raceTimer = setInterval(() => { if (document.visibilityState === 'visible' && location.hash.startsWith('#/race')) loadRace(true); }, 30000);
}

async function loadRace(quiet) {
  try { raceData = await api('/paper'); } catch (ex) { if (!quiet) $('#race-board').innerHTML = `<div class="empty">${esc(ex.message)}</div>`; return; }
  if (!raceData.players.some((p) => p.id === raceSel)) raceSel = raceData.players[0]?.id ?? null;
  renderRace(quiet);
}

function renderRace(quiet) {
  if (!$('#race-board') || !raceData) return;
  $('#race-upd').textContent = `${istTime(raceData.now)} IST`;
  $('#race-board').innerHTML = raceData.players.length ? `<div class="list-rows">${standingsRows(raceData.players, false)}</div>`
    : '<div class="empty"><strong>No one yet</strong>Use "Add person" to start the race.</div>';
  const p = raceData.players.find((x) => x.id === raceSel);
  const box = $('#race-account');
  if (!p) { box.innerHTML = ''; return; }
  // Keep what he is typing in the order ticket when the 30 s refresh redraws the page.
  const keep = quiet && $('#ro-sym') ? { sym: $('#ro-sym').value, amt: $('#ro-amt').value, pin: $('#ro-pin').value, focus: document.activeElement?.id } : null;
  const invested = p.positions.reduce((a, x) => a + x.cost, 0), open = p.positions.reduce((a, x) => a + x.pnl, 0);
  box.innerHTML = `
    <div class="panel" style="margin-bottom:16px"><div class="panel-head"><h2>${esc(p.name)} · account</h2><span class="tag tag-accent">virtual</span></div>
      <div class="stats" style="margin:0;border:0;border-radius:0">
        <div class="stat"><div class="stat-label">Account value</div><div class="stat-value">${rupee(p.equity)}</div><div class="stat-sub" style="color:${pnlColor(p.pnl)}">${signed(p.pnl)} overall</div></div>
        <div class="stat"><div class="stat-label">Available cash</div><div class="stat-value">${rupee(p.cash)}</div><div class="stat-sub">to place orders</div></div>
        <div class="stat"><div class="stat-label">Invested</div><div class="stat-value">${rupee(invested)}</div><div class="stat-sub">${p.positions.length} open</div></div>
        <div class="stat"><div class="stat-label">Open P&amp;L</div><div class="stat-value" style="color:${pnlColor(open)}">${signed(open)}</div><div class="stat-sub">live prices</div></div>
      </div></div>
    <form class="panel" id="race-order" style="margin-bottom:16px"><div class="panel-head"><h2>Place order</h2><span class="faint" style="font-size:12px">market order · fills at the live price</span></div>
      <div class="panel-body" style="display:grid;gap:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button type="button" class="btn" data-side="long" style="${raceSide === 'long' ? 'background:var(--up);border-color:var(--up);color:#06110f;font-weight:600' : ''}">BUY</button>
          <button type="button" class="btn" data-side="short" style="${raceSide === 'short' ? 'background:var(--down);border-color:var(--down);color:#1a0505;font-weight:600' : ''}">SELL (short)</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
          <label class="field"><span>Stock or coin</span><input class="input mono" id="ro-sym" list="ro-syms" placeholder="RELIANCE / ETH" autocapitalize="characters" required>
            <datalist id="ro-syms">${[...COIN_SYMS, ...UNIVERSE.map((u) => u.sym)].map((s) => `<option value="${esc(s)}">${esc(symName(s))}</option>`).join('')}</datalist></label>
          <label class="field"><span>Amount (₹)</span><input class="input mono" id="ro-amt" inputmode="decimal" required></label>
          <label class="field"><span>PIN</span><input class="input mono" id="ro-pin" inputmode="numeric" maxlength="4" value="${esc(racePin(p.id))}" required></label>
        </div>
        <div class="chips">${[25, 50, 100].map((f) => `<button type="button" class="chip" data-frac="${f}">${f} % of cash</button>`).join('')}</div>
        <div id="ro-quote" class="mono" style="font-size:13px;min-height:20px"></div>
        <div class="form-row" style="margin:0"><span class="form-msg" id="ro-msg"></span>
          <button class="btn btn-primary" id="ro-go">${raceSide === 'long' ? 'Buy' : 'Sell short'}</button></div>
      </div></form>
    <div class="panel"><div class="panel-head"><div class="chips"><button class="chip" data-tab="positions" aria-pressed="${raceTab === 'positions'}">Positions <span class="n">${p.positions.length}</span></button>
        <button class="chip" data-tab="orders" aria-pressed="${raceTab === 'orders'}">Orders <span class="n">${p.trades.length}</span></button></div></div>
      ${raceTab === 'positions' ? (p.positions.length ? `<div class="list-rows">${p.positions.map((x) => `
        <div class="row" style="grid-template-columns:1fr auto auto;cursor:default">
          <div><div class="row-title"><span class="tag ${x.side === 'long' ? 'tag-up' : 'tag-down'}">${x.side === 'long' ? 'LONG' : 'SHORT'}</span> ${esc(x.sym)} <span class="faint" style="font-weight:400">${esc(x.name)}</span></div>
            <div class="row-sub mono">qty ${num(x.qty, x.qty < 1 ? 6 : 2)} · avg ${num(x.entry)} · LTP ${num(x.price)}${x.priced ? '' : ' (no price now)'} · ${istTime(x.opened)}</div></div>
          <div style="text-align:right;font-family:var(--mono);color:${pnlColor(x.pnl)}">${signed(x.pnl)}<div style="font-size:12px">${x.pnlPct > 0 ? '+' : ''}${num(x.pnlPct)} %</div></div>
          <div style="display:flex;gap:6px"><button class="chip" data-chart="${esc(x.sym)}">Chart</button><button class="chip" data-exit="${x.id}">Exit</button></div></div>`).join('')}</div>`
        : '<div class="empty">No open positions.</div>')
      : (p.trades.length ? `<div class="list-rows">${p.trades.map((t) => {
        const buy = (t.action === 'open') === (t.side === 'long');
        return `<div class="row" style="grid-template-columns:70px 1fr auto;cursor:default">
          <span class="mono faint" style="font-size:12px">${istDay(t.at) === istDayNow() ? istTime(t.at) : new Date(t.at + 330 * 60000).toUTCString().slice(5, 11)}</span>
          <div><div class="row-title"><span style="color:var(--${buy ? 'up' : 'down'})">${buy ? 'BUY' : 'SELL'}</span> ${esc(t.sym)} <span class="faint" style="font-weight:400">${t.action === 'open' ? (t.side === 'long' ? 'open long' : 'open short') : (t.side === 'long' ? 'exit long' : 'cover short')}</span></div>
            <div class="row-sub mono">qty ${num(t.qty, t.qty < 1 ? 6 : 2)} @ ${num(t.price)} · executed</div></div>
          <div class="mono" style="color:${t.pnl === null ? 'var(--faint)' : pnlColor(t.pnl)}">${t.pnl === null ? '' : signed(t.pnl)}</div></div>`;
      }).join('')}</div>` : '<div class="empty">No orders yet.</div>')}
      <div class="panel-body" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px"><span class="faint">Started with ₹${num(raceData.startCash, 0)} · virtual</span><button class="chip" id="race-leave">Leave the race</button></div></div>`;
  if (keep) {
    $('#ro-sym').value = keep.sym; $('#ro-amt').value = keep.amt; $('#ro-pin').value = keep.pin;
    if (keep.focus && $(`#${keep.focus}`)) $(`#${keep.focus}`).focus();
  }
  if (raceQuote) showQuote();
  wireRaceAccount(p);
}

function showQuote() {
  const q = raceQuote, box = $('#ro-quote');
  if (!box || !q) return;
  if (q.error) { box.innerHTML = `<span style="color:var(--down)">${esc(q.error)}</span>`; return; }
  const amt = Number($('#ro-amt')?.value) || 0;
  box.innerHTML = `${esc(q.sym)} · LTP ₹${num(q.price, q.price < 50 ? 4 : 2)}${q.usd ? ` ($${cnum(q.usd)} × ${num(q.fx)})` : ''}${amt ? ` · qty ≈ ${num(amt / q.price, amt / q.price < 1 ? 6 : 3)}` : ''}${q.closed ? ` · <span style="color:var(--down)">${esc(q.closed)}</span>` : ''}`;
}

function wireRaceAccount(p) {
  const box = $('#race-account');
  let qTimer = null;
  const fetchQuote = () => {
    const sym = $('#ro-sym').value.trim().toUpperCase();
    if (!sym) { raceQuote = null; $('#ro-quote').textContent = ''; return; }
    clearTimeout(qTimer);
    qTimer = setTimeout(async () => {
      try { raceQuote = await api(`/paper/quote?sym=${encodeURIComponent(sym)}`); } catch (ex) { raceQuote = { error: ex.message }; }
      showQuote();
    }, 350);
  };
  $('#ro-sym').addEventListener('change', fetchQuote);
  $('#ro-sym').addEventListener('input', () => { if (symKind($('#ro-sym').value.trim().toUpperCase())) fetchQuote(); });
  $('#ro-amt').addEventListener('input', showQuote);
  box.onclick = async (e) => {
    const side = e.target.closest('[data-side]');
    if (side) { raceSide = side.dataset.side; return renderRace(true); }
    const frac = e.target.closest('[data-frac]');
    if (frac) { $('#ro-amt').value = Math.floor((p.cash * Number(frac.dataset.frac)) / 100 * 100) / 100; return showQuote(); }
    const tab = e.target.closest('[data-tab]');
    if (tab) { raceTab = tab.dataset.tab; return renderRace(true); }
    const ch = e.target.closest('[data-chart]');
    if (ch) return openChart(ch.dataset.chart);
    const ex = e.target.closest('[data-exit]');
    if (ex) {
      const pin = $('#ro-pin').value || prompt('PIN');
      if (!pin) return;
      ex.disabled = true;
      try {
        const r = await apiPost('/paper/close', { player: p.id, pin, position: Number(ex.dataset.exit) });
        keepPin(p.id, pin);
        await loadRace(true);
        $('#ro-msg').innerHTML = `<span style="color:${pnlColor(r.closed.pnl)}">Exit executed: ${esc(r.closed.sym)} @ ₹${num(r.closed.price)}, P&amp;L ${signed(r.closed.pnl)}</span>`;
      } catch (er) { ex.disabled = false; $('#ro-msg').innerHTML = `<span style="color:var(--down)">${esc(er.message)}</span>`; }
      return;
    }
    if (e.target.closest('#race-leave')) {
      const pin = prompt(`${p.name}'s PIN to leave the race (all trades are deleted)`);
      if (!pin) return;
      try { await apiPost('/paper/remove', { player: p.id, pin }); raceSel = null; await loadRace(); } catch (er) { alert(er.message); }
    }
  };
  $('#race-order').onsubmit = async (e) => {
    e.preventDefault();
    const go = $('#ro-go'), pin = $('#ro-pin').value;
    go.disabled = true;
    $('#ro-msg').textContent = 'Placing…';
    try {
      const r = await apiPost('/paper/open', { player: p.id, pin, sym: $('#ro-sym').value.trim().toUpperCase(), side: raceSide, amount: Number($('#ro-amt').value) });
      keepPin(p.id, pin);
      const f = r.filled;
      $('#ro-amt').value = '';
      await loadRace(true);
      $('#ro-msg').innerHTML = `<span style="color:var(--up)">Order executed: ${f.side === 'long' ? 'BUY' : 'SELL'} ${esc(f.sym)} ${num(f.qty, f.qty < 1 ? 6 : 3)} @ ₹${num(f.price)}</span>`;
    } catch (er) {
      $('#ro-msg').innerHTML = `<span style="color:var(--down)">${esc(er.message)}</span>`;
    } finally { if ($('#ro-go')) $('#ro-go').disabled = false; }
  };
}

// ---------- router ----------
let lastPage = '', hashParams = new URLSearchParams();
function render() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page = '', arg = ''] = path.split('/').map(decodeURIComponent);
  hashParams = new URLSearchParams(query);
  const current = { '': 'home', s: 'library', v: 'videos', later: arg }[page] ?? page;
  if (page !== 'live') clearInterval(liveTimer);
  renderShell(current);
  $('#sheet').hidden = true;

  const view = $('#view');
  const pages = { '': pageHome, live: pageLive, library: pageLibrary, s: () => pageStrategy(arg), videos: pageVideos,
    v: () => pageVideo(arg), mine: pageMine, later: () => pageLater(arg), check: pageCheck, scan: pageScan, news: pageNews, race: pageRace };
  if (page !== 'race') clearInterval(raceTimer);
  view.innerHTML = (pages[page] || pageHome)();
  if (page === '') loadHomeRace();
  if (page === 'race') startRace();
  if (page === 'library') libResults();
  if (page === 'live') startLive();
  if (page === 'check') startCheck();
  if (page === 'scan') loadScan();
  if (page === 'news') loadNews();
  if (page === 'videos') vidResults();
  if (page === 'v') loadTranscript(arg);
  if (page === 'mine') $('#note-form').addEventListener('submit', saveNote);

  const key = `${page}/${arg}`;
  if (key !== lastPage) window.scrollTo(0, 0);
  lastPage = key;
  const title = { live: 'Live Market', library: 'Strategies', videos: 'Videos', mine: 'My Strategies', check: 'Trade Check', scan: 'Scanner', news: 'News', race: 'Paper Race' }[page];
  document.title = title ? `${title} · Lets Trade` : 'Lets Trade';
}

function start() {
  prepare();
  $('#lock').hidden = true;
  $('#app').hidden = false;
  $('.top .icon-btn').innerHTML = icon('lock');
  render();
}

window.addEventListener('hashchange', render);

document.addEventListener('click', (e) => {
  const src = e.target.closest('a[data-src]');
  if (src) { ui.lib.src = src.dataset.src; LS.set('lt.lib', JSON.stringify(ui.lib)); }
  const a = e.target.closest('[data-action]');
  if (a) {
    const act = a.dataset.action;
    if (act === 'lock') lock();
    if (act === 'sheet') openSheet();
    if (act === 'more-videos') { ui.vid.limit += 60; vidResults(); }
    return;
  }
  if (e.target.id === 'sheet') { $('#sheet').hidden = true; return; }
  const chip = e.target.closest('.chip[data-f]');
  if (chip) {
    const page = location.hash.startsWith('#/videos') ? 'vid' : 'lib';
    ui[page][chip.dataset.f] = chip.dataset.v;
    if (page === 'vid') ui.vid.limit = 60;
    persist(page);
    return;
  }
  const t = e.target.closest('.chip[data-toggle]');
  if (t) { ui.lib[t.dataset.toggle] = !ui.lib[t.dataset.toggle]; persist('lib'); }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'lib-q') { ui.lib.q = e.target.value; LS.set('lt.lib', JSON.stringify(ui.lib)); libResults(); }
  if (e.target.id === 'vid-q') { ui.vid.q = e.target.value; ui.vid.limit = 60; vidResults(); }
});
document.addEventListener('toggle', (e) => {
  if (e.target.classList?.contains('filters')) filtersOpenState = e.target.open;
}, true);
document.addEventListener('change', (e) => {
  if (e.target.id === 'lib-sort') { ui.lib.sort = e.target.value; persist('lib'); }
});

// Chip changes re-render the whole page (counts and pressed states), keeping scroll.
function persist(page) {
  if (page === 'lib') LS.set('lt.lib', JSON.stringify(ui.lib));
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

boot();
