// Indicators and setup checks for the live watch. Pure functions (no I/O) so they can be
// tested on past candles with plain Node: node live/test/replay.mjs
//
// Candle: { t: start time (ms, UTC), d: 'YYYY-MM-DD' (IST), m: minutes since IST midnight, o, h, l, c, v }
// Only COMPLETED candles are ever passed in (library rule: completed bars only, manual p.4).

export const OPEN_M = 9 * 60 + 15;     // 09:15 IST
export const CLOSE_M = 15 * 60 + 30;   // 15:30 IST
const OR_END_M = OPEN_M + 15;          // opening range = 09:15-09:30 (first three 5 min candles)
const ENTRY_FROM_M = 9 * 60 + 30;      // new trade plans only 09:30-14:45 (manual p.3)
const ENTRY_TO_M = 14 * 60 + 45;
const LAST_ALERT_M = 15 * 60 + 15;   // no candle alerts on the last two candles (15:20-15:30)

// Same setup + direction again only after this many minutes (manual p.7: no repeat on the next candle).
export const COOLDOWN = { 'ema-pullback': 60, supertrend: 30 };

// ---------- indicators ----------
// EMA seeded with the SMA of the first n values (manual p.4).
export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (values.length < n) return out;
  let e = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = e;
  const k = 2 / (n + 1);
  for (let i = n; i < values.length; i++) { e = k * values[i] + (1 - k) * e; out[i] = e; }
  return out;
}

const trueRange = (c, i) => (i === 0 ? c[i].h - c[i].l
  : Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));

// Wilder ATR, seeded with the mean of the first n true ranges.
export function atr(c, n = 14) {
  const out = new Array(c.length).fill(null);
  if (c.length < n) return out;
  let a = 0;
  for (let i = 0; i < n; i++) a += trueRange(c, i);
  a /= n; out[n - 1] = a;
  for (let i = n; i < c.length; i++) { a = (a * (n - 1) + trueRange(c, i)) / n; out[i] = a; }
  return out;
}

// TradingView-style Supertrend: hl2 +/- mult*ATR with carried final bands. dir 1 = green (up), -1 = red.
export function supertrend(c, period = 10, mult = 3) {
  const a = atr(c, period);
  const line = new Array(c.length).fill(null), dir = new Array(c.length).fill(null);
  let up = null, dn = null, d = 1;
  for (let i = 0; i < c.length; i++) {
    if (a[i] === null) continue;
    const hl2 = (c[i].h + c[i].l) / 2;
    let bu = hl2 - mult * a[i], bd = hl2 + mult * a[i];
    if (up !== null && c[i - 1].c > up) bu = Math.max(bu, up);
    if (dn !== null && c[i - 1].c < dn) bd = Math.min(bd, dn);
    if (up !== null) d = d === -1 && c[i].c > dn ? 1 : d === 1 && c[i].c < up ? -1 : d;
    up = bu; dn = bd;
    dir[i] = d; line[i] = d === 1 ? up : dn;
  }
  return { line, dir };
}

// ---------- day levels ----------
export function levels(c, today) {
  const days = [...new Set(c.map((x) => x.d))].sort();
  const prevDay = days.filter((d) => d < today).pop();
  const prev = c.filter((x) => x.d === prevDay);
  const todays = c.filter((x) => x.d === today);
  const orBars = todays.filter((x) => x.m < OR_END_M);
  const orDone = todays.some((x) => x.m >= OR_END_M) || (orBars.length === 3);
  return {
    prevDay,
    pdh: prev.length ? Math.max(...prev.map((x) => x.h)) : null,
    pdl: prev.length ? Math.min(...prev.map((x) => x.l)) : null,
    pdc: prev.length ? prev[prev.length - 1].c : null,
    orh: orDone && orBars.length ? Math.max(...orBars.map((x) => x.h)) : null,
    orl: orDone && orBars.length ? Math.min(...orBars.map((x) => x.l)) : null,
  };
}

