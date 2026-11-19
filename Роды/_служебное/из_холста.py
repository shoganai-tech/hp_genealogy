# -*- coding: utf-8 -*-
# Синхронизация «Рода — структура.canvas» с заметками: каждой карточке — своя заметка и ссылка на неё.
# Запуск: python3 из_холста.py          (только план)
#         python3 из_холста.py apply    (записать: заметки, ссылки в холсте, блоки связей)
# Холст — главный: порядок и связи берутся из него. Ручной текст в заметках (после <!-- ручное -->) не трогаем,
# блок между <!-- холст:начало --> и <!-- холст:конец --> перезаписывается при каждом запуске.
import json, os, re, sys, collections
APPLY = len(sys.argv) > 1 and sys.argv[1] == "apply"
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FN = os.path.join(ROOT, "Рода — структура.canvas")
D_L, D_R = os.path.join(ROOT, "Люди"), os.path.join(ROOT, "Рода")
d = json.load(open(FN, encoding="utf-8"))
G = [n for n in d["nodes"] if n["type"] == "group"]
NODE = {n["id"]: n for n in d["nodes"]}
notes_all = {os.path.splitext(f)[0] for f in os.listdir(D_L) if f.endswith(".md")}
# заметки, ранее созданные этим скриптом (тег «холст»), считаем свободными именами: повторный запуск переиспользует их, а не плодит «… 2»
made_before = {n for n in notes_all if "tags: [холст" in open(os.path.join(D_L, n + ".md"), encoding="utf-8").read(300)}
notes = notes_all - made_before
rods = {os.path.splitext(f)[0] for f in os.listdir(D_R) if f.endswith(".md")}
FAM = {"Абботты":["Аббот"],"Амбриджи":["Амбридж"],"Блэки":["Блэк"],"Боунсы":["Боунс"],"Булстроуды":["Булстроуд"],"Бёрки":["Бёрк"],
"Гойлы":["Гойл"],"Голдштейны":["Голдштейн"],"Гонты":["Гонт"],"Гринграссы":["Гринграсс"],"Гэмпы":["Гэмп"],"Дамблдоры":["Дамблдор"],
"Диггори":["Диггори"],"Ковальски":["Ковальски"],"Краучи":["Крауч"],"Крэббы":["Крэбб"],"Кэрроу":["Кэрроу","Карроу"],"Лавгуды":["Лавгуд"],
"Лестрейнджи":["Лестрейндж"],"Лонгботтомы":["Лонгботтом"],"Люпины":["Люпин"],"Макмилланы":["Макмиллан"],"Малфои":["Малфой"],
"Монтегю":["Монтегю"],"Нотты":["Нотт"],"Паркинсоны":["Паркинсон"],"Певереллы":["Певерелл"],"Поттеры":["Поттер"],"Прюэтты":["Прюэтт"],
"Реддлы":["Реддл"],"Розье":["Розье"],"Скамандер":["Скамандер"],"Слагхорны":["Слагхорн"],"Снейпы":["Снейп"],"Сэлвины":["Сэлвин"],
"Тонксы":["Тонкс"],"Трембли":["Трембли"],"Трэверсы":["Трэверс"],"Уайлдсмиты":["Уайлдсмит"],"Уизли":["Уизли"],"Фаджи":["Фадж"],
"Филчи":["Филч"],"Финчи":["Финч"],"Флинты":["Флинт"],"Фоули":["Фоули"],"Шафики":["Шафик"],"Шеклболты":["Шеклболт"],"Эвансы":["Эванс"],
"Эйвери":["Эйвери"],"Яксли":["Яксли"],"Фортескью":["Фортескью"],"Бэгмены":["Бэгмен"],"Скитеры":["Скитер"],"Каркаровы":["Каркаров"],"Петтигрю":["Петтигрю"],"Трелони":["Трелони"],"Рукквуды":["Рукквуд"],"Макнейры":["Макнейр"],"Долоховы":["Долохов"],"Долиши":["Долиш"],"Кресвеллы":["Кресвелл"],"Белби":["Белби"],"Хиггсы":["Хиггс"],"Уайтхорны":["Уайтхорн"],"Саммерби":["Саммерби"],"Шинглтоны":["Шинглтон"],"Мальсиберы":["Мальсибер"],"Помфри":["Помфри"],"Чанги":["Чанг"],"Макгонагаллы":["Макгонагалл"],"Клируотеры":["Клируотер"],"Уркхарты":["Уркхарт"],"Боулы":["Боул"],"Дэвисы":["Дэвис"],"Харперы":["Харпер"],"Фигги":["Фигг"],"Вейзи":["Вейзи"],"Пьюси":["Пьюси"],"Уоррингтоны":["Уоррингтон"],"Стеббинсы":["Стеббинс"],"Бэгшоты":["Бэгшот"],"Тикнессы":["Тикнесс"],"Векторы":["Вектор"],"Патилы":["Патил"],"Причарды":["Причард"],"Финч-Флетчли":["Финч-Флетчли"],"Доджи":["Додж"],"Скримджеры":["Скримджер"],"Муди":["Муди"],"Маклаггены":["Маклагген"],"Блейны":["Блейн"],"Эджкомбы":["Эджкомб"],"Забини":["Забини"],"Финниганы":["Финниган"],"Роули":["Роул"],"Олливандеры":["Олливандер"]}
FACC = {"1": "Гриффиндор", "4": "Слизерин", "5": "Рейвенкло", "3": "Хаффлпафф"}
STAT = {"чистокровный","полукровка","маглорождённый","маггл","маггла","сквиб","волшебник","не названо","ведьма"}
def frame(c):
    best = None
    for g in G:
        if g["x"] <= c["x"] and g["y"] <= c["y"] and c["x"]+c["width"] <= g["x"]+g["width"] and c["y"]+c["height"] <= g["y"]+g["height"]:
            if best is None or g["width"]*g["height"] < best["width"]*best["height"]: best = g
    return best
