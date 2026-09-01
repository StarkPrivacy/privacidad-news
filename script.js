document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const YT_CHANNEL_ID = 'UCiWK5LDY5nmnMpfGsL7KENQ';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const ARCHIVE_PAGE = 50;
  const FEED_PAGE = 20;
  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const feedPager = document.getElementById('feedPager');
  const tagCloud = document.querySelector('.tag-cloud');
  const tagList = document.getElementById('tagList');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const cinema = document.getElementById('cinema');
  const cinemaPlayer = document.getElementById('cinemaPlayer');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');
  const numerosList = document.getElementById('numerosList');
  const numerosMeta = document.getElementById('numerosMeta');
  const numerosPager = document.getElementById('numerosPager');
  const numerosSearch = document.getElementById('numerosSearch');

  let cards = [];
  let tagLinks = [];
  let articlesById = {};
  let archiveItems = [];
  let archivePage = 0;
  let archiveQuery = '';
  let activeCategory = '';
  let feedPage = 0;
  let shareContext = null;

  const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const parseTags = (item) => String(item.tags || '')
    .split(/[\s,]+/)
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);
  const articleShareData = (id, title) => {
    const safeTitle = title || 'Privacidad.news';
    return { title: safeTitle, url: `${SITE_URL}#noticia-${id}`, text: `${safeTitle} — Privacidad.news` };
  };
  const xShareUrl = (data) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  const tgShareUrl = (data) => `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const hasVisual = (item) => Boolean(item.youtube_id || item.video_url || item.image);
  const stripLeadEmoji = (str) => String(str || '')
    .replace(/^(?:[\s\u200d\ufe0f\u20e3]*(?:[\u{1F000}-\u{1FAFF}]|[\u2300-\u23FF]|[\u2600-\u27BF]|[\u2B00-\u2BFF]|[\u25A0-\u25FF]|[\u{1F1E6}-\u{1F1FF}])+)+[\s\u200d\ufe0f\u20e3]*/u, '')
    .replace(/^[^\p{L}\p{N}¿¡«“"'(]+/u, '')
    .trim();
  const isTelegramHost = (host) => /(?:^|\.)(?:t\.me|telegram\.(?:org|me)|telesco\.pe)$/i.test(host || '');
  const isYoutubeHost = (host) => /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(host || '');

  function extractUrls(text) {
    return String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  }

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
    const title = normalize(stripLeadEmoji(item.title || ''));
    return (item.body || [])
      .map(p => stripLeadEmoji(p).replace(/https?:\/\/[^\s<>"']+/gi, '').replace(/\s+/g, ' ').trim())
      .filter(p => p && normalize(p) !== title);
  }

  const ytSrc = (id, autoplay) => {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1'
    });
    if (location.origin && location.origin !== 'null') params.set('origin', location.origin);
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  };

  function ytSubscribeRow(id, title, cinemaReady) {
    const cine = cinemaReady
      ? `<button type="button" class="btn btn-ghost cinema-btn" data-cinema="${escapeHtml(id)}" data-title="${escapeHtml(title || 'YouTube')}">Modo cine</button>`
      : '';
    return `<div class="yt-actions">
      <a class="btn yt-subscribe" href="https://www.youtube.com/channel/${YT_CHANNEL_ID}?sub_confirmation=1" target="_blank" rel="noopener">Suscribirse al canal</a>
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
    const src = ytSrc(id, autoplay);
    return `<div class="yt-player" data-yt-id="${escapeHtml(id)}">
      <div class="yt-embed">
        <iframe src="${src}" title="${escapeHtml(title || 'YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      ${ytSubscribeRow(id, title, cinemaReady)}
    </div>`;
  }

  function nativeVideoBlock(item) {
    const src = escapeHtml(item.video_url || '');
    const poster = escapeHtml(item.video_thumb || item.image || '');
    if (!src) return '';
    return `<div class="native-player">
      <video class="article-video" controls playsinline preload="metadata" poster="${poster}" src="${src}"></video>
      <a class="btn btn-ghost" href="${escapeHtml(item.source_url || '#')}" target="_blank" rel="noopener">Abrir vídeo en Telegram</a>
    </div>`;
  }

  function mediaBlock(item) {
    if (item.youtube_id) return ytFacade(item.youtube_id, item.title, true);
    if (item.video_url) return nativeVideoBlock(item);
    if (item.image) {
      return `<figure class="article-figure">
        <img src="${escapeHtml(item.image)}" alt="" class="article-hero" data-full-image="${escapeHtml(item.image)}" />
      </figure>`;
    }
    return '';
  }

  function sourcesHtml(item) {
    const sources = sourcesOf(item);
    if (!sources.length) return '';
    return `<section class="article-sources">
      <h3>Fuentes</h3>
      <ul>${sources.map(url => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></li>`).join('')}</ul>
    </section>`;
  }

  function tagChips(item) {
    const tags = parseTags(item).slice(0, 8);
    if (!tags.length) return '';
    return `<div class="card-tags">${tags.map(t => `<button type="button" class="tag-chip" data-filter="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>`;
  }

  function renderArticle(item) {
    const id = item.id;
    const title = escapeHtml(stripLeadEmoji(item.title));
    const category = escapeHtml(item.category || 'Seguridad');
    const excerpt = escapeHtml(stripLeadEmoji(item.excerpt || ''));
    const dateLabel = formatDate(item.date);
    const isYt = Boolean(item.youtube_id);
    const isNativeVideo = Boolean(item.video_url);
    const isVideo = isYt || isNativeVideo;
    const image = isYt ? ytThumb(item.youtube_id) : escapeHtml(item.video_thumb || item.image || '');
    const body = cleanParagraphs(item).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const article = document.createElement('article');
    article.className = 'news-card' + (isVideo ? ' is-video' : '');
    article.dataset.id = id;
    article.dataset.tags = normalize(parseTags(item).join(' '));
    article.dataset.category = normalize(item.category || '');
    article.id = `noticia-${id}`;
    const media = isVideo
      ? `<div class="card-media">
          <button type="button" class="${isYt ? 'yt-poster' : 'video-poster'}" ${isYt ? `data-yt-play="${escapeHtml(item.youtube_id)}" data-yt-title="${title}"` : ''} aria-label="${isYt ? 'Reproducir vídeo' : 'Abrir vídeo'}">
            <img src="${image}" alt="" loading="lazy" width="640" height="360" />
            <span class="play-badge" aria-hidden="true">▶</span>
          </button>
        </div>`
      : `<div class="card-image"><img src="${image}" alt="" loading="lazy" width="400" height="400" /></div>`;
    article.innerHTML = `
      ${media}
      <div class="card-body">
        <h2 class="card-title"><a href="#noticia-${id}" class="open-article">${title}</a></h2>
        <div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time><span class="meta-sep">·</span><span class="category">${category}</span>${isVideo ? '<span class="meta-sep">·</span><span class="category" data-filter="video">Vídeo</span>' : ''}<span class="meta-sep">·</span><span class="post-num">#${id}</span></div>
        <p class="card-excerpt">${excerpt}</p>
        ${tagChips(item)}
        <div class="card-actions"><button type="button" class="btn read-more open-article">${isVideo ? 'Abrir con vídeo' : 'Leer artículo'}</button><button type="button" class="btn btn-ghost share-btn" data-share>Compartir</button></div>
      </div>
      <template class="full-content">
        <h1>${title}</h1>
        <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${category}</span> · #${id}</p>
        ${mediaBlock(item)}
        <div class="article-body">${body}</div>
        ${sourcesHtml(item)}
      </template>`;
    return article;
  }
