// Privacidad.news — búsqueda + modal de lectura

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  const cards = document.querySelectorAll('.news-card');
  const modal = document.getElementById('articleModal');
  const modalContent = document.getElementById('modalContent');

  // ——— Búsqueda ———
  if (input) {
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      cards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        const excerpt = card.querySelector('.card-excerpt')?.textContent.toLowerCase() || '';
        const tags = card.dataset.tags || '';
        const matches = !query || title.includes(query) || excerpt.includes(query) || tags.includes(query);
        card.style.display = matches ? '' : 'none';
      });
    });
  }

  // ——— Modal de lectura ———
  function openModal(card) {
    const template = card.querySelector('template.full-content');
    if (!template || !modal || !modalContent) return;

    modalContent.innerHTML = '';
    modalContent.appendChild(template.content.cloneNode(true));

    modal.hidden = false;
    document.body.classList.add('modal-open');

    // Enfocar el panel para accesibilidad
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
  }

  // Abrir al hacer clic en título o botón
  document.querySelectorAll('.open-article').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const card = el.closest('.news-card');
      if (card) openModal(card);
    });
  });

  // Cerrar
  modal?.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) {
      closeModal();
    }
  });
});
