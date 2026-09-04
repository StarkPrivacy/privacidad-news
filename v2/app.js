document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/v2/';
  const YT_CHANNEL_ID = 'UCiWK5LDY5nmnMpfGsL7KENQ';
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const FEED_PAGE = 12;
  const DATA_BASE = '../data/';

  /* Correcciones manuales puntuales (migradas de fixes.js) */
  const OVERRIDES = {
    1661: {
      title: 'Caída generalizada de los servicios de Proton',
      excerpt: 'La mayoría de servicios de Proton están caídos para gran parte de sus usuarios desde hace más de veinte minutos.',
      image: '../images/proton-outage.svg',
      body: [
        'La mayoría de servicios de Proton se encuentran caídos en estos momentos para la mayoría de sus usuarios, desde hace más de 20 minutos.',
        'No se trata de un aviso aislado: el propio panel de estado de la compañía es la referencia para ver qué partes de la suite siguen afectadas y cuáles van recuperándose.',
        'Quien dependa del correo, la VPN u otras herramientas de Proton conviene revisar ese estado antes de asumir que el fallo está en su red o en su dispositivo.'
      ]
    }
  };

  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const feedPager = document.getElementById('feedPager');
  const tagCloud = document.getElementById('filterList') || document.querySelector('.tag-cloud');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const modalKicker = document.getElementById('modalKicker');
  const cinema = document.getElementById('cinema');
  const cinemaPlayer = document.getElementById('cinemaPlayer');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');
  const siteHeader = document.getElementById('siteHeader');

  let cards = [];
  let tagLinks = [];
  let articlesById = {};
  let activeCategory = '';
  let feedPage = 0;
  let shareContext = null;

  const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // news.json guarda rutas de media relativas a la ra\u00edz del repo (media/1669.jpg).
  // Esta p\u00e1gina se sirve desde /v2/, as\u00ed que hay que subir un nivel.
  const mediaURL = (u) => {
    const s = String(u || '').trim();
    if (!s || /^(https?:)?\/\//i.test(s) || /^(data:|blob:|\/|\.\.\/)/.test(s)) return s;
    return `../${s}`;
  };
  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const parseTags = (item) => String(item.tags || '').split(/[\s,]+/)
    .map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);
  const articleShareData = (id, title) => {
    const safeTitle = title || 'Privacidad.news';
    return { title: safeTitle, url: `${SITE_URL}#noticia-${id}`, text: `${safeTitle} — Privacidad.news` };
  };
  const xShareUrl = (data) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  const tgShareUrl = (data) => `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  const stripLeadEmoji = (str) => String(str || '')
    .replace(/^(?:[\s\u200d\ufe0f\u20e3]*(?:[\u{1F000}-\u{1FAFF}]|[\u2300-\u23FF]|[\u2600-\u27BF]|[\u2B00-\u2BFF]|[\u25A0-\u25FF]|[\u{1F1E6}-\u{1F1FF}])+)+[\s\u200d\ufe0f\u20e3]*/u, '')
    .replace(/^[^\p{L}\p{N}¿¡«“"'(]+/u, '')
    .trim();
  const stripUrls = (str) => String(str || '')
    .replace(/https?:\/\/[^\s<>"']+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const looksTruncated = (str) => /\.{2,}$/.test(String(str || '').trim());

  const cleanTitle = (item) => {
    const rawTitle = stripLeadEmoji(stripUrls(item.title || ''));
    const rawExcerpt = stripLeadEmoji(stripUrls(item.excerpt || ''));
    if (looksTruncated(rawTitle) && rawExcerpt && rawExcerpt.length > rawTitle.replace(/\.{2,}$/, '').trim().length + 8) {
      return rawExcerpt;
    }
    let title = rawTitle || rawExcerpt;
    // Títulos degenerados ("Así es.", ":") — usa el primer párrafo con sustancia.
    if (title.replace(/[^\p{L}\p{N}]/gu, '').length < 12) {
      const firstBody = (item.body || [])
        .map(p => stripLeadEmoji(stripUrls(p)))
        .find(p => p && p.replace(/[^\p{L}\p{N}]/gu, '').length >= 14);
      if (firstBody) title = firstBody;
    }
    return title;
  };
  const cleanExcerpt = (item) => {
    const title = cleanTitle(item);
    let excerpt = stripLeadEmoji(stripUrls(item.excerpt || ''));
    if (!excerpt || normalize(excerpt) === normalize(title) || normalize(title).startsWith(normalize(excerpt))) {
      // Recurre al primer párrafo distinto del título.
      excerpt = (item.body || [])
        .map(p => stripLeadEmoji(stripUrls(p)))
        .find(p => p && normalize(p) !== normalize(title) && p.replace(/[^\p{L}\p{N}]/gu, '').length >= 24) || '';
    }
    // Descarta fragmentos vacíos tipo "Así que la pregunta es clara:".
    if (excerpt && excerpt.replace(/[^\p{L}\p{N}]/gu, '').length < 20) return '';
    return excerpt;
  };
  const fallbackLetter = (item) => {
    const source = cleanTitle(item) || item.category || 'P';
    const match = String(source).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/);
    return (match ? match[0] : 'P').toUpperCase();
  };
  const cardTitle = (item) => {
    const full = cleanTitle(item);
    if (full.length <= 120) return full;
    const cut = full.slice(0, 120);
    const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
    return `${(at > 64 ? cut.slice(0, at) : cut).replace(/[.,;:\s]+$/, '')}…`;
  };

  const isVideoItem = (item) => Boolean(item.youtube_id || item.video_url || item.video_external);

  const isTelegramHost = (host) => /(?:^|\.)(?:t\.me|telegram\.(?:org|me)|telesco\.pe)$/i.test(host || '');
  const isYoutubeHost = (host) => /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(host || '');
  const extractUrls = (text) => String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];

  function sourcesOf(item) {
    const raw = [...(item.sources || [])];
    (item.body || []).forEach(p => raw.push(...extractUrls(p)));
    const seen = new Set();
    const out = [];
    raw.forEach(value => {
      const url = String(value || '').replace(/[),.;»"'…]+$/g, '').trim();
      if (!url || url.includes('…')) return;
      let host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return; }
      if (isTelegramHost(host)) return;
      if (item.youtube_id && isYoutubeHost(host)) return;
      if ((host === 'x.com' || host === 'twitter.com') && /\/search/i.test(url)) return;
      if (seen.has(url)) return;
      seen.add(url);
      out.push(url);
    });
    return out;
  }

  function cleanParagraphs(item) {
    const title = normalize(cleanTitle(item));
    return (item.body || [])
      .map(p => stripLeadEmoji(stripUrls(p)).replace(/\s+/g, ' ').trim())
      .filter(p => p && normalize(p) !== title && p.replace(/[^\p{L}\p{N}]/gu, '').length >= 2);
  }

  /* ---------- Imágenes con cadena de respaldo ---------- */
  const catHue = (cat) => cat
    ? [...cat].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 360
    : 215;
  function fallbackTileHtml(item) {
    const cat = item.category || '';
    const wm = cat ? `<span class="fallback-wm" aria-hidden="true">${escapeHtml(cat)}</span>` : '';
    const tag = cat ? `<span class="fallback-tag">${escapeHtml(cat)}</span>` : '';
    return `${wm}<span class="fallback-letter" aria-hidden="true">${escapeHtml(fallbackLetter(item))}</span>${tag}`;
  }
  function paintFallback(wrap, item) {
    if (!wrap) return;
    wrap.classList.add('is-fallback');
    if (item && item.category) wrap.style.setProperty('--tile-h', catHue(item.category));
    wrap.innerHTML = item ? fallbackTileHtml(item)
      : `<span class="fallback-letter" aria-hidden="true">P</span>`;
  }
  // El sync de Telegram guarda copias en images/thumbs/<id>.jpg. Solo probamos
  // ahí para imágenes del CDN de Telegram y dejamos de intentarlo si el primer
  // puñado de sondeos falla (carpeta aún vacía) para no llenar la consola de 404.
  // Cadena de respaldo local para cuando el CDN de Telegram ya ha caducado:
  // media/<id>.jpg (nuevo pipeline) -> images/thumbs/<id>.jpg (legado) -> tile.
  const FALLBACK_DIRS = ['../media/', '../images/thumbs/'];
  let fbMisses = 0;
  const fbProbably = () => fbMisses < FALLBACK_DIRS.length + 3;
  function bindImageFallback(root) {
    (root || document).querySelectorAll('.card-image img').forEach(img => {
      if (img.dataset.fbBound) return;
      img.dataset.fbBound = '1';
      const wrap = img.closest('.card-image');
      const card = img.closest('.news-card');
      const item = card && articlesById[card.dataset.id];
      const fail = () => {
        if (!wrap) return;
        const id = card && card.dataset.id;
        const step = Number(img.dataset.fbStep || 0);
        if (step > 0) fbMisses++;
        const remote = /telesco\.pe|(?:^|\.)t\.me|telegram/i.test(img.src) || step > 0;
        if (id && item && !isVideoItem(item) && remote && step < FALLBACK_DIRS.length && fbProbably()) {
          img.dataset.fbStep = String(step + 1);
          img.src = `${FALLBACK_DIRS[step]}${id}.jpg`;
          return;
        }
        paintFallback(wrap, item);
      };
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
  }
  function hideBrokenArticleMedia(root) {
    (root || document).querySelectorAll('.article-figure img, .article-gallery img').forEach(img => {
      if (img.dataset.errBound) return;
      img.dataset.errBound = '1';
      const fail = () => {
        const wrap = img.closest('.article-figure, .article-gallery');
        if (wrap) wrap.remove();
      };
      img.addEventListener('error', fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
    // Vídeo nativo de Telegram: si la URL ha caducado, deja solo el enlace y un aviso.
    (root || document).querySelectorAll('.native-player video').forEach(video => {
      if (video.dataset.errBound) return;
      video.dataset.errBound = '1';
      video.addEventListener('error', () => {
        const player = video.closest('.native-player');
        if (!player || player.dataset.failed) return;
        player.dataset.failed = '1';
        const link = player.dataset.tgLink || '#';
        player.innerHTML = `<div class="media-unavailable">
          <p>El vídeo alojado en Telegram ya no está disponible aquí.</p>
          <a class="btn" href="${link}" target="_blank" rel="noopener">Ver vídeo en Telegram</a>
        </div>`;
      });
    });
  }

  /* ---------- YouTube ---------- */
  const ytSrc = (id, autoplay) => {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  };
  function ytSubscribeRow(id, title, cinemaReady) {
    const cine = cinemaReady
      ? `<button type="button" class="btn btn-ghost cinema-btn" data-cinema="${escapeHtml(id)}" data-title="${escapeHtml(title || 'YouTube')}">Modo cine</button>`
      : '';
    return `<div class="yt-actions">
      <a class="btn yt-subscribe" href="https://www.youtube.com/channel/${YT_CHANNEL_ID}?sub_confirmation=1" target="_blank" rel="noopener">Suscribirse</a>
      <a class="btn btn-ghost" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">Ver en YouTube</a>
      ${cine}
    </div>`;
  }
  function ytFacade(id, title, cinemaReady) {
    return `<div class="yt-player" data-yt-id="${escapeHtml(id)}">
      <button type="button" class="yt-facade" data-yt-play="${escapeHtml(id)}" data-yt-title="${escapeHtml(title || 'YouTube')}" aria-label="Reproducir vídeo">
        <img src="${ytThumb(id)}" alt="" width="1280" height="720" decoding="async" />
        <span class="play-badge" aria-hidden="true">▶</span>
      </button>
      ${ytSubscribeRow(id, title, cinemaReady)}
    </div>`;
  }
  function ytEmbed(id, title, autoplay, cinemaReady) {
    return `<div class="yt-player" data-yt-id="${escapeHtml(id)}">
      <div class="yt-embed">
        <iframe src="${ytSrc(id, autoplay)}" title="${escapeHtml(title || 'YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>
      ${ytSubscribeRow(id, title, cinemaReady)}
    </div>`;
  }

  function itemImages(item) {
    const list = [];
    (Array.isArray(item.images) ? item.images : []).forEach(src => { if (src) list.push(mediaURL(src)); });
    if (item.image) list.unshift(mediaURL(item.image));
    return list.filter((src, i, arr) => src && arr.indexOf(src) === i);
  }

  function mediaBlock(item) {
    if (item.youtube_id) return ytFacade(item.youtube_id, item.title, true);
    if (item.video_url) {
      const tgLink = escapeHtml(item.source_url || '#');
      return `<div class="native-player" data-tg-link="${tgLink}">
        <video class="article-video" controls playsinline preload="metadata" crossorigin="anonymous" poster="${escapeHtml(mediaURL(item.video_thumb || item.image || ''))}" src="${escapeHtml(mediaURL(item.video_url))}"></video>
        <a class="btn btn-ghost" href="${tgLink}" target="_blank" rel="noopener">Abrir vídeo en Telegram</a>
      </div>`;
    }
    if (item.video_external) {
      const tgLink = escapeHtml(item.source_url || '#');
      const poster = escapeHtml(mediaURL(item.video_thumb || item.image || ''));
      return `<div class="native-player">
        <a class="tg-video" href="${tgLink}" target="_blank" rel="noopener" aria-label="Ver vídeo en Telegram">
          ${poster ? `<img src="${poster}" alt="" referrerpolicy="no-referrer" />` : ''}
          <span class="play-badge" aria-hidden="true">▶</span>
        </a>
        <a class="btn btn-ghost" href="${tgLink}" target="_blank" rel="noopener">Ver vídeo en Telegram</a>
      </div>`;
    }
    const imgs = itemImages(item);
    if (!imgs.length) return '';
    if (imgs.length === 1) {
      return `<figure class="article-figure"><img src="${escapeHtml(imgs[0])}" alt="" class="article-hero" referrerpolicy="no-referrer" data-full-image="${escapeHtml(imgs[0])}" /></figure>`;
    }
    return `<div class="article-gallery">${imgs.map(src =>
      `<figure class="article-figure"><img src="${escapeHtml(src)}" alt="" class="article-hero" referrerpolicy="no-referrer" data-full-image="${escapeHtml(src)}" /></figure>`
    ).join('')}</div>`;
  }

  function sourcesHtml(item) {
    const sources = sourcesOf(item);
    if (!sources.length) return '';
    return `<section class="article-sources"><h3>Fuentes</h3><ul>${
      sources.map(url => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url.replace(/^https?:\/\//, ''))}</a></li>`).join('')
    }</ul></section>`;
  }

  const AUTHOR_HTML = 'Escrito por <a class="author-link" href="https://x.com/StarkPrivacy" target="_blank" rel="noopener">Stark</a>';

  function articleTagsHtml(item) {
    const tags = parseTags(item);
    const bits = [];
    if (item.category) bits.push(item.category);
    tags.forEach(t => { if (!bits.some(b => normalize(b) === normalize(t))) bits.push(t); });
    if (!bits.length) return '';
    return `<div class="article-end-tags">${bits.map(t => `<button type="button" class="end-tag" data-filter="${escapeHtml(normalize(t))}">${escapeHtml(t)}</button>`).join('')}</div>`;
  }

  function kickerHtml(item) {
    const parts = [];
    if (item.category) parts.push(escapeHtml(item.category));
    if (isVideoItem(item)) parts.push('<span class="is-video">Vídeo</span>');
    if (!parts.length) return '';
    return `<span class="card-kicker">${parts.join('<span class="dot">·</span>')}</span>`;
  }

  function fullContentHtml(item) {
    const dateLabel = formatDate(item.date);
    const body = cleanParagraphs(item).map(p => `<p>${escapeHtml(p)}</p>`).join('') || '<p>Sin texto ampliado.</p>';
    return `
      <h1>${escapeHtml(cleanTitle(item))}</h1>
      <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time>${item.category ? `<span>${escapeHtml(item.category)}</span>` : ''}</p>
      <p class="article-byline">${AUTHOR_HTML}</p>
      ${mediaBlock(item)}
      <div class="article-body">${body}</div>
      ${sourcesHtml(item)}
      ${articleTagsHtml(item)}`;
  }

  function renderArticle(item) {
    const id = item.id;
    const title = escapeHtml(cardTitle(item));
    const excerpt = escapeHtml(cleanExcerpt(item));
    const dateLabel = formatDate(item.date);
    const isYt = Boolean(item.youtube_id);
    const isVid = isVideoItem(item);
    const image = isYt ? ytThumb(item.youtube_id) : escapeHtml(mediaURL(item.video_thumb || item.image || ''));

    const article = document.createElement('article');
    article.className = 'news-card' + (isVid ? ' is-video' : '');
    article.dataset.id = id;
    article.dataset.tags = normalize(parseTags(item).join(' '));
    article.dataset.category = normalize(item.category || '');
    article.id = `noticia-${id}`;

    const media = image
      ? `<div class="card-image${isVid ? ' is-video' : ''}"><img src="${image}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="400" height="260" />${isVid ? '<span class="play-badge" aria-hidden="true">▶</span>' : ''}</div>`
      : `<div class="card-image is-fallback" aria-hidden="true" style="--tile-h:${catHue(item.category || '')}">${fallbackTileHtml(item)}</div>`;

    article.innerHTML = `
      ${media}
      <div class="card-body">
        ${kickerHtml(item)}
        <h2 class="card-title"><a href="#noticia-${id}" class="open-article">${title}</a></h2>
        <div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time></div>
        ${excerpt ? `<p class="card-excerpt">${excerpt}</p>` : ''}
        <div class="card-actions"><p class="byline">${AUTHOR_HTML}</p><button type="button" class="btn btn-ghost share-btn" data-share>Compartir</button></div>
      </div>
      <template class="full-content">${fullContentHtml(item)}</template>`;
    return article;
  }

  /* ---------- Filtros / paginación ---------- */
  function matchingCards() {
    const query = normalize(input?.value.trim() || '');
    return cards.filter(card => {
      const title = normalize(card.querySelector('.card-title')?.textContent);
      const excerpt = normalize(card.querySelector('.card-excerpt')?.textContent);
      const tags = normalize(card.dataset.tags);
      const category = normalize(card.dataset.category);
      return (!query || title.includes(query) || excerpt.includes(query) || tags.includes(query) || category.includes(query) || String(card.dataset.id).includes(query))
        && (!activeCategory || category.includes(activeCategory) || tags.includes(activeCategory) || (activeCategory === 'video' && card.classList.contains('is-video')));
    });
  }

  function renderFeedPager(total, page, pages) {
    if (!feedPager) return;
    if (total <= FEED_PAGE) { feedPager.hidden = true; feedPager.innerHTML = ''; return; }
    feedPager.hidden = false;
    const btn = (n, label, current, disabled) =>
      `<button type="button" class="page-btn${current ? ' is-current' : ''}" data-feed-page="${n}" ${disabled ? 'disabled' : ''} ${current ? 'aria-current="page"' : ''}>${label}</button>`;
    const parts = [btn(page - 1, '«', false, page === 0)];
    const windowSize = 7;
    let start = Math.max(0, page - 3);
    let end = Math.min(pages - 1, start + windowSize - 1);
    start = Math.max(0, end - windowSize + 1);
    if (start > 0) parts.push(btn(0, '1', page === 0, false));
    if (start > 1) parts.push('<span class="pager-gap">…</span>');
    for (let i = start; i <= end; i++) parts.push(btn(i, String(i + 1), i === page, false));
    if (end < pages - 2) parts.push('<span class="pager-gap">…</span>');
    if (end < pages - 1) parts.push(btn(pages - 1, String(pages), page === pages - 1, false));
    parts.push(btn(page + 1, '»', false, page >= pages - 1));
    feedPager.innerHTML = parts.join('');
  }

  function applyFilters(resetPage) {
    if (resetPage) feedPage = 0;
    const matches = matchingCards();
    const pages = Math.max(1, Math.ceil(matches.length / FEED_PAGE));
    feedPage = Math.min(Math.max(0, feedPage), pages - 1);
    const isPristine = !activeCategory && !(input && input.value.trim());
    cards.forEach(card => { card.hidden = true; card.classList.remove('is-lead'); });
    const startIdx = feedPage * FEED_PAGE;
    const visible = matches.slice(startIdx, startIdx + FEED_PAGE);
    visible.forEach((card, i) => {
      card.hidden = false;
      if (isPristine && feedPage === 0 && i === 0 && !card.classList.contains('is-video')) {
        card.classList.add('is-lead');
      }
    });
    if (emptyState) emptyState.hidden = matches.length > 0;
    if (feedCount) {
      feedCount.textContent = matches.length
        ? `Página ${feedPage + 1} de ${pages} · ${matches.length} noticia${matches.length === 1 ? '' : 's'}`
        : '0 noticias';
    }
    if (activeFilterEl) {
      activeFilterEl.hidden = !activeCategory;
      const label = activeFilterEl.querySelector('span');
      if (label && activeCategory) label.textContent = `#${activeCategory}`;
    }
    renderFeedPager(matches.length, feedPage, pages);
  }

  /* ---------- Cinema ---------- */
  function openCinema(id, title) {
    if (!cinema || !cinemaPlayer || !id) return;
    cinemaPlayer.innerHTML = ytEmbed(id, title, true, false);
    cinema.hidden = false;
    document.body.classList.add('cinema-open');
  }
  function openCinemaMedia(html) {
    if (!cinema || !cinemaPlayer || !html) return;
    cinemaPlayer.innerHTML = html;
    cinema.hidden = false;
    document.body.classList.add('cinema-open');
  }
  function closeCinema() {
    if (!cinema || cinema.hidden) return;
    cinema.hidden = true;
    document.body.classList.remove('cinema-open');
    if (cinemaPlayer) cinemaPlayer.innerHTML = '';
  }

  /* ---------- Etiquetas ---------- */
  const filterLabel = (link) => normalize(link.dataset.filter || link.textContent.trim());
  function setActiveFilter(value) {
    activeCategory = normalize(value || '');
    tagLinks.forEach(l => l.classList.toggle('is-active', !!activeCategory && filterLabel(l) === activeCategory));
    applyFilters(true);
    document.querySelector('.feed-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function bindEndTags(root) {
    (root || document).querySelectorAll('.end-tag').forEach(tag => {
      if (tag.dataset.bound) return;
      tag.dataset.bound = '1';
      tag.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        closeModal();
        setActiveFilter(tag.dataset.filter || tag.textContent.replace(/^#/, ''));
      });
    });
  }

  /* ---------- Modal ---------- */
  function appendShareBar(data) {
    const bar = document.createElement('div');
    bar.className = 'article-share-bar';
    bar.innerHTML = `<span class="label">Compartir esta noticia</span>
      <a class="btn btn-ghost share-btn" href="${xShareUrl(data)}" target="_blank" rel="noopener">X</a>
      <a class="btn btn-ghost share-btn" href="${tgShareUrl(data)}" target="_blank" rel="noopener">Telegram</a>
      <button type="button" class="btn share-btn" data-copy-link>Copiar enlace</button>`;
    modalContent.appendChild(bar);
    bar.querySelector('[data-copy-link]')?.addEventListener('click', async e => {
      try { await navigator.clipboard.writeText(data.url); e.currentTarget.textContent = 'Copiado'; } catch {}
    });
  }

  function finishModal(item, data) {
    if (modalKicker) {
      const bits = [];
      if (item?.category) bits.push(item.category);
      if (item && isVideoItem(item)) bits.push('Vídeo');
      modalKicker.textContent = bits.join(' · ');
    }
    appendShareBar(data);
    bindYoutubePosters(modalContent);
    hideBrokenArticleMedia(modalContent);
    bindEndTags(modalContent);
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    modalContent.scrollTop = 0;
    document.querySelector('#articleModal .modal-close')?.focus();
  }

  function openModalFromItem(item) {
    if (!modal || !modalContent || !item) return;
    const data = articleShareData(item.id, cleanTitle(item));
    modalContent.innerHTML = fullContentHtml(item);
    finishModal(item, data);
    history.replaceState(null, '', `#noticia-${item.id}`);
  }

  function openModal(card) {
    const item = articlesById[card.dataset.id];
    if (item) { openModalFromItem(item); return; }
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;
    const data = articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim());
    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));
    finishModal(null, data);
    history.replaceState(null, '', `#noticia-${card.dataset.id}`);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modalContent.querySelectorAll('video').forEach(el => el.pause());
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
    if (location.hash.startsWith('#noticia-')) history.replaceState(null, '', location.pathname + location.search);
  }

  function bindYoutubePosters(root) {
    (root || document).querySelectorAll('[data-yt-play]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.dataset.ytPlay;
        const title = btn.dataset.ytTitle || 'YouTube';
        if (!id) return;
        if (btn.classList.contains('yt-facade')) {
          const player = btn.closest('.yt-player');
          if (player) player.innerHTML = ytEmbed(id, title, true, true);
          return;
        }
        const card = btn.closest('.news-card');
        if (card) openModal(card);
      });
    });
  }

  function bindCardEvents() {
    cards = Array.from(document.querySelectorAll('.news-card'));
    cards.forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-share], .author-link, a[target="_blank"]')) return;
        e.preventDefault();
        openModal(card);
      });
    });
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const card = btn.closest('.news-card');
        if (card) openShareMenu(btn, articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim()));
      });
    });
    bindYoutubePosters(feed);
    bindImageFallback(feed);
    applyFilters(true);
    if (location.hash.startsWith('#noticia-')) {
      const id = location.hash.replace('#noticia-', '');
      const card = document.querySelector(`.news-card[data-id="${id}"]`);
      if (card) openModal(card);
      else if (articlesById[id]) openModalFromItem(articlesById[id]);
    }
  }

  function bindFilterLinks(links) {
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const label = filterLabel(link);
        setActiveFilter(activeCategory === label ? '' : label);
      });
    });
  }
  function renderUnifiedFilters(items) {
    if (!tagCloud) return;
    const labels = new Map();
    (items || []).forEach(item => {
      const cat = (item.category || '').trim();
      if (cat) labels.set(normalize(cat), cat);
      parseTags(item).forEach(tag => labels.set(normalize(tag), tag));
      if (isVideoItem(item)) labels.set('video', 'Vídeo');
    });
    const entries = [...labels.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));
    tagCloud.innerHTML = entries.map(([key, name]) =>
      `<a href="#" role="listitem" data-filter="${escapeHtml(key)}">${escapeHtml(name)}</a>`
    ).join('') || '<p class="sidebar-text">Aún no hay etiquetas.</p>';
    tagLinks = Array.from(tagCloud.querySelectorAll('a'));
    bindFilterLinks(tagLinks);
  }

  function skeleton(n) {
    let out = '';
    for (let i = 0; i < n; i++) {
      out += `<div class="skeleton-card"><div class="sk sk-img"></div><div><div class="sk sk-line title"></div><div class="sk sk-line short"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></div></div>`;
    }
    return out;
  }

  /* ---------- Carga de datos ---------- */
  async function loadJson(name) {
    const res = await fetch(`${DATA_BASE}${name}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`${name} ${res.status}`);
    return res.json();
  }

  if (feed) feed.innerHTML = skeleton(6);

  try {
    const results = await Promise.allSettled([loadJson('news.json'), loadJson('latest.json')]);
    const main = results[0].status === 'fulfilled' ? results[0].value : null;
    const latest = results[1].status === 'fulfilled' ? results[1].value : null;
    if (!main) throw results[0].reason || new Error('news.json');

    const byId = new Map();
    (main.posts || main.articles || []).forEach(item => byId.set(item.id, item));
    // latest.json tiene prioridad (versión más reciente del mismo id).
    (latest && (latest.articles || latest.posts) || []).forEach(item => {
      if (!item || !item.id) return;
      byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
    });
    // Correcciones manuales.
    Object.entries(OVERRIDES).forEach(([id, extra]) => {
      const num = Number(id);
      byId.set(num, { ...(byId.get(num) || { id: num }), ...extra });
    });

    const posts = [...byId.values()].sort((a, b) => (b.id || 0) - (a.id || 0));
    posts.forEach(item => { articlesById[item.id] = item; });

    feed.innerHTML = '';
    posts.forEach(item => feed.appendChild(renderArticle(item)));
    renderUnifiedFilters(posts);
  } catch (err) {
    console.error(err);
    if (feed) feed.innerHTML = '<p class="card-excerpt">No se pudieron cargar las noticias.</p>';
  }
  bindCardEvents();

  /* ---------- Cabecera pegada ---------- */
  if (siteHeader) {
    const onScroll = () => siteHeader.classList.toggle('is-stuck', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Panel de filtros compacto ---------- */
  const filterPanel = document.getElementById('filterPanel');
  const compactMq = window.matchMedia('(max-width: 1080px)');
  function syncFilterPanel() {
    if (!filterPanel) return;
    if (compactMq.matches) filterPanel.removeAttribute('open');
    else filterPanel.setAttribute('open', '');
  }
  syncFilterPanel();
  compactMq.addEventListener('change', syncFilterPanel);

  /* ---------- Newsletter ---------- */
  const mailForm = document.getElementById('newsletter-form');
  const captchaWrap = document.getElementById('captcha-wrap');
  const captchaErr = document.getElementById('captcha-error');
  window.onMailCaptcha = function () {
    if (captchaErr) captchaErr.hidden = true;
    if (mailForm && mailForm.checkValidity()) mailForm.submit();
  };
  mailForm?.addEventListener('submit', e => {
    let token = '';
    try { token = (typeof hcaptcha !== 'undefined' && hcaptcha.getResponse()) || ''; } catch (err) {}
    if (!token) {
      e.preventDefault();
      if (captchaWrap) captchaWrap.hidden = false;
      if (captchaErr) captchaErr.hidden = false;
    }
  });

  /* ---------- Temas ---------- */
  function applyTheme(theme) {
    const next = ['dark', 'blue', 'light'].includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('pn-theme', next); } catch (err) {}
    document.querySelectorAll('[data-theme-set]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.themeSet === next);
    });
  }
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  document.querySelectorAll('[data-theme-set]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.themeSet));
  });

  /* ---------- Búsqueda / filtros ---------- */
  input?.addEventListener('input', () => applyFilters(true));
  document.querySelectorAll('#clearFilter, [data-clear-filters]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (input) input.value = '';
      setActiveFilter('');
    });
  });
  feedPager?.addEventListener('click', e => {
    const btn = e.target.closest('[data-feed-page]');
    if (!btn || btn.disabled) return;
    feedPage = Number(btn.dataset.feedPage);
    applyFilters(false);
    document.querySelector('.feed-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Modal / cinema listeners ---------- */
  modal?.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('click', e => {
    const fullImg = e.target.closest('[data-full-image]');
    if (fullImg) {
      e.preventDefault();
      openCinemaMedia(`<img class="cinema-image" src="${fullImg.getAttribute('data-full-image')}" alt="">`);
      return;
    }
    const cineBtn = e.target.closest('[data-cinema]');
    if (cineBtn) {
      e.preventDefault();
      openCinema(cineBtn.dataset.cinema, cineBtn.dataset.title || 'YouTube');
      return;
    }
    if (e.target.hasAttribute('data-cinema-close') || e.target.closest('[data-cinema-close]')) closeCinema();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (cinema && !cinema.hidden) { closeCinema(); return; }
    if (modal && !modal.hidden) closeModal();
  });

  /* ---------- Menú compartir ---------- */
  function hideShareMenu() { if (shareMenu) { shareMenu.hidden = true; shareContext = null; } }
  function openShareMenu(anchor, data) {
    if (!shareMenu) return;
    shareContext = data;
    const rect = anchor.getBoundingClientRect();
    shareMenu.hidden = false;
    const w = shareMenu.offsetWidth || 190;
    shareMenu.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - w - 8)}px`;
    shareMenu.style.top = `${rect.bottom + 6}px`;
    const xLink = shareMenu.querySelector('[data-share-action="x"]');
    const tgLink = shareMenu.querySelector('[data-share-action="telegram"]');
    if (xLink) xLink.href = xShareUrl(data);
    if (tgLink) tgLink.href = tgShareUrl(data);
  }
  shareMenu?.addEventListener('click', async e => {
    const action = e.target.closest('[data-share-action]')?.dataset.shareAction;
    if (!action || !shareContext) return;
    if (action === 'copy' || action === 'native') {
      e.preventDefault();
      if (action === 'native' && navigator.share) {
        try { await navigator.share({ title: shareContext.title, text: shareContext.text, url: shareContext.url }); } catch {}
      } else {
        try { await navigator.clipboard.writeText(shareContext.url); } catch {}
      }
      hideShareMenu();
    }
  });
  document.addEventListener('click', e => {
    if (!shareMenu || shareMenu.hidden) return;
    if (!shareMenu.contains(e.target) && !e.target.closest('[data-share]')) hideShareMenu();
  });

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.donation-item')?.querySelector('code');
      if (!code) return;
      try { await navigator.clipboard.writeText(code.textContent.trim()); btn.textContent = 'Copiado'; } catch {}
    });
  });

  /* ---------- Ticker (migrado de ticker.js) ---------- */
  (function ticker() {
    const TRACK = document.getElementById('tickerTrack');
    const BTC = document.getElementById('pxBtc');
    const XMR = document.getElementById('pxXmr');
    if (!TRACK) return;
    const money = (value, digits) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
    const dirHtml = (pct) => {
      if (!Number.isFinite(pct)) return '';
      const up = pct >= 0;
      return `<span class="ticker-dir ${up ? 'up' : 'down'}" title="${up ? '+' : ''}${pct.toFixed(1)}% (24h)" aria-hidden="true">${up ? '▲' : '▼'}</span>`;
    };
    const headline = (item) => {
      const raw = String(item.title || item.excerpt || '').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
      if (!raw) return `Publicación #${item.id}`;
      const cut = raw.length > 88 ? raw.slice(0, 85).replace(/\s+\S*$/, '') + '…' : raw;
      return escapeHtml(stripLeadEmoji(cut) || cut);
    };
    function paintNews(items) {
      const latest = (items || []).slice(0, 10);
      if (!latest.length) return;
      const row = latest.map(item =>
        `<a class="ticker-item" href="#noticia-${item.id}" data-ticker-id="${item.id}"><span class="ticker-dot"></span>${headline(item)}</a>`
      ).join('');
      TRACK.innerHTML = row + row;
      TRACK.style.animationDuration = `${Math.max(40, latest.length * 6)}s`;
    }
    function paintPrices(btc, xmr) {
      if (BTC && btc && Number.isFinite(btc.usd)) BTC.innerHTML = `<span class="ticker-px btc">BTC&nbsp;$${money(btc.usd, 0)}</span>${dirHtml(btc.chg)}`;
      if (XMR && xmr && Number.isFinite(xmr.usd)) XMR.innerHTML = `<span class="ticker-px xmr">XMR&nbsp;$${money(xmr.usd, 2)}</span>${dirHtml(xmr.chg)}`;
    }
    async function loadNews() {
      try {
        const data = await loadJson('news.json');
        paintNews(data.articles || data.posts || []);
      } catch (err) {}
    }
    async function loadPrices() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=usd&include_24hr_change=true');
        if (!res.ok) throw new Error('coingecko');
        const data = await res.json();
        paintPrices(
          { usd: data.bitcoin?.usd, chg: data.bitcoin?.usd_24h_change },
          { usd: data.monero?.usd, chg: data.monero?.usd_24h_change }
        );
      } catch (err) {
        try {
          const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD,XMRUSD');
          const data = await res.json();
          const btc = data.result?.XXBTZUSD || data.result?.XBTUSD;
          const xmr = data.result?.XXMRZUSD || data.result?.XMRUSD;
          paintPrices({ usd: Number(btc?.c?.[0]), chg: NaN }, { usd: Number(xmr?.c?.[0]), chg: NaN });
        } catch (fallbackErr) {}
      }
    }
    TRACK.addEventListener('click', (e) => {
      const link = e.target.closest('[data-ticker-id]');
      if (!link) return;
      e.preventDefault();
      const id = link.dataset.tickerId;
      const card = document.querySelector(`.news-card[data-id="${id}"]`);
      if (card) { card.click(); return; }
      if (articlesById[id]) openModalFromItem(articlesById[id]);
    });
    loadNews();
    loadPrices();
    window.setInterval(loadPrices, 120000);
  })();
});
