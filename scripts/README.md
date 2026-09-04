# Sincronización con Telegram

`sync_telegram.py` lee el canal con **Pyrogram** (login de bot) y reconstruye
`data/news.json` + `data/latest.json`, descargando la media a `media/` con
rutas estables. Sustituye al raspado de `t.me/s/…`, cuyas URLs de imagen
caducan.

## Puesta en marcha (una vez)

1. **my.telegram.org** → *API development tools* → crea una app → apunta
   `api_id` y `api_hash`.
2. **@BotFather** → `/newbot` → copia el token. (Si el token se ha filtrado
   alguna vez: `/revoke` y usa el nuevo.)
3. En el canal (**@starkprivacy**) → *Administradores* → añade el bot como
   admin con permisos mínimos. Necesita ser admin para leer el historial.
4. En GitHub → *Settings → Secrets and variables → Actions* del repositorio
   (`https://github.com/StarkPrivacy/privacidad-news/settings/secrets/actions`)
   → **New repository secret**:
   - `TG_API_ID`
   - `TG_API_HASH`
   - `TG_BOT_TOKEN`
   - `TG_SESSION_STRING` *(opcional; solo si el bot no pudiera leer el
     historial: una sesión de usuario de Pyrogram/Telethon)*

   Opcional en *Variables* (no secretos): `TG_CHANNEL`, `MEDIA_BASE`,
   `MAX_MEDIA_MB`. **Por defecto `MAX_MEDIA_MB` es `0`: los vídeos NO se
   descargan al repo** (se guarda el póster y un enlace a Telegram), para no
   inflar el repositorio ni pasarse del límite de GitHub Pages. Cuando tengas
   servidor propio, pon `MAX_MEDIA_MB` a `48` y `MEDIA_BASE` a la URL del CDN.

## Primera carga (backfill de todo el archivo)

GitHub → pestaña **Actions** → *Sync Telegram* → **Run workflow** → marca
**"Recorrer todo el archivo"** → Run.

Recorre hasta `ARCHIVE_LIMIT` mensajes, descarga toda la media que siga en el
canal (recupera las imágenes ya rotas) y hace commit de `data/` + `media/`.
Puede tardar varios minutos. Las siguientes ejecuciones (cron cada 20 min) van
en modo incremental y solo tocan lo nuevo. La media ya descargada no se vuelve
a bajar.

## Ejecutar en local

```bash
pip install pyrogram tgcrypto
export TG_API_ID=... TG_API_HASH=... TG_BOT_TOKEN=...
python3 scripts/sync_telegram.py --backfill      # o sin --backfill para incremental
```

## Esquema de `news.json`

Igual que antes, con las rutas de media apuntando a `MEDIA_BASE` (por defecto
`media/`, relativo a la raíz del repo):

```jsonc
{
  "id": 1669,
  "title": "…",
  "date": "2026-09-02T15:00:03+00:00",
  "category": "",          // se conserva si ya estaba puesto a mano
  "tags": "dyson camara",  // hashtags del post + los que ya hubiera
  "excerpt": "…",
  "image": "media/1669.jpg",
  "images": ["media/1669.jpg", "media/1669-2.jpg"],   // solo álbumes
  "video_url": "media/1669.mp4",   // solo si MAX_MEDIA_MB > 0 y el vídeo cabe
  "video_thumb": "media/1669.jpg",
  "video_external": true,   // vídeo no descargado: póster + enlace a Telegram
  "youtube_id": null,
  "source_url": "https://t.me/StarkPrivacy/1669",
  "sources": ["https://www.theverge.com/…"],           // incl. preview del enlace
  "body": ["…", "…"],
  "has_media": true,
  "in_feed": true,
  "locked": false
}
```

El sitio actual (raíz) sigue funcionando sin cambios porque sirve desde la
raíz. `/v2` sube un nivel (`../media/…`) automáticamente.

## Cuando pases a servidor propio

Sube `media/` a tu servidor/CDN y pon la variable `MEDIA_BASE` a
`https://cdn.tudominio.com`. En la siguiente sincronización los artículos
nuevos ya apuntarán ahí; para reescribir los antiguos, lanza un backfill.

## Si el bot no puede leer el historial

Algunos canales restringen la lectura de historial a bots. Solución: genera una
**session string de usuario** una vez y ponla en `TG_SESSION_STRING`:

```bash
python3 -c "from pyrogram import Client; \
c=Client(':memory:', api_id=API_ID, api_hash='API_HASH'); \
c.start(); print(c.export_session_string()); c.stop()"
```
