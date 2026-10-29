'use strict';
// PPT Creator and PDF Creator (tools/ppt-creator/, tools/pdf-creator/): one page for both.
// Claude does the designing on the user's own PC, through the Studio helper
// (%USERPROFILE%\tools\studio-helper, the "studio" command), which this page reaches at
// 127.0.0.1:4455. The design is a fixed-size HTML file the helper keeps; it is shown in a
// frame of this page (srcdoc, so it can be edited here) and saved back to the helper.
const $ = (s, r = document) => r.querySelector(s);
const KIND = /pdf-creator/.test(location.pathname) ? 'pdf' : 'ppt';
const API = new URLSearchParams(location.search).get('helper') || 'http://127.0.0.1:4455';
const WORD = KIND === 'ppt' ? 'slide' : 'page';
const WORDC = KIND === 'ppt' ? 'Slide' : 'Page';
const THING = KIND === 'ppt' ? 'presentation' : 'document';
const SEL = 'body > section.slide, body > section.page';
const CLIENT = Math.random().toString(36).slice(2, 10);
const EFFORTS = [
  ['low', 'Low', 'Fastest and cheapest; no visual review.'],
  ['medium', 'Medium', 'Quick; checks the layout but does not look at previews.'],
  ['high', 'High', 'Looks at previews of every page and polishes once.'],
  ['xhigh', 'Extra high', 'Deeper thinking, up to two polishing rounds.'],
  ['max', 'Max', 'The most thought; slowest and uses the most tokens.'],
];
const THEMES = [
  ['auto', 'Auto', []],
  ['midnight', 'Midnight neon', ['#0b1020', '#22e7ff', '#ff3ecf', '#f5f7ff']],
  ['ocean', 'Ocean', ['#0c4a6e', '#0ea5e9', '#67e8f9', '#f0f9ff']],
  ['sunset', 'Sunset', ['#7c2d12', '#f97316', '#facc15', '#fff7ed']],
  ['forest', 'Forest', ['#14532d', '#22c55e', '#a3e635', '#f7fee7']],
  ['royal', 'Royal', ['#1e1b4b', '#7c3aed', '#f59e0b', '#faf5ff']],
  ['corporate', 'Corporate blue', ['#0f172a', '#2563eb', '#94a3b8', '#ffffff']],
  ['candy', 'Kids candy', ['#ff4d8d', '#ffd23f', '#3bceac', '#5a4fcf']],
  ['earth', 'Earthy', ['#3f2d20', '#b45309', '#d6b88c', '#fbf6ee']],
  ['mono', 'Monochrome', ['#111111', '#555555', '#bbbbbb', '#ffffff']],
  ['custom', 'Custom', null],
];
const STYLES = ['Auto', 'Modern minimal', 'Corporate & clean', 'Bold & vibrant', 'Elegant & premium', 'Playful for kids', 'Academic', 'Tech / futuristic', 'Editorial magazine', 'Hand-drawn & friendly'];
const SIZES = KIND === 'ppt' ? [['16:9', '16:9 wide'], ['4:3', '4:3']] : [['a4', 'A4'], ['letter', 'US Letter']];
const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'DM Sans', 'Space Grotesk', 'Outfit', 'Plus Jakarta Sans', 'Manrope', 'Playfair Display', 'Merriweather', 'Lora', 'DM Serif Display', 'Fraunces', 'Bebas Neue', 'Oswald', 'Anton', 'Fredoka', 'Baloo 2', 'Caveat', 'Noto Sans Devanagari', 'Segoe UI', 'Arial', 'Georgia', 'Times New Roman', 'Consolas'];
const SYSTEM_FONTS = new Set(['Segoe UI', 'Arial', 'Georgia', 'Times New Roman', 'Consolas', 'Verdana', 'Calibri']);

// ---------------------------------------------------------------- small helpers

const NO_HELPER = 'Cannot reach the Studio helper on this PC. Is its window still open? (Type "studio" to start it.)';
/** fetch() to the helper; a helper that is not running becomes a plain message. */
const call = (url, opts) =>
  fetch(API + url, opts).catch(() => {
    throw new Error(NO_HELPER);
  });