def flab(g): return re.sub(r"\s*·.*$", "", g["label"]).strip()
COMMENT = {"2d14d0469d2f5aa8", "cmtnew"}
cards = [n for n in d["nodes"] if n["type"] == "text" and n["id"] != "legend" and n["id"] not in COMMENT]
FULL = {"Юсуф Кама","Корнелий Агриппа","Птолемей","Моргана ле Фэй","Николя Фламель"}
pure = set()
st = collections.defaultdict(list)
for c in cards:
    L = c["text"].split("\n")
    if len(L) > 1:
        p = [x.strip() for x in L[1].replace("✦", "").replace("⚠", "").split("·")][0]
        if p: st[frame(c)["id"]].append(p)
for g in G:
    a = st.get(g["id"], [])
    if g.get("color") == "6" or (a and sum(1 for x in a if x == "чистокровный") * 2 > len(a)): pure.add(g["id"])
info = {}
for c in cards:
    g = frame(c); fl = flab(g); sur = FAM.get(fl, [fl])
    L = c["text"].split("\n")
    m = re.match(r"^\*\*\[\[(.+?)\]\]\*\*(.*)$", L[0])
    if m:
        link = m.group(1); target = link.split("|")[0]; S1 = ((link.split("|")[1] if "|" in link else link) + m.group(2)).strip()
    else: target, S1 = None, L[0].strip()
    i = S1.find("("); name = (S1 if i == -1 else S1[:i]).strip(); tail = "" if i == -1 else S1[i:]
    br = re.findall(r"\(([^()]*)\)", tail)
    years = [b for b in br if re.search(r"\d", b)]
    maiden = next((b for b in br if re.fullmatch(r"[А-ЯЁ][а-яё]+", b)), None)
    desc = [b for b in br if b not in years and b != maiden]
    toks = name.split()
    info[c["id"]] = dict(c=c, fl=fl, sur=sur, target=target, S1=S1, toks=toks, years=years, maiden=maiden, desc=desc,
                         L=L, ph=bool(toks) and (toks[0].lower() in ("мистер","миссис") or toks[0] in ("Сын","Дочь")))
# --- имена заметок ---
name_of, taken = {}, set(n.lower() for n in notes)
for cid, x in info.items():
    if x["target"] and x["target"] in notes_all: name_of[cid] = x["target"]
