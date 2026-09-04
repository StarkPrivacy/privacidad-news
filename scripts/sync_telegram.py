#!/usr/bin/env python3
"""
Sincroniza el canal de Telegram -> data/news.json + media/ locales.

Usa Pyrogram con login de BOT (no la Bot API limitada): el bot, siendo
administrador del canal, puede recorrer todo el historial y descargar la
media sin el tope de 20 MB de getFile.

Config por variables de entorno (todas menos las 3 primeras tienen valor por
defecto):

  TG_API_ID         (obligatoria)  de my.telegram.org
  TG_API_HASH       (obligatoria)  de my.telegram.org
  TG_BOT_TOKEN      (obligatoria)  de @BotFather
  TG_SESSION_STRING (opcional)     sesión de usuario; si se define se usa en
                                   lugar del bot (plan B si el bot no pudiera
                                   leer el historial)

  TG_CHANNEL     = starkprivacy    usuario del canal (sin @)
  MEDIA_DIR      = media           carpeta local donde se guardan los ficheros
  MEDIA_BASE     = media           prefijo que se escribe en news.json.
                                   El día que tengas servidor propio: ponlo a
                                   https://cdn.tudominio.com y re-ejecuta.
  MAX_MEDIA_MB   = 48              vídeos mayores no se descargan: se marca
                                   video_external y se deja el enlace a Telegram
  BACKFILL       = 0               1 = recorre todo el archivo (primera vez)
                                   0 = solo mensajes más nuevos que el último
                                       que ya está en news.json
  ARCHIVE_LIMIT  = 5000            tope de mensajes a recorrer en un backfill
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from pyrogram import Client
    from pyrogram.errors import FloodWait
except ImportError:
    sys.exit("Falta Pyrogram. Instala:  pip install pyrogram tgcrypto")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
NEWS_JSON = DATA / "news.json"
LATEST_JSON = DATA / "latest.json"

def _env(name: str, default: str = "") -> str:
    """Lee una variable de entorno y le quita espacios/comillas/saltos de línea
    que se cuelan fácilmente al pegar secrets."""
    return os.environ.get(name, default).strip().strip('"').strip("'").strip()


API_ID = _env("TG_API_ID")
API_HASH = _env("TG_API_HASH")
BOT_TOKEN = _env("TG_BOT_TOKEN")
SESSION_STRING = _env("TG_SESSION_STRING")
CHANNEL = _env("TG_CHANNEL", "starkprivacy") or "starkprivacy"
MEDIA_DIR = ROOT / os.environ.get("MEDIA_DIR", "media")
MEDIA_BASE = os.environ.get("MEDIA_BASE", "media").rstrip("/")
MAX_MEDIA_BYTES = int(float(os.environ.get("MAX_MEDIA_MB", "48")) * 1024 * 1024)
BACKFILL = os.environ.get("BACKFILL", "0") == "1"
ARCHIVE_LIMIT = int(os.environ.get("ARCHIVE_LIMIT", "5000"))
LATEST_COUNT = 20

URL_RE = re.compile(r"https?://[^\s<>\"')]+", re.I)
YT_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([\w-]{11})", re.I
)
HASHTAG_RE = re.compile(r"(?<!\w)#(\w{2,32})", re.UNICODE)
LEAD_JUNK_RE = re.compile(r"^[\W_]+", re.UNICODE)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def msg_date_iso(msg) -> str:
    d = msg.date or datetime.now(timezone.utc)
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


def clean_line(line: str) -> str:
    return LEAD_JUNK_RE.sub("", line.strip()).strip()


def split_paragraphs(text: str) -> list[str]:
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    chunks = re.split(r"\n\s*\n", text)
    if len(chunks) == 1:
        chunks = text.split("\n")
    out = []
    for c in chunks:
        c = " ".join(c.split()).strip()
        if c:
            out.append(c)
    return out


def make_excerpt(paragraphs: list[str], title: str) -> str:
    rest = " ".join(p for p in paragraphs if p != paragraphs[0]) if len(paragraphs) > 1 else ""
    src = rest or (paragraphs[0] if paragraphs else "")
    src = URL_RE.sub("", src).strip()
    if len(src) <= 240:
        return src
    cut = src[:240]
    sp = cut.rfind(" ")
    if sp > 160:
        cut = cut[:sp]
    return cut.rstrip(" ,.;:") + "…"


def extract_sources(text: str, youtube_id: str) -> list[str]:
    out, seen = [], set()
    for raw in URL_RE.findall(text or ""):
        u = raw.rstrip(").,;»\"'…")
        low = u.lower()
        if "t.me/" in low or "telegram." in low or "telesco.pe" in low:
            continue
        if youtube_id and ("youtube.com" in low or "youtu.be" in low):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def is_photo_doc(msg) -> bool:
    doc = getattr(msg, "document", None)
    return bool(doc and (doc.mime_type or "").startswith("image/"))


def has_media(a: dict) -> bool:
    """Solo se publican posts con foto, vídeo o enlace de YouTube."""
    return bool(a.get("image") or a.get("images") or a.get("video_url")
                or a.get("video_external") or a.get("youtube_id"))


def group_key(msg):
    return getattr(msg, "media_group_id", None)


# ---------------------------------------------------------------- build article

def build_article(app: Client, msgs: list, username: str, prev: dict) -> dict | None:
    """msgs: uno o varios mensajes del mismo álbum, orden ascendente por id."""
    lead = min(msgs, key=lambda m: m.id)
    art_id = lead.id
    text = ""
    for m in msgs:
        t = (m.text or m.caption or "").strip()
        if t and len(t) > len(text):
            text = t

    has_text = bool(text)
    media_msgs = [m for m in msgs if m.photo or m.video or m.animation
                  or m.video_note or is_photo_doc(m)]
    if not has_text and not media_msgs:
        return None

    paragraphs = split_paragraphs(text)
    title = clean_line(paragraphs[0]) if paragraphs else f"Publicación #{art_id}"
    body = paragraphs
    excerpt = make_excerpt(paragraphs, title)

    yt = YT_RE.search(text)
    youtube_id = yt.group(1) if yt else ""
    sources = extract_sources(text, youtube_id)

    # link preview -> fuente, NUNCA imagen del artículo
    wp = getattr(lead, "web_page", None) or getattr(lead, "web_page_preview", None)
    wp_url = None
    if wp is not None:
        wp_obj = getattr(wp, "webpage", wp)
        wp_url = getattr(wp_obj, "url", None)
        if wp_url and wp_url not in sources:
            low = wp_url.lower()
            if not youtube_id or ("youtube" not in low and "youtu.be" not in low):
                sources.append(wp_url)
        if not youtube_id and wp_url:
            m2 = YT_RE.search(wp_url)
            if m2:
                youtube_id = m2.group(1)

    tags = sorted({h.lower() for h in HASHTAG_RE.findall(text)})

    art = {
        "id": art_id,
        "title": title,
        "date": msg_date_iso(lead),
        "category": prev.get("category", ""),
        "tags": " ".join(sorted(set((prev.get("tags", "").split()) + tags))),
        "excerpt": excerpt,
        "image": "",
        "youtube_id": youtube_id or None,
        "has_media": bool(media_msgs) or bool(youtube_id),
        "in_feed": True,
        "source_url": f"https://t.me/{username}/{art_id}",
        "body": body,
        "locked": False,
    }
    if sources:
        art["sources"] = sources

    if youtube_id:
        return art  # el sitio usa la miniatura de YouTube

    # ---- descarga de media
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    images: list[str] = []

    def local(name: str) -> str:
        return f"{MEDIA_BASE}/{name}"

    def dl(m, name: str) -> str | None:
        path = MEDIA_DIR / name
        if path.exists() and path.stat().st_size > 0:
            return str(path)
        try:
            return app.download_media(m, file_name=str(path))
        except Exception as e:  # noqa: BLE001
            print(f"  ! no se pudo bajar {name}: {e}")
            return None

    idx = 0
    for m in sorted(msgs, key=lambda x: x.id):
        suffix = "" if idx == 0 else f"-{idx + 1}"
        if m.photo or is_photo_doc(m):
            if dl(m, f"{art_id}{suffix}.jpg"):
                images.append(local(f"{art_id}{suffix}.jpg"))
                idx += 1
        elif m.video or m.animation or m.video_note:
            v = m.video or m.animation or m.video_note
            size = getattr(v, "file_size", 0) or 0
            # poster
            thumbs = getattr(v, "thumbs", None) or []
            if thumbs and dl(thumbs[-1], f"{art_id}.jpg"):
                art["video_thumb"] = local(f"{art_id}.jpg")
                if not art["image"]:
                    art["image"] = local(f"{art_id}.jpg")
            # MAX_MEDIA_MB <= 0  -> nunca se descarga vídeo (solo enlace + póster).
            too_big = MAX_MEDIA_BYTES <= 0 or (size and size > MAX_MEDIA_BYTES)
            if too_big:
                art["video_external"] = True
                why = "vídeo desactivado" if MAX_MEDIA_BYTES <= 0 else \
                    f"{size/1048576:.1f} MB > límite"
                print(f"  vídeo {art_id}: {why}, se deja enlace a Telegram")
            elif dl(m, f"{art_id}.mp4"):
                art["video_url"] = local(f"{art_id}.mp4")
            idx += 1

    if images:
        art["image"] = images[0]
        if len(images) > 1:
            art["images"] = images
    elif not art["image"]:
        art["has_media"] = bool(art.get("video_url") or art.get("video_external"))

    if not has_media(art):
        return None  # post de solo texto: no se publica
    return art


# ---------------------------------------------------------------------- main

def make_client() -> Client:
    if not API_ID or not API_HASH:
        sys.exit("Faltan TG_API_ID / TG_API_HASH (secrets de GitHub).")
    if not API_ID.isdigit():
        sys.exit(
            f"TG_API_ID debe ser solo el número (7-8 cifras), pero vale "
            f"'{API_ID[:4]}…' ({len(API_ID)} car.). ¿Lo has puesto en el "
            "secret equivocado? El número va en TG_API_ID y la cadena hex de "
            "32 caracteres en TG_API_HASH."
        )
    if len(API_HASH) != 32:
        print(f"Aviso: TG_API_HASH tiene {len(API_HASH)} caracteres; "
              "lo normal son 32. Revisa que esté completo y sin espacios.")
    common = dict(api_id=int(API_ID), api_hash=API_HASH, in_memory=True,
                  no_updates=True)
    if SESSION_STRING:
        return Client("pn-sync", session_string=SESSION_STRING, **common)
    if not BOT_TOKEN:
        sys.exit("Falta TG_BOT_TOKEN (secret de GitHub) o TG_SESSION_STRING.")
    return Client("pn-sync", bot_token=BOT_TOKEN, **common)


def run() -> int:
    existing = {}
    meta_source = f"https://t.me/{CHANNEL}"
    if NEWS_JSON.exists():
        try:
            data = json.loads(NEWS_JSON.read_text("utf-8"))
            for a in data.get("articles", data.get("posts", [])):
                existing[a["id"]] = a
        except Exception as e:  # noqa: BLE001
            print(f"news.json ilegible ({e}); se reconstruye")

    max_known = max(existing) if existing else 0
    print(f"{'BACKFILL completo' if BACKFILL else 'incremental'} · "
          f"{len(existing)} noticias en archivo · último id {max_known}")

    app = make_client()
    processed: dict[int, dict] = {}
    with app:
        me = app.get_me()
        is_bot = bool(getattr(me, "is_bot", False))
        chat = app.get_chat(CHANNEL)
        username = chat.username or CHANNEL
        meta_source = f"https://t.me/{username}"
        print(f"canal: {chat.title} (@{username}) · {'bot' if is_bot else 'usuario'}")

        def get_batch(ids: list[int]) -> list:
            """channels.getMessages: SÍ funciona para bots (a diferencia de
            get_chat_history)."""
            while True:
                try:
                    res = app.get_messages(chat.id, ids)
                    return res if isinstance(res, list) else [res]
                except FloodWait as fw:  # noqa: PERF203
                    wait = int(getattr(fw, "value", 30)) + 2
                    print(f"  FloodWait {wait}s")
                    time.sleep(wait)

        def top_id() -> int:
            """Descubre el id más alto sondeando hacia delante por ventanas."""
            top = max_known
            cur = max_known + 1
            empty = 0
            while empty < 2 and cur < max_known + 6000:
                got = [m for m in get_batch(list(range(cur, cur + 100)))
                       if m and not getattr(m, "empty", False)]
                if got:
                    top = max(top, max(m.id for m in got))
                    empty = 0
                else:
                    empty += 1
                cur += 100
            return top

        latest = top_id()
        start = 1 if BACKFILL else max_known + 1
        end = min(latest, start + ARCHIVE_LIMIT - 1)
        if start > end:
            print("No hay mensajes nuevos.")
        else:
            print(f"leyendo mensajes {start}–{end}")

        buf: list = []
        buf_key = object()
        seen = 0

        def flush():
            nonlocal buf
            if not buf:
                return
            gid = min(m.id for m in buf)
            try:
                art = build_article(app, buf, username, existing.get(gid, {}))
                if art:
                    processed[art["id"]] = art
                    tag = "nuevo" if gid not in existing else "actualizado"
                    print(f"  #{art['id']} {tag}: {art['title'][:70]}")
            except Exception as e:  # noqa: BLE001
                print(f"  ! error en #{gid}: {e}")
            buf = []

        lo = start
        while lo <= end:
            hi = min(lo + 199, end)
            for msg in get_batch(list(range(lo, hi + 1))):
                if not msg or getattr(msg, "empty", False) or msg.service:
                    continue
                seen += 1
                k = group_key(msg)
                if k is not None and k == buf_key:
                    buf.append(msg)
                else:
                    flush()
                    buf = [msg]
                    buf_key = k if k is not None else object()
            lo = hi + 1
            time.sleep(0.35)
        flush()

        # Solo es un fallo real si HABÍA mensajes que leer y no se leyó
        # ninguno. "No hay mensajes nuevos" (start > end) es el caso normal
        # de una sincronización incremental sin novedades y no debe abortar.
        if start <= end and not processed and seen == 0:
            sys.exit(
                "No se pudo leer ningún mensaje. Revisa que el bot es admin "
                "del canal, o define TG_SESSION_STRING con sesión de usuario."
            )
        print(f"{seen} mensajes leídos · {len(processed)} artículos construidos")

    merged = dict(existing)
    for aid, art in processed.items():
        old = existing.get(aid, {})
        if old.get("category") and not art.get("category"):
            art["category"] = old["category"]
        merged[aid] = art

    articles = [merged[k] for k in sorted(merged, reverse=True)
                if has_media(merged[k])]
    dropped = len(merged) - len(articles)
    if dropped:
        print(f"{dropped} posts sin foto/vídeo/YouTube descartados")
    DATA.mkdir(parents=True, exist_ok=True)
    NEWS_JSON.write_text(json.dumps(
        {"updated": now_iso(), "source": meta_source, "articles": articles},
        ensure_ascii=False, indent=2) + "\n", "utf-8")
    LATEST_JSON.write_text(json.dumps(
        {"updated": now_iso(), "articles": articles[:LATEST_COUNT]},
        ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"escrito news.json ({len(articles)}) y latest.json")
    return 0


if __name__ == "__main__":
    if "--backfill" in sys.argv:
        BACKFILL = True
    raise SystemExit(run())