const api = async (url, body) => {
  const res = await call(url, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
};
let toastTimer = null;
const toast = (text, bad = false) => {
  const t = $('#toast');
  t.textContent = text;
  t.className = bad ? 'bad' : '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), bad ? 6000 : 2800);
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const when = (t) => new Date(t).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
const compact = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const colorCanvas = document.createElement('canvas').getContext('2d', {willReadFrequently: true});
/** Any CSS color as #rrggbb (for color inputs); transparent ones as null. */
const hex = (css) => {
  if (!css) return null;
  colorCanvas.clearRect(0, 0, 1, 1);
  colorCanvas.fillStyle = '#000';
  colorCanvas.fillStyle = css;
  colorCanvas.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorCanvas.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
};
const segment = (el, items, value, onPick) => {
  el.innerHTML = '';
  for (const [v, label] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.v = v;
    b.className = v === value ? 'on' : '';
    b.onclick = () => {
      el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(v);
    };
    el.append(b);
  }
};
const uploadFile = async (file) => {
  const res = await call(`/api/upload?name=${encodeURIComponent(file.name)}`, {method: 'POST', body: file});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.token;
};
/** A row of file chips that uploads as files are added; .tokens() lists the finished uploads. */
const fileChips = (box) => {
  const items = [];
  const draw = () => {
    box.innerHTML = '';
    for (const it of items) {
      const c = document.createElement('span');
      c.className = 'chip-file' + (it.token ? '' : ' up');
      c.innerHTML = `<span title="${esc(it.name)}">${esc(it.name)}${it.token ? '' : ' …'}</span><button type="button" title="Remove">×</button>`;
      c.querySelector('button').onclick = () => {
        items.splice(items.indexOf(it), 1);
        draw();
      };
      box.append(c);
    }
  };
  return {
    add: (files) => {
      for (const file of files) {
        const it = {name: file.name, token: null};
        items.push(it);
        uploadFile(file)
          .then((t) => (it.token = t))
          .catch((err) => {
            items.splice(items.indexOf(it), 1);
            toast(`${file.name}: ${err.message}`, true);
          })
          .finally(draw);
      }
      draw();
    },
    pending: () => items.some((it) => !it.token),
    tokens: () => items.filter((it) => it.token).map((it) => it.token),
    clear: () => {
      items.length = 0;
      draw();
    },
  };
};

// ---------------------------------------------------------------- page setup

document.title = `${KIND === 'ppt' ? 'PPT' : 'PDF'} Creator · Ayush AI`;
$('#cname').textContent = KIND === 'ppt' ? 'PPT Creator' : 'PDF Creator';
$(KIND === 'ppt' ? '#navppt' : '#navpdf').classList.add('on');
$('#newhead').textContent = `New ${THING}`;
$('#newtitle').innerHTML = `What should the <span>${THING}</span> be about?`;
$('#newsub').textContent = `Claude designs it from scratch. Afterwards every ${WORD} is editable right here.`;
if (KIND === 'pdf') $('#prompt').placeholder = 'A topic, an outline, notes or the full content. e.g. "4-page parent handout on our new science lab: what it has, timings, safety rules"';
$('#recenthead').textContent = KIND === 'ppt' ? 'Your presentations' : 'Your documents';
$('#countlabel').textContent = KIND === 'ppt' ? 'Slides' : 'Pages';
$('#pagesword').textContent = KIND === 'ppt' ? 'Slides' : 'Pages';
$('#addpage').textContent = `+ ${WORDC}`;
$('#slidelbl').textContent = `This ${WORD}`;
$('#notesbox').hidden = KIND !== 'ppt';
$('#newbtn').textContent = `+ New ${THING}`;

// The new-document form's choices.
const pick = {effort: 'high', theme: 'auto', style: 'Auto', size: SIZES[0][0], orient: 'portrait'};
segment($('#effort'), EFFORTS, pick.effort, (v) => {
  pick.effort = v;
  $('#efforthint').textContent = EFFORTS.find((e) => e[0] === v)[2];
});
$('#efforthint').textContent = EFFORTS.find((e) => e[0] === pick.effort)[2];
segment($('#size'), SIZES, pick.size, (v) => (pick.size = v));
if (KIND === 'pdf') segment($('#orient'), [['portrait', 'Portrait'], ['landscape', 'Landscape']], 'portrait', (v) => (pick.orient = v));
else $('#orient').hidden = true;
for (const [id, name, colors] of THEMES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (id === pick.theme ? ' on' : '');
  b.innerHTML = `<span class="dots">${(colors ?? ['#1e1b4b', '#8b5cff', '#22e7ff', '#ffffff']).map((c) => `<i style="background:${c}"></i>`).join('') || '<i style="background:conic-gradient(#22e7ff,#ff3ecf,#ffc94d,#3dffb0,#22e7ff)"></i>'}</span>${esc(name)}`;
  b.onclick = () => {
    pick.theme = id;
    document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
    $('#customrow').hidden = id !== 'custom';
  };
  $('#themes').append(b);
}
for (const s of STYLES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'stylechip' + (s === pick.style ? ' on' : '');
  b.textContent = s;
  b.onclick = () => {
    pick.style = s;
    document.querySelectorAll('.stylechip').forEach((x) => x.classList.toggle('on', x === b));
  };
  $('#styles').append(b);
}
const refs = fileChips($('#refchips'));
$('#refbtn').onclick = () => $('#reffiles').click();
$('#reffiles').onchange = (e) => {
  refs.add([...e.target.files]);
  e.target.value = '';
};
const drop = $('#drop');
for (const ev of ['dragenter', 'dragover']) $('#newview').addEventListener(ev, (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
for (const ev of ['dragleave', 'drop']) $('#newview').addEventListener(ev, (e) => {
  e.preventDefault();
  if (ev === 'drop' || !$('#newview').contains(e.relatedTarget)) drop.classList.remove('over');
});
$('#newview').addEventListener('drop', (e) => refs.add([...e.dataTransfer.files]));

const themeText = () => {
  if (pick.theme === 'auto') return '';
  if (pick.theme === 'custom') return `Custom colors: main ${$('#c1').value}, accent ${$('#c2').value}, highlight ${$('#c3').value}, light ${$('#c4').value}`;
  const [, name, colors] = THEMES.find((t) => t[0] === pick.theme);
  return `${name}: ${colors.join(', ')}`;
};
const styleText = () => [pick.style === 'Auto' ? '' : pick.style, $('#styletext').value.trim()].filter(Boolean).join('. ');

const createDoc = async () => {
  const prompt = $('#prompt').value.trim();
  if (refs.pending()) return toast('Wait for the files to finish uploading.');
  if (prompt.length < 3 && !refs.tokens().length) return toast('Write what it should be about, or add a reference file.', true);
  $('#create').disabled = true;
  try {
    const {id} = await api('/api/docs', {
      kind: KIND,
      prompt,
      effort: pick.effort,
      uploads: refs.tokens(),
      theme: themeText(),
      style: styleText(),
      size: pick.size,
      orientation: pick.orient,
      count: $('#count').value,
      title: $('#title').value,
    });
    $('#prompt').value = '';
    $('#title').value = '';
    refs.clear();
    await openDoc(id);
  } catch (err) {
    toast(err.message, true);
  } finally {
    $('#create').disabled = false;
  }
};
$('#create').onclick = createDoc;
$('#prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    createDoc();
  }
});

// ---------------------------------------------------------------- the list of documents

let docs = [];
const loadList = async () => {
  try {
    docs = (await api(`/api/docs?kind=${KIND}`)).docs;
  } catch (err) {
    return toast(err.message, true);
  }
  const sel = $('#docsel');
  sel.innerHTML = `<option value="">${KIND === 'ppt' ? 'Your presentations' : 'Your documents'} (${docs.length})</option>` + docs.map((d) => `<option value="${esc(d.id)}">${esc(d.title)}</option>`).join('');
  sel.value = current ?? '';
  const box = $('#recent');
  box.innerHTML = docs.length ? '' : `<p class="hint" style="padding:8px">Nothing yet. Your ${THING}s appear here.</p>`;
  for (const d of docs) {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `<div class="grow"><div class="t">${esc(d.title)}</div><div class="m">${d.status === 'working' ? '<span class="live">Claude is working · </span>' : ''}${d.count} ${WORD}${d.count === 1 ? '' : 's'} · ${when(d.updated)}</div></div><button class="x" title="Delete">✕</button>`;
    c.onclick = (e) => {
      if (e.target.closest('.x')) return;
      openDoc(d.id);
    };
    c.querySelector('.x').onclick = async () => {
      if (!confirm(`Delete "${d.title}"? (It goes to the _docs\\.trash folder on the editor PC.)`)) return;
      try {
        await api(`/api/docs/${d.id}/delete`, {});
        loadList();
      } catch (err) {
        toast(err.message, true);
      }
    };
    box.append(c);
  }
};
$('#docsel').onchange = (e) => (e.target.value ? openDoc(e.target.value) : null);
$('#newbtn').onclick = () => showNew();

const showNew = async () => {
  if (dirty) await save();
  closeDoc();
  $('#editview').hidden = true;
  $('#newview').hidden = false;
  history.replaceState(null, '', location.pathname);
  loadList();
  $('#prompt').focus();
};

// ---------------------------------------------------------------- an open document

let current = null;
let meta = null;
let es = null;
let live = {status: 'idle'};
let lastActivity = '';
let busyAI = false;
let loadedMtime = 0;

const closeDoc = () => {
  es?.close();
  es = null;
  current = null;
  meta = null;
  fdoc = null;
  busyAI = false;
  setPill();
};

const openDoc = async (id) => {
  if (dirty) await save();
  closeDoc();
  current = id;
  history.replaceState(null, '', `${location.pathname}#${id}`);
  $('#newview').hidden = true;
  $('#editview').hidden = false;
  $('#feed').innerHTML = '';
  $('#thumbs').innerHTML = '';
  $('#canvas').style.height = '0px';
  $('#frame').removeAttribute('srcdoc');
  frameLoad++;
  loadedMtime = 0;
  currentIndex = 0;
  resetHistory();
  drawScope();
  es = new EventSource(`${API}/api/docs/${id}/events`);
  es.addEventListener('hello', (e) => {
    const d = JSON.parse(e.data);
    meta = d.doc;
    showMeta();
    $('#feed').innerHTML = '';
    lastActivity = '';
    for (const ev of d.log) addFeed(ev);
    setLive(d.state);
    if (d.mtime && d.mtime !== loadedMtime) loadFrame(d.mtime);
    else if (!d.mtime) showPlaceholder();
  });
  es.addEventListener('log', (e) => addFeed(JSON.parse(e.data)));
  es.addEventListener('state', (e) => setLive(JSON.parse(e.data)));
  es.addEventListener('meta', (e) => {
    meta = JSON.parse(e.data);
    showMeta();
    loadList();
  });
  es.addEventListener('doc', (e) => {
    const d = JSON.parse(e.data);
    if (d.by === CLIENT || d.mtime === loadedMtime) return;
    // Someone else's hand edit waits until this page's own unsaved edits are saved.
    if (d.by !== 'ai' && d.by !== 'restore' && (dirty || editing)) return;
    loadFrame(d.mtime);
  });
  loadList();
};

const showMeta = () => {
  if (!meta) return;
  if (document.activeElement !== $('#doctitle')) $('#doctitle').value = meta.title ?? '';
  $('#docsel').value = current ?? '';
};
$('#doctitle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') e.target.blur();
  if (e.key === 'Escape') {
    e.target.value = meta?.title ?? '';
    e.target.blur();
  }
});
$('#doctitle').addEventListener('change', async (e) => {
  try {
    meta = await api(`/api/docs/${current}/rename`, {title: e.target.value});
    loadList();
  } catch (err) {
    toast(err.message, true);
    e.target.value = meta?.title ?? '';
  }
});

const showPlaceholder = () => {
  $('#placeholder').hidden = false;
  $('#canvas').style.height = '0px';
  $('#phbig').textContent = busyAI ? `Designing your ${THING}…` : 'Nothing here yet';
  $('#phsmall').textContent = busyAI ? `The ${WORD}s appear here as soon as Claude writes them. Watch the progress on the right.` : 'Ask Claude on the right to make it.';
};

// ---------------------------------------------------------------- feed and live status

const addFeed = (ev) => {
  if (ev.kind === 'activity') {
    lastActivity = ev.text;
    $('#doing').textContent = ev.text;
    return;
  }
  const div = document.createElement('div');
  const cls = {user: 'user', claude: 'claude', error: 'note error', ready: 'note ready'}[ev.kind] ?? 'note';
  div.className = `msg ${cls}`;
  div.textContent = ev.text.replace(/\*\*(.+?)\*\*/g, '$1');
  const feed = $('#feed');
  const atEnd = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
  feed.append(div);
  if (atEnd) feed.scrollTop = feed.scrollHeight;
};

const setPill = () => {
  const p = $('#pill');
  p.classList.toggle('working', busyAI);
  $('#pilltext').textContent = busyAI ? (live.label ?? 'Working') : 'Ready';
};