newlist = []
def base_name(x):
    toks, sur = x["toks"], x["sur"]
    if x["ph"]:
        if toks[0] in ("Сын", "Дочь"): return toks[0]
        return " ".join(toks) + (" (%s)" % x["maiden"] if x["maiden"] else "")
    if " ".join(toks) in FULL: return " ".join(toks)
    if len(toks) == 1 and toks[0] in sur: return toks[0] + (" (%s)" % x["desc"][0] if x["desc"] else "")
    if any("-старший" in t or t in sur for t in toks): return " ".join(toks)
    nums = [t for t in toks if t.isdigit()]; given = [t for t in toks if not t.isdigit()]
    return " ".join(given + [x["maiden"] or sur[0]] + nums)
for cid, x in info.items():
    if cid in name_of: continue
    x["base"] = base_name(x); newlist.append(cid)
# первый проход: непустышки
for cid in newlist:
    x = info[cid]
    if x["ph"]: continue
    b = x["base"]
    if (b.lower() in taken or any(n.lower().startswith(b.lower() + " (") for n in notes)) and x["years"]: b = "%s (%s)" % (b, x["years"][0])
    k = 2; b0 = b
    while b.lower() in taken: b = "%s %d" % (b0, k); k += 1
    name_of[cid] = b; taken.add(b.lower())
# связи
par, chi, spo, kin, anc, oth = (collections.defaultdict(list) for _ in range(6))
for e in d["edges"]:
    a, b = e["fromNode"], e["toNode"]
    if a not in info or b not in info: continue
    col = e.get("color")
    if col in (None, "4"): chi[a].append(b); par[b].append(a)
    elif col == "2": spo[a].append(b); spo[b].append(a)
    elif col == "5": kin[a].append(b); kin[b].append(a)
    elif col == "3": anc[a].append(b); anc[b].append(a)
    else: oth[a].append(b); oth[b].append(a)
def nm(i): return name_of.get(i) or info[i].get("base") or info[i]["S1"]
# пустышки
ph = [cid for cid in newlist if info[cid]["ph"]]
for cid in ph:
    x = info[cid]; role = x["toks"][0]; male = role.lower() == "мистер" or role == "Сын"
    suf = None
    nmd = lambda L_: next((o for o in L_ if not info[o]["ph"]), None)
    if role in ("Сын", "Дочь"):
        o = nmd(par[cid]); suf = nm(o) if o else None
    elif nmd(chi[cid]): suf = ("отец " if male else "мать ") + nm(nmd(chi[cid]))
    elif nmd(spo[cid]): suf = ("муж " if male else "жена ") + nm(nmd(spo[cid]))
    elif nmd(par[cid]): suf = ("сын " if male else "дочь ") + nm(nmd(par[cid]))
    elif nmd(anc[cid] + kin[cid] + oth[cid]): suf = "родня " + nm(nmd(anc[cid] + kin[cid] + oth[cid]))
    b = x["base"]
    if b.lower() in taken or sum(1 for y in ph if info[y]["base"].lower() == b.lower()) > 1:
        b = "%s (%s)" % (b, suf) if suf else b
    k = 2; b0 = b
    while b.lower() in taken: b = "%s %d" % (b0, k); k += 1
    x["tmp"] = b; name_of[cid] = b; taken.add(b.lower())
newnames = [name_of[c] for c in newlist]
print("карточек:", len(cards), " с заметкой уже:", len(cards) - len(newlist), " новых заметок:", len(newlist))
fr_new = sorted({info[c]["fl"] for c in info} - rods)
print("рамок без заметки рода:", len(fr_new), fr_new)
if not APPLY:
    for c in newlist: print("  +", name_of[c], "  <-", info[c]["S1"], "|", info[c]["fl"])
    sys.exit(0)
# --- запись ---
def linkto(i):
    n = name_of[i]; s = info[i]["S1"]
    return "[[%s]]" % n
