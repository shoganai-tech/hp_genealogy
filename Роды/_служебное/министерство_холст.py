# -*- coding: utf-8 -*-
# Строит «Министерство — отделы.canvas»: группы по отделам, карточки сотрудников, стрелки подчинения (низ → верх).
# Источники: Лексикон, Compendium, Pottermore; «по версии автора» — из vault. Перезапуск пересоздаёт холст с нуля.
import json,os,re,uuid,math
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PEOPLE=os.path.join(ROOT,'Люди')
OUT_CANON=os.path.join(ROOT,'Министерство — отделы (канон).canvas')
OUT_AUTHOR=os.path.join(ROOT,'Министерство — отделы (авторский).canvas')
COL={'гриффиндор':'1','грифиндор':'1','слизерин':'4','рейвенкло':'5','равенкло':'5','пуффендуй':'3','хаффлпафф':'3'}
def faculty_color(note):
    f=os.path.join(PEOPLE,note+'.md')
    if not os.path.exists(f): return None
    t=open(f,encoding='utf-8').read()
    m=re.search(r'^факультет:\s*"?([^"\n]+)',t,re.M)
    if not m: return None
    v=m.group(1).strip().lower()
    for k,c in COL.items():
        if k in v: return c
def P(key,note,disp,role,boss=None): return dict(key=key,note=note,disp=disp,role=role,boss=boss)
G=[]
def grp(level,title,subs,cols,people,chain=False): G.append(dict(level=level,title=title,subs=subs,cols=cols,people=people,chain=chain))
grp('Уровень 1 · Министр и аппарат','Министр магии и вспомогательный персонал',None,4,[
 P('bag',None,'Millicent Bagnold','министр (1980–1990)'),
 P('fudge','Корнелиус Фадж','Корнелиус Фадж','министр (1990–1996)'),
 P('scr','Руфус Скримджер','Руфус Скримджер','министр (1996–1997); до того глава Аврората'),
 P('thick','Пий Тикнесс','Пий Тикнесс','министр (1997–1998); под Империусом'),
 P('king','Кингсли Шеклболт','Кингсли Шеклболт','министр с 1998'),
 P('umb','Долорес Амбридж','Долорес Амбридж','старший заместитель министра',boss='fudge'),
 P('percy','Перси Уизли','Перси Уизли','младший помощник министра (1995–96)',boss='fudge'),
])
grp('Уровень 2 · Магический правопорядок','Отдел магического правопорядка','Подразделения: Аврорат · Бюро неправомерного использования магии · Бюро по неправильному использованию маггловских предметов · Отряд магического правопорядка · Служба администрирования Визенгамота · Бюро по обнаружению поддельных защитных заклинаний и предметов (создано 1996)',7,[
 P('bones','Амелия Боунс','Амелия Боунс','глава отдела до июля 1996'),
 P('pill',None,'Justus Pilliwickle','глава отдела (ок. 1950)'),
 P('crouch','Бартемиус Крауч','Бартемиус Крауч','глава отдела (ок. 1970–1981)'),
 P('thick','Пий Тикнесс','Пий Тикнесс','глава отдела до августа 1997'),
 P('yax','Корбан Яксли','Корбан Яксли','глава при Пожирателях (1997–98)'),
 P('scr','Руфус Скримджер','Руфус Скримджер','глава Аврората до 1996',boss='bones'),
 P('art','Артур Уизли','Артур Уизли','глава Бюро по маггловским предметам до 1996; затем Бюро поддельных защитных заклинаний',boss='bones'),
 P('hop',None,'Mafalda Hopkirk','Бюро неправомерного использования магии',boss='bones'),
 P('ogden',None,'Bob Ogden','глава Отряда магического правопорядка (1920-е)',boss='bones'),
 P('mcg','Минерва Макгонагалл','Минерва Макгонагалл','работала в отделе до преподавания (Pottermore)',boss='bones'),
 P('urq',None,'Elphinstone Urquart','старший офицер (1950-е), муж Минервы (Compendium)',boss='bones'),
 P('gum',None,'Alastor Gumboil','заявки на хит-визардов, комната 919',boss='bones'),
 P('moody','Аластор Муди','Аластор Муди','аврор',boss='scr'),
 P('kings','Кингсли Шеклболт','Кингсли Шеклболт','аврор',boss='scr'),
 P('tonks','Нимфадора Тонкс','Нимфадора Тонкс','аврор',boss='scr'),
 P('dawl',None,'John Dawlish','аврор',boss='scr'),
 P('frank','Фрэнк Лонгботтом','Фрэнк Лонгботтом','аврор',boss='scr'),
 P('alice','Алиса Лонгботтом','Алиса Лонгботтом','аврор',boss='scr'),
 P('rob',None,'Gawain Robards','аврор',boss='scr'),
 P('prou',None,'Proudfoot','аврор (ОФ)',boss='scr'),
 P('sav',None,'Savage','аврор (ОФ)',boss='scr'),
 P('will',None,'Williamson','аврор (ОФ)',boss='scr'),
 P('steb',None,'Stebbins','аврор (Лексикон)',boss='scr'),
 P('perk',None,'Perkins','Бюро по маггловским предметам',boss='art'),
])
grp('Уровень 3 · Происшествия и катастрофы','Отдел магических происшествий и катастроф','Подразделения: Отряд обращения вспять случайной магии · Штаб обливиаторов · Комитет по выработке правдоподобных объяснений для магглов',2,[
 P('fudge','Корнелиус Фадж','Корнелиус Фадж','младший министр отдела (до министерства)'),
 P('peas',None,'Arnie Peasegood','обливиатор, Отряд обращения случайной магии'),
])
grp('Уровень 4 · Магические существа','Отдел регулирования и контроля магических существ','Подразделения: Управление зверей (Комитет по уничтожению опасных тварей, Отряд по поимке оборотней, Реестр оборотней) · Управление существ (Бюро по связям с гоблинами, Службы помощи оборотням) · Управление духов',3,[
 P('amos','Амос Диггори','Амос Диггори','Управление зверей'),
 P('mac','Уолден Макнейр','Уолден Макнейр','палач, Комитет по уничтожению опасных тварей'),
 P('newt','Ньют Скамандер','Ньют Скамандер','Управление зверей; Бюро по переселению домовых эльфов (Pottermore)'),
 P('msc','Миссис Скамандер','Миссис Скамандер','по версии автора; коллега Амоса и Макнейра'),
 P('mock',None,'Cuthbert Mockridge','глава Бюро по связям с гоблинами (1994)'),
 P('cress','Дирк Кресвелл','Дирк Кресвелл','глава Бюро по связям с гоблинами (1996)'),
])
grp('Уровень 5 · Международное сотрудничество','Отдел международного магического сотрудничества',None,3,[
 P('crouch','Бартемиус Крауч','Бартемиус Крауч','глава отдела (1994)'),
 P('percy','Перси Уизли','Перси Уизли','помощник главы (до 1995)',boss='crouch'),
 P('shaf','Аделард Сухайль Шафик','Аделард Сухайль Шафик','глава отдела — по версии автора'),
 P('slag','Мистер Слагхорн','Мистер Слагхорн','отец Горация Слагхорна — по версии автора'),
])
grp('Уровень 6 · Магический транспорт','Отдел магического транспорта','Подразделения: Центр тестирования по аппарации · Контроль за мётлами · Комиссия по регулированию Флу-сети · Бюро портключей',3,[
 P('edge','Мадам Эджкомб','Мадам Эджкомб','Флу-сеть'),
 P('basil',None,'Basil','портключи, ЧМ 1994'),
 P('twy',None,'Wilkie Twycross','экзаменатор по аппарации (1996–97)'),
])
grp('Уровень 7 · Игры и спорт','Отдел магических игр и спорта',None,3,[
 P('macf',None,'Hamish MacFarlan','глава (1957–1968); экс-капитан «Монтроуз Магпайс» (Pottermore)'),
 P('bagm','Людо Бэгмен','Людо Бэгмен','глава (1994–95)'),
 P('bert',None,'Bertha Jorkins','сотрудница при Бэгмене',boss='bagm'),
])
grp('Уровень 9 · Тайны','Отдел тайн (невыразимцы)','Комнаты: Мозг · Зал пророчеств · Запертая комната · Планеты · Время',3,[
 P('cro',None,'Saul Croaker','невыразимец (ОФ)'),
 P('bode',None,'Broderick Bode','невыразимец (ОФ)'),
 P('rook',None,'Augustus Rookwood','невыразимец, Пожиратель смерти'),
 P('elton',None,'Elton Elderberry','невыразимец (вики-навбокс, первоисточник не проверен)'),
 P('grim',None,'Grim Fawley','невыразимец (вики-навбокс, не проверен)'),
 P('dinah',None,'Dinah Hecat','невыразимец (вики-навбокс, не проверен)'),
 P('olivia',None,'Olivia Green','невыразимец (вики-навбокс, не проверен)'),
 P('gareth',None,'Gareth Greengrass','невыразимец (вики-навбокс, не проверен)'),
 P('eloise',None,'Eloise Mintumble','невыразимец (вики-навбокс, не проверен)'),
 P('levina',None,'Levina Monkstanley','невыразимец (вики-навбокс, не проверен)'),
 P('regina',None,'Regina Rowle','невыразимец (вики-навбокс, не проверен)'),
 P('albert',None,'Albert Sallow','невыразимец (вики-навбокс, не проверен)'),
])
grp('Уровень 10 · Суды','Визенгамот','Зал суда; председатель — Верховный чародей',3,[
 P('dumb','Альбус Дамблдор','Альбус Дамблдор','Верховный чародей (до 1995)'),
 P('bones','Амелия Боунс','Амелия Боунс','член; глава отдела правопорядка',boss='dumb'),
 P('dodge','Элфиас Додж','Элфиас Додж','член',boss='dumb'),
 P('march',None,'Griselda Marchbanks','член (экзаменатор)',boss='dumb'),
 P('tog',None,'Tiberius Ogden','член',boss='dumb'),
 P('gold','Мистер Голдштейн (двоюродный дед Энтони Голдштейн)','Мистер Голдштейн (двоюродный дед Энтони)','член — по версии автора',boss='dumb'),
])
grp('Другие отделы','Прочие службы','Отдел контроля магического оборудования · Отдел магического обслуживания · Бюро по переселению домовых эльфов · Группа по борьбе с гулями',2,[
 P('cat',None,'Reginald Cattermole','Отдел магического обслуживания (ДС)'),
])
grp('Ведомство не названо','Служащие без указанного отдела',None,3,[
 P('blet','Мистер Блетчли','Мистер Блетчли','сотрудник Министерства'),
 P('orf','Орфорд Амбридж','Орфорд Амбридж','сотрудник Министерства (Pottermore)'),
 P('mcl','Тиберий Маклагген','Тиберий Маклагген','«большая шишка» (ПП, гл. 7)'),
 P('gold2','Мистер Голдштейн (отец Энтони Голдштейн)','Мистер Голдштейн (отец Энтони)','министерский служащий — по версии автора'),
 P('lyall','Лайелл Люпин','Лайелл Люпин','Министерство (Pottermore: отец Римуса)'),
])
MIN=[('Ulick Gamp','1707–1718'),('Damocles Rowle','1718–1726'),('Perseus Parkinson','1726–1733'),('Eldritch Diggory','1733–1747'),('Albert Boot','1747–1752'),('Basil Flack','1752'),('Hesphaestus Gore','1752–1770'),('Maximilian Crowdy','1770–1781'),('Porteus Knatchbull','1781–1789'),('Unctuous Osbert','1789–1798'),('Artemisia Lufkin','1798–1811'),('Grogan Stump','1811–1819'),('Josephina Flint','1819–1827'),('Ottaline Gambol','1827–1835'),('Rodolphus Lestrange','1835–1841'),('Hortensia Milliphutt','1841–1849'),('Evangeline Orpington','1849–1855'),('Priscilla Dupont','1855–1858'),('Dugald McPhail','1858–1865'),('Faris Spavin','1865–1903'),('Venusia Crickerly','1903–1912'),('Archer Evermonde','1912–1923'),('Lorcan McLaird','1923–1925'),('Hector Fawley','1925–1939'),('Leonard Spencer-Moon','1939–1948'),('Wilhelmina Tuft','1948–1959'),('Ignatius Tuft','1959–1962'),('Nobby Leach','1962–1968'),('Eugenia Jenkins','1968–1975'),('Harold Minchum','1975–1980'),('Millicent Bagnold','1980–1990'),('Cornelius Fudge','1990–1996'),('Rufus Scrimgeour','1996–1997'),('Pius Thicknesse','1997–1998'),('Kingsley Shacklebolt','1998–')]
NOTE_MIN={'Hector Fawley':'Гектор Фоули','Cornelius Fudge':'Корнелиус Фадж','Rufus Scrimgeour':'Руфус Скримджер','Pius Thicknesse':'Пий Тикнесс','Kingsley Shacklebolt':'Кингсли Шеклболт'}
grp('Министры магии','Министры магии (Pottermore)','Хронологический список; в каноне 35 министров',5,[
 P(f'm{i}',NOTE_MIN.get(n),n,y) for i,(n,y) in enumerate(MIN)],chain=True)