const setLive = (s) => {
  const was = busyAI;
  live = s;
  busyAI = s.status === 'working';
  $('#live').hidden = !busyAI;
  $('#aistop').hidden = !busyAI;
  $('#aisend').disabled = busyAI;
  $('#busybar').hidden = !busyAI;
  setPill();
  if (busyAI) {
    if (editing) stopEditing();
    select(null);
  }
  if (!$('#placeholder').hidden) showPlaceholder();
  if (was && !busyAI) loadList();
  drawLive();
};
const THINKING = ['Thinking...', 'Ayushing...'];
const drawLive = () => {
  if (!busyAI) return;
  const t = Date.now();
  $('#verb').textContent = live.mode === 'writing' ? 'Writing...' : live.mode === 'tool' ? 'Ayushing...' : THINKING[Math.floor(t / 2600) % 2];
  $('#tin').textContent = compact(live.tokens?.in ?? 0);
  $('#tout').textContent = compact(live.tokens?.out ?? 0);
  const s = Math.max(0, Math.floor((t - (live.startedAt ?? t)) / 1000));
  $('#clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#busytext').textContent = `${live.label ?? 'Claude is working'}… ${lastActivity ? `(${lastActivity}) ` : ''}Editing is back when it is done.`;
};
setInterval(drawLive, 500);

// ---------------------------------------------------------------- Ask Claude

const aiRefs = fileChips($('#aichips'));
$('#aieffort').innerHTML = EFFORTS.map(([v, l]) => `<option value="${v}"${v === 'medium' ? ' selected' : ''}>Effort: ${l}</option>`).join('');
const drawScope = () => {
  const s = $('#aiscope');
  const keep = s.value || 'here';
  const n = currentIndex + 1;
  s.innerHTML = `<option value="here">${WORDC} ${n}${selected && !isSlide(selected) ? ' (selected part)' : ''}</option><option value="all">Whole ${KIND === 'ppt' ? 'deck' : 'document'}</option>`;
  s.value = keep;
};
$('#aiattach').onclick = () => $('#aifiles').click();
$('#aifiles').onchange = (e) => {
  aiRefs.add([...e.target.files]);
  e.target.value = '';
};
const sendAI = async () => {
  const text = $('#aitext').value.trim();
  if (!current || busyAI || text.length < 2) return;
  if (aiRefs.pending()) return toast('Wait for the files to finish uploading.');
  if (editing) stopEditing();
  await save();
  const list = slides();
  const slide = list[currentIndex];
  const scope = $('#aiscope').value;
  let selection = '';
  if (scope === 'here' && selected && !isSlide(selected)) {
    const c = selected.cloneNode(true);
    clean(c);
    selection = c.outerHTML.slice(0, 2500);
  }
  try {
    await api(`/api/docs/${current}/ai`, {
      text,
      effort: $('#aieffort').value,
      scope,
      index: slide ? currentIndex + 1 : null,
      name: slide ? nameOf(slide, currentIndex) : '',
      selection,
      uploads: aiRefs.tokens(),
    });
    $('#aitext').value = '';
    aiRefs.clear();
  } catch (err) {
    toast(err.message, true);
  }
};
$('#aiform').onsubmit = (e) => {
  e.preventDefault();
  sendAI();
};
$('#aitext').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendAI();
  }
});
$('#aistop').onclick = () => current && api(`/api/docs/${current}/stop`, {}).catch((err) => toast(err.message, true));

// ---------------------------------------------------------------- the design frame

// Shown only inside the editor (removed before saving): slides one under another, outlines.
const EDITOR_CSS = `
html { background: transparent !important; }
body { margin: 0 !important; padding: 28px 36px 60px !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important;
  gap: 32px !important; background: transparent !important; width: max-content !important; min-width: 0 !important; min-height: 0 !important; height: auto !important;
  overflow: visible !important; zoom: 1 !important; transform: none !important; }
body > section.slide, body > section.page { flex: none !important; margin: 0 !important; transform: none !important; translate: none !important; scale: none !important;
  box-shadow: 0 14px 44px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08) !important; }
.notes { display: none !important; }
[data-ed-hover] { outline: calc(1.5px / var(--edz, 1)) dashed rgba(34,231,255,.9) !important; outline-offset: 1px !important; cursor: move; }
[contenteditable="true"] { outline: calc(2px / var(--edz, 1)) solid #ff3ecf !important; outline-offset: 2px !important; cursor: text !important; }
.ed-box { position: absolute; display: none; pointer-events: none; z-index: 2147483646; box-sizing: border-box;
  border: calc(2px / var(--edz, 1)) solid #22e7ff; box-shadow: 0 0 0 calc(1px / var(--edz, 1)) rgba(0,0,0,.45), 0 0 14px rgba(34,231,255,.55); }
.ed-box.slidebox { border-color: rgba(34,231,255,.55); box-shadow: none; }
.ed-box b { position: absolute; left: calc(-2px / var(--edz, 1)); bottom: 100%; margin-bottom: calc(4px / var(--edz, 1)); font: 600 calc(11px / var(--edz, 1)) / 1.3 "Segoe UI", sans-serif;
  background: #22e7ff; color: #05060d; padding: calc(2px / var(--edz, 1)) calc(7px / var(--edz, 1)); border-radius: calc(4px / var(--edz, 1)); white-space: nowrap; letter-spacing: 0; text-transform: none; }
.ed-box i { position: absolute; width: calc(12px / var(--edz, 1)); height: calc(12px / var(--edz, 1)); margin: calc(-6px / var(--edz, 1)) 0 0 calc(-6px / var(--edz, 1));
  background: #fff; border: calc(2px / var(--edz, 1)) solid #22e7ff; border-radius: calc(3px / var(--edz, 1)); pointer-events: auto; box-sizing: border-box; }
.ed-box.noh i { display: none; }
.ed-box i[data-h=nw] { left: 0; top: 0; cursor: nwse-resize; } .ed-box i[data-h=ne] { left: 100%; top: 0; cursor: nesw-resize; }
.ed-box i[data-h=sw] { left: 0; top: 100%; cursor: nesw-resize; } .ed-box i[data-h=se] { left: 100%; top: 100%; cursor: nwse-resize; }
.ed-box i[data-h=n] { left: 50%; top: 0; cursor: ns-resize; } .ed-box i[data-h=s] { left: 50%; top: 100%; cursor: ns-resize; }
.ed-box i[data-h=w] { left: 0; top: 50%; cursor: ew-resize; } .ed-box i[data-h=e] { left: 100%; top: 50%; cursor: ew-resize; }
.ed-guide { position: absolute; display: none; pointer-events: none; z-index: 2147483645; background: #ff3ecf; }
`;

const frame = $('#frame');
const wrap = $('#canvaswrap');
let fdoc = null;
let fwin = null;
let box = null;
let guideX = null;
let guideY = null;
let zoomStyle = null;
let zoom = 1;
let selected = null;
let editing = null;
let editStart = '';
let hoverEl = null;
let drag = null;
let resizing = null;
let savedRange = null;
let currentIndex = 0;

const slides = () => (fdoc ? [...fdoc.querySelectorAll(SEL)] : []);
const isSlide = (el) => Boolean(el && el.matches?.(SEL));
const slideOf = (el) => el?.closest?.(SEL) ?? null;
const nameOf = (s, i) => s.dataset.name || s.querySelector('h1, h2, h3')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) || `${WORDC} ${i + 1}`;
const cs = (el) => fwin.getComputedStyle(el);
const hasText = (el) => Boolean(el && !el.closest('svg') && el.textContent.trim());

// The design comes from the helper as text and goes into the frame as srcdoc: that keeps it
// on this page's origin, so the editor can reach into it. Its pictures load from the helper
// through the <base>, which is taken out again before saving.
const docBase = () => `<base data-ed href="${API}/docfile/${current}/">`;
const withBase = (html, extra = '') => html.replace(/<head(\s[^>]*)?>/i, (m) => m + docBase() + extra);
let frameLoad = 0;
const loadFrame = async (mtime) => {
  loadedMtime = mtime;
  const id = current;
  const mine = ++frameLoad;
  let html;
  try {
    ({html} = await api(`/api/docs/${id}/html`));
  } catch (err) {
    return toast(err.message, true);
  }
  // A newer load (or another document) won meanwhile.
  if (mine !== frameLoad || id !== current || !html) return;
  $('#placeholder').hidden = true;
  const top = wrap.scrollTop;
  frame.onload = () => setupFrame(top);
  frame.srcdoc = withBase(html);
};

