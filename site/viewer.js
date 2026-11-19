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

    render({ nodes = [], edges = [] }, rel = null) {
      this.clear(); this.setStatus('');
      const byId = new Map(nodes.map((n) => [n.id, n]));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.width); y1 = Math.max(y1, n.y + n.height);
        const el = document.createElement('div');
        el.dataset.id = n.id;
        Object.assign(el.style, { left: n.x + 'px', top: n.y + 'px', width: n.width + 'px', height: n.height + 'px' });
        if (n.color) { el.dataset.c = ''; el.style.setProperty('--nc', col(n.color)); }
        const dim = rel && !rel.has(n.id);
        if (dim) el.classList.add('dim');
        if (n.type === 'group') {
          el.className = 'group';
          if (n.label) {
            const l = document.createElement('div'); l.className = 'glabel'; l.textContent = n.label;
            const p = resolve('Рода/' + groupName(n.label)) || null;
            if (p && !dim) { l.classList.add('wl'); l.dataset.link = p; }
            el.append(l);
          }
          this.groupsEl.append(el); continue;
        }
        el.className = 'node md' + (dim ? ' dim' : '') + (n.plaque ? ' plaque' : '');
        if (n.plaque) el.style.fontSize = Math.max(40, Math.min(140, Math.min(n.width / 7, n.height / 2.5))) + 'px';
        if (n.type === 'text' && dim) {
          el.textContent = (el.innerHTML = renderMd(n.text || ''), el.textContent); // только имя, без ссылок
        } else if (n.type === 'text') {
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
        let p1 = sidePt(a, fs), p2 = sidePt(b, ts);
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const off = Math.max(60, Math.min(d / 2, 250));
        let c1 = push(p1, fs, off), c2 = push(p2, ts, off);
        if (e.straight) { p1 = sidePt(a, ''); p2 = sidePt(b, ''); c1 = p1; c2 = p2; }
        const c = rel && !(rel.has(e.fromNode) && rel.has(e.toNode)) ? 'var(--dimline)' : col(e.color) || 'var(--muted)';
        const path = document.createElementNS(NS, 'path');
        path.dataset.a = e.fromNode; path.dataset.b = e.toNode;
        path.setAttribute('d', `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`);
        path.setAttribute('fill', 'none'); path.style.stroke = c; path.setAttribute('stroke-width', e.weight ? String(Math.min(36, 6 + e.weight * 5)) : '2.5');
        if (e.title) { const t = document.createElementNS(NS, 'title'); t.textContent = e.title; path.append(t); path.style.pointerEvents = 'stroke'; }
        path.setAttribute('stroke-linecap', 'round');
        if (e.dashed) { path.setAttribute('stroke-dasharray', '14 10'); path.classList.add('dashed'); }
        if ((e.toEnd || 'arrow') === 'arrow') path.setAttribute('marker-end', `url(#${marker(c)})`);
        if ((e.fromEnd || 'none') === 'arrow') path.setAttribute('marker-start', `url(#${marker(c)})`);
        this.svg.append(path);
        if (e.label) {
          const t = 0.5, mt = 0.5, f = (a, b, c, d) => mt ** 3 * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t ** 3 * d;
          const l = document.createElement('div'); l.className = 'elabel' + (e.weight ? ' big' : ''); l.textContent = e.label;
          l.dataset.a = e.fromNode; l.dataset.b = e.toNode;
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
    highlight(ids) {
      for (const el of [...this.nodesEl.children, ...this.groupsEl.children]) el.classList.toggle('faded', !!ids && !ids.has(el.dataset.id));
      for (const p of this.svg.querySelectorAll('path[data-a]')) p.classList.toggle('faded', !!ids && !(ids.has(p.dataset.a) && ids.has(p.dataset.b) && (ids.focus === p.dataset.a || ids.focus === p.dataset.b)));
      this.world.querySelectorAll('.elabel').forEach((l) => l.classList.toggle('faded', !!ids));
    }
    fitTo(ids) {
      const ns = [...this.nodesEl.children, ...this.groupsEl.children].filter((e) => ids.has(e.dataset.id));
      if (!ns.length) return this.fit();
      const save = this.bounds;
      this.bounds = { x0: Math.min(...ns.map((e) => e.offsetLeft)), y0: Math.min(...ns.map((e) => e.offsetTop)),
        x1: Math.max(...ns.map((e) => e.offsetLeft + e.offsetWidth)), y1: Math.max(...ns.map((e) => e.offsetTop + e.offsetHeight)) };
      this.fit(); this.bounds = save;
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
      // режим «стрелки по наведению»: показываем связи только у карточки под курсором (на тач-экране — по первому тапу)
      const lightUp = (id) => {
        if (this.lit === id) return; this.lit = id;
        const ends = new Set(id ? [id] : []);
        for (const p of this.world.querySelectorAll('[data-a]')) {
          const on = !!id && (p.dataset.a === id || p.dataset.b === id);
          p.classList.toggle('lit', on); if (on) { ends.add(p.dataset.a); ends.add(p.dataset.b); }
        }
        for (const n of this.nodesEl.children) n.classList.toggle('kin', !!id && ends.has(n.dataset.id) && n.dataset.id !== id);
      };
      vp.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse' || !document.body.classList.contains('hover-edges')) return;
        const n = e.target.closest('.node'); lightUp(n ? n.dataset.id : null);
      });
      vp.addEventListener('pointerleave', () => lightUp(null));
      vp.addEventListener('click', (e) => {
        if (this.moved) { e.preventDefault(); e.stopPropagation(); return; }
        if (document.body.classList.contains('hover-edges') && !matchMedia('(hover: hover)').matches) {
          const n = e.target.closest('.node'), id = n ? n.dataset.id : null;
          if (id !== this.lit) { lightUp(id); e.preventDefault(); e.stopPropagation(); return; } // второй тап — открыть
        }
        if (this.onPick) { const n = e.target.closest('.node'); if (this.onPick(n && n.dataset.id, e)) { e.preventDefault(); e.stopPropagation(); return; } }
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
  // какие узлы главного холста относятся к роду: его рамка, его люди, их прямые связи и рамки родов этих связей целиком
  function rodRelevant(data, rodPath, people) {
    const name = baseName(rodPath);
    const allGroups = data.nodes.filter((n) => n.type === 'group');
    const own = allGroups.filter((g) => groupName(g.label) === name);
    const inside = (n, g) => n !== g && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height;
    const outerOf = (n) => { let g = null; for (const q of allGroups) if (inside(n, q) && (!g || q.width * q.height > g.width * g.height)) g = q; return g; };
    const core = new Set();
    for (const n of data.nodes) {
      if (own.some((g) => g === n || inside(n, g))) core.add(n.id);
      else if (n.type !== 'group' && people.has(linkOf(n))) core.add(n.id);
    }
    if (!core.size) return null;
    const rel = new Set(core);
    const addGroup = (g) => { rel.add(g.id); for (const n of data.nodes) if (inside(n, g)) rel.add(n.id); };
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    for (const id of core) { const g = outerOf(byId.get(id)); if (g) addGroup(g); } // люди рода в чужих рамках
    for (const e of data.edges) {
      if (core.has(e.fromNode) === core.has(e.toNode)) continue;
      const nb = byId.get(core.has(e.fromNode) ? e.toNode : e.fromNode); if (!nb) continue;
      rel.add(nb.id); const g = outerOf(nb); if (g) addGroup(g);
    }
    return { rel, core };
  }

  // ---------- вид «Союзы»: род = одна плашка, связи между родами слиты в одну линию ----------
  const KIND = { '4': 'parent', '3': 'ancestor', '5': 'sibling', '2': 'marriage' };
  const kindOf = (c) => KIND[c] || (c && (c === '6' || /^#[cd]/i.test(c)) ? 'engagement' : 'other');
  const KIND_ORDER = ['marriage', 'engagement', 'parent', 'ancestor', 'sibling', 'other'];
  const KIND_COLOR = { marriage: '2', engagement: '#d350dc', parent: '4', ancestor: '3', sibling: '5', other: null };
  const KIND_NAME = { marriage: 'брак', engagement: 'помолвка', parent: 'родитель → ребёнок', ancestor: 'предок → потомок', sibling: 'братья и сёстры', other: 'другое' };
  function rodStructure(data) {
    const groups = data.nodes.filter((n) => n.type === 'group');
    const inside = (n, g) => n !== g && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height;
    const top = groups.filter((g) => !groups.some((q) => inside(g, q)));
    const ownerOf = new Map(), size = new Map();
    for (const n of data.nodes) {
      const g = top.find((q) => q === n || inside(n, q)); if (!g) continue;
      ownerOf.set(n.id, g.id); if (n.type !== 'group') size.set(g.id, (size.get(g.id) || 0) + 1);
    }
    const plaque = (g, compact) => {
      const name = groupName(g.label), rod = resolve('Рода/' + name);
      const text = rod ? `[[${rod.replace(/\.md$/, '')}|${g.label}]]` : g.label || '';
      if (!compact) return { id: g.id, type: 'text', plaque: true, x: g.x, y: g.y, width: g.width, height: g.height, color: g.color, text };
      // компактная плашка в центре рамки: ширина по имени, высота по числу людей
      const w = Math.max(220, Math.min(560, (g.label || '').length * 26 + 60)), h = Math.max(90, Math.min(220, 70 + (size.get(g.id) || 0) * 6));
      return { id: g.id, type: 'text', plaque: true, compact: true, x: g.x + g.width / 2 - w / 2, y: g.y + g.height / 2 - h / 2, width: w, height: h,
        color: g.color, text, members: size.get(g.id) || 0 };
    };
    return { top, ownerOf, plaque };
  }

  // «Союзы»: холст как есть, но в рамках остаются только люди, через которых идёт союз родов:
  // вошедший в род («Ирма (Крэбб)»), его супруг(а) и родня в родном роду; связи — только между ними
  function unionsView(data) {
    const { top, ownerOf } = rodStructure(data);
    const byName = top.map((g) => [groupName(g.label), g.id]);
    const rodOfSurname = (sur) => (byName.find(([nm]) => nm.startsWith(sur.slice(0, Math.max(4, sur.length - 1))) || sur.startsWith(nm.slice(0, -1))) || [])[1];
    const keep = new Set(), keepEdge = new Set();
    const adj = new Map();
    for (const e of data.edges) for (const [x, y] of [[e.fromNode, e.toNode], [e.toNode, e.fromNode]]) {
      if (!adj.has(x)) adj.set(x, []); adj.get(x).push([y, e]);
    }
    for (const n of data.nodes) {
      const g = n.type === 'text' && ownerOf.get(n.id); if (!g) continue;
      const from = [...(n.text || '').matchAll(/\(([А-ЯЁ][а-яё-]+(?: [А-ЯЁ][а-яё-]+)?)\)/g)].map((m) => rodOfSurname(m[1])).filter((r) => r && r !== g);
      if (!from.length) continue;
      keep.add(n.id);
      for (const [o, e] of adj.get(n.id) || []) {
        const k = kindOf(e.color), og = ownerOf.get(o);
        if (k === 'marriage' || k === 'engagement' || (og && og !== g)) { keep.add(o); keepEdge.add(e.id); } // супруг(а) и родня из другого рода
      }
    }
    for (const id of [...keep]) for (const [o, e] of adj.get(id) || []) { // родители и дети внутри рода — чтобы было видно, кто чей
      const k = kindOf(e.color); if ((k === 'parent' || k === 'ancestor') && ownerOf.get(o) === ownerOf.get(id)) keep.add(o);
    }
    for (const e of data.edges) { // браки и помолвки, прямо проведённые между родами
      const k = kindOf(e.color), ga = ownerOf.get(e.fromNode), gb = ownerOf.get(e.toNode);
      if ((k === 'marriage' || k === 'engagement') && ga !== gb) { keep.add(e.fromNode); keep.add(e.toNode); keepEdge.add(e.id); }
    }
    return {
      nodes: data.nodes.filter((n) => n.type === 'group' || keep.has(n.id)),
      edges: data.edges.filter((e) => keepEdge.has(e.id) || (keep.has(e.fromNode) && keep.has(e.toNode)))
        .map((e) => (keepEdge.has(e.id) && ownerOf.get(e.fromNode) !== ownerOf.get(e.toNode) && !['marriage', 'engagement'].includes(kindOf(e.color)) ? { ...e, dashed: true } : e)), // откуда пришёл — пунктиром
    };
  }

  // «Карта»: только рамки родов на своих местах, без связей — чистое положение по двум осям
  function mapView(data) { const { top, plaque } = rodStructure(data); return { nodes: top.map((g) => plaque(g, false)), edges: [] }; }

  // ---------- UI ----------
  const host = $('#host'), page = $('#page');
  const main = new CanvasView(host, (k) => ($('#zoom').textContent = Math.round(k * 100) + '%'));
  let mainPath = null;
  $('#fit').onclick = () => main.fit();
  $('#zin').onclick = () => main.zoomBy(1.25);
  $('#zout').onclick = () => main.zoomBy(1 / 1.25);
  $('#pick').onchange = (e) => (location.hash = href.canvas(e.target.value));
  const setEdges = (h) => {
    document.body.classList.toggle('hover-edges', h);
    $('#edgesmode').textContent = h ? 'Стрелки: по наведению' : 'Стрелки: все';
    try { localStorage.setItem('edges', h ? 'hover' : 'all'); } catch {}
  };
  $('#edgesmode').onclick = () => setEdges(!document.body.classList.contains('hover-edges'));
  try { setEdges(localStorage.getItem('edges') === 'hover'); } catch { setEdges(false); }
  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const t = cur === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch {}
  };
  window.addEventListener('resize', () => main.apply());

  let mainData = null;
  function renderUnions() { main.render(unionsView(mainData)); }

  async function showCanvas(path, focus, mode) {
    page.hidden = true; host.hidden = false; $('#cvctl').hidden = false;
    $('#pick').value = path; document.title = baseName(path) + ' · Роды';
    const isMain = path === MAIN;
    mode = !isMain || focus ? 'people' : ['map', 'people'].includes(mode) ? mode : 'unions'; // посторонний сначала видит рода
    $('#modes').hidden = !isMain; $('#axes').hidden = !isMain; $('#legend').hidden = !isMain; $('#years').hidden = !isMain;
    const year = new URLSearchParams(location.hash.split('?')[1] || '').get('year') || '';
    document.querySelectorAll('#years button').forEach((b) => b.classList.toggle('on', b.dataset.y === year));
    $('#host').dataset.year = year; // сюда потом подключим «кто жив в этот год»
    document.querySelectorAll('#modes a').forEach((a) => {
      a.classList.toggle('on', a.dataset.mode === mode);
      const y = new URLSearchParams(location.hash.split('?')[1] || '').get('year');
      a.href = href.canvas(MAIN) + '?mode=' + a.dataset.mode + (y ? '&year=' + y : '');
    });
    $('#host').dataset.mode = mode;  if (mode === 'map') $('#legend').hidden = true;
    if (mainPath !== path + mode) {
      mainPath = path + mode; main.clear(); main.setStatus('Загрузка…');
      let data;
      try { data = await getJSON(path); } catch (e) { main.setStatus('Не удалось загрузить ' + path); return; }
      if (mainPath !== path + mode) return;
      mainData = data;
      main.render(mode === 'unions' ? unionsView(data) : mode === 'map' ? mapView(data) : data);
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
      const r = rodRelevant(mainData, path, people);
      if (r) {
        const sec = document.createElement('section');
        sec.innerHTML = '<h2>Связи рода</h2><div class="mini"><div class="mini-ctl"><button data-a="in">+</button><button data-a="out">−</button><button data-a="fit">⤢</button></div><div class="mini-cv" style="height:100%"></div></div>';
        $('h1', art).after(sec);
        const cv = new CanvasView($('.mini-cv', sec), null, 0.03);
        cv.render(mainData, r.rel);
        const fitRel = () => cv.fitTo(r.rel);
        requestAnimationFrame(fitRel);
        $('.mini-ctl', sec).onclick = (e) => { const a = e.target.dataset.a; a === 'in' ? cv.zoomBy(1.25) : a === 'out' ? cv.zoomBy(0.8) : a === 'fit' && fitRel(); };
      }
    }
  }

  function route() {
    const [p, q = ''] = location.hash.slice(1).split('?');
    const focus = new URLSearchParams(q).get('focus');
    const m = /^\/(n|c)\/(.+)$/.exec(p);
    if (m) {
      const path = decodeURIComponent(m[2]);
      return m[1] === 'n' ? showNote(path) : showCanvas(path, focus, new URLSearchParams(q).get('mode'));
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
    $('#modes').innerHTML = `<a data-mode="map" href="${href.canvas(MAIN)}?mode=map">Карта</a><a data-mode="unions" href="${href.canvas(MAIN)}?mode=unions">Союзы родов</a><a data-mode="people" href="${href.canvas(MAIN)}?mode=people">Люди</a>`;
    // годы: пока только выбор и адрес; кто жив в этот год — следующая задача
    const YEARS = ['1991', '1992', '1993', '1994', '1995', '1996', '1997', '1998', '2017'];
    $('#years').innerHTML = '<span>Год:</span><button data-y="">все</button>' + YEARS.map((y) => `<button data-y="${y}">${y}</button>`).join('');
    $('#years').onclick = (e) => {
      const y = e.target.dataset && e.target.dataset.y; if (y === undefined) return;
      const [p, q = ''] = location.hash.slice(1).split('?'); const sp = new URLSearchParams(q);
      y ? sp.set('year', y) : sp.delete('year');
      location.hash = (p || '/c/' + encodeURI(MAIN)) + (sp.toString() ? '?' + sp : '');
    };
    $('#legend').innerHTML = '<summary>Легенда</summary>' + ['marriage', 'engagement', 'parent', 'ancestor', 'sibling']
      .map((k) => `<div><i style="background:${col(KIND_COLOR[k])}"></i>${KIND_NAME[k]}</div>`).join('') +
      '<p>В «Союзах» в рамках оставлены только те, кто вошёл в род из другого рода (девичья фамилия в скобках), и их супруги. Пунктир ведёт к родне в родном роду.</p>';
    const legacy = new URLSearchParams(location.search).get('c'); // старые ссылки ?c=
    if (legacy) history.replaceState(null, '', location.pathname + href.canvas(legacy));
    window.addEventListener('hashchange', route);
    route();
  }
  init();
})();
