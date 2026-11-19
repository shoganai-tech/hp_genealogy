(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const MAIN = 'Рода — структура.canvas';
  const MIN = 0.1, MAX = 4;
  const PRESET = { 1: 'var(--c1)', 2: 'var(--c2)', 3: 'var(--c3)', 4: 'var(--c4)', 5: 'var(--c5)', 6: 'var(--c6)' };
  const col = (c) => (c ? PRESET[c] || c : null);
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const baseName = (p) => p.split('/').pop().replace(/\.(md|canvas)$/, '');
  const groupName = (l) => (l || '').split('·')[0].replace(/ /g, ' ').trim();

  let manifest = { canvases: [], files: [] };
  const fileSet = new Set(), byName = new Map(), cache = new Map();
  const getText = (p) => {
    if (!cache.has(p)) cache.set(p, fetch(enc(p), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(r.status); return r.text();
    }));
    return cache.get(p);
  };
  const getJSON = async (p) => JSON.parse(await getText(p));

  // ---------- ссылки ----------
  const href = { note: (p) => '#/n/' + encodeURI(p), canvas: (p, focus) => '#/c/' + encodeURI(p) + (focus ? '?focus=' + encodeURIComponent(focus) : '') };
  // всё сравниваем в NFC: macOS отдаёт имена файлов в NFD («й», «ё» разложены)
  const nfc = (s) => s.normalize('NFC');
  function resolve(name) {
    name = nfc(name);
    if (fileSet.has(name)) return name;
    if (fileSet.has(name + '.md')) return name + '.md';
    return byName.get(name.split('/').pop().replace(/\.md$/, '')) || null;
  }
  function resolveFile(p) { // пути из канваса могут идти от корня волта
    const parts = nfc(p).split('/');
    for (let i = 0; i < parts.length; i++) { const s = parts.slice(i).join('/'); if (fileSet.has(s)) return s; }
    return null;
  }

  // ---------- Markdown + KaTeX + wikilinks ----------
  marked.setOptions({ gfm: true, breaks: true });
  function renderMd(src) {
    src = src.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const math = [];
    const keep = (tex, display) => {
      try { math.push(katex.renderToString(tex, { displayMode: display, throwOnError: false })); } catch { math.push(esc(tex)); }
      return `\u0000M${math.length - 1}\u0000`;
    };
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true))
             .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, p, t) => p + keep(t, false));
    src = src.replace(/(!?)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, emb, target, _h, alias) => {
      const path = resolve(target.trim());
      if (emb && path && /\.(png|jpe?g|gif|webp|svg)$/i.test(path)) return `<img src="${enc(path)}" alt="">`;
      const label = esc(alias || target);
      if (!path) return `<span class="wl dead">${label}</span>`;
      return path.endsWith('.canvas') ? `<a class="wl" href="${href.canvas(path)}">${label}</a>`
                                      : `<a class="wl" href="${href.note(path)}" data-note="${esc(path)}">${label}</a>`;
    });
    let html = marked.parse(src).replace(/\u0000M(\d+)\u0000/g, (_, i) => math[+i]);
    html = html.replace(/<blockquote>\s*<p>\[!(\w+)\][-+]?\s*([^<\n]*)(?:<br>)?/g,
      (_, type, title) => `<blockquote class="callout callout-${type}"><p><span class="callout-title">${title || type}</span><br>`);
    return html;
  }

  // ---------- Холст ----------
  const NS = 'http://www.w3.org/2000/svg';
  class CanvasView {
    constructor(host, onZoom, min = MIN) {
      this.min = min;
      this.onZoom = onZoom || (() => {});
      this.view = { x: 0, y: 0, k: 1 };
      host.innerHTML = '<div class="cv"><div class="world"><div class="groups"></div><svg width="1" height="1"></svg><div class="nodes"></div></div><div class="status" hidden></div></div>';
      this.vp = $('.cv', host); this.world = $('.world', host); this.svg = $('svg', host);
      this.nodesEl = $('.nodes', host); this.groupsEl = $('.groups', host); this.status = $('.status', host);
      this.bindInput();
    }
    setStatus(t) { this.status.hidden = !t; this.status.textContent = t || ''; }
    clear() { this.nodesEl.innerHTML = this.groupsEl.innerHTML = this.svg.innerHTML = ''; this.world.querySelectorAll('.elabel').forEach((e) => e.remove()); }

    render({ nodes = [], edges = [] }) {
      this.clear(); this.setStatus('');
      const byId = new Map(nodes.map((n) => [n.id, n]));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.width); y1 = Math.max(y1, n.y + n.height);
        const el = document.createElement('div');
        Object.assign(el.style, { left: n.x + 'px', top: n.y + 'px', width: n.width + 'px', height: n.height + 'px' });
        if (n.color) { el.dataset.c = ''; el.style.setProperty('--nc', col(n.color)); }
        if (n.type === 'group') {
          el.className = 'group';
          if (n.label) {
            const l = document.createElement('div'); l.className = 'glabel'; l.textContent = n.label;
            const p = resolve('Рода/' + groupName(n.label)) || null;
            if (p) { l.classList.add('wl'); l.dataset.link = p; }
            el.append(l);
          }
          this.groupsEl.append(el); continue;
        }
        el.className = 'node md' + (n.ext ? ' ext' : '');
        if (n.type === 'text') {
          el.innerHTML = renderMd(n.text || '');
          const links = el.querySelectorAll('.wl[data-note]');
          if (links.length) { el.classList.add('card'); el.dataset.link = links[0].dataset.note; }
          if ((n.text || '').length > 200) el.classList.add('long');
        } else if (n.type === 'link') el.innerHTML = `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.url)}</a>`;
        else if (n.type === 'file') this.fileNode(el, n);
        this.nodesEl.append(el);
      }
      if (!nodes.length) { x0 = y0 = 0; x1 = y1 = 100; }
      this.bounds = { x0, y0, x1, y1 };

      const defs = document.createElementNS(NS, 'defs'); this.svg.append(defs);
      const markers = new Map(), uid = Math.random().toString(36).slice(2, 7);
      const marker = (c) => {
        if (markers.has(c)) return markers.get(c);
        const id = `m${uid}${markers.size}`, m = document.createElementNS(NS, 'marker');
        for (const [k, v] of Object.entries({ id, viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 12, markerHeight: 12,
          orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' })) m.setAttribute(k, v);
        m.innerHTML = `<path d="M0,1 L10,5 L0,9 z" style="fill:${c}"/>`;
        defs.append(m); markers.set(c, id); return id;
      };
      for (const e of edges) {
        const a = byId.get(e.fromNode), b = byId.get(e.toNode);
        if (!a || !b) continue;
        let fs = e.fromSide || autoSide(a, b), ts = e.toSide || autoSide(b, a);
        // узлы налезают друг на друга по оси — стрелка сделала бы петлю; переводим на другую пару сторон
        const H = { left: 1, right: 1 };
        if (H[fs] && H[ts] && fs !== ts && (fs === 'left' ? b.x + b.width > a.x : b.x < a.x + a.width) && (fs === 'left') === (b.x < a.x)) {
          const down = b.y > a.y; fs = down ? 'bottom' : 'top'; ts = down ? 'top' : 'bottom';
        } else if (!H[fs] && !H[ts] && fs !== ts && (fs === 'top' ? b.y + b.height > a.y : b.y < a.y + a.height) && (fs === 'top') === (b.y < a.y)) {
          const right = b.x > a.x; fs = right ? 'right' : 'left'; ts = right ? 'left' : 'right';
        }
        const p1 = sidePt(a, fs), p2 = sidePt(b, ts);
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const off = Math.max(60, Math.min(d / 2, 250));
        const c1 = push(p1, fs, off), c2 = push(p2, ts, off);
        const c = col(e.color) || 'var(--muted)';
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`);
        path.setAttribute('fill', 'none'); path.style.stroke = c; path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        if ((e.toEnd || 'arrow') === 'arrow') path.setAttribute('marker-end', `url(#${marker(c)})`);
        if ((e.fromEnd || 'none') === 'arrow') path.setAttribute('marker-start', `url(#${marker(c)})`);
        this.svg.append(path);
        if (e.label) {
          const t = 0.5, mt = 0.5, f = (a, b, c, d) => mt ** 3 * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t ** 3 * d;
          const l = document.createElement('div'); l.className = 'elabel'; l.textContent = e.label;
          l.style.left = f(p1.x, c1.x, c2.x, p2.x) + 'px'; l.style.top = f(p1.y, c1.y, c2.y, p2.y) + 'px';
          this.world.append(l);
        }
      }
    }
    async fileNode(el, n) {
      const p = resolveFile(n.file), name = n.file.split('/').pop();
      if (!p) { el.classList.add('missing'); el.textContent = name + ' (не опубликован)'; return; }
      if (/\.(png|jpe?g|gif|webp|svg)$/i.test(p)) { el.className = 'node img'; el.innerHTML = `<img src="${enc(p)}" alt="" loading="lazy" draggable="false">`; return; }
      if (p.endsWith('.canvas')) { el.innerHTML = `Холст: <a class="wl" href="${href.canvas(p)}">${esc(baseName(p))}</a>`; return; }
      el.classList.add('long'); el.dataset.link = p;
      try { el.innerHTML = renderMd(await getText(p)); } catch { el.classList.add('missing'); el.textContent = name; }
    }

    apply() {
      const { x, y, k } = this.view;
      this.world.style.transform = `translate(${x}px,${y}px) scale(${k})`;
      this.vp.style.backgroundSize = `${24 * k}px ${24 * k}px`; this.vp.style.backgroundPosition = `${x}px ${y}px`;
      this.onZoom(k);
    }
    zoomAt(cx, cy, k) {
      const v = this.view; k = Math.min(MAX, Math.max(this.min, k));
      v.x = cx - (cx - v.x) * (k / v.k); v.y = cy - (cy - v.y) * (k / v.k); v.k = k; this.apply();
    }
    zoomBy(f) { this.zoomAt(this.vp.clientWidth / 2, this.vp.clientHeight / 2, this.view.k * f); }
    fit() {
      const b = this.bounds; if (!b) return;
      const pad = 30, W = this.vp.clientWidth - pad * 2, H = this.vp.clientHeight - pad * 2;
      const bw = b.x1 - b.x0 + 80, bh = b.y1 - b.y0 + 80; // +80: подписи групп над рамкой
      const k = Math.min(MAX, Math.max(this.min, Math.min(W / bw, H / bh, 1.2)));
      this.view = { k, x: pad + (W - bw * k) / 2 - (b.x0 - 40) * k, y: pad + (H - bh * k) / 2 - (b.y0 - 60) * k };
      this.apply();
    }
    focus(link) {
      const el = [...this.nodesEl.querySelectorAll('.node')].find((n) => n.dataset.link === link);
      if (!el) return false;
      const x = el.offsetLeft + el.offsetWidth / 2, y = el.offsetTop + el.offsetHeight / 2, k = 1;
      this.view = { k, x: this.vp.clientWidth / 2 - x * k, y: this.vp.clientHeight / 2 - y * k };
      this.apply();
      this.nodesEl.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl'));
      el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 2500);
      return true;
    }

    bindInput() {
      const vp = this.vp, ptrs = new Map();
      let last = null, pinch = null, downAt = null;
      this.moved = false;
      vp.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.shiftKey) { this.view.x -= e.deltaX || e.deltaY; this.apply(); return; }
        const r = vp.getBoundingClientRect(), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, this.view.k * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
      }, { passive: false });
      vp.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) { last = { x: e.clientX, y: e.clientY }; downAt = { ...last }; this.moved = false; }
        if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), k: this.view.k }; }
      });
      window.addEventListener('pointermove', (e) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!this.moved && downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) {
          this.moved = true; vp.classList.add('drag');
        }
        const r = vp.getBoundingClientRect();
        if (ptrs.size >= 2 && pinch) {
          const [p, q] = [...ptrs.values()], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          if (last) { this.view.x += mx - last.x; this.view.y += my - last.y; }
          last = { x: mx, y: my };
          this.zoomAt(mx - r.left, my - r.top, pinch.k * Math.hypot(p.x - q.x, p.y - q.y) / pinch.d);
          this.moved = true;
        } else if (this.moved && last) {
          this.view.x += e.clientX - last.x; this.view.y += e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; this.apply();
        }
      });
      const up = (e) => {
        if (!ptrs.delete(e.pointerId)) return;
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 1) { const [p] = ptrs.values(); last = { ...p }; }
        if (!ptrs.size) { vp.classList.remove('drag'); last = downAt = null; setTimeout(() => (this.moved = false), 0); }
      };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      vp.addEventListener('click', (e) => {
        if (this.moved) { e.preventDefault(); e.stopPropagation(); return; }
        if (e.target.closest('a')) return; // обычная ссылка внутри карточки
        const t = e.target.closest('[data-link]');
        if (t) location.hash = href.note(t.dataset.link);
      }, true);
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

  // ---------- подграф рода ----------
  function linkOf(n) {
    const m = n.type === 'text' && /\[\[([^\]|#]+)/.exec(n.text || '');
    return m ? resolve(m[1].trim()) : n.type === 'file' ? resolveFile(n.file) : null;
  }
  function rodSubgraph(data, rodPath, people) {
    const name = baseName(rodPath);
    const allGroups = data.nodes.filter((n) => n.type === 'group');
    const own = allGroups.filter((g) => groupName(g.label) === name);
    const inside = (n, g) => n !== g && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height;
    const ownerOf = (n) => allGroups.filter((g) => inside(n, g)).sort((a, b) => a.width * a.height - b.width * b.height)[0];

    // ядро рода: всё внутри его рамки + люди из заметки рода, где бы они ни стояли
    const core = new Set();
    for (const n of data.nodes) {
      if (own.some((g) => inside(n, g))) core.add(n.id);
      else if (n.type !== 'group' && people.has(linkOf(n))) core.add(n.id);
    }
    if (!core.size) return null;
    const byId = new Map(data.nodes.map((n) => [n.id, n]));

    // соседи по связям → их рода целиком (рамка со всем содержимым), либо одиночная карточка
    const blocks = new Map(); // key → Set(id)
    const addBlock = (key, ids) => { if (!blocks.has(key)) blocks.set(key, new Set()); ids.forEach((i) => blocks.get(key).add(i)); };
    for (const e of data.edges) {
      const [inA, inB] = [core.has(e.fromNode), core.has(e.toNode)];
      if (inA === inB) continue;
      const nb = byId.get(inA ? e.toNode : e.fromNode); if (!nb) continue;
      let g = ownerOf(nb);
      while (g && ownerOf(g) && !own.includes(ownerOf(g))) g = ownerOf(g); // самая внешняя рамка
      if (g && !own.includes(g)) addBlock(g.id, [g.id, ...data.nodes.filter((n) => inside(n, g)).map((n) => n.id)]);
      else addBlock(nb.id, [nb.id]);
    }
    // люди рода, стоящие в чужих рамках (замужние и т.п.), тоже переезжают к роду
    for (const id of core) {
      const n = byId.get(id);
      if (!own.some((g) => inside(n, g)) && n.type !== 'group') addBlock(id, [id]);
    }

    const clone = (n) => ({ ...n });
    const innerNodes = data.nodes.filter((n) => own.includes(n) || own.some((g) => inside(n, g))).map(clone);
    const inner = innerNodes.length ? innerNodes : [...core].map((id) => clone(byId.get(id)));
    const out = [...inner];
    const used = new Set(out.map((n) => n.id));
    const bbox = (ns) => ({ x0: Math.min(...ns.map((n) => n.x)), y0: Math.min(...ns.map((n) => n.y) ) - 50,
      x1: Math.max(...ns.map((n) => n.x + n.width)), y1: Math.max(...ns.map((n) => n.y + n.height)) });
    const B = bbox(inner), cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, M = 160, GAP = 60;
    const placed = [B];
    const hits = (r) => placed.some((q) => r.x0 < q.x1 + GAP && q.x0 < r.x1 + GAP && r.y0 < q.y1 + GAP && q.y0 < r.y1 + GAP);

    const list = [...blocks.entries()].map(([key, ids]) => {
      const ns = [...ids].filter((i) => !used.has(i)).map((i) => clone(byId.get(i))).filter(Boolean);
      return { key, ns, r: ns.length && bbox(ns) };
    }).filter((b) => b.ns.length)
      .sort((a, b) => Math.atan2((a.r.y0 + a.r.y1) / 2 - cy, (a.r.x0 + a.r.x1) / 2 - cx) - Math.atan2((b.r.y0 + b.r.y1) / 2 - cy, (b.r.x0 + b.r.x1) / 2 - cx));
    // раскладка: каждый блок уходит на ту сторону от рода, куда он смотрел на большом холсте
    const sides = { top: [], right: [], bottom: [], left: [] };
    for (const b of list) {
      b.ns = b.ns.filter((n) => !used.has(n.id)); if (!b.ns.length) continue;
      b.ns.forEach((n) => used.add(n.id));
      b.r = bbox(b.ns);
      const dx = ((b.r.x0 + b.r.x1) / 2 - cx) / (B.x1 - B.x0 || 1), dy = ((b.r.y0 + b.r.y1) / 2 - cy) / (B.y1 - B.y0 || 1);
      sides[Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top')].push(b);
    }
    const put = (b, nx, ny) => {
      const ox = nx - b.r.x0, oy = ny - b.r.y0;
      for (const n of b.ns) { n.x += ox; n.y += oy; if (n.type !== 'group' && !core.has(n.id)) n.ext = true; out.push(n); }
    };
    const W = (b) => b.r.x1 - b.r.x0, Hh = (b) => b.r.y1 - b.r.y0;
    // лево/право — колонками, сверху вниз по исходному y
    for (const side of ['left', 'right']) {
      const col = sides[side].sort((a, b) => a.r.y0 - b.r.y0);
      const total = col.reduce((s, b) => s + Hh(b) + GAP, -GAP);
      let y = cy - total / 2;
      for (const b of col) { put(b, side === 'left' ? B.x0 - M - W(b) : B.x1 + M, y); y += Hh(b) + GAP; }
    }
    // верх/низ — рядами, слева направо по исходному x
    for (const side of ['top', 'bottom']) {
      const row = sides[side].sort((a, b) => a.r.x0 - b.r.x0);
      const total = row.reduce((s, b) => s + W(b) + GAP, -GAP);
      let x = cx - total / 2;
      for (const b of row) { put(b, x, side === 'top' ? B.y0 - M - Hh(b) : B.y1 + M); x += W(b) + GAP; }
    }
    const ids = new Set(out.map((n) => n.id));
    return { nodes: out, edges: data.edges.filter((e) => ids.has(e.fromNode) && ids.has(e.toNode)) };
  }

  // ---------- UI ----------
  const host = $('#host'), page = $('#page');
  const main = new CanvasView(host, (k) => ($('#zoom').textContent = Math.round(k * 100) + '%'));
  let mainPath = null;
  $('#fit').onclick = () => main.fit();
  $('#zin').onclick = () => main.zoomBy(1.25);
  $('#zout').onclick = () => main.zoomBy(1 / 1.25);
  $('#pick').onchange = (e) => (location.hash = href.canvas(e.target.value));
  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const t = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
  };
  window.addEventListener('resize', () => main.apply());

  async function showCanvas(path, focus) {
    page.hidden = true; host.hidden = false; $('#cvctl').hidden = false;
    $('#pick').value = path; document.title = baseName(path) + ' · Роды';
    if (mainPath !== path) {
      mainPath = path; main.clear(); main.setStatus('Загрузка…');
      let data;
      try { data = await getJSON(path); } catch (e) { main.setStatus('Не удалось загрузить ' + path); return; }
      if (mainPath !== path) return;
      main.render(data);
      if (!focus) main.fit();
    }
    if (focus && !main.focus(focus)) main.fit();
  }

  async function showNote(path) {
    host.hidden = true; page.hidden = false; $('#cvctl').hidden = true; $('#pick').selectedIndex = -1;
    const title = baseName(path); document.title = title + ' · Роды';
    page.innerHTML = '<div class="article"><p style="color:var(--muted)">Загрузка…</p></div>';
    page.scrollTop = 0;
    let raw;
    try { raw = await getText(path); } catch { page.innerHTML = `<div class="article"><h1>${esc(title)}</h1><p>Заметка не найдена.</p></div>`; return; }

    const isRod = path.startsWith('Рода/');
    const rodM = /\*\*Род:\*\*\s*\[\[([^\]|#]+)/.exec(raw);
    const rod = !isRod && rodM ? resolve(rodM[1].trim()) : null;
    const mainData = await getJSON(MAIN).catch(() => null);
    const onMain = mainData && mainData.nodes.some((n) => linkOf(n) === path);

    const crumbs = [`<a href="${href.canvas(MAIN)}">${esc(baseName(MAIN))}</a>`];
    if (isRod) crumbs.push('<span>Рода</span>');
    if (rod) crumbs.push(`<a href="${href.note(rod)}">${esc(baseName(rod))}</a>`);
    const actions = [];
    if (rod) actions.push(`<a class="btn" href="${href.note(rod)}">↩ Род: ${esc(baseName(rod))}</a>`);
    if (onMain) actions.push(`<a class="btn" href="${href.canvas(MAIN, path)}">◎ Показать на холсте</a>`);

    page.innerHTML = `<div class="article"><nav class="crumbs">${crumbs.join(' › ')} › <span>${esc(title)}</span></nav>
      <div class="actions">${actions.join('')}</div><article class="md">${renderMd(raw)}</article></div>`;
    const art = $('article', page);
    if (!$('h1', art)) art.insertAdjacentHTML('afterbegin', `<h1>${esc(title)}</h1>`);

    if (isRod && mainData) {
      const sect = (/^## Люди[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(raw) || [, ''])[1];
      const people = new Set([...sect.matchAll(/\[\[([^\]|#]+)/g)].map((m) => resolve(m[1].trim())).filter(Boolean));
      const sub = rodSubgraph(mainData, path, people);
      if (sub) {
        const sec = document.createElement('section');
        sec.innerHTML = '<h2>Связи рода</h2><div class="mini"><div class="mini-ctl"><button data-a="in">+</button><button data-a="out">−</button><button data-a="fit">⤢</button></div><div class="mini-cv" style="height:100%"></div></div>';
        $('h1', art).after(sec);
        const cv = new CanvasView($('.mini-cv', sec), null, 0.03);
        cv.render(sub); requestAnimationFrame(() => cv.fit());
        $('.mini-ctl', sec).onclick = (e) => { const a = e.target.dataset.a; a === 'in' ? cv.zoomBy(1.25) : a === 'out' ? cv.zoomBy(0.8) : a === 'fit' && cv.fit(); };
      }
    }
  }

  function route() {
    const [p, q = ''] = location.hash.slice(1).split('?');
    const focus = new URLSearchParams(q).get('focus');
    const m = /^\/(n|c)\/(.+)$/.exec(p);
    if (m) {
      const path = decodeURIComponent(m[2]);
      return m[1] === 'n' ? showNote(path) : showCanvas(path, focus);
    }
    showCanvas(MAIN);
  }

  async function init() {
    try { manifest = await (await fetch('manifest.json', { cache: 'no-cache' })).json(); } catch {}
    for (const f of manifest.files) {
      fileSet.add(f);
      if (f.endsWith('.md')) { const b = baseName(f); if (!byName.has(b) || byName.get(b).startsWith('_старые/')) byName.set(b, f); }
    }
    for (const c of manifest.canvases) $('#pick').add(new Option(baseName(c), c));
    const legacy = new URLSearchParams(location.search).get('c'); // старые ссылки ?c=
    if (legacy) history.replaceState(null, '', location.pathname + href.canvas(legacy));
    window.addEventListener('hashchange', route);
    route();
  }
  init();
})();