const setupFrame = (scrollTop) => {
  fdoc = frame.contentDocument;
  fwin = frame.contentWindow;
  if (!fdoc?.body) return;
  const style = fdoc.createElement('style');
  style.setAttribute('data-ed', '');
  style.textContent = EDITOR_CSS;
  zoomStyle = fdoc.createElement('style');
  zoomStyle.setAttribute('data-ed', '');
  fdoc.head.append(style, zoomStyle);
  box = fdoc.createElement('div');
  box.setAttribute('data-ed-ui', '');
  box.className = 'ed-box';
  box.innerHTML = '<b></b>' + ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i data-h="${h}"></i>`).join('');
  guideX = fdoc.createElement('div');
  guideY = fdoc.createElement('div');
  for (const g of [guideX, guideY]) {
    g.setAttribute('data-ed-ui', '');
    g.className = 'ed-guide';
  }
  // Outside <body>, so it never ends up in the design.
  fdoc.documentElement.append(box, guideX, guideY);
  bindFrame();
  delete $('#font').dataset.filled;
  selected = editing = hoverEl = null;
  resetHistory();
  layoutFrame();
  wrap.scrollTop = scrollTop;
  buildThumbs();
  checkOverflow();
  updateInspector();
  fdoc.fonts.ready.then(() => {
    layoutFrame();
    checkOverflow();
  });
  drawScope();
};

let frameW = 0;
const layoutFrame = () => {
  if (!fdoc?.body) return;
  const w = Math.ceil(fdoc.body.scrollWidth);
  const h = Math.ceil(fdoc.documentElement.scrollHeight);
  frameW = w;
  const mode = $('#zoom').value;
  zoom = mode === 'fit' ? Math.max(0.2, Math.min(1.25, (wrap.clientWidth - 6) / w)) : Number(mode);
  frame.style.width = `${w}px`;
  frame.style.height = `${h}px`;
  frame.style.transform = `scale(${zoom})`;
  $('#canvas').style.width = `${w * zoom}px`;
  $('#canvas').style.height = `${h * zoom}px`;
  zoomStyle.textContent = `:root { --edz: ${zoom}; }`;
  placeBox();
};
$('#zoom').onchange = layoutFrame;
new ResizeObserver(() => $('#zoom').value === 'fit' && layoutFrame()).observe(wrap);

// Which slide is in view, for the slide list and "Ask Claude".
wrap.addEventListener('scroll', () => {
  if (!fdoc || (selected && slideOf(selected))) return;
  const mid = (wrap.scrollTop + wrap.clientHeight / 2) / zoom;
  const list = slides();
  let best = 0;
  list.forEach((s, i) => {
    if (s.offsetTop <= mid) best = i;
  });
  if (best !== currentIndex) {
    currentIndex = best;
    highlightThumb();
    updateInspector();
    drawScope();
  }
});

const goTo = (i) => {
  const s = slides()[i];
  if (!s) return;
  currentIndex = i;
  wrap.scrollTo({top: Math.max(0, s.offsetTop * zoom - 14), behavior: 'smooth'});
  highlightThumb();
  updateInspector();
  drawScope();
};

// ---------------------------------------------------------------- selecting

const label = (el) => {
  if (isSlide(el)) return `${WORDC} ${slides().indexOf(el) + 1}`;
  const t = el.tagName;
  if (t === 'IMG') return 'Picture';
  if (t === 'svg' || t === 'SVG') return 'Drawing / chart';
  if (/^H[1-6]$/.test(t)) return 'Heading';
  if (t === 'LI') return 'List item';
  if (t === 'UL' || t === 'OL') return 'List';
  if (t === 'TABLE') return 'Table';
  if ([...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) return 'Text';
  return el.children.length ? 'Box' : 'Shape';
};

const pickTarget = (t) => {
  if (!t || t.nodeType !== 1 || t.closest('[data-ed-ui]')) return null;
  if (!slideOf(t)) return null;
  // A drawing is chosen whole, not its lines and dots.
  let svg = t.closest('svg');
  while (svg?.parentElement?.closest('svg')) svg = svg.parentElement.closest('svg');
  return svg ?? t;
};

const select = (el) => {
  if (hoverEl) {
    hoverEl.removeAttribute('data-ed-hover');
    hoverEl = null;
  }
  selected = el;
  const s = slideOf(el);
  if (s) {
    currentIndex = slides().indexOf(s);
    highlightThumb();
  }
  placeBox();
  updateInspector();
  syncToolbar();
  drawScope();
};

const placeBox = () => {
  if (!box) return;
  if (!selected || !selected.isConnected) {
    box.style.display = 'none';
    return;
  }
  const r = selected.getBoundingClientRect();
  Object.assign(box.style, {display: 'block', left: `${r.left + fwin.scrollX}px`, top: `${r.top + fwin.scrollY}px`, width: `${r.width}px`, height: `${r.height}px`});
  box.classList.toggle('noh', isSlide(selected) || Boolean(editing));
  box.classList.toggle('slidebox', isSlide(selected));
  box.querySelector('b').textContent = editing ? 'Typing' : label(selected);
};

const getTranslate = (el) => {
  const t = el.style.translate || cs(el).translate;
  if (!t || t === 'none') return [0, 0];
  const [x = 0, y = 0] = t.split(/\s+/).map(parseFloat);
  return [x || 0, y || 0];
};
const setTranslate = (el, x, y) => {
  x = Math.round(x);
  y = Math.round(y);
  el.style.translate = x || y ? `${x}px ${y}px` : '';
};

// ---------------------------------------------------------------- mouse and keys in the frame

const bindFrame = () => {
  fdoc.addEventListener('mousedown', onDown, true);
  fdoc.addEventListener('mousemove', onMove, true);
  fdoc.addEventListener('mouseup', onUp, true);
  fdoc.addEventListener('dblclick', onDouble, true);
  fdoc.addEventListener('keydown', onKey, true);
  fdoc.addEventListener('dragstart', (e) => e.preventDefault());
  fdoc.addEventListener('click', (e) => {
    if (!editing && e.target.closest?.('a')) e.preventDefault();
  }, true);
  fdoc.addEventListener('paste', (e) => {
    if (!editing) return;
    e.preventDefault();
    fdoc.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  fdoc.addEventListener('input', () => editing && placeBox());
  fdoc.addEventListener('selectionchange', () => {
    const s = fdoc.getSelection();
    if (editing && s.rangeCount && editing.contains(s.anchorNode)) {
      savedRange = s.getRangeAt(0).cloneRange();
      syncToolbar();
    }
  });
};
window.addEventListener('mouseup', () => onUp());

const onDown = (e) => {
  if (e.button !== 0) return;
  if (busyAI) {
    e.preventDefault();
    return;
  }
  const handle = e.target.closest?.('[data-h]');
  if (handle && selected && !isSlide(selected)) {
    e.preventDefault();
    startResize(e, handle.dataset.h);
    return;
  }
  if (editing && editing.contains(e.target)) return;
  if (editing) stopEditing();
  e.preventDefault();
  fwin.focus();
  const el = pickTarget(e.target);
  select(el);
  if (el && !isSlide(el)) drag = {el, x0: e.clientX, y0: e.clientY, t0: getTranslate(el), moved: false, slide: slideOf(el)};
};

const SNAP = 6;
const onMove = (e) => {
  if (resizing) return doResize(e);
  if (drag) {
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    let x = drag.t0[0] + dx;
    let y = drag.t0[1] + dy;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) y = drag.t0[1];
      else x = drag.t0[0];
    }
    setTranslate(drag.el, x, y);
    // Centre lines of the slide pull the box in.
    const r = drag.el.getBoundingClientRect();
    const s = drag.slide.getBoundingClientRect();
    const offX = r.left + r.width / 2 - (s.left + s.width / 2);
    const offY = r.top + r.height / 2 - (s.top + s.height / 2);
    const snapX = !e.altKey && Math.abs(offX) < SNAP;
    const snapY = !e.altKey && Math.abs(offY) < SNAP;
    if (snapX || snapY) setTranslate(drag.el, x - (snapX ? offX : 0), y - (snapY ? offY : 0));
    Object.assign(guideX.style, snapX ? {display: 'block', left: `${s.left + s.width / 2 + fwin.scrollX}px`, top: `${s.top + fwin.scrollY}px`, width: `${1 / zoom}px`, height: `${s.height}px`} : {display: 'none'});
    Object.assign(guideY.style, snapY ? {display: 'block', left: `${s.left + fwin.scrollX}px`, top: `${s.top + s.height / 2 + fwin.scrollY}px`, width: `${s.width}px`, height: `${1 / zoom}px`} : {display: 'none'});
    placeBox();
    return;
  }
  if (busyAI || editing) return;
  const el = pickTarget(e.target);
  const want = el && el !== selected && !isSlide(el) ? el : null;
  if (want !== hoverEl) {
    hoverEl?.removeAttribute('data-ed-hover');
    hoverEl = want;
    hoverEl?.setAttribute('data-ed-hover', '');
  }
};

const onUp = () => {
  if (resizing) {
    resizing = null;
    commit();
  }
  if (drag) {
    if (drag.moved) commit();
    drag = null;
    if (guideX) guideX.style.display = guideY.style.display = 'none';
  }
};

const onDouble = (e) => {
  if (busyAI) return;
  const el = pickTarget(e.target);
  if (!el || isSlide(el)) return;
  if (el.tagName === 'IMG') return replacePicture();
  if (hasText(el)) startEditing(el, e);
};

// ---- resizing with the handles

const startResize = (e, h) => {
  const el = selected;
  const r = el.getBoundingClientRect();
  const st = cs(el);
  const padX = st.boxSizing === 'border-box' ? 0 : parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) + parseFloat(st.borderLeftWidth) + parseFloat(st.borderRightWidth);
  const padY = st.boxSizing === 'border-box' ? 0 : parseFloat(st.paddingTop) + parseFloat(st.paddingBottom) + parseFloat(st.borderTopWidth) + parseFloat(st.borderBottomWidth);
  resizing = {el, h, x0: e.clientX, y0: e.clientY, w0: r.width, h0: r.height, t0: getTranslate(el), padX, padY, ratio: r.width / Math.max(1, r.height), keepRatio: el.tagName === 'IMG' || el.tagName === 'svg'};
};
const doResize = (e) => {
  const z = resizing;
  const dx = e.clientX - z.x0;
  const dy = e.clientY - z.y0;
  let w = z.w0 + (z.h.includes('e') ? dx : z.h.includes('w') ? -dx : 0);
  let h = z.h0 + (z.h.includes('s') ? dy : z.h.includes('n') ? -dy : 0);
  w = Math.max(8, w);
  h = Math.max(8, h);
  const corner = z.h.length === 2;
  if (corner && (z.keepRatio !== e.shiftKey)) h = w / z.ratio;
  const el = z.el;
  if (z.h !== 'n' && z.h !== 's') {
    el.style.width = `${Math.round(w - z.padX)}px`;
    el.style.maxWidth = 'none';
    el.style.flex = 'none';
  }
  const textOnly = hasText(el) && !el.querySelector('img, svg');
  if (z.h === 'n' || z.h === 's' || (corner && !textOnly)) {
    el.style.height = `${Math.round(h - z.padY)}px`;
    el.style.maxHeight = 'none';
  }
  const [tx, ty] = z.t0;
  setTranslate(el, z.h.includes('w') ? tx + (z.w0 - w) : tx, z.h.includes('n') ? ty + (z.h0 - (z.h === 'n' || z.h === 's' || (corner && !textOnly) ? h : z.h0)) : ty);
  placeBox();
};

// ---- typing

const startEditing = (el, e) => {
  let host = el;
  while (host && !isSlide(host.parentElement) && cs(host).display === 'inline') host = host.parentElement;
  if (!host || isSlide(host)) return;
  editing = host;
  editStart = host.innerHTML;
  host.setAttribute('contenteditable', 'true');
  host.setAttribute('spellcheck', 'false');
  selected = host;
  hoverEl?.removeAttribute('data-ed-hover');
  hoverEl = null;
  fwin.focus();
  host.focus();
  const sel = fdoc.getSelection();
  const range = e ? fdoc.caretRangeFromPoint(e.clientX, e.clientY) : null;
  sel.removeAllRanges();
  if (range && host.contains(range.startContainer)) sel.addRange(range);
  else {
    const all = fdoc.createRange();
    all.selectNodeContents(host);
    sel.addRange(all);
  }
  placeBox();
  updateInspector();
  syncToolbar();
};

const stopEditing = () => {
  const host = editing;
  if (!host) return;
  editing = null;
  savedRange = null;
  host.removeAttribute('contenteditable');
  host.removeAttribute('spellcheck');
  fdoc.getSelection()?.removeAllRanges();
  if (host.innerHTML !== editStart) commit();
  placeBox();
};

const newListItem = () => {
  const li = editing;
  stopEditing();
  const n = fdoc.createElement('li');
  for (const a of li.attributes) if (a.name !== 'contenteditable' && a.name !== 'spellcheck') n.setAttribute(a.name, a.value);
  n.innerHTML = '<br>';
  li.after(n);
  startEditing(n);
};

const onKey = (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 's') {
    e.preventDefault();
    save();
    return;
  }
  if (editing) {
    if (e.key === 'Escape') {
      e.preventDefault();
      stopEditing();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editing.tagName === 'LI') newListItem();
      else fdoc.execCommand('insertLineBreak');
    }
    return;
  }
  if (busyAI || !fdoc) return;
  if (mod && k === 'z') {
    e.preventDefault();
    e.shiftKey ? redoStep() : undoStep();
    return;
  }
  if (mod && k === 'y') {
    e.preventDefault();
    redoStep();
    return;
  }
  if (!selected) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  } else if (mod && k === 'd') {
    e.preventDefault();
    duplicateSelected();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    selectParent();
  } else if (e.key === 'Enter' && hasText(selected) && !isSlide(selected)) {
    e.preventDefault();
    startEditing(selected);
  } else if (e.key.startsWith('Arrow') && !isSlide(selected)) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const [x, y] = getTranslate(selected);
    setTranslate(selected, x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0));
    placeBox();
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(commit, 400);
  }
};
let nudgeTimer = null;
document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea, select, dialog')) return;
  if ($('#editview').hidden) return;
  onKey(e);
});

const selectParent = () => {
  if (!selected) return;
  if (isSlide(selected)) return select(null);
  const p = selected.parentElement;
  select(p && slideOf(p) ? p : null);
};

// ---------------------------------------------------------------- history and saving

let undoList = [];
let redoList = [];
let lastSnap = '';
let dirty = false;
let saveTimer = null;
let saving = null;

/** Removes the editor's own marks from a copy of the design. */
const clean = (root) => {
  root.querySelectorAll?.('[data-ed-ui], [data-ed]').forEach((n) => n.remove());
  for (const n of [root, ...(root.querySelectorAll?.('[data-ed-hover], [contenteditable], [spellcheck]') ?? [])]) {
    n.removeAttribute?.('data-ed-hover');
    n.removeAttribute?.('contenteditable');
    n.removeAttribute?.('spellcheck');
  }
  return root;
};
const snapBody = () => clean(fdoc.body.cloneNode(true)).innerHTML;
const serialize = () => '<!doctype html>\n' + clean(fdoc.documentElement.cloneNode(true)).outerHTML;

const resetHistory = () => {
  undoList = [];
  redoList = [];
  lastSnap = fdoc?.body ? snapBody() : '';
  dirty = false;
  drawUndo();
};
const drawUndo = () => {
  $('#undo').disabled = !undoList.length;
  $('#redo').disabled = !redoList.length;
};

/** Records a finished change: undo, saving, the slide list and the warnings follow. */
const commit = () => {
  if (!fdoc) return;
  const s = snapBody();
  if (s === lastSnap) return;
  undoList.push(lastSnap);
  if (undoList.length > 80) undoList.shift();
  redoList = [];
  lastSnap = s;
  afterChange();
};
const afterChange = (structure = false) => {
  drawUndo();
  markDirty();
  placeBox();
  updateInspector();
  syncToolbar();
  if (structure || $('#thumbs').children.length !== slides().length) buildThumbs();
  else refreshThumb(currentIndex);
  checkOverflow();
  drawScope();
};
const restoreSnap = (s) => {
  if (editing) stopEditing();
  fdoc.body.innerHTML = s;
  selected = hoverEl = null;
  lastSnap = s;
  layoutFrame();
  afterChange(true);
};
const undoStep = () => {
  if (!undoList.length || busyAI) return;
  redoList.push(lastSnap);
  restoreSnap(undoList.pop());
};
const redoStep = () => {
  if (!redoList.length || busyAI) return;
  undoList.push(lastSnap);
  restoreSnap(redoList.pop());
};
$('#undo').onclick = undoStep;
$('#redo').onclick = redoStep;

const setSaveState = (text, bad = false) => {
  $('#savestate').textContent = text;
  $('#savestate').classList.toggle('bad', bad);
};
const markDirty = () => {
  dirty = true;
  setSaveState('Saving soon…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 900);
};
const save = async () => {
  clearTimeout(saveTimer);
  if (saving) await saving;
  if (!dirty || !current || !fdoc?.body) return;
  dirty = false;
  setSaveState('Saving…');
  saving = (async () => {
    try {
      const r = await api(`/api/docs/${current}/save`, {html: serialize(), client: CLIENT});
      loadedMtime = r.mtime;
      setSaveState('All changes saved');
    } catch (err) {
      dirty = true;
      setSaveState(err.message, true);
    }
  })();
  await saving;
  saving = null;
};
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    save();
    e.preventDefault();
  }
});
document.addEventListener('visibilitychange', () => document.hidden && dirty && save());

// ---------------------------------------------------------------- slide list

const thumbCss = (i) =>
  `<style>html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:none!important;display:block!important;width:auto!important;height:auto!important;zoom:1!important;transform:none!important}body>section:not(:nth-of-type(${i + 1})){display:none!important}body>section{margin:0!important;box-shadow:none!important;transform:none!important;translate:none!important}.notes{display:none!important}</style>`;
const thumbSrc = (html, i) => withBase(html, thumbCss(i));

const buildThumbs = () => {
  const box = $('#thumbs');
  box.innerHTML = '';
  const list = slides();
  $('#pagecount').textContent = list.length;
  if (!list.length) return;
  const html = serialize();
  list.forEach((s, i) => {
    const W = s.offsetWidth || 1280;
    const H = s.offsetHeight || 720;
    const tw = 172;
    const k = tw / W;
    const d = document.createElement('div');
    d.className = 'thumb' + (i === currentIndex ? ' on' : '');
    d.innerHTML = `<div class="tbox" style="width:${tw}px;height:${Math.round(H * k)}px"><iframe tabindex="-1" scrolling="no" style="width:${W}px;height:${H}px;transform:scale(${k})"></iframe></div>
      <div class="tmeta"><span class="n">${i + 1}</span><span class="nm"></span><span class="warn" hidden title="Text runs past the edge here">⚠</span></div>
      <div class="tact"><button data-a="up" title="Move up">↑</button><button data-a="down" title="Move down">↓</button><button data-a="dup" title="Duplicate">⧉</button><button data-a="del" title="Delete">✕</button></div>`;
    d.querySelector('.nm').textContent = nameOf(s, i);
    d.querySelector('iframe').srcdoc = thumbSrc(html, i);
    d.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a) slideAction(a, i);
      else {
        select(null);
        goTo(i);
      }
    };
    box.append(d);
  });
};
let thumbTimer = null;
const refreshThumb = (i) => {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    const t = $('#thumbs').children[i];
    const s = slides()[i];
    if (!t || !s) return;
    t.querySelector('iframe').srcdoc = thumbSrc(serialize(), i);
    t.querySelector('.nm').textContent = nameOf(s, i);
  }, 600);
};
const highlightThumb = () => {
  [...$('#thumbs').children].forEach((t, i) => t.classList.toggle('on', i === currentIndex));
  $('#thumbs').children[currentIndex]?.scrollIntoView({block: 'nearest'});
};

/** Marks slides where text runs past the edge (after hand edits, mostly). */
const checkOverflow = () => {
  slides().forEach((s, i) => {
    const sr = s.getBoundingClientRect();
    let over = false;
    for (const el of s.querySelectorAll('*')) {
      if (el.closest('.notes, svg') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) continue;
      const r = fdoc.createRange();
      r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      if (b.width && (b.bottom > sr.bottom + 2 || b.right > sr.right + 2 || b.left < sr.left - 2 || b.top < sr.top - 2)) {
        over = true;
        break;
      }
    }
    const w = $('#thumbs').children[i]?.querySelector('.warn');
    if (w) w.hidden = !over;
  });
};

const newSlide = () => {
  const s = fdoc.createElement('section');
  s.className = KIND === 'ppt' ? 'slide' : 'page';
  s.dataset.name = `New ${WORD}`;
  return s;
};
const slideAction = (a, i) => {
  if (busyAI || !fdoc) return;
  if (editing) stopEditing();
  const list = slides();
  const s = list[i];
  if (!s) return;
  let to = i;
  if (a === 'up' && i > 0) {
    list[i - 1].before(s);
    to = i - 1;
  } else if (a === 'down' && i < list.length - 1) {
    list[i + 1].after(s);
    to = i + 1;
  } else if (a === 'dup') {
    s.after(s.cloneNode(true));
    to = i + 1;
  } else if (a === 'del') {
    if (list.length < 2) return toast(`The last ${WORD} cannot be deleted.`);
    if (!confirm(`Delete ${WORD} ${i + 1}? (Undo brings it back.)`)) return;
    s.remove();
    to = Math.max(0, i - 1);
  } else if (a === 'add') {
    s.after(newSlide());
    to = i + 1;
  } else return;
  select(null);
  currentIndex = to;
  const snap = snapBody();
  undoList.push(lastSnap);
  redoList = [];
  lastSnap = snap;
  layoutFrame();
  afterChange(true);
  goTo(to);
};
$('#addpage').onclick = () => slideAction('add', currentIndex);
$('#duppage').onclick = () => slideAction('dup', currentIndex);

// ---------------------------------------------------------------- toolbar

// Buttons keep the typing selection inside the frame.
document.querySelectorAll('.tb').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

const typingRange = () => {
  if (!editing) return false;
  const s = fdoc.getSelection();
  if ((!s.rangeCount || !editing.contains(s.anchorNode)) && savedRange) {
    fwin.focus();
    editing.focus();
    s.removeAllRanges();
    s.addRange(savedRange);
  }
  return s.rangeCount > 0 && !s.isCollapsed && editing.contains(s.anchorNode);
};
const target = () => editing ?? (selected && !isSlide(selected) ? selected : null);
/** Applies a text style: to the highlighted words while typing, else to the whole selected box. */
const textStyle = (cmd, value, prop, css, later = false) => {
  const el = target();
  if (!el || busyAI) return toast('Select some text first.');
  if (typingRange() && cmd) {
    fdoc.execCommand('styleWithCSS', false, true);
    fdoc.execCommand(cmd, false, value);
  } else {
    el.style[prop] = css;
  }
  // later: the color picker is still moving; its "change" records the step.
  if (!editing && !later) commit();
  placeBox();
  syncToolbar();
};
$('#bold').onclick = () => {
  const el = target();
  if (!el) return toast('Select some text first.');
  textStyle('bold', null, 'fontWeight', Number(cs(el).fontWeight) >= 600 ? '400' : '700');
};
$('#italic').onclick = () => {
  const el = target();
  if (!el) return toast('Select some text first.');
  textStyle('italic', null, 'fontStyle', cs(el).fontStyle === 'italic' ? 'normal' : 'italic');
};
$('#under').onclick = () => {
  const el = target();
  if (!el) return toast('Select some text first.');
  textStyle('underline', null, 'textDecoration', cs(el).textDecorationLine.includes('underline') ? 'none' : 'underline');
};
$('#tcolor').addEventListener('input', (e) => textStyle('foreColor', e.target.value, 'color', e.target.value, true));
$('#tcolor').addEventListener('change', () => !editing && commit());
document.querySelectorAll('[data-align]').forEach((b) =>
  b.addEventListener('click', () => {
    const el = target();
    if (!el) return toast('Select some text first.');
    el.style.textAlign = b.dataset.align;
    if (!editing) commit();
    syncToolbar();
  }),
);
$('#fsize').addEventListener('change', (e) => {
  const px = Math.max(6, Math.min(400, Number(e.target.value) || 0));
  const el = target();
  if (!el || !px) return;
  if (typingRange()) {
    fdoc.execCommand('styleWithCSS', false, true);
    fdoc.execCommand('fontSize', false, '7');
    editing.querySelectorAll('[style*="xxx-large"], font[size="7"]').forEach((n) => {
      n.style.fontSize = `${px}px`;
      n.removeAttribute('size');
    });
  } else el.style.fontSize = `${px}px`;
  if (!editing) commit();
  placeBox();
});
const docFonts = () =>
  fdoc
    ? [...fdoc.querySelectorAll('link[href*="fonts.googleapis.com"]')].flatMap((l) => [...new URL(l.href).searchParams.getAll('family')].map((f) => f.split(':')[0].replace(/\+/g, ' ')))
    : [];
const fillFonts = () => {
  const mine = [...new Set(docFonts())];
  const rest = FONTS.filter((f) => !mine.includes(f));
  $('#font').innerHTML = (mine.length ? `<optgroup label="In this ${THING}">${mine.map((f) => `<option>${esc(f)}</option>`).join('')}</optgroup>` : '') + `<optgroup label="More fonts">${rest.map((f) => `<option>${esc(f)}</option>`).join('')}</optgroup>`;
};
const ensureFont = (fam) => {
  if (SYSTEM_FONTS.has(fam) || docFonts().includes(fam)) return;
  const l = fdoc.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
  fdoc.head.append(l);
};
$('#font').addEventListener('change', (e) => {
  const fam = e.target.value;
  const el = target();
  if (!el) return toast('Select some text first.');
  ensureFont(fam);
  const stack = `'${fam}', ${SYSTEM_FONTS.has(fam) ? 'sans-serif' : 'system-ui, sans-serif'}`;
  if (typingRange()) {
    fdoc.execCommand('styleWithCSS', false, true);
    fdoc.execCommand('fontName', false, stack);
  } else el.style.fontFamily = stack;
  if (!editing) commit();
  fdoc.fonts.ready.then(placeBox);
});

/** Shows the selected text's font, size, color and styles in the toolbar. */
const syncToolbar = () => {
  if (!fdoc) return;
  let el = target();
  if (editing) {
    const s = fdoc.getSelection();
    const n = s.rangeCount ? s.getRangeAt(0).startContainer : null;
    if (n && editing.contains(n)) el = n.nodeType === 3 ? n.parentElement : n;
  }
  if ($('#font').options.length === 0 || !$('#font').dataset.filled) {
    fillFonts();
    $('#font').dataset.filled = '1';
  }
  const on = Boolean(el);
  for (const id of ['font', 'fsize', 'bold', 'italic', 'under', 'tcolor', 'dup', 'front', 'back', 'del']) $(`#${id}`).disabled = !on || busyAI;
  document.querySelectorAll('[data-align]').forEach((b) => (b.disabled = !on || busyAI));
  if (!el) return;
  const st = cs(el);
  const fam = st.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (![...$('#font').options].some((o) => o.value === fam)) $('#font').insertAdjacentHTML('afterbegin', `<option>${esc(fam)}</option>`);
  $('#font').value = fam;
  if (document.activeElement !== $('#fsize')) $('#fsize').value = Math.round(parseFloat(st.fontSize));
  $('#tcolor').value = hex(st.color) ?? '#000000';
  $('#bold').classList.toggle('on', Number(st.fontWeight) >= 600);
  $('#italic').classList.toggle('on', st.fontStyle === 'italic');
  $('#under').classList.toggle('on', st.textDecorationLine.includes('underline'));
  const align = ['center', 'right', 'end'].includes(st.textAlign) ? (st.textAlign === 'end' ? 'right' : st.textAlign) : 'left';
  document.querySelectorAll('[data-align]').forEach((b) => b.classList.toggle('on', b.dataset.align === align));
};

