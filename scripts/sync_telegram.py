#!/usr/bin/env python3
"""Sync t.me/s/starkprivacy into data/news.json."""
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
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
MAX_PAGES = 16
ARCHIVE_LIMIT = 400

CATEGORIES = [
    ("Cifrado", ["cifrado", "encryption", "e2ee", "pgp", "gpg", "clave publica"]),
    ("Herramientas", ["herramienta", "graphene", "brave", "firefox", "extensi", "navegador", "tor browser"]),
    ("Servicios", ["vpn", "proton", "mullvad", "servicio", "email", "alias", "icloud", "hide my email"]),
    ("Productos", ["pixel", "iphone", "android", "gafas", "router", "xbox", "playstation"]),
    ("Empresas", ["apple", "google", "meta", "openai", "microsoft", "comcast", "amazon", "sony", "aliexpress"]),
    ("Paises", ["rusia", "reino unido", "ee.uu", "eeuu", "espana", "alemania", "union europea", "ue exige", "la ue"]),
    ("Legislacion", ["ley", "norma", "reglamento", "etsi", "gdpr", "dsa", "requisitos minimos"]),
    ("Seguridad", ["spyware", "malware", "ataque", "vulnerabilidad", "hack", "vigil", "identificarte"]),
    ("Proyectos", ["proyecto", "open source", "codigo abierto", "grapheneos"]),
    ("Identidad digital", ["identidad", "dni", "reconocimiento facial", "biometric", "kyc"]),
]

KEYWORD_TAGS = {
    "apple": "apple", "google": "google", "meta": "meta", "openai": "openai",
    "chatgpt": "chatgpt", "proton": "proton", "signal": "signal", "vpn": "vpn",
    "mullvad": "mullvad", "graphene": "grapheneos", "pixel": "pixel", "brave": "brave",
    "firefox": "firefox", "microsoft": "microsoft", "sony": "sony", "xbox": "xbox",
    "aliexpress": "aliexpress", "comcast": "comcast", "kyc": "kyc", "youtube": "youtube",
}

YT_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{11})", re.I)
HASH_RE = re.compile(r"(?:^|\s)#([A-Za-z][\w-]{1,39})")
COLOR_RE = re.compile(r"^[0-9a-f]{3,8}$", re.I)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", "replace")