def block(i):
    out = ["<!-- холст:начало -->", "## Связи (с холста «Рода — структура»)"]
    def row(title, lst):
        lst = [x for x in dict.fromkeys(lst) if x != i]
        if lst: out.append("- **%s:** %s" % (title, ", ".join(linkto(x) for x in lst)))
    row("Родители", par[i]); row("Дети", chi[i]); row("Супруг(а)", spo[i]); row("Брат/сестра/кузен", kin[i])
    row("Предок/потомок", anc[i]); row("Прочие связи", oth[i])
    if len(out) == 2: out.append("- связей на холсте нет")
    out.append("<!-- холст:конец -->"); return "\n".join(out)
def put_block(path, blk):
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"\n?<!-- холст:начало -->.*?<!-- холст:конец -->\n?", "\n", s, flags=re.S)
    if "<!-- ручное -->" not in s: s = s.rstrip("\n") + "\n\n<!-- ручное -->\n"
    s = s.rstrip("\n") + "\n\n" + blk + "\n"
    open(path, "w", encoding="utf-8").write(s)
made = 0
for cid in newlist:
    x = info[cid]; n = name_of[cid]; c = x["c"]
    stt = next((p for p in [q.strip() for q in x["L"][1].replace("✦", "").replace("⚠", "").split("·")] if p in STAT), None) if len(x["L"]) > 1 else None
    if not stt and frame(c)["id"] in pure and not x["ph"]: stt = "чистокровный (по роду)"
    fac = FACC.get(c.get("color"))
    yrs = ", ".join(x["years"]) if x["years"] else "—"
    desc_lines = [l for l in x["L"][1:] if l.strip() and l.strip() not in STAT and "✦" not in l and "⚠" not in l and not any(p.strip() in STAT or p.strip() in FACC.values() for p in l.split("·"))]
    body = ["---", "tags: [холст, сверить]", 'кровь-заявленная: "%s"' % (stt or "—"), 'факультет: "%s"' % (fac or "—"), 'годы: "%s"' % yrs, "---",
            "# " + n, "", "> [!info] " + n, "> **Кровь:** " + (stt or "—"), "> **Факультет:** " + (fac or "—"), "> **Годы жизни:** " + yrs, "",
            "**Род:** [[%s]]" % x["fl"], "**Источник:** холст «Рода — структура», добавлено автором 5.11; канон не сверялся",
            ("**На карточке:** " + "; ".join(l.strip() for l in desc_lines)) if desc_lines else "", "", "<!-- ручное -->", ""]
    path = os.path.join(D_L, n + ".md")
    if not os.path.exists(path):
        open(path, "w", encoding="utf-8").write("\n".join(body)); made += 1
for cid in info:
    path = os.path.join(D_L, name_of[cid] + ".md")
    put_block(path, block(cid))
# ссылки в холсте
for cid, x in info.items():
    n = name_of[cid]; s = x["S1"]
    l1 = "**[[%s]]**" % n if n == s else "**[[%s|%s]]**" % (n, s)
    x["c"]["text"] = "\n".join([l1] + x["L"][1:])
# заметки родов
byf = collections.defaultdict(list)
for cid, x in info.items(): byf[x["fl"]].append(cid)
glabel = {flab(g): g for g in G}
for fl, ids in byf.items():
    path = os.path.join(D_R, fl + ".md")
    if not os.path.exists(path):
        p28 = "да — [[Священные 28]]" if glabel[fl].get("color") == "6" else "нет"
        open(path, "w", encoding="utf-8").write("---\ntags: [род, холст]\nсвященные-28: %s\n---\n# %s\n\nВ «Священных 28»: %s\n\nРод заведён по рамке на холсте «Рода — структура» (5.11). Этимология и положение рода пока не сверены.\n\n<!-- ручное -->\n" % ("да" if glabel[fl].get("color") == "6" else "нет", fl, p28))
    blk = ["<!-- холст:начало -->", "## Люди на холсте"] + ["- [[%s|%s]]" % (name_of[i], info[i]["S1"].replace("|", "/")) if name_of[i] != info[i]["S1"] else "- [[%s]]" % name_of[i] for i in ids] + ["<!-- холст:конец -->"]
    put_block(path, "\n".join(blk))
tmp = FN + ".tmp"; json.dump(d, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1); os.replace(tmp, FN)
print("создано заметок:", made, "; записано блоков связей:", len(info), "; рамок:", len(byf))