// ---- adding things

const currentSlide = () => slideOf(selected) ?? slides()[currentIndex] ?? slides()[0];
const placeNew = (el) => {
  const s = currentSlide();
  if (!s) return;
  s.insertBefore(el, s.querySelector(':scope > .notes'));
  commit();
  select(el);
};
$('#addtext').onclick = () => {
  if (!fdoc || busyAI) return;
  const s = currentSlide();
  const el = fdoc.createElement('div');
  el.textContent = 'New text';
  const W = s.offsetWidth;
  const H = s.offsetHeight;
  const w = Math.round(W * 0.4);
  el.style.cssText = `position:absolute;left:${Math.round((W - w) / 2)}px;top:${Math.round(H / 2 - 30)}px;width:${w}px;font-size:${KIND === 'ppt' ? 32 : 18}px;line-height:1.3;z-index:20`;
  placeNew(el);
  startEditing(el);
};
$('#addshape').onclick = () => {
  if (!fdoc || busyAI) return;
  const s = currentSlide();
  const el = fdoc.createElement('div');
  const W = s.offsetWidth;
  const H = s.offsetHeight;
  el.style.cssText = `position:absolute;left:${Math.round(W / 2 - 120)}px;top:${Math.round(H / 2 - 80)}px;width:240px;height:160px;background:#8b5cff;border-radius:18px;z-index:10`;
  placeNew(el);
};
const choosePicture = () =>
  new Promise((resolve) => {
    const input = $('#imgfile');
    input.value = '';
    input.onchange = () => resolve(input.files[0] ?? null);
    input.click();
  });
