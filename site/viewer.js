(() => {
  const $ = (s) => document.querySelector(s);
  const vp = $('#viewport'), world = $('#world'), svg = $('#edges'),
    nodesEl = $('#nodes'), groupsEl = $('#groups'), status = $('#status');
  const MIN = 0.1, MAX = 4;
  const PRESET = { 1: 'var(--c1)', 2: 'var(--c2)', 3: 'var(--c3)', 4: 'var(--c4)', 5: 'var(--c5)', 6: 'var(--c6)' };
  const col = (c) => (c ? PRESET[c] || c : null);
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

  let manifest = { canvases: [], files: [] };
  let byName = new Map(); // basename без .md → путь
  let view = { x: 0, y: 0, k: 1 }, bounds = null;

  // ---------- Markdown + KaTeX + wikilinks ----------
  marked.setOptions({ gfm: true, breaks: true });
  function renderMd(src) {
    src = src.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const math = [];
    const keep = (tex, display) => {
      try { math.push(katex.renderToString(tex, { displayMode: display, throwOnError: false })); }
      catch { math.push(tex); }
      return `\u0000M${math.length - 1}\u0000`;
    };
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true))
             .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, p, t) => p + keep(t, false));
    src = src.replace(/(!?)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, emb, target, _h, alias) => {
      const path = resolve(target.trim());
      if (emb && path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return `<img src="${enc(path)}" alt="">`;
      const label = (alias || target).replace(/</g, '&lt;');
      return path ? `<span class="wl" data-note="${path.replace(/"/g, '&quot;')}">${label}</span>`
                  : `<span class="wl dead">${label}</span>`;
    });
    let html = marked.parse(src);
    html = html.replace(/\u0000M(\d+)\u0000/g, (_, i) => math[+i]);
    // Obsidian callouts: > [!type] Title
    html = html.replace(/<blockquote>\s*<p>\[!(\w+)\][-+]?\s*([^<\n]*)(?:<br>)?/g,
      (_, type, title) => `<blockquote class="callout callout-${type}"><p><span class="callout-title">${title || type}</span><br>`);
    return html;
  }
  function resolve(name) {
    if (manifest.files.includes(name)) return name;
    if (manifest.files.includes(name + '.md')) return name + '.md';
    const base = name.split('/').pop().replace(/\.md$/, '');
    return byName.get(base) || null;
  }
  // путь из канваса может начинаться с корня волта — подрезаем до файла, который реально есть
  function resolveFile(p) {
    if (manifest.files.includes(p)) return p;
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const s = parts.slice(i).join('/');
      if (manifest.files.includes(s)) return s;
    }
    return null;
  }

  // ---------- Загрузка ----------
  async function init() {
    try { manifest = await (await fetch('manifest.json', { cache: 'no-cache' })).json(); } catch {}
    for (const f of manifest.files) if (f.endsWith('.md')) {
      const b = f.split('/').pop().slice(0, -3);
      if (!byName.has(b) || byName.get(b).startsWith('_старые/')) byName.set(b, f);
    }
    const pick = $('#pick');
    const list = manifest.canvases.length ? manifest.canvases : ['canvas.canvas'];
    for (const c of list) pick.add(new Option(c.replace(/\.canvas$/, ''), c));
    const q = new URLSearchParams(location.search).get('c');
    const start = q && list.includes(q) ? q : (list.find((c) => c.startsWith('Рода — структура')) || list[0]);
    pick.value = start;
    pick.onchange = () => load(pick.value, true);
    load(start, false);
  }

  async function load(path, push) {
    status.hidden = false; status.textContent = 'Загрузка…';
    nodesEl.innerHTML = groupsEl.innerHTML = svg.innerHTML = '';
    world.querySelectorAll('.elabel').forEach((e) => e.remove());
    if (push) history.replaceState(null, '', '?c=' + encodeURIComponent(path));
    $('#pick').value = path;
    let data;
    try {
      const r = await fetch(enc(path), { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
    } catch (e) { status.textContent = 'Не удалось загрузить ' + path + ' (' + e.message + ')'; return; }
    status.hidden = true;
    draw(data);
    fit();
  }

  function draw({ nodes = [], edges = [] }) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
      x1 = Math.max(x1, n.x + n.width); y1 = Math.max(y1, n.y + n.height);
      const el = document.createElement('div');
      Object.assign(el.style, { left: n.x + 'px', top: n.y + 'px', width: n.width + 'px', height: n.height + 'px' });
      if (n.color) { el.dataset.c = ''; el.style.setProperty('--nc', col(n.color)); }
      if (n.type === 'group') {
        el.className = 'group';
        if (n.label) { const l = document.createElement('div'); l.className = 'glabel'; l.textContent = n.label; el.append(l); }
        groupsEl.append(el); continue;
      }
      el.className = 'node md';
      if (n.type === 'text') el.innerHTML = renderMd(n.text || '');
      else if (n.type === 'link') el.innerHTML = `<a href="${n.url}" target="_blank" rel="noopener">${n.url}</a>`;
      else if (n.type === 'file') fileNode(el, n);
      nodesEl.append(el);
    }
    if (!nodes.length) { x0 = y0 = 0; x1 = y1 = 100; }
    bounds = { x0, y0, x1, y1 };

    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(NS, 'defs'); svg.append(defs);
    const markers = new Map();
    const marker = (c) => {
      if (markers.has(c)) return markers.get(c);
      const id = 'm' + markers.size;
      const m = document.createElementNS(NS, 'marker');
      m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 10 10'); m.setAttribute('refX', '9'); m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7'); m.setAttribute('orient', 'auto-start-reverse');
      m.setAttribute('markerUnits', 'strokeWidth');
      m.innerHTML = `<path d="M0,0 L10,5 L0,10 z" style="fill:${c}"/>`;
      defs.append(m); markers.set(c, id); return id;
    };
    for (const e of edges) {
      const a = byId.get(e.fromNode), b = byId.get(e.toNode);
      if (!a || !b) continue;
      const fs = e.fromSide || autoSide(a, b), ts = e.toSide || autoSide(b, a);
      const p1 = sidePt(a, fs), p2 = sidePt(b, ts);
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const off = Math.max(40, Math.min(d / 2, 250));
      const c1 = push(p1, fs, off), c2 = push(p2, ts, off);
      const c = col(e.color) || '#888';
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`);
      path.setAttribute('fill', 'none'); path.style.stroke = c; path.setAttribute('stroke-width', '3');
      if ((e.toEnd || 'arrow') === 'arrow') path.setAttribute('marker-end', `url(#${marker(c)})`);
      if ((e.fromEnd || 'none') === 'arrow') path.setAttribute('marker-start', `url(#${marker(c)})`);
      svg.append(path);
      if (e.label) {
        const t = 0.5, mt = 1 - t;
        const mx = mt ** 3 * p1.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * p2.x;
        const my = mt ** 3 * p1.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * p2.y;
        const l = document.createElement('div'); l.className = 'elabel'; l.textContent = e.label;
        l.style.left = mx + 'px'; l.style.top = my + 'px'; world.append(l);
      }
    }
  }
  const sidePt = (n, s) => ({
    top: { x: n.x + n.width / 2, y: n.y }, bottom: { x: n.x + n.width / 2, y: n.y + n.height },
    left: { x: n.x, y: n.y + n.height / 2 }, right: { x: n.x + n.width, y: n.y + n.height / 2 },
  })[s] || { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  const push = (p, s, o) => ({ x: p.x + (s === 'right' ? o : s === 'left' ? -o : 0), y: p.y + (s === 'bottom' ? o : s === 'top' ? -o : 0) });
  function autoSide(a, b) {
    const dx = b.x + b.width / 2 - (a.x + a.width / 2), dy = b.y + b.height / 2 - (a.y + a.height / 2);
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  }

  async function fileNode(el, n) {
    const p = resolveFile(n.file);
    const name = n.file.split('/').pop();
    if (!p) { el.classList.add('missing'); el.textContent = name + ' (не опубликован)'; return; }
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p)) {
      el.className = 'node img'; el.innerHTML = `<img src="${enc(p)}" alt="" loading="lazy" draggable="false">`; return;
    }
    if (p.endsWith('.canvas')) {
      el.innerHTML = `<div class="fname">Холст</div><a href="?c=${encodeURIComponent(p)}" data-canvas="${p}">${name}</a>`; return;
    }
    el.innerHTML = `<div class="fname">${name.replace(/\.md$/, '')}</div>`;
    try {
      const t = await (await fetch(enc(p))).text();
      el.innerHTML = renderMd(t);
      el.querySelector('h1')?.classList.add('fname-h');
      el.dataset.note = p;
    } catch { el.classList.add('missing'); }
  }

  // ---------- Панель заметки ----------
  async function openNote(path) {
    const panel = $('#panel');
    $('#ptitle').textContent = path.split('/').pop().replace(/\.md$/, '');
    $('#pbody').innerHTML = '…'; panel.hidden = false;
    try { $('#pbody').innerHTML = renderMd(await (await fetch(enc(path))).text()); $('#pbody').scrollTop = 0; }
    catch { $('#pbody').textContent = 'Не удалось загрузить'; }
  }
  $('#pclose').onclick = () => ($('#panel').hidden = true);
  document.addEventListener('click', (ev) => {
    if (moved) { ev.preventDefault(); ev.stopPropagation(); return; }
    const c = ev.target.closest('[data-canvas]');
    if (c) { ev.preventDefault(); load(c.dataset.canvas, true); return; }
    const w = ev.target.closest('.wl[data-note]');
    if (w) openNote(w.dataset.note);
  }, true);

  // ---------- Pan / zoom ----------
  const apply = () => {
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    const g = 24 * view.k;
    vp.style.backgroundSize = `${g}px ${g}px`; vp.style.backgroundPosition = `${view.x}px ${view.y}px`;
    $('#zoom').textContent = Math.round(view.k * 100) + '%';
  };
  function zoomAt(cx, cy, k) {
    k = Math.min(MAX, Math.max(MIN, k));
    view.x = cx - (cx - view.x) * (k / view.k); view.y = cy - (cy - view.y) * (k / view.k); view.k = k; apply();
  }
  function fit() {
    if (!bounds) return;
    const top = $('#bar').offsetHeight, pad = 40;
    const W = vp.clientWidth - pad * 2, H = vp.clientHeight - top - pad * 2;
    const bw = bounds.x1 - bounds.x0 + 60, bh = bounds.y1 - bounds.y0 + 60;
    view.k = Math.min(MAX, Math.max(MIN, Math.min(W / bw, H / bh)));
    view.x = pad + (W - bw * view.k) / 2 - (bounds.x0 - 30) * view.k;
    view.y = top + pad + (H - bh * view.k) / 2 - (bounds.y0 - 30) * view.k;
    apply();
  }
  $('#fit').onclick = fit;
  const center = () => [vp.clientWidth / 2, vp.clientHeight / 2];
  $('#zin').onclick = () => zoomAt(...center(), view.k * 1.25);
  $('#zout').onclick = () => zoomAt(...center(), view.k / 1.25);

  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) { view.x -= e.deltaX || e.deltaY; apply(); return; }
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX, e.clientY, view.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  const ptrs = new Map();
  let last = null, pinch = null, moved = false, downAt = null;
  vp.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { last = { x: e.clientX, y: e.clientY }; downAt = { ...last }; moved = false; }
    if (ptrs.size === 2) {
      const [p, q] = [...ptrs.values()];
      pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), k: view.k };
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!moved && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) {
      moved = true; vp.classList.add('drag'); try { vp.setPointerCapture(e.pointerId); } catch {}
    }
    if (ptrs.size >= 2 && pinch) {
      const [p, q] = [...ptrs.values()];
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      if (last) { view.x += mx - last.x; view.y += my - last.y; }
      last = { x: mx, y: my };
      zoomAt(mx, my, pinch.k * Math.hypot(p.x - q.x, p.y - q.y) / pinch.d);
      moved = true;
    } else if (moved && last) {
      view.x += e.clientX - last.x; view.y += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; apply();
    }
  });
  const up = (e) => {
    if (!ptrs.delete(e.pointerId)) return;
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 1) { const [p] = ptrs.values(); last = { ...p }; }
    if (!ptrs.size) { vp.classList.remove('drag'); last = null; downAt = null; setTimeout(() => (moved = false), 0); }
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('resize', apply);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#panel').hidden = true; });

  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const t = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
  };

  init();
})();
