// Privacidad.news — carga desde data/news.json

document.addEventListener('DOMContentLoaded', async () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const input = document.getElementById('searchInput');
  const feed = document.getElementById('newsFeed');
  const tagLinks = document.querySelectorAll('.tag-cloud a');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');

  let cards = [];
  let activeCategory = '';
  let shareContext = null;

  const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const escapeHtml = (str) => String(str || '').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const articleShareData = (card) => {
    const id = card.dataset.id || '';
    const title = card.querySelector('.card-title')?.textContent.trim() || 'Privacidad.news';
    const url = `${SITE_URL}#noticia-${id}`;
    return { title, url, text: `${title} — Privacidad.news` };
  };
  const xShareUrl = (data) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  const tgShareUrl = (data) => `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;

  function renderArticle(item) {
    const id = item.id;
    const title = escapeHtml(item.title);
    const category = escapeHtml(item.category || 'Seguridad');
    const excerpt = escapeHtml(item.excerpt || '');
    const image = escapeHtml(item.image || '');
    const dateLabel = formatDate(item.date);
    const body = (item.body || []).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    const source = item.source_url ? `<p><a href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">Ver publicación original</a></p>` : '';
    const article = document.createElement('article');
    article.className = 'news-card';
    article.dataset.id = id;
    article.dataset.tags = normalize(item.tags || '');
    article.id = `noticia-${id}`;
    article.innerHTML = `
      <div class="card-image"><img src="${image}" alt="" loading="lazy" width="400" height="400" /></div>
      <div class="card-body">
        <h2 class="card-title"><a href="#noticia-${id}" class="open-article">${title}</a></h2>
        <div class="card-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time><span class="meta-sep">·</span><span class="category">${category}</span></div>
        <p class="card-excerpt">${excerpt}</p>
        <div class="card-actions"><button type="button" class="read-more open-article">Leer artículo completo →</button><button type="button" class="share-btn" data-share>Compartir</button></div>
      </div>
      <template class="full-content">
        <h1>${title}</h1>
        <p class="article-meta"><time datetime="${escapeHtml(item.date || '')}">${dateLabel}</time> · <span class="category">${category}</span></p>
        <img src="${image}" alt="" class="article-hero" />
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
      const category = normalize(card.querySelector('.category')?.textContent);
      const show = (!query || title.includes(query) || excerpt.includes(query) || tags.includes(query) || category.includes(query))
        && (!activeCategory || category.includes(activeCategory) || tags.includes(activeCategory));
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

  function filterLabel(link) {
    return normalize(link.dataset.filter || link.textContent.trim());
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
    document.querySelectorAll('.news-card .category').forEach(badge => {
      badge.addEventListener('click', () => {
        activeCategory = normalize(badge.textContent.trim());
        tagLinks.forEach(l => l.classList.toggle('is-active', filterLabel(l) === activeCategory));
        applyFilters();
      });
    });
    document.querySelectorAll('[data-share]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const card = btn.closest('.news-card');
        if (card) openShareMenu(btn, articleShareData(card));
      });
    });
    applyFilters();
    if (location.hash.startsWith('#noticia-')) {
      const card = document.querySelector(`.news-card[data-id="${location.hash.replace('#noticia-', '')}"]`);
      if (card) openModal(card);
    }
  }

  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`);
    const data = await res.json();
    feed.innerHTML = '';
    (data.articles || []).forEach(item => feed.appendChild(renderArticle(item)));
  } catch (err) {
    console.error(err);
    if (feed) feed.innerHTML = '<p class="card-excerpt">No se pudieron cargar las noticias.</p>';
  }
  bindCardEvents();

  input?.addEventListener('input', applyFilters);
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
  document.querySelectorAll('#clearFilter, [data-clear-filters]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = '';
      tagLinks.forEach(l => l.classList.remove('is-active'));
      if (input) input.value = '';
      applyFilters();
    });
  });

  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;
    const data = articleShareData(card);
    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));
    const bar = document.createElement('div');
    bar.className = 'article-share-bar';
    bar.innerHTML = `<span class="label">Compartir esta noticia</span>
      <a class="share-btn" href="${xShareUrl(data)}" target="_blank" rel="noopener">X</a>
      <a class="share-btn" href="${tgShareUrl(data)}" target="_blank" rel="noopener">Telegram</a>
      <button type="button" class="share-btn" data-copy-link>Copiar enlace</button>
      <button type="button" class="share-btn" data-share-modal>Más…</button>`;
    modalContent.appendChild(bar);
    bar.querySelector('[data-share-modal]')?.addEventListener('click', e => openShareMenu(e.currentTarget, data));
    bar.querySelector('[data-copy-link]')?.addEventListener('click', async e => {
      await copyText(data.url);
      const btn = e.currentTarget;
      const prev = btn.textContent;
      btn.textContent = 'Copiado';
      setTimeout(() => { btn.textContent = prev; }, 1500);
    });
    modal.hidden = false;
    document.body.classList.add('modal-open');
    history.replaceState(null, '', `#noticia-${card.dataset.id}`);
    modal.querySelector('.modal-close')?.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
    if (location.hash.startsWith('#noticia-')) history.replaceState(null, '', location.pathname + location.search);
  }

  modal?.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (shareMenu && !shareMenu.hidden) hideShareMenu();
      else if (modal && !modal.hidden) closeModal();
    }
  });

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
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
    const menuW = shareMenu.offsetWidth || 180;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    if (top + 160 > window.innerHeight) top = rect.top - 160;
    shareMenu.style.left = `${Math.max(8, left)}px`;
    shareMenu.style.top = `${Math.max(8, top)}px`;
    const xLink = shareMenu.querySelector('[data-share-action="x"]');
    const tgLink = shareMenu.querySelector('[data-share-action="telegram"]');
    if (xLink) xLink.href = xShareUrl(data);
    if (tgLink) tgLink.href = tgShareUrl(data);
  }

  shareMenu?.addEventListener('click', async e => {
    const action = e.target.closest('[data-share-action]')?.dataset.shareAction;
    if (!action || !shareContext) return;
    if (action === 'native') {
      e.preventDefault();
      if (navigator.share) {
        try { await navigator.share({ title: shareContext.title, text: shareContext.text, url: shareContext.url }); } catch {}
      } else await copyText(shareContext.url);
      hideShareMenu();
    } else if (action === 'copy') {
      e.preventDefault();
      await copyText(shareContext.url);
      hideShareMenu();
    }
  });

  document.addEventListener('click', e => {
    if (!shareMenu || shareMenu.hidden) return;
    if (!shareMenu.contains(e.target) && !e.target.closest('[data-share], [data-share-modal]')) hideShareMenu();
  });

  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.donation-item')?.querySelector('code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent.trim());
        const original = btn.textContent;
        btn.textContent = 'Copiado';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1600);
      } catch {}
    });
  });
});