const uploadPicture = async (file) => {
  const res = await call(`/api/docs/${current}/asset?name=${encodeURIComponent(file.name)}`, {method: 'POST', body: file});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.src;
};
$('#addimg').onclick = async () => {
  if (!fdoc || busyAI) return;
  const file = await choosePicture();
  if (!file) return;
  try {
    const src = await uploadPicture(file);
    const s = currentSlide();
    const img = fdoc.createElement('img');
    img.src = src;
    img.alt = '';
    const w = Math.round(s.offsetWidth * 0.36);
    img.style.cssText = `position:absolute;left:${Math.round((s.offsetWidth - w) / 2)}px;top:${Math.round(s.offsetHeight * 0.2)}px;width:${w}px;height:auto;z-index:15`;
    img.onload = () => {
      placeBox();
      commit();
    };
    placeNew(img);
  } catch (err) {
    toast(err.message, true);
  }
};
const replacePicture = async () => {
  const el = selected;
  if (!el || busyAI) return;
  const file = await choosePicture();
  if (!file) return;
  try {
    const src = await uploadPicture(file);
    if (el.tagName === 'IMG') {
      el.src = src;
      el.removeAttribute('srcset');
      if (!el.style.objectFit && cs(el).objectFit === 'fill') el.style.objectFit = 'cover';
      el.onload = () => {
        placeBox();
        commit();
      };
    } else {
      el.style.backgroundImage = `url("${src}")`;
      el.style.backgroundSize = el.style.backgroundSize || 'cover';
      el.style.backgroundPosition = el.style.backgroundPosition || 'center';
      commit();
    }
  } catch (err) {
    toast(err.message, true);
  }
};
$('#replaceimg').onclick = replacePicture;

