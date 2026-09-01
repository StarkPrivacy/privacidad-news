document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const ARCHIVE_PAGE = 50;
  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const tagCloud = document.querySelector('.tag-cloud');
  const tagList = document.getElementById('tagList');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
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
  const hasVisual = (item) => Boolean(item.youtube_id || item.image);

  function ytEmbed(id, title, autoplay) {
    const src = `https://www.youtube-nocookie.com/embed/${escapeHtml(id)}${autoplay ? '?autoplay=1' : ''}`;
    return `<div class="yt-embed"><iframe src="${src}" title="${escapeHtml(title || 'YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
  }

  function mediaBlock(item) {
    if (item.youtube_id) return ytEmbed(item.youtube_id, item.title, false);
    if (item.image) return `<img src="${escapeHtml(item.image)}" alt="" class="article-hero" />`;
    return '';
  }

  function tagChips(item) {
    const tags = parseTags(item).slice(0, 8);
    if (!tags.length) return '';
    return `<div class="card-tags">${tags.map(t => `<button type="button" class="tag-chip" data-filter="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>`;
  }

  function renderArticle(item) {
    const id = item.id;
    const title = escapeHtml(item.title);
    const category = escapeHtml(item.category || 'Seguridad');
    const excerpt = escapeHtml(item.excerpt || '');
    const dateLabel = formatDate(item.date);
    const isYt = Boolean(item.youtube_id);
    const image = isYt ? ytThumb(item.youtube_id) : escapeHtml(item.image || '');
    const body = (item.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const source = item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">Ver publicación original</a></p>` : '';
    const article = document.createElement('article');
    article.className = 'news-card' + (isYt ? ' is-video' : '');
    article.dataset.id = id;
    article.dataset.tags = normalize(parseTags(item).join(' '));
    article.dataset.category = normalize(item.category || '');
    article.id = `noticia-${id}`;
    const media = isYt
      ? `<div class="card-media">
          <button type="button" class="yt-poster" data-yt-play="${escapeHtml(item.youtube_id)}" aria-label="Reproducir vídeo">
            <img src="${image}" alt="" loading="lazy" width="640" height="360" />
            <span class="play-badge" aria-hidden="true">▶</span>
          </button>
        </div>`
      : `<div class="card-image"><img src="${image}" alt="" loading="lazy" width="400" height="400" /></div>`;
    article.innerHTML = `
      ${media}
      <div class="card-body">
        <h2 class="card-title"><a href="#noticia-${id}" class="open-article">${title}</a></h2>
        <div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time><span class="meta-sep">·</span><span class="category">${category}</span>${isYt ? '<span class="meta-sep">·</span><span class="category" data-filter="video">Vídeo</span>' : ''}<span class="meta-sep">·</span><span class="post-num">#${id}</span></div>
        <p class="card-excerpt">${excerpt}</p>
        ${tagChips(item)}
        <div class="card-actions"><button type="button" class="read-more open-article">${isYt ? 'Abrir con vídeo →' : 'Leer artículo completo →'}</button><button type="button" class="share-btn" data-share>Compartir</button></div>
      </div>
      <template class="full-content">
        <h1>${title}</h1>
        <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${category}</span> · #${id}</p>
        ${mediaBlock(item)}
        <div class="article-body">${body}${source}</div>
      </template>`;
    return article;
  }

  function applyFilters() {
    const query = normalize(input?.value.trim() || '');
    let visible = 0;
    cards.forEach(card => {
      const title = normalize(card.querySelector('.card-title')?.textContent);
      const excerpt = normalize(card.querySelector('.card-excerpt')?.textContent);
      const tags = normalize(card.dataset.tags);
      const category = normalize(card.dataset.category + ' ' + [...card.querySelectorAll('.category')].map(n => n.textContent).join(' '));
      const show = (!query || title.includes(query) || excerpt.includes(query) || tags.includes(query) || category.includes(query) || String(card.dataset.id).includes(query))
        && (!activeCategory || category.includes(activeCategory) || tags.includes(activeCategory) || (activeCategory === 'video' && card.classList.contains('is-video')));
      card.hidden = !show;
      if (show) visible++;
    });
    if (emptyState) emptyState.hidden = visible > 0;
    if (feedCount) feedCount.textContent = visible === 1 ? '1 noticia' : `${visible} noticias`;
    if (activeFilterEl) {
      activeFilterEl.hidden = !activeCategory;
      const label = activeFilterEl.querySelector('span');
      if (label && activeCategory) label.textContent = activeCategory;
    }
  }

  const filterLabel = (link) => normalize(link.dataset.filter || link.textContent.trim());

  function openModalFromItem(item) {
    if (!modal || !modalContent || !item) return;
    const data = articleShareData(item.id, item.title);
    const dateLabel = formatDate(item.date);
    const body = (item.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('') || '<p>Sin texto ampliado.</p>';
    const source = item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">Ver publicación original en Telegram</a></p>` : '';
    modalContent.innerHTML = `
      <h1>${escapeHtml(item.title)}</h1>
      <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${escapeHtml(item.category || '')}</span> · #${item.id}</p>
      ${mediaBlock(item)}
      <div class="article-body">${body}${source}</div>`;
    appendShareBar(data);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    history.replaceState(null, '', `#noticia-${item.id}`);
  }

  function appendShareBar(data) {
    const bar = document.createElement('div');
    bar.className = 'article-share-bar';
    bar.innerHTML = `<span class="label">Compartir esta noticia</span>
      <a class="share-btn" href="${xShareUrl(data)}" target="_blank" rel="noopener">X</a>
      <a class="share-btn" href="${tgShareUrl(data)}" target="_blank" rel="noopener">Telegram</a>
      <button type="button" class="share-btn" data-copy-link>Copiar enlace</button>`;
    modalContent.appendChild(bar);
    bar.querySelector('[data-copy-link]')?.addEventListener('click', async e => {
      try { await navigator.clipboard.writeText(data.url); e.currentTarget.textContent = 'Copiado'; } catch {}
    });
  }

  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;
    const data = articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim());
    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));
    appendShareBar(data);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    history.replaceState(null, '', `#noticia-${card.dataset.id}`);
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
    if (location.hash.startsWith('#noticia-')) history.replaceState(null, '', location.pathname + location.search);
  }

  function bindYoutubePosters(root) {
    (root || document).querySelectorAll('[data-yt-play]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.ytPlay;
        const wrap = btn.closest('.card-media') || btn.parentElement;
        if (!wrap || !id) return;
        wrap.innerHTML = ytEmbed(id, 'YouTube', true);
      });
    });
  }

  function bindCardEvents() {
    cards = Array.from(document.querySelectorAll('.news-card'));
    document.querySelectorAll('.open-article').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const card = el.closest('.news-card');
        if (card) openModal(card);
      });
    });
    document.querySelectorAll('.news-card .category, .tag-chip').forEach(badge => {
      badge.addEventListener('click', () => {
        activeCategory = normalize(badge.dataset.filter || badge.textContent.trim().replace(/^#/, ''));
        tagLinks.forEach(l => l.classList.toggle('is-active', filterLabel(l) === activeCategory));
        applyFilters();
      });
    });
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.news-card');
        if (card) openShareMenu(btn, articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim()));
      });
    });
    bindYoutubePosters(feed);
    applyFilters();
    if (location.hash.startsWith('#noticia-')) {
      const id = location.hash.replace('#noticia-', '');
      const card = document.querySelector(`.news-card[data-id="${id}"]`);
      if (card) openModal(card);
      else if (articlesById[id]) openModalFromItem(articlesById[id]);
    }
  }

  function filteredArchive() {
    const q = normalize(archiveQuery);
    if (!q) return archiveItems;
    return archiveItems.filter(item => {
      return String(item.id).includes(q.replace(/^#/, ''))
        || normalize(item.title).includes(q)
        || normalize(item.date).includes(q);
    });
  }

  function renderArchivePage() {
    if (!numerosList) return;
    const items = filteredArchive();
    const totalPages = Math.max(1, Math.ceil(items.length / ARCHIVE_PAGE));
    archivePage = Math.min(Math.max(0, archivePage), totalPages - 1);
    const start = archivePage * ARCHIVE_PAGE;
    const slice = items.slice(start, start + ARCHIVE_PAGE);
    numerosList.innerHTML = '';
    slice.forEach(item => {
      const li = document.createElement('li');
      const kind = item.youtube_id ? 'is-video' : (item.has_media ? 'is-media' : 'is-text');
      li.innerHTML = `<a class="${kind}" href="#noticia-${item.id}" data-archive-id="${item.id}">
        <span class="num">#${item.id}</span>
        <span class="ttl">${escapeHtml(item.title)}</span>
        <time class="when" datetime="${escapeHtml(item.date || '')}">${formatDate(item.date)}</time>
      </a>`;
      numerosList.appendChild(li);
    });
    if (numerosMeta) {
      numerosMeta.textContent = `${items.length} publicaciones · página ${archivePage + 1} de ${totalPages}`;
    }
    if (numerosPager) {
      numerosPager.hidden = items.length <= ARCHIVE_PAGE;
      numerosPager.innerHTML = `
        <button type="button" data-page="prev" ${archivePage === 0 ? 'disabled' : ''}>Anterior</button>
        <button type="button" data-page="next" ${archivePage >= totalPages - 1 ? 'disabled' : ''}>Siguiente</button>`;
    }
  }

  function bindArchive() {
    numerosList?.addEventListener('click', e => {
      const link = e.target.closest('a[data-archive-id]');
      if (!link) return;
      e.preventDefault();
      const id = link.dataset.archiveId;
      const card = document.querySelector(`.news-card[data-id="${id}"]`);
      if (card) {
        openModal(card);
        return;
      }
      if (articlesById[id]) {
        openModalFromItem(articlesById[id]);
        return;
      }
      window.open(`https://t.me/StarkPrivacy/${id}`, '_blank', 'noopener');
    });
    numerosPager?.addEventListener('click', e => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      archivePage += btn.dataset.page === 'next' ? 1 : -1;
      renderArchivePage();
    });
    numerosSearch?.addEventListener('input', () => {
      archiveQuery = numerosSearch.value.trim();
      archivePage = 0;
      const exact = archiveQuery.replace(/^#/, '');
      if (/^\d+$/.test(exact)) {
        const idx = archiveItems.findIndex(item => String(item.id) === exact);
        if (idx >= 0) archivePage = Math.floor(idx / ARCHIVE_PAGE);
      }
      renderArchivePage();
    });
  }

  function bindFilterLinks(links) {
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const label = filterLabel(link);
        if (activeCategory === label) {
          activeCategory = '';
          tagLinks.forEach(l => l.classList.remove('is-active'));
        } else {
          activeCategory = label;
          tagLinks.forEach(l => l.classList.toggle('is-active', filterLabel(l) === label));
        }
        applyFilters();
      });
    });
  }

  function renderCategories(items) {
    if (!tagCloud) return;
    const preset = ['Cifrado','Empresas','Herramientas','Identidad digital','Legislación','Países','Productos','Proyectos','Seguridad','Servicios','Vídeo'];
    const seen = new Set(preset.map(normalize));
    items.forEach(item => {
      const cat = (item.category || '').trim();
      if (cat && !seen.has(normalize(cat))) {
        preset.push(cat);
        seen.add(normalize(cat));
      }
    });
    tagCloud.innerHTML = preset.map(name => {
      const filter = normalize(name) === 'video' ? 'video' : normalize(name);
      return `<a href="#" role="listitem" data-filter="${filter}">${escapeHtml(name)}</a>`;
    }).join('');
    const catLinks = Array.from(tagCloud.querySelectorAll('a'));
    bindFilterLinks(catLinks);
    tagLinks = catLinks.concat(tagLinks);
  }

  function renderTagSidebar(items) {
    if (!tagList) return;
    const counts = {};
    items.forEach(item => {
      parseTags(item).forEach(tag => {
        const key = tag.toLowerCase();
        if (normalize(item.category) === normalize(tag)) return;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    const popular = Object.entries(counts)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24);
    if (!popular.length) {
      tagList.innerHTML = '<span class="sidebar-text">Las etiquetas salen solas del texto y de los hashtags del canal cuando existan.</span>';
      return;
    }
    tagList.innerHTML = popular.map(([tag, n]) =>
      `<a href="#" role="listitem" data-filter="${escapeHtml(tag)}">#${escapeHtml(tag)} <em>${n}</em></a>`
    ).join('');
    const links = Array.from(tagList.querySelectorAll('a'));
    bindFilterLinks(links);
    tagLinks = tagLinks.concat(links);
  }

  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`);
    const data = await res.json();
    const posts = data.posts || data.articles || [];
    posts.forEach(item => { articlesById[item.id] = item; });
    feed.innerHTML = '';
    const mediaItems = posts.filter(hasVisual);
    mediaItems.forEach(item => {
      feed.appendChild(renderArticle(item));
    });
    archiveItems = (data.archive && data.archive.length ? data.archive : posts).map(p => ({
      id: p.id,
      title: p.title,
      date: p.date,
      url: p.source_url || p.url,
      has_media: Boolean(p.has_media || p.youtube_id || p.image),
      youtube_id: p.youtube_id
    }));
    renderCategories(Object.values(articlesById));
    renderTagSidebar(mediaItems);
    renderArchivePage();
    bindArchive();
  } catch (err) {
    console.error(err);
    if (feed) feed.innerHTML = '<p class="card-excerpt">No se pudieron cargar las noticias.</p>';
  }
  bindCardEvents();

  input?.addEventListener('input', applyFilters);
  document.querySelectorAll('#clearFilter, [data-clear-filters]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = '';
      tagLinks.forEach(l => l.classList.remove('is-active'));
      if (input) input.value = '';
      applyFilters();
    });
  });
  modal?.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  function hideShareMenu() {
    if (!shareMenu) return;
    shareMenu.hidden = true;
    shareContext = null;
  }
  function openShareMenu(anchor, data) {
    if (!shareMenu) return;
    shareContext = data;
    const rect = anchor.getBoundingClientRect();
    shareMenu.hidden = false;
    shareMenu.style.left = `${Math.max(8, rect.left)}px`;
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
});
