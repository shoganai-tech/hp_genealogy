# -*- coding: utf-8 -*-
# Строит .canvas с деревом по поколениям из тех же данных (собрать_роды.py).
import os, sys, json, io, contextlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
with contextlib.redirect_stdout(io.StringIO()):
    import собрать_роды as R
by, spouse, children, sibs, ROOT = R.by, R.spouse, R.children, R.sibs, R.ROOT

COLOR = {"н": "1", "с": "3", "д": "6", "в": "5", "ф": "4"}
def node_color(src):
    for c in "нсфвд":
        if c in src:
            return COLOR[c]
    return None

def build(title, names, extra_edges, out, notes=()):
    S = set(names)
    for n in S: assert n in by, n
    gen = {n: 0 for n in S}
    for _ in range(60):
        ch = False
        def up(n, v):
            nonlocal ch
            if gen[n] < v: gen[n] = v; ch = True
        for n in S:
            for par in (by[n]["father"], by[n]["mother"]):
                if par in S: up(n, gen[par] + 1)
            for s in spouse[n]:
                if s in S: up(n, gen[s])
            for s in sibs[n]:
                if s in S: up(n, gen[s])
        if not ch: break
    levels = {}
    for n in S: levels.setdefault(gen[n], []).append(n)
    # компоненты браков: цепочки
    def comp_order(group):
        seen, out_units = set(), []
        for n in sorted(group):
            if n in seen: continue
            comp, stack = [], [n]
            while stack:
                x = stack.pop()
                if x in seen: continue
                seen.add(x); comp.append(x)
                stack += [s for s in spouse[x] if s in S and gen[s] == gen[x]]
            if len(comp) == 1:
                out_units.append(comp); continue
            ends = [x for x in comp if len([s for s in spouse[x] if s in comp]) <= 1] or comp[:1]
            order, cur, vis = [], ends[0], set()
            while cur is not None:
                order.append(cur); vis.add(cur)
                nxt = [s for s in sorted(spouse[cur]) if s in comp and s not in vis]
                cur = nxt[0] if nxt else None
            order += [x for x in comp if x not in vis]
            out_units.append(order)
        return out_units
    W, H, GX, GY = 230, 90, 50, 170
    pos = {}
    for g in sorted(levels):
        units = comp_order(levels[g])
        def key(u):
            xs = []
            for n in u:
                for par in (by[n]["father"], by[n]["mother"]):
                    if par in pos: xs.append(pos[par][0])
                for s in sibs[n]:
                    if s in pos: xs.append(pos[s][0])
            return sum(xs) / len(xs) if xs else 1e9
        units.sort(key=lambda u: (key(u), u[0]))
        x = 0
        for u in units:
            for n in u:
                pos[n] = (x, g * (H + GY)); x += W + GX
            x += GX
    # центрируем уровни по общей ширине
    maxw = max(max(p[0] for p in pos.values() if p[1] == g * (H + GY)) for g in levels)
    for g in levels:
        row = [n for n in pos if pos[n][1] == g * (H + GY)]
        w = max(pos[n][0] for n in row)
        shift = (maxw - w) / 2
        for n in row: pos[n] = (pos[n][0] + shift, pos[n][1])
    ids = {n: "n%d" % i for i, n in enumerate(sorted(S))}
    nodes, edges = [], []
    for n in sorted(S):
        p = by[n]
        sub = " · ".join(R.SRCNAME[c] for c in p["src"])
        text = "**[[%s]]**\n%s" % (n, p["rod"])
        nd = {"id": ids[n], "type": "text", "text": text, "x": int(pos[n][0]), "y": int(pos[n][1] + 60), "width": W, "height": H}
        c = node_color(p["src"])
        if c: nd["color"] = c
        nodes.append(nd)
    k = 0
    for n in sorted(S):
        for par in (by[n]["father"], by[n]["mother"]):
            if par in S:
                edges.append({"id": "e%d" % k, "fromNode": ids[par], "fromSide": "bottom", "toNode": ids[n], "toSide": "top"}); k += 1
    done = set()
    for n in sorted(S):
        for s in spouse[n]:
            if s in S and (s, n) not in done:
                done.add((n, s))
                a, b = (n, s) if pos[n][0] <= pos[s][0] else (s, n)
                if gen[a] == gen[b]:
                    edges.append({"id": "e%d" % k, "fromNode": ids[a], "fromSide": "right", "toNode": ids[b], "toSide": "left", "label": "брак", "color": "2"}); k += 1
    for a, b, label in extra_edges:
        assert a in S and b in S, (a, b)
        edges.append({"id": "e%d" % k, "fromNode": ids[a], "fromSide": "bottom", "toNode": ids[b], "toSide": "bottom", "label": label, "color": "2"}); k += 1
    legend = ["**" + title + "**", "", "красный — наше", "жёлтый — сверить", "фиолетовый — дерево Роулинг", "голубой — вики / Pottermore", "без цвета — канон (книги)", "оранжевая линия — брак / особая связь"] + list(notes)
    nodes.append({"id": "legend", "type": "text", "text": "\n".join(legend), "x": -520, "y": 0, "width": 340, "height": 40 + 26 * len(legend)})
    json.dump({"nodes": nodes, "edges": edges}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(os.path.basename(out), "узлов:", len(nodes) - 1, "рёбер:", len(edges), "поколений:", len(levels))

nott = ["Кантанкерус Нотт", "Теодотус Нотт", "Корделия Финч", "Мистер Финч", "Первенец Нотта", "Доротея Нотт", "Джулия Монтегю",
        "Мортимер Монтегю", "Гертруда Крэбб", "Крэбб-старший", "Винсент Крэбб", "Грэхэм Монтегю", "Теодор Нотт"]
build("Нотты, Монтегю, Крэббы", nott, [("Грэхэм Монтегю", "Винсент Крэбб", "двоюродные братья"), ("Теодор Нотт", "Грэхэм Монтегю", "двоюродные братья")],
      os.path.join(ROOT, "Дерево — Нотты и Монтегю.canvas"),
      ["", "Сэлвины: Корделия — урождённая Сэлвин", "Монтегю и Крэббы не в «28»"])

black = ["Финеас Найджелус Блэк", "Урсула Флинт", "Арктурус Блэк (1884–1959)", "Лисандра Яксли", "Сигнус Блэк (1889–1943)", "Виолетта Булстроуд",
         "Поллукс Блэк (1912–1990)", "Ирма Крэбб", "Кассиопея Блэк", "Марий Блэк", "Дорея Блэк", "Чарлус Поттер", "Вальбурга Блэк", "Орион Блэк",
         "Альфард Блэк", "Сигнус Блэк (1938–1992)", "Друэлла Розье", "Сириус Блэк", "Регулус Блэк", "Беллатриса Лестрейндж", "Андромеда Тонкс",
         "Нарцисса Малфой", "Рудольфус Лестрейндж", "Рабастан Лестрейндж", "Тед Тонкс", "Нимфадора Тонкс", "Римус Люпин", "Тедди Люпин",
         "Абраксас Малфой", "Люциус Малфой", "Драко Малфой", "Астория Гринграсс", "Скорпиус Малфой", "Седрелла Блэк", "Септимус Уизли", "Артур Уизли"]
build("Блэки и родня", black, [], os.path.join(ROOT, "Дерево — Блэки и родня.canvas"),
      ["", "Почти всё — дерево Роулинг 2006, не книги", "Родители Ориона и Седреллы — сверить"])
