// Lets Trade front end. Everything arrives encrypted (data.enc, t/<id>.enc) and is opened
// in the browser with a key derived from his password. No framework, no build step.

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
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- navigation ----------
const MAIN = [
  { id: 'home', href: '#/', label: 'Overview', short: 'Home', icon: 'home' },
  { id: 'library', href: '#/library', label: 'Strategy Library', short: 'Library', icon: 'library' },
  { id: 'videos', href: '#/videos', label: 'YouTube Research', short: 'Videos', icon: 'videos' },
  { id: 'mine', href: '#/mine', label: 'My Strategies', short: 'Mine', icon: 'mine' },
];

// What he has decided so far for the sections that come in later stages.
const LATER = [
  { id: 'market', label: 'Market Overview', stage: 4, icon: 'globe', lines: [
    'Indian market: Nifty, Bank Nifty and intraday stocks',
    'Global market impact on the Indian market',
    'Crypto: Delta Exchange (BTC, ETH)',
    'Data source to be decided (Upstox free API is the cheapest option)'] },
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
    'Starting now: notification for every new YouTube strategy',
    'Later: live setup alerts'] },
  { id: 'journal', label: 'Trade Journal', stage: 5, icon: 'journal', lines: [
    'Every alert signal alongside your actual executed trade',
    'Includes trade outcomes to verify which strategies actually work'] },
];

