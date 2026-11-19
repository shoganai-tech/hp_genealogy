#!/usr/bin/env python3
"""Собирает site/ из папки Роды/: копирует холсты и заметки, пишет manifest.json.

Запуск: python3 build_site.py
Холсты можно потом подменять прямо в site/ — вьюер грузит их fetch'ем.
"""
import json, shutil, unicodedata
from pathlib import Path

ROOT = Path(__file__).parent
SRC, DST = ROOT / "Роды", ROOT / "site"
SKIP_DIRS = {"_служебное", "__pycache__"}
KEEP_EXT = {".md", ".canvas", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
VIEWER = ["index.html", "viewer.js", "style.css"]

# сохранить файлы вьюера, всё остальное пересобрать
keep = {n: (DST / n).read_bytes() for n in VIEWER if (DST / n).exists()}
if DST.exists():
    shutil.rmtree(DST)
DST.mkdir()
for n, b in keep.items():
    (DST / n).write_bytes(b)
(DST / ".nojekyll").touch()

files = []
for p in sorted(SRC.rglob("*")):
    rel = p.relative_to(SRC)
    if p.is_dir() or set(rel.parts) & SKIP_DIRS or p.suffix.lower() not in KEEP_EXT or p.name.startswith("."):
        continue
    rel = Path(unicodedata.normalize('NFC', rel.as_posix()))  # macOS отдаёт NFD, а git/GitHub и холсты — NFC
    out = DST / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and p.stat().st_size > 1_000_000:
        try:
            from PIL import Image
            im = Image.open(p)
            im.thumbnail((2400, 2400))
            out = out.with_suffix(".jpg") if p.suffix.lower() != ".jpg" else out
            im.convert("RGB").save(out, quality=82, optimize=True)
            print("сжато:", rel)
        except ImportError:
            shutil.copy2(p, out)
    else:
        shutil.copy2(p, out)
    files.append(out.relative_to(DST).as_posix())

canvases = [f for f in files if f.endswith(".canvas") and not f.startswith("_старые/")]
manifest = {"canvases": canvases, "files": files}
(DST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
print(f"{len(files)} файлов, холстов: {len(canvases)}")
