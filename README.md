# Privacidad.news

Medio independiente de noticias sobre privacidad, seguridad y soberanía digital.
Sitio estático: se sirve tal cual desde la raíz.

## Estructura

| | |
|---|---|
| `index.html`, `styles.css`, `app.js` | el sitio |
| `donaciones.html`, `anunciate.html`, `legal.html`, `404.html` | páginas sueltas |
| `fonts/` | IBM Plex auto-alojado (nada carga de Google Fonts) |
| `data/news.json`, `data/latest.json` | contenido, generado por el sync |
| `media/` | imágenes y pósters descargados de Telegram |
| `scripts/sync_telegram.py` | lee el canal de Telegram y regenera `data/` + `media/` |
| `.github/workflows/sync-telegram.yml` | ejecuta el sync (cron cada 20 min) |
| `.htaccess`, `robots.txt`, `sitemap.xml` | producción |

## Puesta en marcha del sync

Ver [`scripts/README.md`](scripts/README.md).

## Desarrollo local

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```