# годы работы: (индекс группы, ключ) -> текст. Если в роли уже есть год — строка не добавляется; иначе «не указаны».
YEARS={
(0,'umb'):'1995–1996',
(1,'hop'):'1995–1998 (в каноне)',
(1,'mcg'):'ок. 1956–1958 (два года, Pottermore; точные не указаны)',
(1,'tonks'):'с 1994',
(1,'percy2'):'с ~1992 (после Хогвартса) и далее при Боунс',
(1,'dawl'):'не указаны (в каноне 1996)',
(1,'frank'):'до 1981',
(1,'alice'):'до 1981',
(1,'prou'):'1995 (ОФ)',(1,'sav'):'1995 (ОФ)',(1,'will'):'1995 (ОФ)',
(1,'perk'):'1994 (в каноне)',
(3,'amos'):'не указаны (в каноне 1994)',
(3,'mac'):'не указаны (в каноне 1994)',
(5,'edge'):'не указаны (в каноне 1996)',
(6,'bert'):'до 1994 (пропала)',
(7,'cro'):'не указаны (в каноне 1995)',
(7,'bode'):'до 1995 (убит)',
(7,'rook'):'до ~1981 (арест); вновь 1997–98 (не проверено)',
(8,'bones'):'до 1996',
(8,'dodge'):'не указаны (в каноне 1995)',
(8,'march'):'не указаны (в каноне 1995)',
(8,'tog'):'не указаны (в каноне 1995)',
(9,'cat'):'1997–98 (ДС)',
}
def add_years(G):
    for gi,g in enumerate(G):
        if g['chain']: continue
        for p in g['people']:
            if re.search(r'\d{4}',p['role']) and (gi,p['key']) not in YEARS: continue
            p['role']+='\nгоды: '+YEARS.get((gi,p['key']),'не указаны')
