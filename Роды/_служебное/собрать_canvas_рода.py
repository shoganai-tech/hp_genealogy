# -*- coding: utf-8 -*-
# Один большой холст: рамка на каждый род, внутри карточки людей (по поколениям), между ними стрелки родства.
import os, sys, json, io, contextlib, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
with contextlib.redirect_stdout(io.StringIO()):
    import собрать_роды as R
by, spouse, sibs, ROOT, PEOPLE = R.by, R.spouse, R.sibs, R.ROOT, R.PEOPLE
S = set(by)

# поколения
gen = {n: 0 for n in S}
for _ in range(80):
    ch = False
    for n in S:
        v = gen[n]
        for par in (by[n]["father"], by[n]["mother"]):
            if par: v = max(v, gen[par] + 1)
        for s in spouse[n] | sibs[n]: v = max(v, gen[s])
        if v != gen[n]: gen[n] = v; ch = True
    if not ch: break

rods = {}
for p in PEOPLE: rods.setdefault(p["rod"], []).append(p["name"])
# связность родов
adj = {r: {} for r in rods}
def addadj(a, b):
    ra, rb = by[a]["rod"], by[b]["rod"]
    if ra != rb:
        adj[ra][rb] = adj[ra].get(rb, 0) + 1; adj[rb][ra] = adj[rb].get(ra, 0) + 1
for n in S:
    for par in (by[n]["father"], by[n]["mother"]):
        if par: addadj(par, n)
    for s in spouse[n]: addadj(n, s)
# порядок: жадно, сначала самые связные
order = []
left = set(rods)
cur = max(rods, key=lambda r: sum(adj[r].values()))
while left:
    order.append(cur); left.discard(cur)
    if not left: break
    cand = max(left, key=lambda r: (sum(adj[r].get(o, 0) for o in order[-4:]), sum(adj[r].values())))
    cur = cand

CW, CH, GAPX, GAPY, PAD, HEAD = 270, 72, 26, 20, 30, 56
COLS = 3
sizes, inner = {}, {}
for r in rods:
    members = rods[r]
    rows = {}
    for n in members: rows.setdefault(gen[n], []).append(n)
    cells, y = {}, 0
    maxc = 1
    for g in sorted(rows):
        ms = sorted(rows[g])
        for i, n in enumerate(ms):
            cells[n] = ((i % COLS), y + i // COLS)
        used = min(COLS, len(ms)); maxc = max(maxc, used)
        y += math.ceil(len(ms) / COLS)
    inner[r] = cells
    sizes[r] = (maxc * (CW + GAPX) - GAPX + 2 * PAD, y * (CH + GAPY) - GAPY + 2 * PAD + HEAD)

# упаковка по полкам
MAXW, GX, GY = 4700, 90, 110
pos = {}
x = y = rowh = 0
for r in order:
    w, h = sizes[r]
    if x and x + w > MAXW:
        x, y, rowh = 0, y + rowh + GY, 0
    pos[r] = (x, y); x += w + GX; rowh = max(rowh, h)

COLOR = {"н": "1", "с": "3", "д": "6", "в": "5", "ф": "4"}
def ncolor(src):
    for c in "нсфвд":
        if c in src: return COLOR[c]
nodes, edges, cardpos, ids = [], [], {}, {}
for i, r in enumerate(order):
    w, h = sizes[r]; gx, gy = pos[r]
    g = {"id": "g%d" % i, "type": "group", "label": r + (" · «28»" if r in R.IN28 else ""), "x": gx, "y": gy, "width": w, "height": h}
    if r in R.IN28: g["color"] = "6"
    nodes.append(g)
k = 0
for r in order:
    gx, gy = pos[r]
    for n, (cx, cy) in inner[r].items():
        x0, y0 = gx + PAD + cx * (CW + GAPX), gy + HEAD + PAD + cy * (CH + GAPY)
        ids[n] = "p%d" % k; k += 1
        cardpos[n] = (x0 + CW / 2, y0 + CH / 2)
        label = n
        inf = R.INFO[n]
        st = inf["кр"].split(" (")[0]
        if inf["кз"] != inf["кр"]: st = "⚠ " + st
        sub = st + ((" · " + inf["ф"]) if inf["ф"] != "—" else "") + (" ✦" if "н" in by[n]["src"] else "")
        nd = {"id": ids[n], "type": "text", "text": "**[[%s]]**\n%s" % (n, sub), "x": int(x0), "y": int(y0), "width": CW, "height": CH}
        c = {"Гриффиндор": "1", "Слизерин": "4", "Рейвенкло": "5", "Хаффлпафф": "3"}.get(inf["ф"])
        if c: nd["color"] = c
        nodes.append(nd)

def sides(a, b):
    (ax, ay), (bx, by_) = cardpos[a], cardpos[b]
    dx, dy = bx - ax, by_ - ay
    if abs(dx) > abs(dy) * 1.5:
        return ("right", "left") if dx > 0 else ("left", "right")
    return ("bottom", "top") if dy > 0 else ("top", "bottom")
e = 0
def edge(a, b, color=None, label=None, fs=None, ts=None):
    global e
    f, t = sides(a, b)
    d = {"id": "e%d" % e, "fromNode": ids[a], "fromSide": fs or f, "toNode": ids[b], "toSide": ts or t}
    if color: d["color"] = color
    if label: d["label"] = label
    edges.append(d); e += 1
for n in sorted(S):
    for par in (by[n]["father"], by[n]["mother"]):
        if par: edge(par, n)
seen = set()
for n in sorted(S):
    for s in spouse[n]:
        if (s, n) not in seen:
            seen.add((n, s)); edge(n, s, color="2")
for a, b, label in [("Грэхэм Монтегю", "Винсент Крэбб", "двоюродные братья"), ("Теодор Нотт", "Грэхэм Монтегю", "двоюродные братья"),
                    ]:
    if a in ids and b in ids: edge(a, b, color="4", label=label)

for a, b in R.ANC:
    edge(a, b, color="4", label="предок")
legend = "**Рода «Дополнительных Материалов»**\n\nРамка — род (фиолетовая — из «Священных 28»).\nВнутри карточки людей, сверху вниз по поколениям.\nСерая стрелка — родитель → ребёнок.\nОранжевая — брак. Зелёная — двоюродное родство.\nКарточки: красная — наше, жёлтая — сверить, фиолетовая — дерево Роулинг, голубая — вики/Pottermore, без цвета — канон."
nodes.append({"id": "legend", "type": "text", "text": legend, "x": 0, "y": -330, "width": 760, "height": 260})
out = os.path.join(ROOT, "Рода", "Рода — структура.canvas")
json.dump({"nodes": nodes, "edges": edges}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
tot_w = max(pos[r][0] + sizes[r][0] for r in order); tot_h = max(pos[r][1] + sizes[r][1] for r in order)
print("групп:", len(order), "карточек:", len(ids), "стрелок:", len(edges), "размер холста:", tot_w, "x", tot_h)