def strip_tags(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    text = re.sub(r"</(div|p|h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<a[^>]+href=\"([^\"]+)\"[^>]*>", r"\1 ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", html_lib.unescape(text)).strip()


def guess_title(text: str) -> str:
    lines = [re.sub(r"\s+", " ", ln).strip(" -*") for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "Publicacion"
    first = re.sub(r"^[^\w?]+", "", lines[0]).strip()
    if len(first) < 8 and len(lines) > 1:
        first = re.sub(r"^[^\w?]+", "", lines[1]).strip()
    first = re.sub(r"^https?://\S+", "", first).strip() or first
    if len(first) > 110:
        first = first[:107].rsplit(" ", 1)[0] + "..."
    return first or "Publicacion"


def telegram_hashtags(text: str) -> list[str]:
    out = []
    for raw in HASH_RE.findall(text or ""):
        tag = raw.lower()
        if COLOR_RE.match(tag) or tag.isdigit():
            continue
        if tag not in out:
            out.append(tag)
    return out


def guess_category(text: str, tags: list[str]) -> str:
    blob = " ".join(tags + [text.lower()])
    mapping = {
        "Cifrado": CATEGORIES[0][1],
        "Herramientas": CATEGORIES[1][1],
        "Servicios": CATEGORIES[2][1],
        "Productos": CATEGORIES[3][1],
        "Empresas": CATEGORIES[4][1],
        "Paises": CATEGORIES[5][1],
        "Legislacion": CATEGORIES[6][1],
        "Seguridad": CATEGORIES[7][1],
        "Proyectos": CATEGORIES[8][1],
        "Identidad digital": CATEGORIES[9][1],
    }
    pretty = {
        "Paises": "Países",
        "Legislacion": "Legislación",
    }
    for name, keys in mapping.items():
        if any(k in blob for k in keys):
            return pretty.get(name, name)
    return "Seguridad"


def guess_keyword_tags(text: str, category: str, hashtags: list[str], youtube: bool) -> list[str]:
    found = []
    for tag in hashtags:
        if tag not in found:
            found.append(tag)
    cat = category.lower()
    if cat not in found:
        found.append(cat)
    n = text.lower()
    for key, tag in KEYWORD_TAGS.items():
        if key in n and tag not in found:
            found.append(tag)
    if youtube and "youtube" not in found:
        found.append("youtube")
    return found


def paragraphs(text: str) -> list[str]:
    chunks = [re.sub(r"\s+", " ", c).strip() for c in re.split(r"\n{2,}", text) if c.strip()]
    return chunks or ([text] if text else [])


def youtube_id(text: str):
    m = YT_RE.search(text or "")
    return m.group(1) if m else None


def parse_posts(page: str) -> list[dict]:
    posts = []
    for block in re.split(r'<div class="tgme_widget_message ', page)[1:]:
        m_id = re.search(r'data-post="[^"/]+/(\d+)"', block) or re.search(r"https://t\.me/[^/]+/(\d+)", block)
        if not m_id:
            continue
        pid = int(m_id.group(1))
        text_m = re.search(r'class="[^"]*tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', block, re.S)
        text = strip_tags(text_m.group(1)) if text_m else ""
        date_m = re.search(r'<time datetime="([^"]+)"', block)
        date = date_m.group(1) if date_m else datetime.now(timezone.utc).isoformat()
        photo = None
        img_m = re.search(r"tgme_widget_message_photo_wrap[^>]+background-image:url\(['\"]([^'\"]+)['\"]\)", block)
        if img_m:
            photo = img_m.group(1)
        vid_m = re.search(r"tgme_widget_message_video_thumb[^>]+background-image:url\(['\"]([^'\"]+)['\"]\)", block)
        video_thumb = vid_m.group(1) if vid_m else None
        yt = youtube_id(text) or youtube_id(block)
        hashtags = telegram_hashtags(text)
        title = guess_title(text) if text else f"Publicacion #{pid}"
        category = guess_category(text, hashtags)
        tags = guess_keyword_tags(text, category, hashtags, bool(yt))
        body = paragraphs(text)
        excerpt_src = body[1] if len(body) > 1 else (body[0] if body else title)
        excerpt = excerpt_src[:220]
        has_media = bool(photo or video_thumb or yt)
        image = f"https://i.ytimg.com/vi/{yt}/hqdefault.jpg" if yt else (photo or video_thumb)
        posts.append({
            "id": pid,
            "title": title,
            "date": date,
            "category": category,
            "tags": " ".join(tags),
            "excerpt": excerpt,
            "image": image,
            "youtube_id": yt,
            "has_media": has_media,
            "in_feed": has_media,
            "source_url": f"https://t.me/StarkPrivacy/{pid}",
            "body": body,
            "locked": False,
        })
    return sorted({p["id"]: p for p in posts}.values(), key=lambda x: x["id"], reverse=True)


def fetch_pages(max_pages: int = MAX_PAGES) -> list[dict]:
    url = PREVIEW
    all_posts = {}
    for _ in range(max_pages):
        html = fetch(url)
        batch = parse_posts(html)
        if not batch:
            break
        for p in batch:
            all_posts[p["id"]] = p
        rel = re.search(r'<link rel="prev" href="([^"]+)"', html)
        if not rel:
            break
        href = rel.group(1)
        url = "https://t.me" + href if href.startswith("/") else href
    return sorted(all_posts.values(), key=lambda x: x["id"], reverse=True)


def load_existing(dest: Path) -> list[dict]:
    if not dest.exists():
        return []
    old = json.loads(dest.read_text(encoding="utf-8"))
    known = {}
    for key in ("articles", "posts"):
        for item in old.get(key) or []:
            try:
                known[int(item["id"])] = item
            except (KeyError, TypeError, ValueError):
                continue
    for item in old.get("archive") or []:
        try:
            pid = int(item["id"])
        except (KeyError, TypeError, ValueError):
            continue
        if pid in known:
            continue
        known[pid] = {
            "id": pid,
            "title": item.get("title") or f"Publicacion #{pid}",
            "date": item.get("date") or "",
            "category": "Seguridad",
            "tags": "",
            "excerpt": item.get("title") or "",
            "image": None,
            "youtube_id": item.get("youtube_id"),
            "has_media": bool(item.get("has_media") or item.get("youtube_id")),
            "in_feed": bool(item.get("has_media") or item.get("youtube_id")),
            "source_url": item.get("url") or f"https://t.me/StarkPrivacy/{pid}",
            "body": [],
            "locked": False,
        }
    return list(known.values())


def merge(existing, incoming):
    known = {int(i["id"]): i for i in existing}
    added = 0
    for post in incoming:
        if post["id"] in known:
            old = known[post["id"]]
            if old.get("locked") or old.get("edited"):
                if not old.get("youtube_id") and post.get("youtube_id"):
                    old["youtube_id"] = post["youtube_id"]
                    old["image"] = post["image"]
                    old["has_media"] = True
                    old["in_feed"] = True
                if post.get("tags") and not old.get("tags"):
                    old["tags"] = post["tags"]
                continue
            for key, value in post.items():
                if value not in (None, "", []):
                    old[key] = value
            old["has_media"] = bool(old.get("image") or old.get("youtube_id"))
            old["in_feed"] = old["has_media"]
            continue
        known[post["id"]] = post
        added += 1
    return sorted(known.values(), key=lambda x: int(x["id"]), reverse=True), added


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    if not (root / "index.html").exists():
        root = Path.cwd()
    dest = root / "data" / "news.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    existing = load_existing(dest)
    incoming = fetch_pages(MAX_PAGES)
    if not incoming:
        print("No posts parsed", file=sys.stderr)
        return 1
    merged, added = merge(existing, incoming)
    merged = merged[:ARCHIVE_LIMIT]
    feed = [p for p in merged if p.get("in_feed") or p.get("has_media") or p.get("youtube_id")]
    archive = [{
        "id": p["id"],
        "title": p["title"],
        "date": p["date"],
        "url": p.get("source_url") or f"https://t.me/StarkPrivacy/{p['id']}",
        "has_media": bool(p.get("has_media") or p.get("youtube_id") or p.get("image")),
        "youtube_id": p.get("youtube_id"),
    } for p in merged]
    payload = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": PREVIEW,
        "articles": merged,
        "archive": archive,
    }
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Parsed {len(incoming)} added {added} feed {len(feed)} archive {len(archive)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
