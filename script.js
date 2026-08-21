// Privacidad.news — búsqueda, filtros, modal y utilidades

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  const cards = Array.from(document.querySelectorAll('.news-card'));
  const tagLinks = document.querySelectorAll('.tag-cloud a');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');
  const emptyState = document.getElementById('emptyState');
  const feedCount = document.getElementById('feedCount');
  const activeFilterEl = document.getElementById('activeFilter');
  const clearFilterBtn = document.getElementById('clearFilter');

  let activeCategory = '';

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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

    if (emptyState) {
      emptyState.hidden = visible > 0;
    }
    if (feedCount) {
      feedCount.textContent =
        visible === 1 ? '1 noticia' : `${visible} noticias`;
    }
    if (activeFilterEl) {
      if (activeCategory) {
        activeFilterEl.hidden = false;
        activeFilterEl.querySelector('span').textContent = activeCategory;
      } else {
        activeFilterEl.hidden = true;
      }
    }
  }

  // ——— Búsqueda ———
  input?.addEventListener('input', applyFilters);

  // ——— Categorías ———
  tagLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const label = normalize(link.textContent.trim());

      if (activeCategory === label) {
        activeCategory = '';
        tagLinks.forEach(l => l.classList.remove('is-active'));
      } else {
        activeCategory = label;
        tagLinks.forEach(l => {
          l.classList.toggle('is-active', normalize(l.textContent.trim()) === label);
        });
      }
      applyFilters();
    });
  });

  clearFilterBtn?.addEventListener('click', () => {
    activeCategory = '';
    tagLinks.forEach(l => l.classList.remove('is-active'));
    if (input) input.value = '';
    applyFilters();
  });

  // Clic en badge de categoría de la tarjeta
  document.querySelectorAll('.news-card .category').forEach(badge => {
    badge.style.cursor = 'pointer';
    badge.title = 'Filtrar por esta categoría';
    badge.addEventListener('click', () => {
      const label = normalize(badge.textContent.trim());
      activeCategory = label;
      tagLinks.forEach(l => {
        l.classList.toggle('is-active', normalize(l.textContent.trim()) === label);
      });
      applyFilters();
      document.querySelector('.sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  applyFilters();

  // ——— Modal de lectura ———
  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;

    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.modal-close')?.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
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
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  // ——— Copiar direcciones de donación ———
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = btn.closest('.donation-item')?.querySelector('code');
      if (!code) return;
      const text = code.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copiado';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1600);
      } catch {
        // fallback silencioso
      }
    });
  });
});