const deleteSelected = () => {
  if (!selected || busyAI) return;
  if (isSlide(selected)) return slideAction('del', slides().indexOf(selected));
  selected.remove();
  select(null);
  commit();
};
const duplicateSelected = () => {
  if (!selected || busyAI) return;
  if (isSlide(selected)) return slideAction('dup', slides().indexOf(selected));
  const c = selected.cloneNode(true);
  selected.after(c);
  const [x, y] = getTranslate(selected);
  setTranslate(c, x + 24, y + 24);
  commit();
  select(c);
};
const layer = (up) => {
  const el = selected;
  if (!el || isSlide(el) || busyAI) return;
  const st = cs(el);
  if (st.position === 'static') el.style.position = 'relative';
  const z = Number.parseInt(st.zIndex, 10) || 0;
  el.style.zIndex = String(up ? z + 1 : z - 1);
  commit();
};
$('#dup').onclick = duplicateSelected;
$('#del').onclick = deleteSelected;
$('#front').onclick = () => layer(true);
$('#back').onclick = () => layer(false);

// ---------------------------------------------------------------- inspector

const updateInspector = () => {
  const el = selected && !isSlide(selected) ? selected : null;
  const s = slides()[currentIndex];
  $('#inspempty').hidden = Boolean(el);
  $('#inspbox').hidden = !el;
  $('#inspslide').hidden = !s;
  $('#sellabel').textContent = el ? label(el) : s ? `${WORDC} ${currentIndex + 1}` : '';
  if (el) {
    const st = cs(el);
    $('#fill').value = hex(st.backgroundColor) ?? '#ffffff';
    $('#opacity').value = st.opacity;
    $('#radius').value = Math.round(parseFloat(st.borderTopLeftRadius) || 0);
    $('#bw').value = Math.round(parseFloat(st.borderTopWidth) || 0);
    $('#bc').value = hex(st.borderTopColor) ?? '#000000';
    const r = el.getBoundingClientRect();
    if (document.activeElement !== $('#wbox')) $('#wbox').value = Math.round(r.width);
    if (document.activeElement !== $('#hbox')) $('#hbox').value = Math.round(r.height);
    const pic = el.tagName === 'IMG' || /url\(/.test(st.backgroundImage);
    $('#replaceimg').hidden = !pic;
    $('#fitrow').hidden = el.tagName !== 'IMG';
    $('#fit').value = st.objectFit === 'contain' ? 'contain' : 'cover';
  }
  if (s) {
    $('#slidebg').value = hex(cs(s).backgroundColor) ?? '#ffffff';
    if (document.activeElement !== $('#slidename')) $('#slidename').value = s.dataset.name ?? '';
    if (document.activeElement !== $('#notes')) $('#notes').value = s.querySelector(':scope > .notes')?.textContent.trim() ?? '';
  }
};
const boxStyle = (fn) => {
  const el = selected && !isSlide(selected) ? selected : null;
  if (!el || busyAI) return;
  fn(el);
  placeBox();
};
$('#fill').addEventListener('input', (e) => boxStyle((el) => (el.style.background = e.target.value)));
$('#fill').addEventListener('change', () => commit());
$('#nofill').onclick = () => boxStyle((el) => {
  el.style.background = 'transparent';
  commit();
});
$('#opacity').addEventListener('input', (e) => boxStyle((el) => (el.style.opacity = e.target.value)));
$('#opacity').addEventListener('change', () => commit());
$('#radius').addEventListener('change', (e) => boxStyle((el) => {
  el.style.borderRadius = `${Math.max(0, Number(e.target.value) || 0)}px`;
  if (el.tagName !== 'IMG') el.style.overflow = el.style.overflow || 'hidden';
  commit();
}));
const border = () => boxStyle((el) => {
  const w = Math.max(0, Number($('#bw').value) || 0);
  el.style.border = w ? `${w}px solid ${$('#bc').value}` : 'none';
  commit();
});
$('#bw').addEventListener('change', border);
$('#bc').addEventListener('change', border);
const sizeBox = (dim) => boxStyle((el) => {
  const v = Math.max(4, Number($(dim === 'width' ? '#wbox' : '#hbox').value) || 0);
  const st = cs(el);
  const pad = st.boxSizing === 'border-box' ? 0 : dim === 'width'
    ? parseFloat(st.paddingLeft) + parseFloat(st.paddingRight) + parseFloat(st.borderLeftWidth) + parseFloat(st.borderRightWidth)
    : parseFloat(st.paddingTop) + parseFloat(st.paddingBottom) + parseFloat(st.borderTopWidth) + parseFloat(st.borderBottomWidth);
  el.style[dim] = `${Math.round(v - pad)}px`;
  if (dim === 'width') {
    el.style.maxWidth = 'none';
    el.style.flex = 'none';
  } else el.style.maxHeight = 'none';
  commit();
});
$('#wbox').addEventListener('change', () => sizeBox('width'));
$('#hbox').addEventListener('change', () => sizeBox('height'));
$('#autoh').onclick = () => boxStyle((el) => {
  el.style.height = 'auto';
  commit();
});
$('#fit').addEventListener('change', (e) => boxStyle((el) => {
  el.style.objectFit = e.target.value;
  commit();
}));
$('#parentbtn').onclick = selectParent;
$('#slidebg').addEventListener('input', (e) => {
  const s = slides()[currentIndex];
  if (s && !busyAI) s.style.background = e.target.value;
});
$('#slidebg').addEventListener('change', () => commit());
$('#slidename').addEventListener('change', (e) => {
  const s = slides()[currentIndex];
  if (!s || busyAI) return;
  if (e.target.value.trim()) s.dataset.name = e.target.value.trim();
  else delete s.dataset.name;
  commit();
});
let notesTimer = null;
$('#notes').addEventListener('input', (e) => {
  const s = slides()[currentIndex];
  if (!s || busyAI) return;
  let n = s.querySelector(':scope > .notes');
  if (!n) {
    n = fdoc.createElement('aside');
    n.className = 'notes';
    s.append(n);
  }
  n.textContent = e.target.value;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(commit, 700);
});

// ---------------------------------------------------------------- versions

$('#versions').onclick = async () => {
  if (!current) return;
  await save();
  let versions = [];
  try {
    versions = (await api(`/api/docs/${current}`)).versions;
  } catch (err) {
    return toast(err.message, true);
  }
  const list = $('#verlist');
  list.innerHTML = versions.length ? '' : '<p class="hint">No versions yet.</p>';
  for (const v of versions) {
    const row = document.createElement('div');
    row.className = 'ver';
    row.innerHTML = `<span>${when(v.at)}</span><span class="why grow">${esc(v.why)}</span><button type="button" class="btn small">Restore</button>`;
    row.querySelector('button').onclick = async () => {
      if (busyAI) return toast('Wait for Claude to finish.');
      if (!confirm(`Go back to the version from ${when(v.at)}? The current one is kept as a version.`)) return;
      try {
        const r = await api(`/api/docs/${current}/restore`, {name: v.name});
        $('#verdlg').close();
        loadFrame(r.mtime);
        toast('Restored.');
      } catch (err) {
        toast(err.message, true);
      }
    };
    list.append(row);
  }
  $('#verdlg').showModal();
};

// ---------------------------------------------------------------- download with the PIN

const FORMATS = KIND === 'ppt'
  ? [['pptx', 'PowerPoint (.pptx)', 'Text stays editable in PowerPoint; shapes, photos and charts come as the slide picture.'], ['pptx-pictures', 'PowerPoint, exact look', 'Every slide as one picture: looks exactly the same everywhere, not editable.'], ['pdf', 'PDF', 'Exactly as designed, for sharing and printing.']]
  : [['pdf', 'PDF', 'Exactly as designed, for sharing and printing.']];
$('#fmts').innerHTML = FORMATS.map(([v, t, d], i) => `<label class="fmt"><input type="radio" name="fmt" value="${v}"${i === 0 ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('<div style="height:8px"></div>');
$('#fmts').hidden = FORMATS.length < 2;

let pinStatus = null;
const askPin = (change) => {
  $('#pintitle').textContent = change ? 'Change the download PIN' : 'Set the download PIN';
  $('#oldpinrow').hidden = !change;
  for (const id of ['oldpin', 'newpin', 'newpin2']) $(`#${id}`).value = '';
  $('#pinerr').textContent = '';
  $('#pindlg').showModal();
  $(change ? '#oldpin' : '#newpin').focus();
};
$('#pincancel').onclick = () => $('#pindlg').close();
$('#pinform').onsubmit = async (e) => {
  e.preventDefault();
  const a = $('#newpin').value.trim();
  if (!/^\d{4,8}$/.test(a)) return ($('#pinerr').textContent = 'The PIN must be 4 to 8 digits.');
  if (a !== $('#newpin2').value.trim()) return ($('#pinerr').textContent = 'The two PINs are not the same.');
  try {
    await api('/api/docs/pin', {newPin: a, pin: $('#oldpin').value.trim()});
    pinStatus = {set: true, thisPc: true};
    $('#pindlg').close();
    toast('Download PIN saved.');
    openDownload();
  } catch (err) {
    $('#pinerr').textContent = err.message;
  }
};
const openDownload = async () => {
  if (!current) return;
  try {
    pinStatus = await api('/api/docs/pin');
  } catch (err) {
    return toast(err.message, true);
  }
  if (!pinStatus.set) return askPin(false);
  $('#changepin').hidden = false;
  $('#dlerr').textContent = '';
  $('#pin').value = '';
  $('#dlgo').disabled = false;
  $('#dlgo').textContent = 'Download';
  $('#dldlg').showModal();
  $('#pin').focus();
};
$('#download').onclick = openDownload;
$('#dlcancel').onclick = () => $('#dldlg').close();
$('#changepin').onclick = () => {
  $('#dldlg').close();
  askPin(true);
};
$('#dlform').onsubmit = async (e) => {
  e.preventDefault();
  const pin = $('#pin').value.trim();
  if (!pin) return ($('#dlerr').textContent = 'Type the PIN.');
  const format = $('#fmts input:checked')?.value ?? FORMATS[0][0];
  if (editing) stopEditing();
  await save();
  $('#dlgo').disabled = true;
  $('#dlgo').textContent = 'Making the file…';
  $('#dlerr').textContent = '';
  try {
    const res = await call(`/api/docs/${current}/download`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({format, pin})});
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(cd)?.[1] ?? '') || `${meta?.title ?? 'download'}.${format === 'pdf' ? 'pdf' : 'pptx'}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    $('#dldlg').close();
    toast(`Downloaded ${name}`);
  } catch (err) {
    $('#dlerr').textContent = err.message;
    $('#pin').select();
  } finally {
    $('#dlgo').disabled = false;
    $('#dlgo').textContent = 'Download';
  }
};

// ---------------------------------------------------------------- start

window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && id !== current) openDoc(id);
});
// Nothing works without the helper: until it answers, the page explains how to start it.
let started = false;
const connect = async () => {
  try {
    const res = await fetch(`${API}/api/hello`, {cache: 'no-store'});
    if (!res.ok) throw new Error();
    const hello = await res.json();
    if (!hello.claude) toast('The helper is running, but Claude Code was not found on this PC.', true);
  } catch {
    $('#connect').hidden = false;
    $('#newview').hidden = $('#editview').hidden = true;
    $('#connstatus').textContent = `Not reachable yet (${new Date().toLocaleTimeString('en-GB')}). Checking again every few seconds…`;
    setTimeout(connect, 4000);
    return;
  }
  $('#connect').hidden = true;
  if (started) {
    // Back after the helper was away: show whichever view was open.
    $(current ? '#editview' : '#newview').hidden = false;
    return;
  }
  started = true;
  await loadList();
  const startId = decodeURIComponent(location.hash.slice(1));
  if (current) return;
  if (startId && docs.some((d) => d.id === startId)) openDoc(startId);
  else {
    $('#newview').hidden = false;
    $('#prompt').focus();
  }
};
$('#retry').onclick = connect;
$('#newview').hidden = true;
connect();