def build(G,OUT):
    CW,CH,GAP=330,132,18
    ROWS=[[0,11],[1],[2,3],[4,5,6],[7,8],[9,10]]
    nodes=[];edges=[];missing=[]
    def edge(a,b,color='6'):
        edges.append({"id":uuid.uuid4().hex[:16],"fromNode":a,"fromSide":"bottom","toNode":b,"toSide":"top","color":color})
    y=0
    for row in ROWS:
        x=0; rowh=0
        for gi in row:
            g=G[gi]; people=g['people']
            cols=g['cols']
            gw=max(cols*(CW+GAP)+GAP,460)
            if g['subs']: subh=(math.ceil(len(g['subs'])/max(20,(gw-70)/10.5))+1)*30+40
            else: subh=60
            gid='g'+uuid.uuid4().hex[:10]
            gnode={"id":gid,"type":"group","x":x,"y":y,"width":gw,"height":0,"label":g['level']}
            nodes.append(gnode)
            cy=y+60
            hid='h'+uuid.uuid4().hex[:10]
            txt=f"**{g['title']}**"+(f"\n{g['subs']}" if g['subs'] else "")
            nodes.append({"id":hid,"type":"text","x":x+GAP,"y":cy,"width":gw-2*GAP,"height":subh-GAP,"text":txt})
            cy+=subh+30
            depth={}
            def d(k):
                if k in depth: return depth[k]
                b=next(p['boss'] for p in people if p['key']==k)
                depth[k]=1 if (b is None or g['chain']) else d(b)+1
                return depth[k]
            for p in people: d(p['key'])
            levels={}
            for p in people: levels.setdefault(depth[p['key']],[]).append(p)
            ids={}
            for lv in sorted(levels):
                items=levels[lv]
                rows_n=math.ceil(len(items)/cols)
                for i,p in enumerate(items):
                    r,c=divmod(i,cols)
                    px=x+GAP+c*(CW+GAP); py=cy+r*(CH+GAP)
                    note=p['note']
                    if note:
                        if not os.path.exists(os.path.join(PEOPLE,note+'.md')): missing.append(note)
                        link=f"[[{note}|{p['disp']}]]" if note!=p['disp'] else f"[[{note}]]"
                        text=f"**{link}**\n{p['role']}"
                    else: text=f"**{p['disp']}**\n{p['role']}"
                    nid='c'+uuid.uuid4().hex[:10]; ids[p['key']]=nid
                    n={"id":nid,"type":"text","x":px,"y":py,"width":CW,"height":CH,"text":text}
                    col=faculty_color(note) if note else None
                    if col: n['color']=col
                    nodes.append(n)
                cy+=rows_n*(CH+GAP)+(30 if lv<max(levels) else 0)
            has_h=any(p['boss'] for p in people)
            if not g['chain']:
                for p in people:
                    if p['boss'] is not None: edge(ids[p['boss']], ids[p['key']])
                    elif has_h: edge(hid, ids[p['key']])   # плоские группы без иерархии — без стрелок
            gnode['height']=(cy-y)+GAP
            x+=gw+60; rowh=max(rowh,gnode['height'])
        y+=rowh+80
    json.dump({"nodes":nodes,"edges":edges},open(OUT+'.tmp','w',encoding='utf-8'),ensure_ascii=False,indent='\t')
    os.replace(OUT+'.tmp',OUT)
    print('карточек',sum(1 for n in nodes if n['id'].startswith('c')),'групп',sum(1 for n in nodes if n['type']=='group'),'стрелок',len(edges),'нет заметок',missing)


AUTH='по версии автора'
def canon(G):
    out=[]
    for g in G:
        ps=[p for p in g['people'] if AUTH not in p['role']]
        keys={p['key'] for p in ps}
        for p in ps:
            if p['boss'] and p['boss'] not in keys: p['boss']=None
        out.append(dict(g,people=ps))
    return out
import copy,sys
def author(G):
    G=copy.deepcopy(G)
    G[4]['people']=[p for p in G[4]['people'] if p['key']!='percy']
    G[0]['people']=[p for p in G[0]['people'] if p['key']!='percy']
    G[1]['people'].append(P('percy2','Перси Уизли','Перси Уизли','под началом Амелии Боунс — по версии автора (остаётся при ней, пока она на посту)',boss='bones'))
    return G
Gc=canon(copy.deepcopy(G)); add_years(Gc); build(Gc,OUT_CANON)
# авторский холст создаётся один раз и дальше правится вручную; перезапись только с --force-author
if not os.path.exists(OUT_AUTHOR) or '--force-author' in sys.argv:
    Ga=author(G); add_years(Ga); build(Ga,OUT_AUTHOR)
else:
    print('авторский холст уже есть — не трогаю (--force-author для пересоздания)')
