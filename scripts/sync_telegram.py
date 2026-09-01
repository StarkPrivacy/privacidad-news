#!/usr/bin/env python3
"""Fetch public posts from t.me/s/starkprivacy and merge into news.json."""

from __future__ import annotations

import html as html_lib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CHANNEL = "starkprivacy"
PREVIEW = f"https://t.me/s/{CHANNEL}"
UA = "Mozilla/5.0 (compatible; PrivacidadNews/1.0; +https://privacidad.news)"

CATEGORIES = [
    ("cifrado", ["cifrado", "encryption", "signal", "pgp", "e2ee", "clave"]),
    ("herramientas", ["herramienta", "graphene", "brave", "firefox", "extensi", "navegador"]),
    ("servicios", ["vpn", "proton", "mullvad", "servicio", "email", "alias"]),
    ("productos", ["pixel", "iphone", "android", "gafas", "router"]),
    ("empresas", ["apple", "google", "meta", "openai", "microsoft", "comcast", "amazon"]),
    ("países", ["ue", "unión europea", "rusia", "reino unido", "ee.uu", "eeuu", "españa", "alemania"]),
    ("legislación", ["ley", "norma", "reglamento", "etsi", "gdpr", "dsa"]),
    ("seguridad", ["spyware", "malware", "ataque", "vulnerabilidad", "hack"]),
    ("proyectos", ["proyecto", "open source", "código abierto"]),
    ("identidad digital", ["identidad", "dni", "reconocimiento facial", "biometric"]),
]

FALLBACK_IMAGES = {
    "cifrado": "https://images.unsplash.com/photo-1614064641938-3b95b2fc4c0a?w=800&h=500&fit=crop&q=80",
    "herramientas": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=500&fit=crop&q=80",
    "servicios": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&h=500&fit=crop&q=80",
    "productos": "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=500&fit=crop&q=80",
    "empresas": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=500&fit=crop&q=80",
    "países": "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&h=500&fit=crop&q=80",
    "legislación": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=500&fit=crop&q=80",
    "seguridad": "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=500&fit=crop&q=80",
    "proyectos": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop&q=80",
    "identidad digital": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop&q=80",
    "default": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop&q=80",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", "replace")


def strip_tags(raw: str) -> str:
    text = re.sub(r"<br\\s*/?>", "\n", raw, flags=re.I)
    text = re.sub(r"</(div|p|h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_lib.unescape(text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def guess_title(text: str) -> str:
    lines = [ln.strip(" -–—*") for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "Nueva noticia"
    first = re.sub(r"^[^\wÁÉÍÓÚÜÑáéíóúüñ]+", "", lines[0]).strip()
    if len(first) < 12 and len(lines) > 1:
        first = re.sub(r"^[^\wÁÉÍÓÚÜÑáéíóúüñ]+", "", lines[1]).strip()
    first = first.split("\n")[0]
    if len(first) > 110:
        first = first[:107].rsplit(" ", 1)[0] + "…"
    return first or "Nueva noticia"


def guess_category(text: str) -> str:
    n = text.lower()
    for name, keys in CATEGORIES:
        if any(k in n for k in keys):
            return name.capitalize() if name != "países" else "Países"
    return "Seguridad"


def guess_tags(text: str, category: str) -> str:
    n = text.lower()
    tags = {category.lower()}
    extra = {
        "apple": "apple", "google": "google", "meta": "meta", "proton": "proton",
        "signal": "signal", "vpn": "vpn", "ia": "ia", "chatgpt": "chatgpt",
        "graphene": "grapheneos", "pixel": "pixel", "ue": "ue",
    }
    for key, tag in extra.items():
        if key in n:
            tags.add(tag)
    return " ".join(sorted(tags))


def paragraphs(text: str) -> list[str]:
    chunks = [c.strip() for c in re.split(r"\n{2,}", text) if c.strip()]
    if len(chunks) == 1:
        sentences = re.split(r"(?<=[.!?])\s+", chunks[0])
        if len(sentences) > 3:
            mid = max(1, len(sentences) // 2)
            return [" ".join(sentences[:mid]), " ".join(sentences[mid:])]
    return chunks or [text]


def parse_posts(page: str) -> list[dict]:
    posts = []
    blocks = re.split(r'<div class="tgme_widget_message ', page)[1:]
    for block in blocks:
        m_id = re.search(r'data-post="[^"/]+/(\d+)"', block)
        if not m_id:
            m_href = re.search(r"https://t\.me/[^/]+/(\d+)", block)
            if not m_href:
                continue
            pid = int(m_href.group(1))
        else:
            pid = int(m_id.group(1))

        text_m = re.search(
            r'class="[^"]*tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>\s*<div class="',
            block, re.S,
        )
        if not text_m:
            text_m = re.search(
                r'class="[^"]*tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
                block, re.S,
            )
        if not text_m:
            continue
        text = strip_tags(text_m.group(1))
        if len(text) < 40:
            continue

        date_m = re.search(r'<time datetime="([^"]+)"', block)
        date = date_m.group(1) if date_m else datetime.now(timezone.utc).isoformat()

        img = None
        img_m = re.search(
            r'tgme_widget_message_photo_wrap[^>]+background-image:url\([\'"]([^\'"]+)[\']\)',
            block,
        )
        if not img_m:
            img_m = re.search(
                r'class="[^"]*tgme_widget_message_photo[^"]*"[^>]+src="(https://cdn\d\.telesco\.pe/file/[^"]+)"',
                block,
            )
        if img_m:
            img = img_m.group(1)

        title = guess_title(text)
        category = guess_category(text)
        body = paragraphs(text)
        excerpt_src = next((p for p in body if title.lower() not in p.lower()[: len(title) + 8] and len(p) > 40), body[-1] if body else title)
        excerpt = excerpt_src[:220] + ("…" if len(excerpt_src) > 220 else "")
        posts.append({
            "id": pid,
            "title": title,
            "date": date,
            "category": category,
            "tags": guess_tags(text, category),
            "excerpt": excerpt,
            "image": img or FALLBACK_IMAGES.get(category.lower(), FALLBACK_IMAGES["default"]),
            "source_url": f"https://t.me/StarkPrivacy/{pid}",
            "body": body,
            "locked": False,
        })
    by_id = {}
    for p in posts:
        by_id[p["id"]] = p
    return sorted(by_id.values(), key=lambda x: x["id"], reverse=True)


def merge(existing: list[dict], incoming: list[dict]) -> tuple[list[dict], int]:
    known = {int(item["id"]): item for item in existing}
    added = 0
    for post in incoming:
        if post["id"] in known:
            old = known[post["id"]]
            if old.get("locked") or old.get("edited"):
                continue
            if post.get("image") and "telesco.pe" in post["image"] and "telesco.pe" not in (old.get("image") or ""):
                old["image"] = post["image"]
            continue
        known[post["id"]] = post
        added += 1
    merged = sorted(known.values(), key=lambda x: int(x["id"]), reverse=True)
    return merged, added


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    if not (root / "index.html").exists():
        root = Path.cwd()
    dest = root / "data" / "news.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if dest.exists():
        existing = json.loads(dest.read_text(encoding="utf-8")).get("articles", [])
    html = fetch(PREVIEW)
    incoming = parse_posts(html)
    if not incoming:
        print("No posts parsed", file=sys.stderr)
        return 1
    merged, added = merge(existing, incoming)
    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": PREVIEW,
        "articles": merged[:80],
    }
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Parsed {len(incoming)} posts, added {added}, total {len(merged)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
