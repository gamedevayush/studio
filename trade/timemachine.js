// Trade Check engine: the Time Machine, position size and risk check, ported from the Day Trader pack
// (trader-timemachine, trader-budget, trader-risk; MIT, github.com/Jakeschincariol/day-trader-skill) to NSE
// 5 minute sessions (09:15-15:30 IST) and 24 hour crypto. Pure functions, no network: app.js fetches the bars.
// Simulated odds are not predictions. Nothing here places an order.
import { detect, COOLDOWN, OPEN_M } from './signals.js';

const IST_MS = 330 * 60000;
export const istDay = (t) => new Date(t + IST_MS).toISOString().slice(0, 10);
export const istMin = (t) => { const d = new Date(t + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const utcSlot = (t) => Math.floor((t % 86400000) / 300000); // 5 minute slot of the UTC day, 0-287
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const r1 = (x) => Math.round(x * 10) / 10;
const pct = (n, of) => (of ? r1((n / of) * 100) : 0);
export const SESSION_BARS = 75; // 09:15 ... 15:25 five minute bars

// mulberry32: the same seed gives the same draws on any device, so a run can be repeated.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the pool: every past bar as ratios to the bar before, by time of day ----------
// Indices/stocks: only FULL sessions (all 75 bars) before the plan's day. Crypto: full UTC days of 288 bars.
function buildPool(candles, kind, beforeDay) {
  const crypto = kind === 'crypto';
  const nSlots = crypto ? 288 : SESSION_BARS;
  const days = new Map();
  for (let i = 1; i < candles.length; i++) {
    const [t, o, h, l, c] = candles[i], pc = candles[i - 1][4];
    const day = crypto ? new Date(t).toISOString().slice(0, 10) : istDay(t);
    if (!crypto && day >= beforeDay) continue;
    const slot = crypto ? utcSlot(t) : (istMin(t) - OPEN_M) / 5;
    if (!Number.isInteger(slot) || slot < 0 || slot >= nSlots) continue;
    if (!days.has(day)) days.set(day, new Map());
    days.get(day).set(slot, [o / pc, h / pc, l / pc, c / pc]);
  }
  const full = [...days.values()].filter((d) => d.size === nSlots);
  const pool = Array.from({ length: nSlots }, (_, s) => full.map((d) => d.get(s)));
  return { pool, sessions: full.length, nSlots };
}

// ---------- 1. the replays ----------
// plan: { sym, kind ('index'|'stock'|'crypto'), dir ('up'|'down'), entry, stop, target, at (ms) }
// opts: { replays, seed, window (±bars), flatBy ('15:15', indices/stocks), hours (crypto horizon) }
export function timeMachine(candles, plan, { replays = 10000, seed = 19, window = 2, flatBy = '15:30', hours = 24 } = {}) {
  const crypto = plan.kind === 'crypto';
  const day = istDay(plan.at);
  const { pool, sessions, nSlots } = buildPool(candles, plan.kind, crypto ? '9999' : day);
  if (sessions < 20) return { error: `Only ${sessions} full past sessions in the data; the Time Machine needs at least 20.` };
  const risk = Math.abs(plan.entry - plan.stop);
  const rT = Math.abs(plan.target - plan.entry) / risk;
  const long = plan.dir === 'up';

  // Slots to replay: from the bar forming at the entry time to the last bar before flat-by (or 24 hours of crypto).
  let slots, untilLabel;
  if (crypto) {
    const first = utcSlot(plan.at);
    slots = Array.from({ length: Math.round(hours * 12) }, (_, k) => (first + k) % nSlots);
    untilLabel = `${hours} hours later (${hm(istMin(plan.at + hours * 3600000))} IST)`;
  } else {
    const first = Math.max(0, Math.floor((istMin(plan.at) - OPEN_M) / 5));
    const last = Math.min(nSlots - 1, Math.floor((toMin(flatBy) - OPEN_M) / 5) - 1);
    if (first > last) return { error: `The entry time ${hm(istMin(plan.at))} is at or after the flat-by time ${flatBy}.` };
    slots = []; for (let s = first; s <= last; s++) slots.push(s);
    untilLabel = flatBy;
  }
  // Each slot draws from the bars at the same time of day ±window.
  const near = slots.map((s) => {
    const out = [];
    for (let j = -window; j <= window; j++) {
      const k = crypto ? (s + j + nSlots) % nSlots : s + j;
      if (k >= 0 && k < nSlots) out.push(...pool[k]);
    }
    return out;
  });

  const rand = rng(seed);
  let nT = 0, nS = 0, nGreen = 0, sumR = 0;
  const closes = new Float64Array(replays);
  for (let n = 0; n < replays; n++) {
    let p = plan.entry, done = 0;
    for (let k = 0; k < near.length; k++) {
      const b = near[k][Math.floor(rand() * near[k].length)];
      if (!done) {
        const h = p * b[1], l = p * b[2];
        if (long ? l <= plan.stop : h >= plan.stop) done = -1; // a bar that touches both counts as the stop
        else if (long ? h >= plan.target : l <= plan.target) done = 1;
      }
      p *= b[3]; // the path goes on to the end, for the price at the close
    }
    closes[n] = p;
    if (done === 1) { nT++; nGreen++; sumR += rT; } else if (done === -1) { nS++; sumR -= 1; } else { // still open at the end
      const r = (long ? p - plan.entry : plan.entry - p) / risk;
      sumR += r; if (r > 0) nGreen++;
    }
  }
  const sorted = Array.from(closes).sort((a, b) => a - b);
  const q = (f) => sorted[Math.min(replays - 1, Math.floor(f * replays))];
  return {
    replays, seed, bars: slots.length, sessions, untilLabel, rT,
    target: pct(nT, replays), stop: pct(nS, replays), neither: pct(replays - nT - nS, replays), green: pct(nGreen, replays),
    median: q(0.5), p5: q(0.05), p95: q(0.95), avgR: Math.round((sumR / replays) * 1000) / 1000,
  };
}

// The verdict, as trader-timemachine words it: among replays that hit a side, how often the target came first,
// against the break-even rate 1 / (1 + R) for this target.
export function verdict(tm) {
  if (tm.error) return [];
  const hit = tm.target + tm.stop;
  if (!hit) return [`No replay reached the stop or the target by ${tm.untilLabel}.`];
  const share = (tm.target / hit) * 100, need = 100 / (1 + tm.rT), d = share - need;
  const one = Math.abs(tm.rT - 1) < 0.05;
  const side = d > 0 ? 'the target' : 'the stop';
  const label = Math.abs(d) < 5 ? (one ? 'Close to a coin flip' : 'Close to break-even')
    : Math.abs(d) < 15 ? `Leans toward ${side}` : `Strongly toward ${side}`;
  const lines = [`${label}: target first ${tm.target} % vs stop first ${tm.stop} % (at ${r1(tm.rT)}R it needs the target in ${r1(need)} % of the replays that hit a side; it got ${r1(share)} %).`];
  if (tm.neither > 40) lines.push(`${tm.neither} % of the replays hit neither by ${tm.untilLabel}; the price then decides those.`);
  if (Math.abs(d) >= 5 && Math.sign(tm.avgR) !== 0 && Math.sign(tm.avgR) !== Math.sign(d)) {
    lines.push(`Average R ${tm.avgR > 0 ? '+' : ''}${tm.avgR} points the other way, because of the replays that hit neither.`);
  }
  return lines;
}

// ---------- 2. the history: the same rule on every past session ----------
// rule: { type: 'orb15', dir, rT } (15 minute opening range, stop at the range middle, the plan's R)
//    or { type: 'detect', kind, dir } (the live alert's own setup and plan, src/signals.js)
// Indices/stocks use 5 min bars to flat-by; crypto uses 1 hour bars and 24 bars after the signal.
export function historyRun(candles, plan, rule, { flatBy = '15:30', entryTo = '14:45' } = {}) {
  if (!rule) return null;
  const crypto = plan.kind === 'crypto';
  const c = candles.map(([t, o, h, l, cl]) => ({ t, d: istDay(t), m: istMin(t), o, h, l, c: cl }));
  const today = istDay(plan.at);
  const flatM = toMin(flatBy), toM = toMin(entryTo);
  const out = { label: '', sessions: 0, fired: 0, target: 0, stop: 0, neither: 0, notFilled: 0, sumR: 0 };

  // Walks bars after index i; entry is filled at once (orb15) or when price reaches a stop order (detect plans).
  const walk = (i, p, stopOrder) => {
    const long = p.dir === 'up', risk = Math.abs(p.entry - p.stop), rT = Math.abs(p.target - p.entry) / risk;
    let filled = !stopOrder, last = null;
    const end = crypto ? Math.min(c.length - 1, i + 24) : c.length - 1;
    for (let k = i + 1; k <= end; k++) {
      const b = c[k];
      if (!crypto && (b.d !== c[i].d || b.m + 5 > flatM)) break;
      if (!filled) {
        if (long ? b.l <= p.stop : b.h >= p.stop) return { res: 'notFilled' };
        if (long ? b.h >= p.entry : b.l <= p.entry) filled = true; else continue;
      }
      if (long ? b.l <= p.stop : b.h >= p.stop) return { res: 'stop', r: -1 };
      if (long ? b.h >= p.target : b.l <= p.target) return { res: 'target', r: rT };
      last = b.c;
    }
    if (!filled) return { res: 'notFilled' };
    return { res: 'neither', r: last === null ? 0 : (long ? last - p.entry : p.entry - last) / risk };
  };
  const count = ({ res, r }) => {
    if (res === 'notFilled') { out.notFilled++; return; }
    out.fired++; out.sumR += r; out[res]++;
  };

  if (rule.type === 'orb15') {
    out.label = `15 minute opening range break ${rule.dir === 'up' ? 'up' : 'down'}, stop at the range middle, target ${r1(rule.rT)}R, flat by ${flatBy}`;
    const days = [...new Set(c.map((b) => b.d))].filter((d) => d < today);
    for (const d of days) {
      const idx = c.map((b, i) => (b.d === d ? i : -1)).filter((i) => i >= 0);
      if (idx.length !== SESSION_BARS) continue;
      out.sessions++;
      const or = idx.slice(0, 3).map((i) => c[i]);
      const orh = Math.max(...or.map((b) => b.h)), orl = Math.min(...or.map((b) => b.l)), mid = (orh + orl) / 2;
      const i = idx.slice(3).find((k) => (rule.dir === 'up' ? c[k].c > orh : c[k].c < orl));
      if (i === undefined || c[i].m + 5 > toM) continue;
      const entry = c[i].c, risk = Math.abs(entry - mid);
      if (!risk) continue;
      const p = { dir: rule.dir, entry, stop: mid, target: rule.dir === 'up' ? entry + rule.rT * risk : entry - rule.rT * risk };
      count(walk(i, p, false));
    }
  } else {
    const names = { orb: 'Opening range break (AI Manual setup 61 plan)', 'ema-pullback': '9/20 EMA pullback (AI Manual setups 1/10 plan)' };
    out.label = `${names[rule.kind] || rule.kind} ${rule.dir === 'up' ? 'up' : 'down'} on ${crypto ? '1 hour' : '5 min'} candles, as the live alerts fire it`;
    const cool = crypto ? { 'ema-pullback': 360, supertrend: 180 } : COOLDOWN;
    const lastAt = {};
    const days = new Set();
    for (let i = 30; i < c.length; i++) {
      if (!crypto && c[i].d >= today) break;
      if (crypto && c[i].t >= plan.at - 3600000) break;
      days.add(c[i].d);
      const { events } = detect(c.slice(Math.max(0, i - 160), i + 1), c[i].d, crypto ? { tick: 0, session: false, tf: '1 hour' } : {});
      const e = events.find((x) => x.kind === rule.kind && x.dir === rule.dir && x.plan);
      if (!e) continue;
      const k = `${e.kind}:${e.dir}`;
      const once = e.kind === 'orb';
      if (once ? lastAt[k] === c[i].d : lastAt[k] && c[i].t - lastAt[k] < (cool[e.kind] || 0) * 60000) continue;
      lastAt[k] = once ? c[i].d : c[i].t;
      count(walk(i, e.plan, true));
    }
    out.sessions = days.size;
  }
  out.avgR = out.fired ? Math.round((out.sumR / out.fired) * 1000) / 1000 : null;
  return out;
}

// ---------- 3. position size (trader-budget) ----------
// rules: see DEFAULT_RULES. Index futures in lots, stocks in shares, crypto in coins (USD).
export const DEFAULT_RULES = {
  capitalInr: 100000, maxLossInr: 1000, maxDailyLossInr: 3000, maxTradesPerDay: 3, minRR: 1,
  maxPositionPct: 75, entryFrom: '09:30', entryTo: '14:45', flatBy: '15:15',
  lot: { NIFTY: 65, BANKNIFTY: 30, SENSEX: 20 }, maxLots: 2,
  cryptoCapitalUsd: 500, cryptoMaxLossUsd: 10, cryptoMaxDailyLossUsd: 30, cryptoMaxPositionPct: 75,
};

export function sizeTrade(plan, rules) {
  const risk = Math.abs(plan.entry - plan.stop);
  if (!(risk > 0)) return { refused: 'The stop is at the entry.' };
  if (plan.kind === 'index') {
    const lot = Number(rules.lot?.[plan.sym]) || 0;
    if (!lot) return { refused: `No lot size set for ${plan.sym}.` };
    const perLot = risk * lot;
    const limits = [{ name: 'max loss per trade', qty: Math.floor(rules.maxLossInr / perLot), math: `₹${fmt0(rules.maxLossInr)} / (${r2(risk)} pts × ${lot})` },
      { name: 'max lots', qty: Number(rules.maxLots) || 0, math: 'your cap' }];
    return finish(limits, 'lots', perLot, `one lot (${lot} units) risks ₹${fmt0(perLot)}`, '₹', lot * plan.entry);
  }
  if (plan.kind === 'stock') {
    const limits = [{ name: 'max loss per trade', qty: Math.floor(rules.maxLossInr / risk), math: `₹${fmt0(rules.maxLossInr)} / ₹${r2(risk)} a share` },
      { name: 'position cap', qty: Math.floor((rules.capitalInr * rules.maxPositionPct / 100) / plan.entry), math: `${rules.maxPositionPct} % of ₹${fmt0(rules.capitalInr)} / ₹${r2(plan.entry)}` },
      { name: 'capital', qty: Math.floor(rules.capitalInr / plan.entry), math: `₹${fmt0(rules.capitalInr)} / ₹${r2(plan.entry)}` }];
    return finish(limits, 'shares', risk, `one share risks ₹${r2(risk)}`, '₹', plan.entry);
  }
  const floor3 = (x) => Math.floor(x * 1000) / 1000;
  const limits = [{ name: 'max loss per trade', qty: floor3(rules.cryptoMaxLossUsd / risk), math: `$${rules.cryptoMaxLossUsd} / $${r4(risk)} a coin` },
    { name: 'position cap', qty: floor3((rules.cryptoCapitalUsd * rules.cryptoMaxPositionPct / 100) / plan.entry), math: `${rules.cryptoMaxPositionPct} % of $${rules.cryptoCapitalUsd} / $${r4(plan.entry)}` }];
  return finish(limits, 'coins', risk, `one coin risks $${r4(risk)}`, '$', plan.entry);
}
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => (Math.abs(x) < 50 ? Math.round(x * 10000) / 10000 : r2(x));
const fmt0 = (x) => Math.round(x).toLocaleString('en-IN');
function finish(limits, unit, perUnit, perText, cur, unitValue) {
  const min = limits.reduce((a, b) => (b.qty < a.qty ? b : a));
  const qty = Math.max(0, min.qty);
  if (!(qty > 0)) return { refused: `Zero ${unit}: ${perText}, so the ${min.name} limit (${min.math}) allows none.`, limits, unit };
  return { qty, unit, limits, decidedBy: min.name, maxLoss: r2(qty * perUnit), value: r2(qty * unitValue), cur };
}

// ---------- 4. risk check (trader-risk) ----------
// journal: trades he marked as taken today [{ sym, maxLoss, cur }]. Returns { pass, checks: [{ ok, name, text }] }.
export function riskCheck(plan, size, rules, journalToday, { now = Date.now(), marketOpen = true } = {}) {
  const crypto = plan.kind === 'crypto', cur = crypto ? '$' : '₹';
  const long = plan.dir === 'up', risk = Math.abs(plan.entry - plan.stop), rr = Math.abs(plan.target - plan.entry) / risk;
  const maxLoss = crypto ? rules.cryptoMaxLossUsd : rules.maxLossInr;
  const maxDay = crypto ? rules.cryptoMaxDailyLossUsd : rules.maxDailyLossInr;
  const same = journalToday.filter((j) => (j.cur === '$') === crypto);
  const usedRisk = same.reduce((a, j) => a + (j.maxLoss || 0), 0);
  const m = istMin(now), dow = new Date(now + IST_MS).getUTCDay();
  const checks = [
    { name: 'stop', ok: risk > 0 && (long ? plan.stop < plan.entry : plan.stop > plan.entry), text: `stop ${plan.stop} is ${long ? 'below' : 'above'} the entry ${plan.entry}` },
    { name: 'target', ok: long ? plan.target > plan.entry : plan.target < plan.entry, text: `target ${plan.target} is ${long ? 'above' : 'below'} the entry` },
    { name: 'size', ok: !size.refused, text: size.refused || `${size.qty} ${size.unit}, max loss at the stop ${cur}${size.maxLoss}` },
    { name: 'loss', ok: !size.refused && size.maxLoss <= maxLoss, text: size.refused ? 'no size fits' : `max loss ${cur}${size.maxLoss} (limit ${cur}${maxLoss})` },
    { name: 'reward:risk', ok: rr >= rules.minRR - 1e-9, text: `${r2(rr)} (min ${rules.minRR})` },
    { name: 'daily loss', ok: usedRisk + (size.maxLoss || 0) <= maxDay, text: `today ${cur}${r2(usedRisk)} + this ${cur}${size.maxLoss || 0} of ${cur}${maxDay}` },
    { name: 'trades', ok: journalToday.length < rules.maxTradesPerDay, text: `${journalToday.length} of ${rules.maxTradesPerDay} taken today` },
  ];
  if (!crypto) {
    const inWindow = dow > 0 && dow < 6 && marketOpen && m >= toMin(rules.entryFrom) && m <= toMin(rules.entryTo);
    checks.push({ name: 'window', ok: inWindow, text: `entries ${rules.entryFrom}-${rules.entryTo} IST on trading days; now ${hm(m)}${marketOpen ? '' : ', market closed'}` });
  }
  return { pass: checks.every((c) => c.ok), checks };
}