const STAGES = [
  'Website + YouTube research + strategy library',
  'Your custom rules converted into testable conditions',
  'Historical data + backtesting',
  'Live data, signals, and Telegram alerts',
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
  transcribed: 'Waiting for Claude',
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
  return new TextDecoder().decode(plain);
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
let CH = {}, ALL = [], VID = {};

function prepare() {
  CH = Object.fromEntries(DATA.channels.map((c) => [c.id, c]));
  VID = Object.fromEntries(DATA.videos.map((v) => [v.id, v]));
  ALL = [...DATA.mine, ...DATA.strategies];
  if (!DATA.videos.some((v) => v.st === 'extracted')) ui.vid.st = 'queued';
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
const srcLabel = (s) => s.source === 'mine'
  ? '<span class="card-src"><span class="dot"></span>My Strategy</span>'
  : `<span class="card-src">${esc(CH[s.channel]?.name || s.channel)}</span>`;

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
  const laterOn = LATER.some((l) => l.id === current);
  $('#dock').innerHTML = MAIN.map((i) =>
    `<a href="${i.href}" class="${i.id === current ? 'on' : ''}">${icon(i.icon)}<span>${i.short}</span></a>`).join('') +
    `<button data-action="sheet" class="${laterOn ? 'on' : ''}">${icon('more')}<span>More</span></button>`;
}

function openSheet() {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-label="More sections">
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
  const queue = v.filter((x) => x.st === 'queued' || x.st === 'failed');
  const queueSec = queue.reduce((a, x) => a + (x.d || 1800), 0);
  const used = DATA.usage?.day === pacificDay() ? DATA.usage.seconds || 0 : 0;
  const latest = [...ALL].sort((a, b) => (b.extractedAt || b.updatedAt || '').localeCompare(a.extractedAt || a.updatedAt || '')).slice(0, 6);
  const tracked = v.filter((x) => x.st !== 'skipped').length;

  return `
  <div class="page-head"><div><div class="kicker">Overview</div><h1>Trading desk</h1>
    <p>Expert strategies, your custom rules, and upcoming live signals. All in one place.</p></div></div>

  <div class="stats">
    <div class="stat"><div class="stat-label">Strategies</div><div class="stat-value">${ALL.length}</div>
      <div class="stat-sub">${DATA.strategies.length} expert · ${DATA.mine.length} mine</div></div>
    <div class="stat"><div class="stat-label">Videos processed</div><div class="stat-value">${by('extracted').length + by('no-strategy').length}</div>
      <div class="stat-sub">${by('no-strategy').length} contained no strategy</div></div>
    <div class="stat"><div class="stat-label">Queue</div><div class="stat-value">${queue.length}</div>
      <div class="stat-sub">${queue.length ? `~${Math.ceil(queueSec / DATA.budget)} days remaining` : 'empty'}</div></div>
    <div class="stat"><div class="stat-label">Waiting for Claude</div><div class="stat-value">${by('transcribed').length}</div>
      <div class="stat-sub">checked every 3 hours</div></div>
  </div>

  <div class="grid-2">
    <div class="panel">
      <div class="panel-head"><h2>New strategies</h2><a href="#/library">View all</a></div>
      ${latest.length ? `<div class="list-rows">${latest.map((s) => `
        <a class="row" href="#/s/${esc(s.sid)}" style="grid-template-columns:1fr auto">
          <div><div class="row-title">${esc(s.name)}</div>
          <div class="row-sub">${s.source === 'mine' ? 'My Strategy' : esc(CH[s.channel]?.name)} · ${esc(ago(s.extractedAt || s.updatedAt))}</div></div>
          ${meter(s.completeness)}</a>`).join('')}</div>`
      : `<div class="empty"><strong>No strategies yet</strong>Once transcripts are analyzed, Claude will populate strategies here and trigger a Telegram notification.</div>`}
    </div>

    <div class="stack">
      <div class="panel">
        <div class="panel-head"><h2>Pipeline</h2><a href="#/videos">Videos</a></div>
        <div class="facts">
          <div class="fact"><span>Channels</span><span>${DATA.channels.map((c) => esc(c.name)).join(', ')}</span></div>
          <div class="fact"><span>Strategy videos</span><span class="mono">${tracked} / ${v.length}</span></div>
          <div class="fact"><span>New video check</span><span>Every 3 hours</span></div>
          <div class="fact" style="display:block"><div style="display:flex;justify-content:space-between">
            <span class="muted">Gemini today (free)</span><span class="mono">${hours(used)} / ${hours(DATA.budget)}</span></div>
            <div class="bar"><i style="width:${Math.min(100, used / DATA.budget * 100).toFixed(1)}%"></i></div></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Roadmap</h2></div>
        <div class="roadmap">${STAGES.map((t, i) => `
          <div class="step${i === 0 ? ' now' : ''}"><span class="step-n">${i + 1}</span><span>${esc(t)}</span>
          ${i === 0 ? '<span class="tag tag-accent">Current</span>' : ''}</div>`).join('')}</div>
      </div>
    </div>
  </div>`;
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
    <p>Every rule specifies whether it was <b>explicitly stated</b> by the expert or <b>inferred</b> by AI. Elements missing from the video are clearly tagged.</p></div></div>
  <div class="toolbar">
    <label class="search">${icon('search')}<input class="input" id="lib-q" type="search" placeholder="Search: rectangle, supertrend, bank nifty…" value="${esc(f.q)}"></label>
    <details class="filters" ${filtersOpen() ? 'open' : ''}><summary>Filters${activeFilters()}</summary><div class="toolbar">
    ${chipRow('Source', 'src', [['all', 'All', ALL.length], ['expert', 'Experts', DATA.strategies.length], ['mine', 'Mine', DATA.mine.length]], f)}
    ${chipRow('Channel', 'ch', [['all', 'All'], ...DATA.channels.map((c) => [c.id, c.name])], f)}
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
  const n = ['src', 'ch', 'style', 'tf', 'comp'].filter((k) => f[k] !== 'all').length + (f.test ? 1 : 0);
  return n ? ` <span class="tag tag-accent">${n}</span>` : '';
}

function libResults() {
  const f = ui.lib;
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = ALL.filter((s) => {
    if (f.src !== 'all' && s.source !== f.src) return false;
    if (f.ch !== 'all' && s.channel !== f.ch) return false;
    if (f.style !== 'all' && !(s.styles || []).includes(f.style)) return false;
    if (f.tf !== 'all' && !(s.timeframes || []).includes(f.tf)) return false;
    if (f.comp !== 'all' && s.completeness !== f.comp) return false;
    if (f.test && !s.testable) return false;
    if (!words.length) return true;
    const hay = [s.name, s.summary, s.videoTitle, CH[s.channel]?.name, ...(s.indicators || []), ...(s.patterns || []),
      ...(s.instruments || []), ...(s.timeframes || []), ...rulesOf(s).map((r) => r.text)].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => f.sort === 'views'
    ? (b.views || 0) - (a.views || 0)
    : (b.extractedAt || b.updatedAt || '').localeCompare(a.extractedAt || a.updatedAt || ''));

  $('#lib-results').innerHTML = `<div class="result-line">${list.length} ${list.length === 1 ? 'strategy' : 'strategies'}</div>` +
    (list.length ? `<div class="cards">${list.map(card).join('')}</div>`
      : `<div class="panel empty"><strong>No results found</strong>${ALL.length ? 'Try clearing some filters.' : 'The library is currently empty. Strategies will appear following Claude’s next run.'}</div>`);
}

function card(s) {
  const c = counts(s);
  const tags = [...(s.styles || []).map((x) => STYLE_NAMES[x] || x), ...(s.timeframes || []), ...(s.indicators || []).slice(0, 3)];
  return `<a class="card" href="#/s/${esc(s.sid)}">
    <div class="card-top">${srcLabel(s)}<span>${s.kind === 'concept' ? 'Concept' : 'Strategy'}</span></div>
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.summary)}</p>
    ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${s.testable ? '<span class="tag tag-accent">Backtest-ready</span>' : ''}</div>` : ''}
    <div class="card-foot">${meter(s.completeness)}<span>${c.stated} stated · ${c.inferred} inferred · ${c.missing} missing</span></div>
  </a>`;
}

function pageStrategy(sid) {
  const s = ALL.find((x) => x.sid === sid);
  if (!s) return `<a class="back" href="#/library">${icon('back')}Library</a><div class="panel empty"><strong>Strategy not found</strong>It may have been modified or removed. Please reopen from the library.</div>`;
  const mine = s.source === 'mine';
  const dir = { long: '<span class="tag tag-up">Long / Buy</span>', short: '<span class="tag tag-down">Short / Sell</span>',
    both: '<span class="tag tag-up">Buy</span> <span class="tag tag-down">Sell</span>' }[s.direction] || '<span class="faint">Unspecified</span>';
  const list = (a) => (a && a.length ? esc(a.join(', ')) : '<span class="faint">Unspecified</span>');

  const rule = (r) => r.basis === 'stated'
    ? `<li class="rule"><div class="rule-text">${esc(r.text)}</div><div class="rule-meta">
        ${Number.isFinite(r.t) && !mine ? `<a class="ts" href="${yt(s.videoId, r.t)}" target="_blank" rel="noopener">▶ ${clock(r.t)}</a>` : ''}
        <span>${mine ? 'Defined by you' : 'Stated in video'}</span></div></li>`
    : `<li class="rule inferred"><div class="rule-text">${esc(r.text)}</div>
        <div class="rule-meta"><span>Inferred by AI</span></div>${r.why ? `<div class="rule-why">${esc(r.why)}</div>` : ''}</li>`;

  return `
  <a class="back" href="#/library">${icon('back')}Library</a>
  <div class="detail-head">
    <div class="kicker">${mine ? 'My Strategy' : `Expert · ${esc(CH[s.channel]?.name)}`}${s.kind === 'concept' ? ' · Concept' : ''}</div>
    <h1>${esc(s.name)}</h1>
    <div class="src">${mine
      ? `<span>${s.status === 'final' ? 'Final' : 'Draft'}</span><span>Updated ${esc(date(s.updatedAt))}</span>`
      : `<a href="${yt(s.videoId)}" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center">${esc(s.videoTitle)} ${icon('ext')}</a>
         ${s.published ? `<span>${esc(date(s.published))}</span>` : ''}${s.views ? `<span>${views(s.views)} views</span>` : ''}`}</div>
    <p class="summary">${esc(s.summary)}</p>
    <div class="legend"><span><i class="sw sw-stated"></i>${mine ? 'Defined by you' : 'Stated in video'}</span>
      <span><i class="sw sw-inferred"></i>Inferred by AI</span><span><i class="sw sw-missing"></i>Unspecified</span></div>
  </div>

  <div class="grid-2">
    <div class="stack">
      <div class="panel rules">${SECTIONS.map(([k, label, sub]) => {
        const items = s.rules?.[k] || [];
        return `<div class="rule-sec"><h2>${label}${sub ? `<div class="faint" style="font-size:11.5px;margin-top:2px">${sub}</div>` : ''}</h2>
          ${items.length ? `<ul class="rule-list">${items.map(rule).join('')}</ul>` : '<div class="rule-none">Unspecified</div>'}</div>`;
      }).join('')}</div>
      ${(s.missing || []).length ? `<div class="panel"><div class="panel-head"><h2>${mine ? 'Pending decision' : 'Not stated in video'}</h2></div>
        <div class="panel-body"><ul class="missing-list">${s.missing.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div></div>` : ''}
      ${(s.cautions || []).length ? `<div class="panel"><div class="panel-head"><h2>${mine ? 'Points to note' : 'Expert warnings'}</h2></div>
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
      ${mine ? '' : `<div class="panel"><a href="#/v/${esc(s.videoId)}" style="display:block;padding:12px">
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
  if (f.st === 'queued') {
    // Same order transcribe.mjs works in: new uploads, then old strategy, then old concept, most viewed first.
    const rank = (v) => (v.o === 'new' ? 0 : v.l === 'strategy' ? 1 : 2);
    list.sort((a, b) => rank(a) - rank(b) || (a.o === 'new'
      ? (b.p || '').localeCompare(a.p || '') : (b.vw || 0) - (a.vw || 0)));
  } else {
    list.sort((a, b) => (b.p || '').localeCompare(a.p || '') || (b.vw || 0) - (a.vw || 0));
  }
  return list;
}

function pageVideos() {
  const f = ui.vid;
  const inCh = DATA.videos.filter((v) => f.ch === 'all' || v.c === f.ch);
  const n = (st) => inCh.filter((v) => v.st === st || (st === 'queued' && v.st === 'failed')).length;
  return `
  <div class="page-head"><div><div class="kicker">YouTube Research</div><h1>Videos</h1>
    <p>Standard videos across all three channels (excluding Shorts and livestreams). Processing queue order: new uploads, then past strategy videos, then concept videos, sorted by highest views.</p></div></div>
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
    : `<div class="panel empty"><strong>Transcript not generated yet</strong>${v.st === 'queued' ? 'Queued. Free Gemini processes ~7 hours of video daily.' : ''}</div>`}`;
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

// ---------- router ----------
let lastPage = '';
function render() {
  const [page = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const current = { '': 'home', s: 'library', v: 'videos', later: arg }[page] ?? page;
  renderShell(current);
  $('#sheet').hidden = true;

  const view = $('#view');
  const pages = { '': pageHome, library: pageLibrary, s: () => pageStrategy(arg), videos: pageVideos,
    v: () => pageVideo(arg), mine: pageMine, later: () => pageLater(arg) };
  view.innerHTML = (pages[page] || pageHome)();
  if (page === 'library') libResults();
  if (page === 'videos') vidResults();
  if (page === 'v') loadTranscript(arg);
  if (page === 'mine') $('#note-form').addEventListener('submit', saveNote);

  const key = `${page}/${arg}`;
  if (key !== lastPage) window.scrollTo(0, 0);
  lastPage = key;
  const title = { library: 'Strategies', videos: 'Videos', mine: 'My Strategies' }[page];
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
