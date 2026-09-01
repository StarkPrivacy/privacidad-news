document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const ARCHIVE_PAGE = 40;
  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const tagCloud = document.querySelector('.tag-cloud');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');
  const numerosList = document.getElementById('numerosList');
  const numerosMeta = document.getElementById('numerosMeta');
  const numerosPager = document.getElementById('numerosPager');

  let cards = [];
  let tagLinks = [];
  let articlesById = {};
  let archiveItems = [];
  let archivePage = 0;
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
  const articleShareData = (id, title) => {
    const safeTitle = title || 'Privacidad.news';
    return { title: safeTitle, url: `${SITE_URL}#noticia-${id}`, text: `${safeTitle} — Privacidad.news` };
  };
  const xShareUrl = (data) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  const tgShareUrl = (data) => `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;

  function mediaBlock(item) {
    if (item.youtube_id) {
      return `<div class="yt-embed"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(item.youtube_id)}" title="${escapeHtml(item.title || 'YouTube')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
    }
    if (item.image) return `<img src="${escapeHtml(item.image)}" alt="" class="article-hero" />`;
    return '';
  }

  function tagChips(item) {
    const tags = String(item.tags || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 6);
    if (!tags.length) return '';
    return `<div class="card-tags">${tags.map(t => `<button type="button" class="tag-chip" data-filter="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}</div>`;
  }

  function renderArticle(item) {
    const id = item.id;
    const title = escapeHtml(item.title);
    const category = escapeHtml(item.category || 'Seguridad');
    const excerpt = escapeHtml(item.excerpt || '');
    const image = escapeHtml(item.image || '');
    const dateLabel = formatDate(item.date);
    const isYt = Boolean(item.youtube_id);
    const body = (item.body || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const source = item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">Ver publicación original</a></p>` : '';
    const article = document.createElement('article');
    article.className = 'news-card' + (isYt ? ' is-video' : '');
    article.dataset.id = id;
    article.dataset.tags = normalize(item.tags || '');
    article.dataset.category = normalize(item.category || '');
    article.id = `noticia-${id}`;
    article.innerHTML = `
      <div class="card-image${isYt ? ' is-video' : ''}">
        ${image ? `<img src="${image}" alt="" loading="lazy" width="400" height="400" />` : '<div class="thumb-fallback"></div>'}
        ${isYt ? '<span class="play-badge" aria-hidden="true">▶</span>' : ''}
      </div>
      <div class="card-body">
        <h2 class="card-title"><a href="#noticia-${id}" class="open-article">${title}</a></h2>
        <div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time><span class="meta-sep">·</span><span class="category">${category}</span>${isYt ? '<span class="meta-sep">·</span><span class="category">Vídeo</span>' : ''}</div>
        <p class="card-excerpt">${excerpt}</p>
        ${tagChips(item)}
        <div class="card-actions"><button type="button" class="read-more open-article">${isYt ? 'Ver vídeo →' : 'Leer artículo completo →'}</button><button type="button" class="share-btn" data-share>Compartir</button></div>
      </div>
      <template class="full-content">
        <h1>${title}</h1>
        <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${category}</span></p>
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
      const show = (!query || title.includes(query) || excerpt.includes(query) || tags.includes(query) || category.includes(query))
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
    const source = item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">Ver publicación original</a></p>` : '';
    modalContent.innerHTML = `
      <h1>${escapeHtml(item.title)}</h1>
      <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${escapeHtml(item.category || '')}</span></p>
      ${mediaBlock(item)}
      <div class="article-body">${body}${source}</div>`;
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
    modal.hidden = false;
    document.body.classList.add('modal-open');
    history.replaceState(null, '', `#noticia-${item.id}`);
  }

  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;
    const data = articleShareData(card.dataset.id, card.querySelector('.card-title')?.textContent.trim());
    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));
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
    applyFilters();
    if (location.hash.startsWith('#noticia-')) {
      const id = location.hash.replace('#noticia-', '');
      const card = document.querySelector(`.news-card[data-id="${id}"]`);
      if (card) openModal(card);
      else if (articlesById[id]) openModalFromItem(articlesById[id]);
    }
  }

  function renderArchivePage() {
    if (!numerosList) return;
    const totalPages = Math.max(1, Math.ceil(archiveItems.length / ARCHIVE_PAGE));
    archivePage = Math.min(archivePage, totalPages - 1);
    const start = archivePage * ARCHIVE_PAGE;
    const slice = archiveItems.slice(start, start + ARCHIVE_PAGE);
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
      numerosMeta.textContent = `${archiveItems.length} publicaciones · página ${archivePage + 1} de ${totalPages}`;
    }
    if (numerosPager) {
      numerosPager.hidden = archiveItems.length <= ARCHIVE_PAGE;
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
      if (card) openModal(card);
      else if (articlesById[id]) openModalFromItem(articlesById[id]);
    });
    numerosPager?.addEventListener('click', e => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;
      archivePage += btn.dataset.page === 'next' ? 1 : -1;
      renderArchivePage();
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
    tagLinks = Array.from(tagCloud.querySelectorAll('a'));
    tagLinks.forEach(link => {
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

  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`);
    const data = await res.json();
    const posts = data.posts || data.articles || [];
    posts.forEach(item => { articlesById[item.id] = item; });
    feed.innerHTML = '';
    const mediaItems = (data.articles || posts).filter(p => p.image || p.youtube_id || p.has_media);
    mediaItems.slice(0, 60).forEach(item => {
      feed.appendChild(renderArticle(item));
    });
    archiveItems = data.archive || posts.map(p => ({
      id: p.id, title: p.title, date: p.date, url: p.source_url, has_media: p.has_media, youtube_id: p.youtube_id
    }));
    renderCategories(Object.values(articlesById));
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
