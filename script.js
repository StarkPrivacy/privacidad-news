// Privacidad.news — búsqueda, filtros, modal y compartir

document.addEventListener('DOMContentLoaded', () => {
  const SITE_URL = 'https://starkprivacy.github.io/privacidad-news/';
  const input = document.getElementById('searchInput');
  const cards = Array.from(document.querySelectorAll('.news-card'));
  const tagLinks = document.querySelectorAll('.tag-cloud a');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const shareMenu = document.getElementById('shareMenu');

  let activeCategory = '';
  let shareContext = null; // { title, url }

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function filterLabel(link) {
    return normalize(link.dataset.filter || link.textContent.trim());
  }

  function articleShareData(card) {
    const id = card.dataset.id || card.id?.replace('noticia-', '') || '';
    const title =
      card.querySelector('.card-title')?.textContent.trim() ||
      'Privacidad.news';
    const url = `${SITE_URL}#noticia-${id}`;
    return { title, url, text: `${title} — Privacidad.news` };
  }

  function clearAllFilters() {
    activeCategory = '';
    tagLinks.forEach(l => l.classList.remove('is-active'));
    if (input) input.value = '';
    applyFilters();
  }

  function applyFilters() {
    const query = normalize(input?.value.trim() || '');
    let visible = 0;

    cards.forEach(card => {
      const title = normalize(card.querySelector('.card-title')?.textContent);
      const excerpt = normalize(card.querySelector('.card-excerpt')?.textContent);
      const tags = normalize(card.dataset.tags);
      const category = normalize(card.querySelector('.category')?.textContent);

      const matchesQuery =
        !query ||
        title.includes(query) ||
        excerpt.includes(query) ||
        tags.includes(query) ||
        category.includes(query);

      const matchesCategory =
        !activeCategory ||
        category.includes(activeCategory) ||
        tags.includes(activeCategory);

      const show = matchesQuery && matchesCategory;
      card.hidden = !show;
      if (show) visible++;
    });

    if (emptyState) emptyState.hidden = visible > 0;
    if (feedCount) {
      feedCount.textContent = visible === 1 ? '1 noticia' : `${visible} noticias`;
    }
    if (activeFilterEl) {
      if (activeCategory) {
        activeFilterEl.hidden = false;
        const label = activeFilterEl.querySelector('span');
        if (label) label.textContent = activeCategory;
      } else {
        activeFilterEl.hidden = true;
      }
    }
  }

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
        tagLinks.forEach(l => {
          l.classList.toggle('is-active', filterLabel(l) === label);
        });
      }
      applyFilters();
    });
  });

  document.querySelectorAll('#clearFilter, [data-clear-filters]').forEach(btn => {
    btn.addEventListener('click', clearAllFilters);
  });

  document.querySelectorAll('.news-card .category').forEach(badge => {
    badge.addEventListener('click', () => {
      const label = normalize(badge.textContent.trim());
      activeCategory = label;
      tagLinks.forEach(l => {
        l.classList.toggle('is-active', filterLabel(l) === label);
      });
      applyFilters();
    });
  });

  applyFilters();

  // ——— Modal ———
  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;

    const data = articleShareData(card);
    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));

    // Barra de compartir dentro del artículo
    const bar = document.createElement('div');
    bar.className = 'article-share-bar';
    bar.innerHTML = `
      <span class="label">Compartir</span>
      <button type="button" class="share-btn" data-share-modal>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        Compartir
      </button>
      <button type="button" class="share-btn" data-copy-link>Copiar enlace</button>
    `;
    modalContent.appendChild(bar);

    bar.querySelector('[data-share-modal]')?.addEventListener('click', e => {
      openShareMenu(e.currentTarget, data);
    });
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
    if (location.hash.startsWith('#noticia-')) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  document.querySelectorAll('.open-article').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const card = el.closest('.news-card');
      if (card) openModal(card);
    });
  });

  modal?.addEventListener('click', e => {
    if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (shareMenu && !shareMenu.hidden) hideShareMenu();
      else if (modal && !modal.hidden) closeModal();
    }
  });

  // Abrir por hash al cargar
  if (location.hash.startsWith('#noticia-')) {
    const id = location.hash.replace('#noticia-', '');
    const card = document.querySelector(`.news-card[data-id="${id}"]`);
    if (card) openModal(card);
  }

  // ——— Compartir ———
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
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
    if (xLink) {
      xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
    }
    if (tgLink) {
      tgLink.href = `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
    }
  }

  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest('.news-card');
      if (!card) return;
      openShareMenu(btn, articleShareData(card));
    });
  });

  shareMenu?.addEventListener('click', async e => {
    const action = e.target.closest('[data-share-action]')?.dataset.shareAction;
    if (!action || !shareContext) return;

    if (action === 'native') {
      e.preventDefault();
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareContext.title,
            text: shareContext.text,
            url: shareContext.url
          });
        } catch { /* cancelado */ }
      } else {
        await copyText(shareContext.url);
      }
      hideShareMenu();
    } else if (action === 'copy') {
      e.preventDefault();
      await copyText(shareContext.url);
      const btn = e.target.closest('[data-share-action]');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = prev; hideShareMenu(); }, 900);
      } else hideShareMenu();
    }
    // x / telegram: enlace nativo, no preventDefault
  });

  document.addEventListener('click', e => {
    if (!shareMenu || shareMenu.hidden) return;
    if (!shareMenu.contains(e.target) && !e.target.closest('[data-share], [data-share-modal]')) {
      hideShareMenu();
    }
  });

  // ——— Donaciones copiar ———
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.donation-item')?.querySelector('code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent.trim());
        const original = btn.textContent;
        btn.textContent = 'Copiado';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1600);
      } catch { /* ignore */ }
    });
  });
});
