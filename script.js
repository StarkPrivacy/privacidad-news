// Búsqueda simple en el prototipo (filtra por título y extracto)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  const cards = document.querySelectorAll('.news-card');

  if (!input) return;

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
});
