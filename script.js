document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const YT_CHANNEL_ID = 'UCiWK5LDY5nmnMpfGsL7KENQ';
  const AUTHOR_HTML = 'Escrito por: <a class="author-link" href="https://x.com/StarkPrivacy" target="_blank" rel="noopener">Stark</a>';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const FEED_PAGE = 10;
  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const feedPager = document.getElementById('feedPager');
  const tagCloud = document.getElementById('filterList');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const cinema = document.getElementById('cinema');
  const cinemaPlayer = document.getElementById('cinemaPlayer');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');
  let cards = []; let tagLinks = []; let articlesById = {}; let activeCategory = ''; let feedPage = 0; let shareContext = null;
  const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escapeHtml = (str) => String(str || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  const formatDate = (iso) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const parseTags = (item) => String(item.tags || '').split(/[\s,]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean).filter((t, i, arr) => arr.indexOf(t) === i);
  const articleShareData = (id, title) => { const safeTitle = title || 'Privacidad.news'; return { title: safeTitle, url: `${SITE_URL}#noticia-${id}`, text: `${safeTitle} — Privacidad.news` }; };
  const xShareUrl = (data) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  const tgShareUrl = (data) => `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
  const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const stripLeadEmoji = (str) => String(str || '').replace(/^(?:[\s\u200d\ufe0f\u20e3]*(?:[\u{1F000}-\u{1FAFF}]|[\u2300-\u23FF]|[\u2600-\u27BF]|[\u2B00-\u2BFF]|[\u25A0-\u25FF]|[\u{1F1E6}-\u{1F1FF}])+)+[\s\u200d\ufe0f\u20e3]*/u, '').replace(/^[^\p{L}\p{N}¿¡«“"'(]+/u, '').trim();
  const isTelegramHost = (host) => /(?:^|\.)(?:t\.me|telegram\.(?:org|me)|telesco\.pe)$/i.test(host || '');
  const isYoutubeHost = (host) => /(?:^|\.)(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(host || '');
  const extractUrls = (text) => String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  function sourcesOf(item) {
    const raw = [...(item.sources || [])]; (item.body || []).forEach(p => raw.push(...extractUrls(p)));
    const seen = new Set(); const out = [];
    raw.forEach(value => {
      const url = String(value || '').replace(/[),.;»"'…]+$/g, '').trim();
      if (!url || url.includes('…')) return; let host = '';
      try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return; }
      if (isTelegramHost(host) || (item.youtube_id && isYoutubeHost(host))) return;
      if ((host === 'x.com' || host === 'twitter.com') && /\/search/i.test(url)) return;
      if (!seen.has(url)) { seen.add(url); out.push(url); }
    }); return out;
  }
  function cleanParagraphs(item) {
    const title = normalize(stripLeadEmoji(item.title || ''));
    return (item.body || []).map(p => stripLeadEmoji(p).replace(/https?:\/\/[^\s<>"']+/gi, '').replace(/\s+/g, ' ').trim()).filter(p => p && normalize(p) !== title);
  }
  const ytSrc = (id, autoplay) => { const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' }); if (autoplay) params.set('autoplay', '1'); return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`; };
  function ytSubscribeRow(id, title, cinemaReady) {
    const cine = cinemaReady ? `<button type="button" class="btn btn-ghost cinema-btn" data-cinema="${escapeHtml(id)}" data-title="${escapeHtml(title || 'YouTube')}">Modo cine</button>` : '';
    return `<div class="yt-actions"><a class="btn yt-subscribe" href="https://www.youtube.com/channel/${YT_CHANNEL_ID}?sub_confirmation=1" target="_blank" rel="noopener">Suscribirse al canal</a><a class="btn btn-ghost" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener">Ver en YouTube</a>${cine}</div>`;
  }
  function ytFacade(id, title, cinemaReady) {
    return `<div class="yt-player" data-yt-id="${escapeHtml(id)}"><button type="button" class="yt-facade" data-yt-play="${escapeHtml(id)}" data-yt-title="${escapeHtml(title || 'YouTube')}" aria-label="Reproducir vídeo"><img src="${ytThumb(id)}" alt="" /><span class="play-badge" aria-hidden="true">▶</span></button>${ytSubscribeRow(id, title, cinemaReady)}</div>`;
  }
  function ytEmbed(id, title, autoplay, cinemaReady) {
    return `<div class="yt-player" data-yt-id="${escapeHtml(id)}"><div class="yt-embed"><iframe src="${ytSrc(id, autoplay)}" title="${escapeHtml(title || 'YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>${ytSubscribeRow(id, title, cinemaReady)}</div>`;
  }
  function itemImages(item) {
    const list = [];
    (Array.isArray(item.images) ? item.images : []).forEach(src => { if (src) list.push(src); });
    if (item.image) list.unshift(item.image);
    return list.filter((src, i, arr) => src && arr.indexOf(src) === i);
  }
  function mediaBlock(item) {
    if (item.youtube_id) return ytFacade(item.youtube_id, item.title, true);
    if (item.video_url) return `<div class="native-player"><video class="article-video" controls playsinline preload="metadata" poster="${escapeHtml(item.video_thumb || item.image || '')}" src="${escapeHtml(item.video_url)}"></video><a class="btn btn-ghost" href="${escapeHtml(item.source_url || '#')}" target="_blank" rel="noopener">Abrir vídeo en Telegram</a></div>`;
    const imgs = itemImages(item);
    if (!imgs.length) return '';
    if (imgs.length === 1) return `<figure class="article-figure"><img src="${escapeHtml(imgs[0])}" alt="" class="article-hero" data-full-image="${escapeHtml(imgs[0])}" /></figure>`;
    return `<div class="article-gallery">${imgs.map(src => `<figure class="article-figure"><img src="${escapeHtml(src)}" alt="" class="article-hero" data-full-image="${escapeHtml(src)}" /></figure>`).join('')}</div>`;
  }
  function sourcesHtml(item) {
    const sources = sourcesOf(item); if (!sources.length) return '';
    return `<section class="article-sources"><h3>Fuentes</h3><ul>${sources.map(url => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></li>`).join('')}</ul></section>`;
  }
  function articleTagsHtml(item) {
    const bits = [];
    if (item.category) bits.push(item.category);
    parseTags(item).forEach(t => { if (!bits.some(b => normalize(b) === normalize(t))) bits.push(t); });
    if (!bits.length) return '';
    return `<div class="article-end-tags">${bits.map(t => `<button type="button" class="end-tag" data-filter="${escapeHtml(normalize(t))}">#${escapeHtml(t)}</button>`).join('')}</div>`;
  }
  function renderArticle(item) {
    const id = item.id; const title = escapeHtml(stripLeadEmoji(item.title));
    const excerpt = escapeHtml(stripLeadEmoji(item.excerpt || '')); const dateLabel = formatDate(item.date);
    const isYt = Boolean(item.youtube_id); const isVideo = isYt || Boolean(item.video_url);
    const image = isYt ? ytThumb(item.youtube_id) : escapeHtml(item.video_thumb || item.image || '');
    const body = cleanParagraphs(item).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const article = document.createElement('article');
    article.className = 'news-card' + (isVideo ? ' is-video' : '') + (!image && !isVideo ? ' is-text' : '');
    article.dataset.id = id; article.dataset.tags = normalize(parseTags(item).join(' ')); article.dataset.category = normalize(item.category || ''); article.id = `noticia-${id}`;
    const media = image ? `<div class="card-image${isVideo ? ' is-video' : ''}"><img src="${image}" alt="" loading="lazy" />${isVideo ? '<span class="play-badge" aria-hidden="true">▶</span>' : ''}</div>` : '';
    article.innerHTML = `${media}<div class="card-body"><h2 class="card-title"><a href="#noticia-${id}">${title}</a></h2><p class="byline">${AUTHOR_HTML}</p><div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time></div><p class="card-excerpt">${excerpt}</p><div class="card-actions"><button type="button" class="btn btn-ghost share-btn" data-share>Compartir</button></div></div><template class="full-content"><h1>${title}</h1><p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time></p><p class="article-byline">${AUTHOR_HTML}</p>${mediaBlock(item)}<div class="article-body">${body}</div>${sourcesHtml(item)}${articleTagsHtml(item)}</template>`;
    return article;
  }
  function matchingCards() {
    const query = normalize(input?.value.trim() || '');
    return cards.filter(card => {
      const title = normalize(card.querySelector('.card-title')?.textContent);
      const excerpt = normalize(card.querySelector('.card-excerpt')?.textContent);
      const tags = normalize(card.dataset.tags);
      const category = normalize(card.dataset.category);
      return (!query || title.includes(query) || excerpt.includes(query) || tags.includes(query) || category.includes(query) || String(card.dataset.id).includes(query)) && (!activeCategory || category.includes(activeCategory) || tags.includes(activeCategory) || (activeCategory === 'video' && card.classList.contains('is-video')));
    });
  }
  function renderFeedPager(total, page, pages) {
    if (!feedPager) return;
    if (total <= FEED_PAGE) { feedPager.hidden = true; feedPager.innerHTML = ''; return; }
    feedPager.hidden = false;
    const btn = (n, label, current, disabled) => `<button type="button" class="page-btn${current ? ' is-current' : ''}" data-feed-page="${n}" ${disabled ? 'disabled' : ''} ${current ? 'aria-current="page"' : ''}>${label}</button>`;
    const parts = [btn(page - 1, '«', false, page === 0)];
    let start = Math.max(0, page - 3); let end = Math.min(pages - 1, start + 6); start = Math.max(0, end - 6);
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
    const matches = matchingCards(); const pages = Math.max(1, Math.ceil(matches.length / FEED_PAGE));
    feedPage = Math.min(Math.max(0, feedPage), pages - 1);
    cards.forEach(card => { card.hidden = true; });
    matches.slice(feedPage * FEED_PAGE, feedPage * FEED_PAGE + FEED_PAGE).forEach(card => { card.hidden = false; });
    if (emptyState) emptyState.hidden = matches.length > 0;
    if (feedCount) feedCount.textContent = matches.length ? `Página ${feedPage + 1} de ${pages} · ${matches.length} noticia${matches.length === 1 ? '' : 's'}` : '0 noticias';
    if (activeFilterEl) { activeFilterEl.hidden = !activeCategory; const label = activeFilterEl.querySelector('span'); if (label && activeCategory) label.textContent = activeCategory; }
    renderFeedPager(matches.length, feedPage, pages);
  }
  function openCinema(id, title) { if (!cinema || !cinemaPlayer || !id) return; cinemaPlayer.innerHTML = ytEmbed(id, title, true, false); cinema.hidden = false; document.body.classList.add('cinema-open'); }
  function openCinemaMedia(html) { if (!cinema || !cinemaPlayer || !html) return; cinemaPlayer.innerHTML = html; cinema.hidden = false; document.body.classList.add('cinema-open'); }
  function closeCinema() { if (!cinema || cinema.hidden) return; cinema.hidden = true; document.body.classList.remove('cinema-open'); if (cinemaPlayer) cinemaPlayer.innerHTML = ''; }
  const filterLabel = (link) => normalize(link.dataset.filter || link.textContent.trim());
  function appendShareBar(data) {
    const bar = document.createElement('div'); bar.className = 'article-share-bar';
    bar.innerHTML = `<span class="label">Compartir esta noticia</span><a class="btn btn-ghost share-btn" href="${xShareUrl(data)}" target="_blank" rel="noopener">X</a><a class="btn btn-ghost share-btn" href="${tgShareUrl(data)}" target="_blank" rel="noopener">Telegram</a><button type="button" class="btn share-btn" data-copy-link>Copiar enlace</button>`;
    modalContent.appendChild(bar);
    bar.querySelector('[data-copy-link]')?.addEventListener('click', async e => { try { await navigator.clipboard.writeText(data.url); e.currentTarget.textContent = 'Copiado'; } catch {} });
  }
  function bindEndTags() {
    modalContent.querySelectorAll('.end-tag').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        activeCategory = normalize(btn.dataset.filter || btn.textContent.replace(/^#/, ''));
        closeModal();
        tagLinks.forEach(l => l.classList.toggle('is-active', filterLabel(l) === activeCategory));
        applyFilters(true);
      });
    });
  }
  function openModalFromItem(item) {
    if (!modal || !modalContent || !item) return;
    const data = articleShareData(item.id, stripLeadEmoji(item.title)); const dateLabel = formatDate(item.date);
    const body = cleanParagraphs(item).map(p => `<p>${escapeHtml(p)}</p>`).join('') || '<p>Sin texto ampliado.</p>';
    modalContent.innerHTML = `<h1>${escapeHtml(stripLeadEmoji(item.title))}</h1><p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time></p><p class="article-byline">${AUTHOR_HTML}</p>${mediaBlock(item)}<div class="article-body">${body}</div>${sourcesHtml(item)}${articleTagsHtml(item)}`;
    appendShareBar(data); bindYoutubePosters(modalContent); bindEndTags(); modal.hidden = false; document.body.classList.add('modal-open'); history.replaceState(null, '', `#noticia-${item.id}`);
  }
  function openModal(card) {
    const template = card.querySelector('template.full-content'); if (!template || !modal || !modalContent) return;
    const data = articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim());
    modalContent.innerHTML = ''; modalContent.appendChild(template.content.cloneNode(true)); appendShareBar(data); bindYoutubePosters(modalContent); bindEndTags();
    modal.hidden = false; document.body.classList.add('modal-open'); history.replaceState(null, '', `#noticia-${card.dataset.id}`);
  }
  function closeModal() {
    if (!modal || modal.hidden) return; modalContent.querySelectorAll('video').forEach(el => el.pause());
    modal.hidden = true; document.body.classList.remove('modal-open'); modalContent.innerHTML = '';
    if (location.hash.startsWith('#noticia-')) history.replaceState(null, '', location.pathname + location.search);
  }
  function bindYoutubePosters(root) {
    (root || document).querySelectorAll('[data-yt-play]').forEach(btn => {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.dataset.ytPlay; const title = btn.dataset.ytTitle || 'YouTube'; if (!id) return;
        if (btn.classList.contains('yt-facade')) { const player = btn.closest('.yt-player'); if (player) player.innerHTML = ytEmbed(id, title, true, true); }
      });
    });
  }
  function bindCardEvents() {
    cards = Array.from(document.querySelectorAll('.news-card'));
    cards.forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-share], .author-link, a[target="_blank"]')) return;
        e.preventDefault(); openModal(card);
      });
    });
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const card = btn.closest('.news-card');
        if (card) openShareMenu(btn, articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim()));
      });
    });
    bindYoutubePosters(feed); applyFilters(true);
    if (location.hash.startsWith('#noticia-')) {
      const id = location.hash.replace('#noticia-', '');
      const card = document.querySelector('.news-card[data-id="'+id+'"]');
      if (card) openModal(card); else if (articlesById[id]) openModalFromItem(articlesById[id]);
    }
  }
  function bindFilterLinks(links) {
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const label = filterLabel(link);
        if (activeCategory === label) { activeCategory = ''; tagLinks.forEach(l => l.classList.remove('is-active')); }
        else { activeCategory = label; tagLinks.forEach(l => l.classList.toggle('is-active', filterLabel(l) === label)); }
        applyFilters(true);
      });
    });
  }
  function renderUnifiedFilters() {
    if (!tagCloud) return;
    const names = ['Cifrado','Empresas','Herramientas','Identidad digital','Legislación','Países','Productos','Proyectos','Seguridad','Servicios','Vídeo'];
    tagCloud.innerHTML = names.map(name => `<a href="#" role="listitem" data-filter="${escapeHtml(normalize(name) === 'video' ? 'video' : normalize(name))}">${escapeHtml(name)}</a>`).join('');
    tagLinks = Array.from(tagCloud.querySelectorAll('a'));
    bindFilterLinks(tagLinks);
  }
  try {
    const res = await fetch('data/news.json?t=' + Date.now());
    if (!res.ok) throw new Error('news.json ' + res.status);
    const data = await res.json(); const posts = data.posts || data.articles || [];
    posts.forEach(item => { articlesById[item.id] = item; });
    feed.innerHTML = '';
    posts.forEach(item => feed.appendChild(renderArticle(item)));
    renderUnifiedFilters();
  } catch (err) { console.error(err); if (feed) feed.innerHTML = '<p class="card-excerpt">No se pudieron cargar las noticias.</p>'; }
  bindCardEvents();
  const filterPanel = document.getElementById('filterPanel');
  const compactMq = window.matchMedia('(max-width: 1100px)');
  function syncFilterPanel() { if (!filterPanel) return; if (compactMq.matches) filterPanel.removeAttribute('open'); else filterPanel.setAttribute('open', ''); }
  syncFilterPanel();
  compactMq.addEventListener('change', syncFilterPanel);
  window.addEventListener('resize', () => { if (compactMq.matches) filterPanel?.removeAttribute('open'); });
  const mailForm = document.getElementById('newsletter-form');
  const captchaWrap = document.getElementById('captcha-wrap');
  const captchaErr = document.getElementById('captcha-error');
  window.onMailCaptcha = function () { if (captchaErr) captchaErr.hidden = true; if (mailForm && mailForm.checkValidity()) mailForm.submit(); };
  mailForm?.addEventListener('submit', e => { let token = ''; try { token = (typeof hcaptcha !== 'undefined' && hcaptcha.getResponse()) || ''; } catch (err) {} if (!token) { e.preventDefault(); if (captchaWrap) captchaWrap.hidden = false; if (captchaErr) captchaErr.hidden = false; } });
  input?.addEventListener('input', () => applyFilters(true));
  document.querySelectorAll('#clearFilter, [data-clear-filters]').forEach(btn => { btn.addEventListener('click', () => { activeCategory = ''; tagLinks.forEach(l => l.classList.remove('is-active')); if (input) input.value = ''; applyFilters(true); }); });
  feedPager?.addEventListener('click', e => { const btn = e.target.closest('[data-feed-page]'); if (!btn || btn.disabled) return; feedPage = Number(btn.dataset.feedPage); applyFilters(false); document.querySelector('.feed-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  modal?.addEventListener('click', e => { if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('click', e => {
    const fullImg = e.target.closest('[data-full-image]'); if (fullImg) { e.preventDefault(); openCinemaMedia('<img class="cinema-image" src="'+fullImg.getAttribute('data-full-image')+'" alt="">'); return; }
    const cineBtn = e.target.closest('[data-cinema]'); if (cineBtn) { e.preventDefault(); openCinema(cineBtn.dataset.cinema, cineBtn.dataset.title || 'YouTube'); return; }
    if (e.target.hasAttribute('data-cinema-close') || e.target.closest('[data-cinema-close]')) closeCinema();
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (cinema && !cinema.hidden) { closeCinema(); return; } if (modal && !modal.hidden) closeModal(); });
  function hideShareMenu() { if (!shareMenu) return; shareMenu.hidden = true; shareContext = null; }
  function openShareMenu(anchor, data) {
    if (!shareMenu) return; shareContext = data; const rect = anchor.getBoundingClientRect();
    shareMenu.hidden = false; shareMenu.style.left = Math.max(8, rect.left)+'px'; shareMenu.style.top = (rect.bottom + 6)+'px';
    const xLink = shareMenu.querySelector('[data-share-action="x"]'); const tgLink = shareMenu.querySelector('[data-share-action="telegram"]');
    if (xLink) xLink.href = xShareUrl(data); if (tgLink) tgLink.href = tgShareUrl(data);
  }
  shareMenu?.addEventListener('click', async e => {
    const action = e.target.closest('[data-share-action]')?.dataset.shareAction; if (!action || !shareContext) return;
    if (action === 'copy' || action === 'native') { e.preventDefault(); if (action === 'native' && navigator.share) { try { await navigator.share({ title: shareContext.title, text: shareContext.text, url: shareContext.url }); } catch {} } else { try { await navigator.clipboard.writeText(shareContext.url); } catch {} } hideShareMenu(); }
  });
  document.addEventListener('click', e => { if (!shareMenu || shareMenu.hidden) return; if (!shareMenu.contains(e.target) && !e.target.closest('[data-share]')) hideShareMenu(); });
  document.querySelectorAll('[data-copy]').forEach(btn => { btn.addEventListener('click', async () => { const code = btn.closest('.donation-item')?.querySelector('code'); if (!code) return; try { await navigator.clipboard.writeText(code.textContent.trim()); btn.textContent = 'Copiado'; } catch {} }); });
});
