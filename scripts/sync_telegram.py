#!/usr/bin/env python3
"""Sync t.me/s/starkprivacy into data/news.json."""
from __future__ import annotations
import html as html_lib, json, re, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

CHANNEL = "starkprivacy"
PREVIEW = f"https://t.me/s/{CHANNEL}"
UA = "Mozilla/5.0 (compatible; PrivacidadNews/1.0)"
CATEGORIES = [
    ("cifrado", ["cifrado", "encryption", "signal", "pgp", "e2ee", "clave"]),
    ("herramientas", ["herramienta", "graphene", "brave", "firefox", "extensi", "navegador"]),
    ("servicios", ["vpn", "proton", "mullvad", "servicio", "email", "alias", "icloud"]),
    ("productos", ["pixel", "iphone", "android", "gafas", "router"]),
    ("empresas", ["apple", "google", "meta", "openai", "microsoft", "comcast", "amazon", "sony", "xbox"]),
    ("países", ["rusia", "reino unido", "ee.uu", "eeuu", "españa", "alemania", "unión europea"]),
    ("legislación", ["ley", "norma", "reglamento", "etsi", "gdpr", "dsa"]),
    ("seguridad", ["spyware", "malware", "ataque", "vulnerabilidad", "hack", "vigil"]),
    ("proyectos", ["proyecto", "open source", "código abierto", "grapheneos"]),
    ("identidad digital", ["identidad", "dni", "reconocimiento facial", "biometric", "kyc"]),
]
YT_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([A-Za-z0-9_-]{6,})", re.I)
HASH_RE = re.compile(r"(?:#|＃)([\wÁÉÍÓÚÜÑáéíóúüñ-]{2,40})")

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", "replace")

def strip_tags(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    text = re.sub(r"</(div|p|h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", html_lib.unescape(text)).strip()

def guess_title(text: str) -> str:
    lines = [ln.strip(" -–—*") for ln in text.splitlines() if ln.strip()]
    if not lines:
        return "Nueva noticia"
    first = re.sub(r"[^\wÁÉÍÓÚÜÑáéíóúüñ¿¡]+", "", lines[0], count=0)
    first = re.sub(r"^[^\wÁÉÍÓÚÜÑáéíóúüñ¿¡]+", "", lines[0]).strip()
    if len(first) < 12 and len(lines) > 1:
        first = re.sub(r"^[^\wÁÉÍÓÚÜÑáéíóúüñ¿¡]+", "", lines[1]).strip()
    if len(first) > 110:
        first = first[:107].rsplit(" ", 1)[0] + "…"
    return first or "Nueva noticia"

def telegram_hashtags(text: str) -> list[str]:
    out = []
    for raw in HASH_RE.findall(text or ""):
        tag = raw.lower()
        if tag not in out:
            out.append(tag)
    return out

def guess_category(text: str, tags: list[str]) -> str:
    blob = " ".join(tags + [text.lower()])
    for name, keys in CATEGORIES:
        if any(k in blob for k in keys):
            return "Países" if name == "países" else name.capitalize()
    return "Seguridad"

def guess_keyword_tags(text: str, category: str) -> list[str]:
    n = text.lower()
    found = [category.lower()]
    extra = {"apple":"apple","google":"google","meta":"meta","proton":"proton","signal":"signal","vpn":"vpn","chatgpt":"chatgpt","graphene":"grapheneos","pixel":"pixel","brave":"brave","mullvad":"mullvad"}
    for key, tag in extra.items():
        if key in n and tag not in found:
            found.append(tag)
    return found

def paragraphs(text: str) -> list[str]:
    chunks = [c.strip() for c in re.split(r"\n{2,}", text) if c.strip()]
    return chunks or [text]

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
        if len(text) < 20:
            continue
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
        title = guess_title(text)
        category = guess_category(text, hashtags)
        tags = hashtags if hashtags else guess_keyword_tags(text, category)
        body = paragraphs(text)
        has_media = bool(photo or video_thumb or yt)
        image = f"https://i.ytimg.com/vi/{yt}/hqdefault.jpg" if yt else (photo or video_thumb)
        posts.append({"id": pid, "title": title, "date": date, "category": category, "tags": " ".join(tags),
                      "excerpt": (body[-1] if body else title)[:220], "image": image, "youtube_id": yt,
                      "has_media": has_media, "in_feed": has_media,
                      "source_url": f"https://t.me/StarkPrivacy/{pid}", "body": body, "locked": False})
    return sorted({p["id"]: p for p in posts}.values(), key=lambda x: x["id"], reverse=True)

def fetch_pages(max_pages: int = 6) -> list[dict]:
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
                    old["has_media"] = old["in_feed"] = True
                continue
            old.update({k: post[k] for k in post if post[k] not in (None, "", [])})
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
    existing = []
    if dest.exists():
        old = json.loads(dest.read_text(encoding="utf-8"))
        existing = old.get("articles") or []
    incoming = fetch_pages(6)
    if not incoming:
        print("No posts parsed", file=sys.stderr)
        return 1
    merged, added = merge(existing, incoming)
    feed = [p for p in merged if p.get("in_feed") or p.get("has_media") or p.get("youtube_id")]
    archive = [{"id": p["id"], "title": p["title"], "date": p["date"],
                "url": p.get("source_url") or f"https://t.me/StarkPrivacy/{p['id']}",
                "has_media": bool(p.get("has_media") or p.get("youtube_id")),
                "youtube_id": p.get("youtube_id")} for p in merged]
    dest.write_text(json.dumps({"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                "source": PREVIEW, "articles": feed[:80], "archive": archive[:300]},
                               ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Parsed {len(incoming)} added {added} feed {len(feed)} archive {len(archive)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