// ---------- setups on the last completed candle ----------
// Returns events: { kind, dir: 'up'|'down', title, body, plan? }. Plans only for setups the library
// defines for that direction; the rest are information alerts (the manual: never invent the opposite signal).
// session: true = Indian market hours (opening range, 09:30-14:45 entry window, quiet last candles);
// false = 24 hour market (crypto): no opening range, no entry window. tf names the candle in messages.
export function detect(c, today, { tick = 0.05, session = true, tf = '5 min' } = {}) {
  const i = c.length - 1;
  if (i < 30 || (session && c[i].d !== today)) return { events: [], state: null };
  const quiet = session && c[i].m > LAST_ALERT_M;
  const x = c[i], p = c[i - 1];
  const closes = c.map((k) => k.c);
  const e9 = ema(closes, 9), e20 = ema(closes, 20);
  const a = atr(c, 14);
  const st = supertrend(c, 10, 3);
  const lv = levels(c, today);
  if (!session) lv.orh = lv.orl = null; // no opening range in a 24 hour market
  const b = Math.max(tick, 0.05 * (a[i] || 0)); // buffer b = max(1 tick, 0.05 ATR) (manual p.5)
  const fmt = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: Math.abs(n) < 50 ? 4 : 2 });
  const inEntryWindow = !session || (x.m >= ENTRY_FROM_M && x.m <= ENTRY_TO_M);
  const events = [];
  const plan = (dir, entry, stop) => {
    const r = Math.abs(entry - stop);
    return { dir, entry, stop, target: dir === 'up' ? entry + 2 * r : entry - 2 * r, r, atr: a[i] };
  };

  // 1. Opening range break (manual setup 61 for longs; a break down is information only).
  if (session && lv.orh !== null && x.m >= OR_END_M) {
    if (x.c > lv.orh + b && p.c <= lv.orh + b) {
      const ev = { kind: 'orb', dir: 'up', title: 'Opening range break ↑',
        body: `${tf} close ${fmt(x.c)} above the 09:15-09:30 high ${fmt(lv.orh)}` };
      if (inEntryWindow) {
        const anchor = Math.min(...c.slice(i - 3, i).map((k) => k.l));
        ev.plan = plan('up', x.h + b, anchor - b);
        ev.ref = 'Library: AI Manual setup 61';
      }
      events.push(ev);
    }
    if (x.c < lv.orl - b && p.c >= lv.orl - b) {
      events.push({ kind: 'orb', dir: 'down', title: 'Opening range break ↓',
        body: `${tf} close ${fmt(x.c)} below the 09:15-09:30 low ${fmt(lv.orl)}` });
    }
  }

  // 2. Previous day high / low break (information; setups 35-36 wait for a retest).
  if (lv.pdh !== null && x.c > lv.pdh + b && p.c <= lv.pdh + b) {
    events.push({ kind: 'pdh', dir: 'up', title: "Broke yesterday's high ↑",
      body: `${tf} close ${fmt(x.c)} above yesterday's high ${fmt(lv.pdh)}. Setup 35 waits for a retest that holds` });
  }
  if (lv.pdl !== null && x.c < lv.pdl - b && p.c >= lv.pdl - b) {
    events.push({ kind: 'pdl', dir: 'down', title: "Broke yesterday's low ↓",
      body: `${tf} close ${fmt(x.c)} below yesterday's low ${fmt(lv.pdl)}` });
  }

  // 3. 9/20 EMA pullback (manual setups 1 long, 10 short).
  const crosses = (() => {
    let n = 0;
    for (let j = i - 9; j <= i; j++) if (e9[j - 1] !== null && Math.sign(e9[j] - e20[j]) !== Math.sign(e9[j - 1] - e20[j - 1])) n++;
    return n;
  })();
  const range = x.h - x.l;
  if (inEntryWindow && e20[i - 3] !== null && crosses < 2 && range > 0 && range <= 1.5 * a[i]) {
    // Long: EMA 9 above rising EMA 20, candle dips into the band and closes back above EMA 9 near its high.
    if (e9[i] > e20[i] && e20[i] > e20[i - 3] && x.l <= e9[i] && x.c > e9[i] && x.c > x.o && (x.c - x.l) / range >= 0.75) {
      let j = i; while (j > i - 5 && c[j - 1].l <= e9[j - 1]) j--;
      const pl = plan('up', x.h + b, Math.min(...c.slice(j, i + 1).map((k) => k.l)) - b);
      const blocked = [lv.pdh, lv.orh].filter((v) => v !== null && v > pl.entry && v < pl.entry + 1.5 * pl.r);
      if (!blocked.length) {
        events.push({ kind: 'ema-pullback', dir: 'up', title: '9/20 EMA pullback ↑', plan: pl, ref: 'Library: AI Manual setup 1',
          body: `Pulled back into the EMA 9-20 band (${fmt(e9[i])} / ${fmt(e20[i])}) and closed strong at ${fmt(x.c)}` });
      }
    }
    // Short: EMA 9 below falling EMA 20, rally into the band closes back below EMA 9 near its low.
    if (e9[i] < e20[i] && e20[i] < e20[i - 3] && x.h >= e9[i] && x.c < e9[i] && x.c < x.o && (x.h - x.c) / range >= 0.75) {
      let j = i; while (j > i - 5 && c[j - 1].h >= e9[j - 1]) j--;
      const pl = plan('down', x.l - b, Math.max(...c.slice(j, i + 1).map((k) => k.h)) + b);
      const blocked = [lv.pdl, lv.orl].filter((v) => v !== null && v < pl.entry && v > pl.entry - 1.5 * pl.r);
      if (!blocked.length) {
        events.push({ kind: 'ema-pullback', dir: 'down', title: '9/20 EMA pullback ↓', plan: pl, ref: 'Library: AI Manual setup 10',
          body: `Rallied into the EMA 9-20 band (${fmt(e9[i])} / ${fmt(e20[i])}) and closed weak at ${fmt(x.c)}` });
      }
    }
  }

  // 4. Supertrend (10,3) flip on a 5 min close (Varsity: buy above the line, the line is the trailing stop).
  if (st.dir[i - 1] !== null && st.dir[i] !== st.dir[i - 1]) {
    let flips = 0;
    for (let j = i - 10; j < i; j++) if (st.dir[j - 1] !== null && st.dir[j] !== st.dir[j - 1]) flips++;
    if (flips < 2) { // manual setup 11: skip when it already flipped twice in the last 10 bars (chop)
      const up = st.dir[i] === 1;
      events.push({ kind: 'supertrend', dir: up ? 'up' : 'down', title: `Supertrend turned ${up ? 'green ↑' : 'red ↓'}`,
        body: `${tf} close ${fmt(x.c)}; Supertrend (10,3) line at ${fmt(st.line[i])} is the trailing stop (Varsity ch. 20)` });
    }
  }

  if (quiet) events.length = 0;
  const state = {
    at: x.t, lastClose: x.c, ema9: e9[i], ema20: e20[i], atr: a[i], st: st.line[i], stDir: st.dir[i], ...lv,
  };
  return { events, state };
}

// Price change over the last `minutes`, from minute ticks [{m, ltp}] of today (sorted by m).
export function quickMove(ticks, minutes) {
  if (ticks.length < 2) return null;
  const last = ticks[ticks.length - 1];
  const ref = ticks.filter((t) => t.m <= last.m - minutes).pop();
  if (!ref || last.m - ref.m > minutes + 2) return null;
  return { from: ref.ltp, to: last.ltp, pct: ((last.ltp - ref.ltp) / ref.ltp) * 100, mins: last.m - ref.m };
}
